/**
 * Prepare the municipalities of the third navigation step.
 *
 * Source: Eurostat GISCO, LAU 2024, scale 1:1 million, WGS 84.
 * https://gisco-services.ec.europa.eu/distribution/v2/lau/
 *
 * Three things about this dataset shape everything below.
 *
 * It is one 150 MB file for the whole of Europe, published at a single scale:
 * there is no per-country download and no coarser version. So it is fetched
 * once into a local cache that never reaches the repository; what is committed
 * is the split output.
 *
 * It carries no NUTS code. The attributes are GISCO_ID, CNTR_CODE, LAU_NAME,
 * population, area and year, and nothing says which province a unit is in. In
 * Spain the code would give it away —ES_08193 opens with the INE province
 * number— but in Portugal the code is district, concelho and parish, and the
 * NUTS 3 sub-regions do not follow district lines. So both countries are solved
 * the same way: a point in polygon test against the NUTS 3 boundaries.
 *
 * And LAU is not the same unit on each side of the border. Spain declares the
 * municipio, 8.132 of them. Portugal declares the freguesia, the civil parish:
 * 3.092, which group into the 308 concelhos by the first four digits of their
 * code. GISCO does not publish the concelho outlines and dissolving parishes
 * into them would take a polygon union, so the finer unit is what Portugal
 * gets. The reasoning is in the bitacola.
 *
 * Run:  npm run data:municipalities
 */

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

const SOURCES = {
  'lau-2024':
    'https://gisco-services.ec.europa.eu/distribution/v2/lau/geojson/LAU_RG_01M_2024_4326.geojson',
  // The provinces at 1:1 M and not the 1:3 M the application draws: the test
  // below runs against LAU outlines, also at 1:1 M, and matching the scales is
  // what keeps coastal units from falling outside a coarser province.
  'nuts3-01m':
    'https://gisco-services.ec.europa.eu/distribution/v2/nuts/geojson/NUTS_RG_01M_2024_4326_LEVL_3.geojson',
};

const CACHE = resolve(HERE, '.cache');
const OUTPUT = resolve(HERE, '../public/data/municipalities');

/** The same regions the other two steps leave out, so the three files agree. */
const EXCLUDED_REGIONS = new Set(['PT20', 'PT30', 'ES63', 'ES64']);

/**
 * How far a unit may sit outside every province and still count as one of
 * theirs, in degrees: about five kilometres.
 *
 * A centroid can land just outside its own province where two generalised
 * outlines disagree, and that has to be forgiven. What must not be forgiven is
 * the Atlantic. The Azores, Madeira, Ceuta and Melilla are ES and PT too, they
 * belong to no province of the study area, and a plain «nearest province» rule
 * handed them to La Palma, Cádiz and Almería. Further than this is out of
 * scope, not misplaced.
 */
const NEAR_ENOUGH = 0.05;

async function cached(name, url) {
  const path = resolve(CACHE, name + '.geojson');
  if (existsSync(path)) {
    process.stdout.write(name + ': de la memoria cau\n');
    return JSON.parse(await readFile(path, 'utf8'));
  }
  process.stdout.write(name + ': descarregant...\n');
  const response = await fetch(url);
  if (!response.ok) throw new Error('GISCO ha respost ' + response.status + ' per ' + name);
  const text = await response.text();
  await mkdir(CACHE, { recursive: true });
  await writeFile(path, text, 'utf8');
  return JSON.parse(text);
}

/** Every outer ring of a polygon or multipolygon, holes left out. */
function outerRings(geometry) {
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.map((p) => p[0]);
  if (geometry.type === 'Polygon') return [geometry.coordinates[0]];
  return [];
}

/**
 * A point inside the shape, near its middle.
 *
 * The area-weighted centroid of its largest ring. For an administrative unit
 * that is nearly always inside it, and the few it is not are caught below.
 */
function representativePoint(geometry) {
  let best = null;
  let bestArea = -1;

  for (const ring of outerRings(geometry)) {
    let twiceArea = 0;
    let x = 0;
    let y = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const cross = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
      twiceArea += cross;
      x += (ring[j][0] + ring[i][0]) * cross;
      y += (ring[j][1] + ring[i][1]) * cross;
    }
    const area = Math.abs(twiceArea / 2);
    if (area > bestArea) {
      bestArea = area;
      best = twiceArea === 0 ? ring[0] : [x / (3 * twiceArea), y / (3 * twiceArea)];
    }
  }

  return best;
}

/** Ray casting. Holes count: a point inside a hole is outside the polygon. */
function inRing(point, ring) {
  const [lon, lat] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function inGeometry(point, geometry) {
  const polygons =
    geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];
  for (const polygon of polygons) {
    if (!inRing(point, polygon[0])) continue;
    if (polygon.slice(1).some((hole) => inRing(point, hole))) continue;
    return true;
  }
  return false;
}

