/**
 * Prepare the provinces and islands of the second navigation step.
 *
 * Source: Eurostat GISCO, NUTS 2024, level 3, scale 1:3 million, WGS 84.
 * https://gisco-services.ec.europa.eu/distribution/v2/nuts/
 *
 * In Spain level 3 is the provinces, except in the Balearics and the Canaries,
 * where it is the islands. For fires that is the better cut: Mallorca and
 * Menorca are separate fire domains and a single «Illes Balears» entry would
 * hide that. In Portugal it is the statistical sub-regions, which are not the
 * districts the ICNF works with; naming that is still open (§3.4).
 *
 * The parent region is not looked up anywhere: a NUTS 3 code is its NUTS 2 code
 * plus one character, so ES511 belongs to ES51 by construction.
 *
 * Run:  npm run data:provinces
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE =
  'https://gisco-services.ec.europa.eu/distribution/v2/nuts/geojson/NUTS_RG_03M_2024_4326_LEVL_3.geojson';

const OUTPUT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../public/data/provinces.geojson',
);

/** The same regions the first step leaves out, so the two files agree. */
const EXCLUDED_REGIONS = new Set(['PT20', 'PT30', 'ES63', 'ES64']);

/** Which framing each one is drawn in; see fetch-regions.mjs. */
const CANARIES = 'ES70';

async function main() {
  process.stdout.write('Descarregant NUTS 3 de GISCO…\n');
  const response = await fetch(SOURCE);
  if (!response.ok) throw new Error(`GISCO ha respost ${response.status}`);
  const collection = await response.json();

  const features = collection.features
    .filter((feature) => {
      const { CNTR_CODE, NUTS_ID } = feature.properties;
      if (CNTR_CODE !== 'ES' && CNTR_CODE !== 'PT') return false;
      return !EXCLUDED_REGIONS.has(NUTS_ID.slice(0, 4));
    })
    .map((feature) => {
      const id = feature.properties.NUTS_ID;
      const region = id.slice(0, 4);
      return {
        type: 'Feature',
        id,
        geometry: feature.geometry,
        properties: {
          id,
          name: feature.properties.NAME_LATN,
          region,
          country: feature.properties.CNTR_CODE,
          scope: region === CANARIES ? 'canaries' : 'peninsula',
        },
      };
    })
    .sort((a, b) => a.properties.id.localeCompare(b.properties.id));

  const output = { type: 'FeatureCollection', features };

  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, JSON.stringify(output), 'utf8');

  const regions = new Set(features.map((f) => f.properties.region));
  const kb = Math.round(JSON.stringify(output).length / 1024);

  process.stdout.write(`${OUTPUT}\n`);
  process.stdout.write(`${features.length} províncies i illes · ${kb} kB\n`);
  process.stdout.write(`${regions.size} regions amb fills\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
