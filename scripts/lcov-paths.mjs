/**
 * Move a coverage report's paths to the root of the repository.
 *
 * Sonar reads the reports from here, where a path that says `src/firms.ts`
 * resolves to nothing: vitest writes them from `web/` or from `api/`, and on
 * Windows with backslashes. This rewrites the `SF:` lines —the only ones that
 * name a file— so that each one starts at the root and uses slashes.
 *
 *   node ../scripts/lcov-paths.mjs api coverage/lcov.info
 *
 * It is the last step of each half's `test:coverage`, and running it twice
 * does not prefix anything twice.
 */
import { readFile, writeFile } from 'node:fs/promises';

const [prefix, ...reports] = process.argv.slice(2);

if (!prefix || !reports.length) {
  console.error('usage: lcov-paths.mjs <prefix> <report.info...>');
  process.exit(1);
}

for (const report of reports) {
  let text;
  try {
    text = await readFile(report, 'utf8');
  } catch {
    console.log(`${report}: not there, nothing to do`);
    continue;
  }
  const fixed = text.replace(/^SF:(.*)$/gm, (_line, path) => {
    const slashes = path.replace(/\\/g, '/');
    return `SF:${slashes.startsWith(`${prefix}/`) ? slashes : `${prefix}/${slashes}`}`;
  });
  if (fixed !== text) await writeFile(report, fixed);
  console.log(`${report}: ${fixed.match(/^SF:/gm)?.length ?? 0} files under ${prefix}/`);
}
