import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rename, rm, utimes, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify from "fastify";
import {
  WATER_MARGIN_M, readGva, readRediamGml, readIcnf,
  validateBbox, expandBbox, pointsWithin,
} from "../dist/water.js";
import { registerWaterRoutes } from "../dist/water-routes.js";
import { prepareWater } from "../scripts/prepare-water.mjs";

function feature(properties, coordinates = [-0.5, 40]) {
  return { type: "Feature", properties, geometry: { type: "Point", coordinates } };
}

function collection(features, extra = {}) {
  return { type: "FeatureCollection", features, ...extra };
}

function gva(codigo, properties = {}, coordinates) {
  return feature({ codigo, ...properties }, coordinates);
}

function icnf(Codigo, properties = {}, coordinates = [-8, 39]) {
  return feature({ Codigo, Classe: "Aéreo", Operacionalidade: "Operacional", ...properties }, coordinates);
}

const rediam = `<?xml version="1.0" encoding="UTF-8"?>
<msGMLOutput xmlns:gml="http://www.opengis.net/gml">
  <puntos_agua_layer>
    <puntos_agua_feature>
      <gml:Point><gml:coordinates decimal="." cs="," ts=" ">-5.2,37.4 -5.2,37.4</gml:coordinates></gml:Point>
      <CODIGO>AN001</CODIGO><TIPO>Balsa &amp; depósito</TIPO>
    </puntos_agua_feature>
    <puntos_agua_feature>
      <gml:Point><gml:coordinates>-4.8,37.8</gml:coordinates></gml:Point>
      <CODIGO>AN002</CODIGO><TIPO><![CDATA[Depósito]]></TIPO>
    </puntos_agua_feature>
    <puntos_agua_feature>
      <gml:Point><gml:coordinates>-5.2,37.4</gml:coordinates></gml:Point>
      <CODIGO>AN001</CODIGO><TIPO>Balsa</TIPO>
    </puntos_agua_feature>
  </puntos_agua_layer>
</msGMLOutput>`;

test("GVA preserves names/types and maps Sí, No and unknown independently", () => {
  const points = readGva(collection([
    gva("V1", { etiqueta: "Bassa del Pi", tipo: "Depósito", helicop: "Sí", anfibios: "No" }),
    gva("V2", { etiqueta: "", helicop: "No", anfibios: "Sí" }),
    gva(3, { helicop: "Desconegut", anfibios: "" }),
    gva("V4", { helicop: true, anfibios: null }),
  ]));
  assert.deepEqual(points[0], {
    source: "GVA", id: "V1", name: "Bassa del Pi", lon: -0.5, lat: 40,
    type: "Depósito", helicopter: true, amphibious: false,
  });
  assert.deepEqual(points.map((p) => [p.name, p.helicopter, p.amphibious]), [
    ["Bassa del Pi", true, false], ["V2", false, true], ["3", null, null], ["V4", null, null],
  ]);
  assert.equal(points[1].type, null);
});

test("REDIAM reads two distinct GML features and deduplicates repeated CODIGO", () => {
  assert.deepEqual(readRediamGml(rediam), [
    { source: "REDIAM", id: "AN001", name: "AN001", lon: -5.2, lat: 37.4, type: "Balsa & depósito", helicopter: null, amphibious: null },
    { source: "REDIAM", id: "AN002", name: "AN002", lon: -4.8, lat: 37.8, type: "Depósito", helicopter: null, amphibious: null },
  ]);
  assert.deepEqual(readRediamGml('<msGMLOutput xmlns:gml="http://www.opengis.net/gml"/>'), []);
  const prefixed = rediam.replaceAll("<CODIGO>", "<ms:CODIGO>").replaceAll("</CODIGO>", "</ms:CODIGO>");
  assert.equal(readRediamGml(prefixed).length, 2);
});

