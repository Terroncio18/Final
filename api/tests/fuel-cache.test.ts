import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'vitest';
import { writeFuelCache } from '../src/fuel-cache.js';

let dir = '';

afterEach(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
  dir = '';
});

test('when storage is full, it evicts the oldest answer and retries', async () => {
  dir = await mkdtemp(join(tmpdir(), 'ignislab-fuel-cache-'));
  const cacheDir = join(dir, 'cache');
  await mkdir(cacheDir, { recursive: true });
  const oldest = 'a'.repeat(64) + '.json.gz';
  const newer = 'b'.repeat(64) + '.json.gz';
  const target = 'c'.repeat(64) + '.json.gz';
  const oldPath = join(cacheDir, oldest);
  const newerPath = join(cacheDir, newer);
  await writeFile(oldPath, 'old');
  await writeFile(newerPath, 'newer');
  const oldTime = new Date('2020-01-01T00:00:00Z');
  const newTime = new Date('2021-01-01T00:00:00Z');
  await utimes(oldPath, oldTime, oldTime);
  await utimes(newerPath, newTime, newTime);
  let attempts = 0;

  const saved = await writeFuelCache(
    cacheDir,
    join(cacheDir, target),
    Buffer.from('answer'),
    async (path, data) => {
      attempts++;
      if (attempts === 1) {
        throw Object.assign(new Error('disk full'), { code: 'ENOSPC' });
      }
      await writeFile(path, data);
    },
  );

  assert.equal(saved, true);
  assert.equal(attempts, 2, 'one retry follows one eviction');
  assert.deepEqual((await readdir(cacheDir)).sort(), [newer, target].sort());
});

test('when there is no old answer to evict, it skips caching without failing', async () => {
  dir = await mkdtemp(join(tmpdir(), 'ignislab-fuel-cache-'));
  const cacheDir = join(dir, 'cache');
  let attempts = 0;

  const saved = await writeFuelCache(
    cacheDir,
    join(cacheDir, 'd'.repeat(64) + '.json.gz'),
    Buffer.from('answer'),
    async () => {
      attempts++;
      throw Object.assign(new Error('disk full'), { code: 'ENOSPC' });
    },
  );

  assert.equal(saved, false);
  assert.equal(attempts, 1, 'there are no cache files to evict and retry');
  assert.deepEqual(await readdir(cacheDir), []);
});
