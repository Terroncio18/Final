/**
 * Prepare the place names the simulation screen writes over the terrain.
 *
 * Source: OpenStreetMap through the Overpass API, under the ODbL. The
 * administrative files (§2.25) carry polygons and no settlements: the centre
 * of Sóller's territory is a mountainside, not the town, so a label placed at
 * a municipality's centroid names the right place in the wrong spot.
 *
 * What is kept, measured on a domain-sized square of the Serra de Tramuntana:
 *
 *   place=city|town|village          19 in 30 x 30 km   kept
 *   + hamlet, suburb, locality    1.250 in 30 x 30 km   left out, it is noise
 *   natural=peak with name and ele  357 in 30 x 30 km   kept, the client caps them
 *
 * A peak is not decoration on a fire map: a named ridge is where a fire stops
 * running, and its height is what says whether the domain has one.
 *
 * One file per province, like the municipalities, and **by bounding box with a
 * margin rather than by what falls strictly inside**: the domain is 30,7 km of
 * side and crosses province borders all the time, so a file cut at the border
 * would leave half of a domain's labels out. A place near the line lands in
 * both files, which costs a few kilobytes and is never wrong on screen.
 *
 * Run:  npm run data:places            every province
 *       npm run data:places ES532      only these
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROVINCES = resolve(HERE, '../public/data/provinces.geojson');
const CACHE = resolve(HERE, '.cache');
const OUTPUT = resolve(HERE, '../public/data/places');

const OVERPASS = 'https://overpass-api.de/api/interpreter';

/** Overpass asks for a way to be reached; it gets a name and no address. */
const AGENT = 'IgnisLab/0.1 (TFG UOC; preparació de topònims)';

/**
 * Degrees added to each province's extent, about 20 km.
 *
 * Half a domain, so a point chosen on the border still has names on both
 * sides of it.
 */
const MARGIN = 0.2;

/** Five decimals, about a metre: the same precision the URL uses for a point. */
const DECIMALS = 5;

/** Collision order: a city outlives a village when the two overlap. */
const RANK = { city: 0, town: 1, village: 2, peak: 3 };

/**
 * The highest peaks kept per province, and the rest dropped.
 *
 * Every named bump is a `natural=peak` in OSM: Lleida answers with 7.833 of
 * them and the file goes past a megabyte —three times the biggest municipality
 * file— for labels a screen can never show. A domain fits a dozen; six hundred
 * candidates per province leave the client plenty wherever the point lands,
 * and it chooses by height.
 */
const PEAKS_KEPT = 600;

/** Between queries. Overpass is a free service and this is a one-off job. */
const PAUSE_MS = 1500;

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

function extentOf(geometry) {
  let west = 180;
  let south = 90;
  let east = -180;
  let north = -90;

  const polygons = geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];
  for (const polygon of polygons) {
    for (const [lon, lat] of polygon[0]) {
      if (lon < west) west = lon;
      if (lon > east) east = lon;
      if (lat < south) south = lat;
      if (lat > north) north = lat;
    }
  }

  return [west - MARGIN, south - MARGIN, east + MARGIN, north + MARGIN];
}

function query([west, south, east, north]) {
  const box = `${south},${west},${north},${east}`;
  return `[out:json][timeout:180];
(
  node["place"~"^(city|town|village)$"]["name"](${box});
  node["natural"="peak"]["name"]["ele"](${box});
);
out body;`;
}

/**
 * One province's answer, from the cache if it is there.
 *
 * Cached because the script is run again whenever the selection changes and
 * the answer for a province that has not moved is the same answer. The cache
 * never reaches the repository; what is committed is the output.
 */
async function ask(id, extent) {
  const path = resolve(CACHE, `places-${id}.json`);
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    // Not cached yet, which is the normal path the first time.
  }

  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(OVERPASS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': AGENT },
        body: new URLSearchParams({ data: query(extent) }),
      });
      if (!response.ok) throw new Error(`Overpass ha respost ${response.status}`);
      const text = await response.text();
      const parsed = JSON.parse(text);
      await mkdir(CACHE, { recursive: true });
      await writeFile(path, text, 'utf8');
      return parsed;
    } catch (error) {
      lastError = error;
      // Overpass refuses by being slow rather than by saying no, so a retry
      // that comes straight back is a retry wasted.
      await sleep(attempt * 5000);
    }
  }

  throw lastError;
}

function toFeature(element) {
  const tags = element.tags ?? {};
  const kind = tags.natural === 'peak' ? 'peak' : tags.place;
  if (!kind || !(kind in RANK) || !tags.name) return null;

  const properties = { name: tags.name, kind, rank: RANK[kind] };

  // Metres above sea level, as OSM writes them: «1445», «1445 m», «1 445».
  const ele = Number.parseFloat(String(tags.ele ?? '').replace(/[^\d.-]/g, ''));
  if (Number.isFinite(ele)) properties.ele = Math.round(ele);

  const population = Number.parseInt(String(tags.population ?? '').replace(/\D/g, ''), 10);
  if (Number.isFinite(population)) properties.population = population;

  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [Number(element.lon.toFixed(DECIMALS)), Number(element.lat.toFixed(DECIMALS))],
    },
    properties,
  };
}

async function main() {
  const wanted = new Set(process.argv.slice(2));
  const provinces = JSON.parse(await readFile(PROVINCES, 'utf8'));
  const targets = provinces.features.filter(
    (feature) => wanted.size === 0 || wanted.has(feature.properties.id),
  );

  if (!targets.length) throw new Error('Cap província coincideix amb el que s’ha demanat');

  await mkdir(OUTPUT, { recursive: true });
  let total = 0;
  let bytes = 0;

  for (const [index, province] of targets.entries()) {
    const { id, name } = province.properties;
    process.stdout.write(`${index + 1}/${targets.length} ${id} ${name}… `);

    const answer = await ask(id, extentOf(province.geometry));
    const features = (answer.elements ?? [])
      .map(toFeature)
      .filter(Boolean)
      // Rank first, then the big ones, so the client can stop reading when it
      // has enough labels and still have the ones that matter.
      .sort(
        (a, b) =>
          a.properties.rank - b.properties.rank ||
          (b.properties.population ?? b.properties.ele ?? 0) -
            (a.properties.population ?? a.properties.ele ?? 0) ||
          a.properties.name.localeCompare(b.properties.name),
      );

    const settlements = features.filter((feature) => feature.properties.kind !== 'peak');
    const summits = features
      .filter((feature) => feature.properties.kind === 'peak')
      .slice(0, PEAKS_KEPT);
    const kept = [...settlements, ...summits];

    const text = JSON.stringify({ type: 'FeatureCollection', features: kept });
    await writeFile(resolve(OUTPUT, `${id}.geojson`), text, 'utf8');

    const dropped = features.length - kept.length;
    process.stdout.write(
      `${settlements.length} poblacions, ${summits.length} cims` +
        (dropped ? ` (${dropped} més baixos, fora)` : '') +
        ` · ${Math.round(text.length / 1024)} kB\n`,
    );

    total += kept.length;
    bytes += text.length;
    if (index < targets.length - 1) await sleep(PAUSE_MS);
  }

  process.stdout.write(`${OUTPUT}\n`);
  process.stdout.write(
    `${targets.length} fitxers · ${total} topònims · ${Math.round(bytes / 1024)} kB\n`,
  );
  process.stdout.write('© OpenStreetMap contributors, ODbL\n');
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