test("ICNF keeps aerial/mixed points and excludes all four unavailable statuses", () => {
  const excluded = ["Ruptura", "Falta de água", "Em planeamento", "Em proposta"];
  const points = readIcnf(collection([
    icnf("P1", { Nome: "Barragem", Tipo: "Albufeira" }),
    icnf("P2", { Nome: " ", Classe: "Misto", Operacionalidade: null }),
    icnf("ground", { Classe: "Terrestre" }),
    icnf("unknown", { Classe: null }),
    ...excluded.map((Operacionalidade, i) => icnf(`excluded-${i}`, { Operacionalidade })),
  ]));
  assert.deepEqual(points, [
    { source: "ICNF", id: "P1", name: "Barragem", lon: -8, lat: 39, type: "Albufeira", helicopter: true, amphibious: null },
    { source: "ICNF", id: "P2", name: "P2", lon: -8, lat: 39, type: null, helicopter: true, amphibious: null },
  ]);
});

test("readers reject upstream errors and malformed included records", () => {
  for (const reader of [readGva, readIcnf]) {
    assert.throws(() => reader({ error: { message: "service unavailable" } }));
    assert.throws(() => reader(collection([feature({ Classe: "Aéreo" })])));
  }
  for (const coords of [[NaN, 40], [-0.5, Infinity], [181, 40], [0, -91], [null, 40], ["0", 40]])
    assert.throws(() => readGva(collection([gva("bad", {}, coords)])));
  assert.throws(() => readRediamGml("<ServiceExceptionReport>error</ServiceExceptionReport>"));
  assert.throws(() => readRediamGml(rediam.replace("-5.2,37.4", "invalid")));
  assert.throws(() => readRediamGml(rediam.replace("</puntos_agua_feature>", "")));
  assert.throws(() => readRediamGml(rediam.replace("</msGMLOutput>", "")));
});

const invalidBboxes = [
  undefined, "", " ", [], ["0,39,1,40", "0,39,1,40"],
  "0,39,1", "0,39,1,40,41", ",39,1,40", "0, ,1,40",
  "NaN,39,1,40", "0,39,Infinity,40", "0,39,no,40",
  "1,39,0,40", "0,40,1,39", "0,39,0,40", "0,39,1,39",
  "-181,39,-180,40", "180,39,181,40", "0,-91,1,-90", "0,90,1,91",
  "0,39,2.01,40", "0,39,1,41.01",
];

test("bbox validates finite ordered WGS84 coordinates and the inclusive 2° limit", () => {
  for (const value of invalidBboxes) assert.throws(() => validateBbox(value), /bbox/);
  for (const value of ["-1,39,1,41", "-180,-90,-178,-88", "178,88,180,90", " 0 , 39 , 1 , 40 "])
    assert.deepEqual(validateBbox(value), value.split(",").map(Number));
});

test("30 km expansion uses the central latitude, about 0.27° lat and 0.35° lon at 40° N", () => {
  assert.equal(WATER_MARGIN_M, 30000);
  const bbox = [-1, 39.5, 0, 40.5];
  const [w, s, e, n] = expandBbox(bbox, WATER_MARGIN_M);
  assert.ok(Math.abs((bbox[1] - s) - 0.2695) < 0.0001);
  assert.ok(Math.abs((bbox[0] - w) - 0.3518) < 0.0001);
  assert.ok(Math.abs(n - bbox[3] - (bbox[1] - s)) < 1e-12);
  assert.ok(Math.abs(e - bbox[2] - (bbox[0] - w)) < 1e-12);
  assert.deepEqual(expandBbox(bbox, 0), bbox);
  for (const margin of [-1, NaN, Infinity]) assert.throws(() => expandBbox(bbox, margin));
});

test("filter includes all edges and corners and excludes points just beyond", () => {
  const bbox = expandBbox([-1, 39.5, 0, 40.5], WATER_MARGIN_M);
  const [w, s, e, n] = bbox;
  const xy = [[w, s], [w, n], [e, s], [e, n], [w, 40], [e, 40], [-0.5, s], [-0.5, n],
    [w - 1e-7, 40], [e + 1e-7, 40], [-0.5, s - 1e-7], [-0.5, n + 1e-7]];
  const points = readGva(collection(xy.map((coords, i) => gva(String(i), {}, coords))));
  assert.deepEqual(pointsWithin(points, bbox), points.slice(0, 8));
  assert.equal(points.length, 12);
  const crossing = readGva(collection([gva("date-line", {}, [-179.9, 40])]));
  assert.equal(pointsWithin(crossing, expandBbox([179.7, 39.5, 180, 40.5], WATER_MARGIN_M)).length, 1);
  assert.equal(expandBbox([0, 89, 1, 90], WATER_MARGIN_M)[3], 90);
});

