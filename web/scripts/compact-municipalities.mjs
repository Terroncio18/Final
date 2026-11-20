import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { roundGeoJSONCoordinates } from './geojson-precision.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIRECTORY = resolve(HERE, '../public/data/municipalities');

let before = 0;
let after = 0;
const files = (await readdir(DIRECTORY)).filter((name) => name.endsWith('.geojson'));

for (const name of files) {
  const path = resolve(DIRECTORY, name);
  const source = await readFile(path, 'utf8');
  const collection = JSON.parse(source);
  const compact = JSON.stringify({
    ...collection,
    features: collection.features.map((feature) => ({
      ...feature,
      geometry: {
        ...feature.geometry,
        coordinates: roundGeoJSONCoordinates(feature.geometry.coordinates),
      },
    })),
  });
  await writeFile(path, compact, 'utf8');
  before += Buffer.byteLength(source);
  after += Buffer.byteLength(compact);
}

process.stdout.write(
  `${files.length} províncies: ${before} → ${after} bytes ` +
    `(-${before - after}; ${(((before - after) / before) * 100).toFixed(1)}%)\n`,
);
