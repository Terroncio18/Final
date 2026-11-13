/**
 * Build the index the form's search field reads.
 *
 * Derived and not downloaded: everything in it is already in
 * `public/data/municipalities`, which is 13 MB of geometry across 81 files.
 * A search cannot ask for a province's file first —skipping that question is
 * the whole point of it— so the names are pulled out once, offline, into one
 * file of about 540 kB that the browser gets in 111 kB.
 *
 * What travels, per unit: the name, the LAU code the URL carries, its NUTS 3
 * code and that province's name.
 *
 * What does not: the NUTS 2 segment. NUTS codes are hierarchical by
 * construction, so a province's region is the first four characters of its own
 * code, and all 81 of them agree with `provinces.geojson`. The province's
 * *name* is the one field here that is not derivable, and it is carried on
 * purpose: 173 names belong to more than one unit —`Pinheiro` to six— so a
 * result without it is a row nobody can choose between. It also means the
 * field can answer on the first step without pulling the 380 kB of provinces
 * that step deliberately does not load (§2.23).
 *
 * Run:  npm run data:index
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROVINCES = resolve(HERE, '../public/data/provinces.geojson');
const MUNICIPALITIES = resolve(HERE, '../public/data/municipalities');
const OUTPUT = resolve(HERE, '../public/data/municipality-index.json');

async function main() {
  const provinces = JSON.parse(await readFile(PROVINCES, 'utf8'));
  const names = new Map(
    provinces.features.map((feature) => [feature.properties.id, feature.properties.name.trim()]),
  );

  // A province whose region is not its own prefix would silently send the
  // search to a region that does not contain the result; better to stop.
  for (const feature of provinces.features) {
    const { id, region } = feature.properties;
    if (id.slice(0, 4) !== region) {
      throw new Error(`${id} diu que la seva regio es ${region}, i no ${id.slice(0, 4)}`);
    }
  }

  const files = (await readdir(MUNICIPALITIES)).filter((name) => name.endsWith('.geojson')).sort();

  const municipalities = [];
  for (const file of files) {
    const collection = JSON.parse(await readFile(resolve(MUNICIPALITIES, file), 'utf8'));
    for (const feature of collection.features) {
      const { id, name, province } = feature.properties;
      const provinceName = names.get(province);
      if (!provinceName) throw new Error(`${id} esta a ${province}, que no es cap provincia`);
      municipalities.push([name.trim(), id, province, provinceName]);
    }
  }

  // By name, so that equal scores come out alphabetical without the browser
  // having to sort eleven thousand rows it has only just parsed.
  municipalities.sort((a, b) => a[0].localeCompare(b[0], 'ca'));

  // `fields` is not read by anything: it is there so the file says what the
  // four positions of each row mean without having to open the script.
  const text = JSON.stringify({
    fields: ['name', 'lau', 'nuts3', 'province'],
    municipalities,
  });
  await writeFile(OUTPUT, text, 'utf8');

  const repeated = new Map();
  for (const [name] of municipalities) repeated.set(name, (repeated.get(name) ?? 0) + 1);
  const ambiguous = [...repeated.values()].filter((count) => count > 1).length;

  process.stdout.write(OUTPUT + '\n');
  process.stdout.write(
    municipalities.length +
      ' unitats de ' +
      files.length +
      ' provincies - ' +
      (text.length / 1024).toFixed(0) +
      ' kB\n',
  );
  process.stdout.write(ambiguous + ' noms els porta mes d una unitat\n');
}

await main();