test("HTTP returns 400/503/200, filters the margin and reloads an atomically replaced file", async (t) => {
  const dataDir = await mkdtemp(join(tmpdir(), "water-route-"));
  const app = Fastify();
  t.after(async () => { await app.close(); await rm(dataDir, { recursive: true, force: true }); });
  registerWaterRoutes(app, { dataDir });
  const url = "/api/water-points?bbox=-1,39.5,0,40.5";
  for (const value of invalidBboxes.filter((v) => typeof v === "string")) {
    const response = await app.inject(`/api/water-points?bbox=${encodeURIComponent(value)}`);
    assert.equal(response.statusCode, 400);
    assert.match(response.json().error, /bbox/);
  }
  for (const invalidUrl of ["/api/water-points", `${url}&bbox=-1,39.5,0,40.5`])
    assert.equal((await app.inject(invalidUrl)).statusCode, 400);
  const missing = await app.inject(url);
  assert.equal(missing.statusCode, 503);
  assert.deepEqual(missing.json(), { error: "Els punts d'aigua no estan preparats." });
  const points = readGva(collection([
    gva("inside", {}, [-0.5, 40]), gva("margin", {}, [0.3, 40]), gva("outside", {}, [0.4, 40]),
  ]));
  const data = {
    preparedAt: "2026-11-16T12:00:00.000Z",
    sources: [{ id: "GVA", name: "GVA", url: "https://terramapas.icv.gva.es/0509_PlanificacionPPIFDF", licence: "CC BY", count: 3 }],
    points,
  };
  const path = join(dataDir, "points.json");
  await writeFile(path, JSON.stringify(data));
  for (const response of await Promise.all([app.inject(url), app.inject(url)])) {
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["cache-control"], "public, max-age=3600");
    assert.deepEqual(response.json(), { ...data, marginM: 30000, points: points.slice(0, 2) });
  }
  const empty = await app.inject("/api/water-points?bbox=2,40,2.1,40.1");
  assert.equal(empty.statusCode, 200);
  assert.deepEqual(empty.json().points, []);
  assert.equal(empty.json().sources[0].count, 3);
  const updated = { ...data, preparedAt: "2026-11-17T12:00:00.000Z", points: [points[1]] };
  await writeFile(`${path}.tmp`, JSON.stringify(updated));
  await utimes(`${path}.tmp`, new Date("2026-11-17"), new Date("2026-11-17"));
  await rename(`${path}.tmp`, path);
  assert.deepEqual((await app.inject(url)).json(), { ...updated, marginM: 30000 });
  await writeFile(path, "broken json");
  assert.equal((await app.inject(url)).statusCode, 503);
  await writeFile(path, JSON.stringify(data));
  assert.equal((await app.inject(url)).statusCode, 200);
  await rm(path);
  assert.equal((await app.inject(url)).statusCode, 503);
});

function fixtureFetch({ total = true, fail, repeated = false } = {}) {
  const calls = [];
  const fetchImpl = async (input) => {
    const url = new URL(input);
    calls.push(url);
    if (url.hostname === fail) return new Response("failure", { status: 502 });
    if (url.hostname === "terramapas.icv.gva.es") {
      const offset = Number(url.searchParams.get("startIndex"));
      assert.equal(url.searchParams.get("count"), "2000");
      const rows = [gva("V1"), gva("V2")];
      const extra = total ? { numberMatched: 2 } : {};
      return Response.json(collection(rows.slice(repeated ? 0 : offset, (repeated ? 0 : offset) + 1), extra));
    }
    if (url.hostname === "www.juntadeandalucia.es") {
      assert.equal(url.searchParams.get("feature_count"), "100000");
      assert.equal(url.searchParams.get("info_format"), "application/vnd.ogc.gml");
      return new Response(rediam);
    }
    assert.equal(url.hostname, "sigservices.icnf.pt");
    assert.equal(url.searchParams.get("where"), "Classe IN ('Aéreo','Misto')");
    assert.equal(url.searchParams.get("outFields"), "ID,Codigo,Nome,Tipo,Classe,Operacionalidade");
    assert.equal(url.searchParams.get("outSR"), "4326");
    assert.equal(url.searchParams.get("f"), "geojson");
    assert.equal(url.searchParams.get("resultRecordCount"), "2000");
    const offset = Number(url.searchParams.get("resultOffset"));
    const rows = [icnf("P1"), icnf("excluded", { Operacionalidade: "Ruptura" }), icnf("P2", { Classe: "Misto" })];
    return Response.json(collection(rows.slice(offset, offset + 1)));
  };
  return { calls, fetchImpl };
}

