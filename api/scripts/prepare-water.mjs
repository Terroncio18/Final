import { mkdir, writeFile, rename, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { readGva, readRediamGml, readIcnf } from "../dist/water.js";

const GVA_URL = "https://terramapas.icv.gva.es/0509_PlanificacionPPIFDF?service=WFS&version=2.0.0&request=GetFeature&typenames=Hidrica.PuntosAgua&srsName=EPSG:4326&outputformat=application/json;%20subtype=geojson";
const REDIAM_URL = "https://www.juntadeandalucia.es/medioambiente/mapwms/REDIAM_puntos_agua?service=WMS&version=1.1.1&request=GetFeatureInfo&layers=puntos_agua&query_layers=puntos_agua&styles=&srs=EPSG:4326&width=3&height=3&x=1&y=1&info_format=application/vnd.ogc.gml&feature_count=100000";
const ICNF_URL = "https://sigservices.icnf.pt/server/rest/services/BDG/Pontos_agua/MapServer/0/query";
const PAGE_SIZE = 2000;

const SOURCES = [
  { id: "GVA", name: "Generalitat Valenciana · Puntos de agua", url: GVA_URL, licence: "CC BY" },
  { id: "REDIAM", name: "Junta de Andalucía · REDIAM · Puntos de agua", url: REDIAM_URL, licence: "CC BY 4.0" },
  { id: "ICNF", name: "Instituto da Conservação da Natureza e das Florestas · Pontos de água", url: ICNF_URL, licence: "No publicada" },
];

async function download(fetchImpl, url, format) {
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`El servei ha retornat HTTP ${response.status}.`);
  return format === "json" ? response.json() : response.text();
}

function addPoints(target, points) {
  for (const point of points) if (!target.has(point.id)) target.set(point.id, point);
}

async function pagedPoints(fetchImpl, source) {
  const points = new Map();
  const pages = new Set();
  let offset = 0;
  let expected;
  for (let page = 0; page < 10000; page++) {
    // URLs and query fields are fixed here; command-line input cannot select a remote service.
    const url = new URL(source === "GVA" ? GVA_URL : ICNF_URL);
    if (source === "GVA") {
      url.searchParams.set("count", String(PAGE_SIZE));
      url.searchParams.set("startIndex", String(offset));
    } else {
      url.searchParams.set("where", "Classe IN ('Aéreo','Misto')");
      url.searchParams.set("outFields", "ID,Codigo,Nome,Tipo,Classe,Operacionalidade");
      url.searchParams.set("outSR", "4326");
      url.searchParams.set("f", "geojson");
      url.searchParams.set("resultOffset", String(offset));
      url.searchParams.set("resultRecordCount", String(PAGE_SIZE));
      // Stable ordering prevents records moving between pages on an unchanged dataset.
      url.searchParams.set("orderByFields", "ID ASC");
    }
    const json = await download(fetchImpl, url, "json");
    const parsed = source === "GVA" ? readGva(json) : readIcnf(json);
    if (source === "GVA") {
      const total = json.numberMatched ?? json.totalFeatures;
      if (total !== undefined && total !== "unknown") {
        const number = Number(total);
        if (!Number.isSafeInteger(number) || number < 0)
          throw new Error("El recompte de la font no és vàlid.");
        if (expected !== undefined && expected !== number)
          throw new Error("El recompte de la font ha canviat durant la baixada.");
        expected = number;
      }
    }
    const count = json.features.length;
    if (!count) {
      if ((expected !== undefined && offset < expected) || json.exceededTransferLimit === true)
        throw new Error("La font ha retornat una pàgina buida abans d'acabar.");
      return [...points.values()];
    }
    // A server ignoring offsets must fail instead of looping or publishing only its first page.
    const signature = JSON.stringify(json.features);
    if (pages.has(signature)) throw new Error("La font repeteix una pàgina i no permet completar la baixada.");
    pages.add(signature);
    addPoints(points, parsed);
    offset += count;
    if (expected !== undefined && offset >= expected) {
      if (offset !== expected || points.size !== expected)
        throw new Error("Els punts baixats no coincideixen amb el recompte de la font.");
      return [...points.values()];
    }
    // Some services impose a smaller page size than requested; a short page alone is not the end.
    if (source === "ICNF" && json.exceededTransferLimit === false)
      return [...points.values()];
  }
  throw new Error("S'ha superat el límit de pàgines de la font.");
}

async function rediamPoints(fetchImpl) {
  const points = new Map();
  // Integer steps avoid floating-point drift leaving a gap on the coverage boundary.
  for (let x = 0; x < 6; x++) {
    for (let y = 0; y < 3; y++) {
      const w = (-76 + x * 10) / 10;
      const s = (359 + y * 10) / 10;
      const e = Math.min(-1.6, (-66 + x * 10) / 10);
      const n = Math.min(38.8, (369 + y * 10) / 10);
      const url = new URL(REDIAM_URL);
      url.searchParams.set("bbox", [w, s, e, n].join(","));
      addPoints(points, readRediamGml(await download(fetchImpl, url, "text")));
    }
  }
  return [...points.values()];
}

export async function prepareWater({
  dataDir = resolve(process.env.WATER_DATA_DIR ?? "data/water"),
  fetchImpl = fetch,
} = {}) {
  const points = [];
  const sources = [];
  for (const source of SOURCES) {
    try {
      const found = source.id === "REDIAM"
        ? await rediamPoints(fetchImpl)
        : await pagedPoints(fetchImpl, source.id);
      if (!found.length) throw new Error("No s'ha obtingut cap punt d'aigua vàlid.");
      points.push(...found);
      sources.push({ ...source, count: found.length });
    } catch (error) {
      throw new Error(`${source.id}: ${error.message}`, { cause: error });
    }
  }
  const data = { preparedAt: new Date().toISOString(), sources, points };
  await mkdir(dataDir, { recursive: true });
  const path = join(dataDir, "points.json");
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    // Only a complete run can replace the previous dataset; unique temp names also isolate concurrent runs.
    await writeFile(temporary, JSON.stringify(data), { encoding: "utf8", flag: "wx" });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const data = await prepareWater();
    console.log("Punts d'aigua preparats:", Object.fromEntries(data.sources.map((s) => [s.id, s.count])));
  } catch (error) {
    console.error("No s'han pogut preparar els punts d'aigua:", error.message);
    process.exitCode = 1;
  }
}
