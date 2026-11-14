/** Offline Anderson 13 importer. See docs/combustibles/IMPLEMENTACION.md. */
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  renameSync,
  unlinkSync,
} from "node:fs";
import { resolve, join, dirname, extname, basename } from "node:path";
import { createHash } from "node:crypto";
import { open } from "shapefile";
import proj4 from "proj4";
import { unzipSync } from "fflate";
import {
  paintPolygon,
  tileKeys,
  tileBounds,
  TILE_SIZE,
  UNKNOWN,
} from "../dist/fuel-grid.js";

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const i = arg.indexOf("=");
    return [arg.slice(0, i).replace(/^--/, ""), arg.slice(i + 1)];
  }),
);
const dataDir = resolve(process.env.FUEL_DATA_DIR ?? "data/fuels");
let input = args.input;
if (args.region) {
  // Names are the MITECO download IDs; explicit allowlist prevents arbitrary remote fetches.
  const regions = [
    "illesbalears",
    "catalunia",
    "andalucia",
    "aragon",
    "asturias",
    "canarias",
    "cantabria",
    "castilla_la_mancha",
    "castilla_y_leon",
    "extremadura",
    "galicia",
    "larioja",
    "madrid",
    "murcia",
    "navarra",
    "paisvasco",
    "comunidadvalenciana",
  ];
  if (!regions.includes(args.region))
    throw new Error(`Unknown MFE region: ${args.region}`);
  const url = `https://gis.miteco.gob.es/descargas/app/DescargaFichero?f=mfe_${args.region}.zip`;
  const rawDir = join(dataDir, "raw", args.region);
  mkdirSync(rawDir, { recursive: true });
  const archive = join(rawDir, "source.zip");
  if (!existsSync(archive)) {
    console.log("Downloading", url);
    const response = await fetch(url, { signal: AbortSignal.timeout(600000) });
    if (!response.ok) throw new Error(`MITECO ${response.status}`);
    // Regional archives can be large. Streaming avoids holding the download in memory.
    const { pipeline } = await import("node:stream/promises");
    const { Readable } = await import("node:stream");
    const { createWriteStream } = await import("node:fs");
    await pipeline(
      Readable.fromWeb(response.body),
      createWriteStream(archive + ".tmp"),
    );
    if (
      !readFileSync(archive + ".tmp")
        .subarray(0, 2)
        .equals(Buffer.from("PK"))
    ) {
      unlinkSync(archive + ".tmp");
      throw new Error(
        "MITECO returned a web form instead of ZIP (may require CAPTCHA). Download through its site, then use --input=<extracted .shp>. No dataset published.",
      );
    }
    renameSync(archive + ".tmp", archive);
  }
  if (!readFileSync(archive).subarray(0, 2).equals(Buffer.from("PK")))
    throw new Error(
      "Cached source is not a ZIP. Use an extracted official Shapefile with --input.",
    );
  const files = unzipSync(readFileSync(archive), {
    filter: (f) => /\.(shp|dbf|prj|cpg)$/i.test(f.name),
  });
  // Extract only named GIS components into our own flat directory, not archive paths.
  const shapes = [];
  for (const [name, bytes] of Object.entries(files)) {
    const safe = basename(name.replaceAll("\\", "/"));
    const target = join(rawDir, safe);
    if (existsSync(target) && !readFileSync(target).equals(Buffer.from(bytes)))
      throw new Error(`Conflicting archive filenames: ${safe}`);
    writeFileSync(target, bytes);
    if (/\.shp$/i.test(safe)) shapes.push(target);
  }
  if (shapes.length !== 1)
    throw new Error(
      `Archive contains ${shapes.length} shapefiles: rerun with --input=<one .shp> and source metadata`,
    );
  input = shapes[0];
  args.id ??= `mfe-${args.region}`;
  args.label ??= `MFE25 · ${args.region}`;
  args.url ??= url;
  args.attribution ??=
    "© Ministerio para la Transición Ecológica y el Reto Demográfico";
}
if (
  !input ||
  !/^[a-z0-9-]+$/.test(args.id ?? "") ||
  !args.url ||
  !args.date ||
  !args.label ||
  !args.attribution
) {
  throw new Error(
    "Required: --input=file.shp|geojson (or --region=illesbalears) --id=slug --label=name --url=source --date=reference-date --attribution=credit. Optional --crs=EPSG:25831 --field=MODCOMB",
  );
}
const folder = join(dataDir, "datasets", args.id);
// A completed dataset is immutable. Use a new ID for an updated edition.
if (existsSync(join(folder, "manifest.json")))
  throw new Error("Dataset already prepared. Use a new versioned --id.");
