/**
 * Move the coverage reports' paths to the root of the repository.
 *
 * Sonar reads the two `web/coverage` reports from the root, where a path that
 * says `src/app/...` resolves to nothing: vitest writes them from `web/`, and
 * on Windows with backslashes. This rewrites the `SF:` lines —the only ones
 * that name a file— so that each one starts at the root and uses slashes.
 *
 * It is the last step of `npm run test:coverage`, and running it twice does
 * not prefix anything twice.
 */
import { readFile, writeFile } from 'node:fs/promises';

const REPORTS = ['coverage/model/lcov.info', 'coverage/web/lcov.info'];
const BACKSLASH = /\\/g;

for (const report of REPORTS) {
  let text;
  try {
    text = await readFile(report, 'utf8');
  } catch {
    console.log(`${report}: not there, nothing to do`);
    continue;
  }
  const fixed = text.replace(/^SF:(.*)$/gm, (_line, path) => {
    const slashes = path.replace(BACKSLASH, '/');
    return `SF:${slashes.startsWith('web/') ? slashes : `web/${slashes}`}`;
  });
  if (fixed !== text) await writeFile(report, fixed);
  console.log(`${report}: ${fixed.match(/^SF:/gm)?.length ?? 0} files`);
}
