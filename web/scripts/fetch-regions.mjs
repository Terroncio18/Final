/**
 * Prepare the administrative regions used by the navigation.
 *
 * Source: Eurostat GISCO, NUTS 2024, level 2, scale 1:3 million, WGS 84.
 * https://gisco-services.ec.europa.eu/distribution/v2/nuts/
 *
 * Spain's NUTS 2 regions are exactly its autonomous communities, plus Ceuta and
 * Melilla as autonomous cities. Using this instead of the IGN's boundaries gives
 * Spain and Portugal from one file, with one geometry and one simplification
 * criterion, already in GeoJSON and already in WGS 84.
 *
 * These are statistical geometries, generalised for mapping: good for drawing
 * and for picking a region, not for measuring areas.
 *
 * Run:  npm run data:regions
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE =
  'https://gisco-services.ec.europa.eu/distribution/v2/nuts/geojson/NUTS_RG_03M_2024_4326_LEVL_2.geojson';

const OUTPUT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../public/data/regions.geojson',
);

/** Outside the study area: Atlantic archipelagos and the autonomous cities. */
const EXCLUDED = new Set(['PT20', 'PT30', 'ES63', 'ES64']);

/**
 * Which framing each region is drawn in; everything else belongs to the
 * mainland one.
 *
 * The Balearic Islands are deliberately absent: they fit inside the peninsular
 * framing at no cost in zoom, so they are part of it rather than a scope of
 * their own. Only the Canaries, 1.400 km southwest, still need their own.
 */
const SCOPE_BY_ID = new Map([['ES70', 'canaries']]);

async function main() {
  process.stdout.write('Descarregant NUTS 2 de GISCO…\n');
  const response = await fetch(SOURCE);
  if (!response.ok) throw new Error(`GISCO ha respost ${response.status}`);
  const collection = await response.json();

  const features = collection.features
    .filter((feature) => {
      const { CNTR_CODE, NUTS_ID } = feature.properties;
      return (CNTR_CODE === 'ES' || CNTR_CODE === 'PT') && !EXCLUDED.has(NUTS_ID);
    })
    // Only what the application reads. The source carries seventeen fields,
    // including names in four languages, and they would travel to every browser.
    .map((feature) => ({
      type: 'Feature',
      id: feature.properties.NUTS_ID,
      geometry: feature.geometry,
      properties: {
        id: feature.properties.NUTS_ID,
        name: feature.properties.NAME_LATN,
        country: feature.properties.CNTR_CODE,
        scope: SCOPE_BY_ID.get(feature.properties.NUTS_ID) ?? 'peninsula',
      },
    }))
    .sort((a, b) => a.properties.id.localeCompare(b.properties.id));

  const output = { type: 'FeatureCollection', features };

  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, JSON.stringify(output), 'utf8');

  const byScope = features.reduce((counts, f) => {
    counts[f.properties.scope] = (counts[f.properties.scope] ?? 0) + 1;
    return counts;
  }, {});
  const kb = Math.round(JSON.stringify(output).length / 1024);

  process.stdout.write(`${OUTPUT}\n`);
  process.stdout.write(`${features.length} regions · ${kb} kB\n`);
  process.stdout.write(`${JSON.stringify(byScope)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