function bboxOf(geometry) {
  let west = 180;
  let south = 90;
  let east = -180;
  let north = -90;
  for (const ring of outerRings(geometry)) {
    for (const [lon, lat] of ring) {
      if (lon < west) west = lon;
      if (lon > east) east = lon;
      if (lat < south) south = lat;
      if (lat > north) north = lat;
    }
  }
  return [west, south, east, north];
}

function distanceToBox(point, box) {
  const [lon, lat] = point;
  const [west, south, east, north] = box;
  const dx = Math.max(west - lon, 0, lon - east);
  const dy = Math.max(south - lat, 0, lat - north);
  return Math.hypot(dx, dy);
}

async function main() {
  const lau = await cached('lau-2024', SOURCES['lau-2024']);
  const nuts3 = await cached('nuts3-01m', SOURCES['nuts3-01m']);

  const provinces = nuts3.features
    .filter((f) => {
      const { CNTR_CODE, NUTS_ID } = f.properties;
      if (CNTR_CODE !== 'ES' && CNTR_CODE !== 'PT') return false;
      return !EXCLUDED_REGIONS.has(NUTS_ID.slice(0, 4));
    })
    .map((f) => ({ id: f.properties.NUTS_ID, geometry: f.geometry, bbox: bboxOf(f.geometry) }));

  process.stdout.write(provinces.length + ' provincies de referencia\n');

  const units = lau.features.filter(
    (f) => f.properties.CNTR_CODE === 'ES' || f.properties.CNTR_CODE === 'PT',
  );
  process.stdout.write(units.length + ' unitats LAU a Espanya i Portugal\n');

  const byProvince = new Map(provinces.map((p) => [p.id, []]));
  const fallbacks = [];
  const outside = new Map();
  let dropped = 0;

  for (const feature of units) {
    const point = representativePoint(feature.geometry);
    if (!point) {
      dropped += 1;
      continue;
    }

    // The box test first: it rejects eighty of the eighty-one provinces for the
    // price of four comparisons, and only then is walking the rings worth it.
    let province = provinces.find(
      (p) => distanceToBox(point, p.bbox) === 0 && inGeometry(point, p.geometry),
    );

    if (!province) {
      const nearest = provinces.reduce((best, p) =>
        distanceToBox(point, p.bbox) < distanceToBox(point, best.bbox) ? p : best,
      );
      const gap = distanceToBox(point, nearest.bbox);
      if (gap > NEAR_ENOUGH) {
        const prefix = feature.properties.GISCO_ID.slice(0, 5);
        outside.set(prefix, (outside.get(prefix) ?? 0) + 1);
        continue;
      }
      province = nearest;
      const km = (gap * 111).toFixed(1);
      fallbacks.push(
        feature.properties.GISCO_ID +
          ' ' +
          feature.properties.LAU_NAME +
          ' -> ' +
          province.id +
          ' (' +
          km +
          ' km)',
      );
    }

    byProvince.get(province.id).push({
      type: 'Feature',
      id: feature.properties.GISCO_ID,
      geometry: feature.geometry,
      properties: {
        id: feature.properties.GISCO_ID,
        name: feature.properties.LAU_NAME,
        province: province.id,
      },
    });
  }

  await mkdir(OUTPUT, { recursive: true });

  let bytes = 0;
  const counts = [];
  for (const [id, features] of byProvince) {
    counts.push([id, features.length]);
    if (!features.length) continue;
    features.sort((a, b) => a.properties.name.localeCompare(b.properties.name, 'ca'));
    const text = JSON.stringify({ type: 'FeatureCollection', features });
    bytes += text.length;
    await writeFile(resolve(OUTPUT, id + '.geojson'), text, 'utf8');
  }

  counts.sort((a, b) => b[1] - a[1]);
  const written = counts.filter(([, n]) => n > 0);

  process.stdout.write(OUTPUT + '\n');
  process.stdout.write(
    written.length + ' fitxers - ' + (bytes / 1024 / 1024).toFixed(1) + ' MB en total\n',
  );
  process.stdout.write('mes gran: ' + written[0].join(' amb ') + '\n');
  process.stdout.write('mes petit: ' + written[written.length - 1].join(' amb ') + '\n');
  process.stdout.write(counts.length - written.length + ' provincies sense cap unitat\n');
  if (dropped) process.stdout.write(dropped + ' unitats descartades\n');
  const left = [...outside.entries()].sort((a, b) => b[1] - a[1]);
  const leftTotal = left.reduce((n, [, count]) => n + count, 0);
  process.stdout.write(leftTotal + ' unitats fora de l’ambit, per prefix:\n');
  for (const [prefix, count] of left) process.stdout.write('  ' + prefix + ': ' + count + '\n');

  process.stdout.write(fallbacks.length + ' assignades per proximitat:\n');
  for (const line of fallbacks) process.stdout.write('  ' + line + '\n');
}

main().catch((error) => {
  process.stderr.write(error.stack + '\n');
  process.exit(1);
});