mkdirSync(folder, { recursive: true });
const buffers = new Map(),
  keys = new Set();
function tile(x, y) {
  const key = `${x}_${y}`;
  let value = buffers.get(key);
  if (!value) {
    if (buffers.size >= 32) {
      const [oldKey, oldValue] = buffers.entries().next().value;
      writeFileSync(join(folder, `${oldKey}.bin`), oldValue);
      buffers.delete(oldKey);
    }
    // Only tiles written in THIS run may be reused (a failed earlier run is ignored).
    value = keys.has(key)
      ? new Uint8Array(readFileSync(join(folder, `${key}.bin`)))
      : new Uint8Array(TILE_SIZE * TILE_SIZE).fill(UNKNOWN);
    buffers.set(key, value);
    keys.add(key);
  }
  return value;
}
let projection = args.crs;
if (!projection && extname(input).toLowerCase() === ".shp") {
  const prj = input.replace(/\.shp$/i, ".prj");
  if (!existsSync(prj))
    throw new Error("Shapefile needs .prj or explicit --crs.");
  projection = readFileSync(prj, "utf8");
}
for (const zone of [28, 29, 30, 31])
  proj4.defs(
    `EPSG:258${zone}`,
    `+proj=utm +zone=${zone} +ellps=GRS80 +units=m +no_defs`,
  );
const convert = proj4(projection ?? "EPSG:4326", "EPSG:4326");
let features = 0,
  assigned = 0,
  missing = 0;
function add(feature) {
  features++;
  const properties = feature.properties ?? {};
  const field = Object.keys(properties).find(
    (k) => k.toLowerCase() === (args.field ?? "MODCOMB").toLowerCase(),
  );
  if (!field)
    throw new Error(
      `Missing fuel field in feature ${features}. Available: ${Object.keys(properties).join(", ")}`,
    );
  const model = Number(properties[field]);
  if (!Number.isInteger(model) || model < 1 || model > 13) {
    missing++;
    return;
  }
  const geometry = feature.geometry;
  if (!geometry || !["Polygon", "MultiPolygon"].includes(geometry.type)) return;
  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  for (const raw of polygons) {
    const polygon = raw.map((ring) =>
      ring.map((p) => convert.forward([p[0], p[1]])),
    );
    let w = Infinity,
      s = Infinity,
      e = -Infinity,
      n = -Infinity;
    for (const ring of polygon)
      for (const [x, y] of ring) {
        if (
          !Number.isFinite(x) ||
          !Number.isFinite(y) ||
          x < -32 ||
          x > 5 ||
          y < 27 ||
          y > 44.5
        )
          throw new Error("Geometry outside Spain/Portugal: verify CRS");
        w = Math.min(w, x);
        s = Math.min(s, y);
        e = Math.max(e, x);
        n = Math.max(n, y);
      }
    for (const [x, y] of tileKeys([w, s, e, n]))
      paintPolygon(polygon, tileBounds(x, y), TILE_SIZE, tile(x, y), model);
  }
  assigned++;
  if (features % 10000 === 0)
    console.log({ features, assigned, tiles: keys.size });
}
if (extname(input).toLowerCase() === ".shp") {
  const reader = await open(input, undefined, {
    encoding: args.encoding ?? "windows-1252",
  });
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    add(next.value);
  }
} else {
  const collection = JSON.parse(readFileSync(input, "utf8"));
  if (collection.type !== "FeatureCollection")
    throw new Error("Expected a GeoJSON FeatureCollection");
  for (const feature of collection.features) add(feature);
}
for (const [key, value] of buffers)
  writeFileSync(join(folder, `${key}.bin`), value);
if (!assigned)
  throw new Error("No valid Anderson models; dataset not published.");
const manifest = {
  id: args.id,
  label: args.label,
  sourceUrl: args.url,
  attribution: args.attribution,
  sourceDate: args.date,
  preparedAt: new Date().toISOString(),
  priority: Number(args.priority ?? 10),
  classification: "Anderson13",
  unknown: 255,
  sourceZero: "unknown",
  tileSize: TILE_SIZE,
  tileDegrees: 0.125,
  sampling: "pixel-centre, even-odd polygons",
  features,
  assigned,
  missing,
  tiles: [...keys].sort(),
  inputSha256: createHash("sha256").update(readFileSync(input)).digest("hex"),
};
writeFileSync(
  join(folder, "manifest.json.tmp"),
  JSON.stringify(manifest, null, 2),
);
renameSync(join(folder, "manifest.json.tmp"), join(folder, "manifest.json"));
console.log("Prepared", manifest.id, {
  features,
  assigned,
  missing,
  tiles: keys.size,
});