test("preparation paginates capped pages, covers REDIAM, deduplicates and writes complete metadata", async (t) => {
  const dataDir = await mkdtemp(join(tmpdir(), "water-prepare-"));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  for (const total of [true, false]) {
    const { calls, fetchImpl } = fixtureFetch({ total });
    const data = await prepareWater({ dataDir, fetchImpl });
    assert.deepEqual(JSON.parse(await readFile(join(dataDir, "points.json"), "utf8")), data);
    assert.ok(Number.isFinite(Date.parse(data.preparedAt)));
    assert.equal(data.points.length, 6);
    assert.deepEqual(data.sources.map((s) => [s.id, s.licence, s.count]), [
      ["GVA", "CC BY", 2], ["REDIAM", "CC BY 4.0", 2], ["ICNF", "No publicada", 2],
    ]);
    assert.ok(data.sources.every((s) => s.name && s.url.startsWith("https://")));
    const tiles = calls.filter((u) => u.hostname === "www.juntadeandalucia.es")
      .map((u) => u.searchParams.get("bbox").split(",").map(Number));
    assert.equal(tiles.length, 18);
    assert.deepEqual(tiles[0], [-7.6, 35.9, -6.6, 36.9]);
    assert.deepEqual(tiles.at(-1), [-2.6, 37.9, -1.6, 38.8]);
    assert.equal(new Set(tiles.map((tile) => tile.join(","))).size, 18);
    assert.deepEqual(calls.filter((u) => u.hostname === "terramapas.icv.gva.es").map((u) => u.searchParams.get("startIndex")), total ? ["0", "1"] : ["0", "1", "2"]);
    assert.deepEqual(calls.filter((u) => u.hostname === "sigservices.icnf.pt").map((u) => u.searchParams.get("resultOffset")), ["0", "1", "2", "3"]);
    assert.deepEqual(await readdir(dataDir), ["points.json"]);
  }
});

test("any failed source or non-progressing pagination leaves the previous file intact", async (t) => {
  const dataDir = await mkdtemp(join(tmpdir(), "water-failure-"));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  const path = join(dataDir, "points.json");
  const previous = '{"previous":"preserve these exact bytes"}';
  await writeFile(path, previous);
  for (const [id, fail] of [
    ["GVA", "terramapas.icv.gva.es"], ["REDIAM", "www.juntadeandalucia.es"], ["ICNF", "sigservices.icnf.pt"],
  ]) {
    await assert.rejects(prepareWater({ dataDir, ...fixtureFetch({ fail }) }), new RegExp(`${id}:.*HTTP 502`));
    assert.equal(await readFile(path, "utf8"), previous);
  }
  await assert.rejects(prepareWater({ dataDir, ...fixtureFetch({ total: false, repeated: true }) }), /GVA:.*repeteix/);
  assert.equal(await readFile(path, "utf8"), previous);
  assert.deepEqual(await readdir(dataDir), ["points.json"]);
});

test("ICNF keys points by the service ID, since a code can repeat", () => {
  const feature = (ID, lon) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [lon, 40] },
    properties: { ID, Codigo: "20388", Nome: null, Tipo: "Lago", Classe: "Aéreo", Operacionalidade: "Operacional" },
  });
  const points = readIcnf({ type: "FeatureCollection", features: [feature(1, -8), feature(2, -8.1)] });
  assert.deepEqual(points.map((p) => [p.id, p.name]), [["1", "20388"], ["2", "20388"]]);
});
