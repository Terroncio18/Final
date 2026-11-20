import { mkdir, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

const CACHE_FILE = /^[a-f0-9]{64}\.json\.gz$/;

type WriteTemporary = (path: string, data: Uint8Array) => Promise<void>;

async function oldestCacheEntries(cacheDir: string): Promise<string[]> {
  const names = (await readdir(cacheDir)).filter((name) =>
    CACHE_FILE.test(name),
  );
  const found = await Promise.allSettled(
    names.map(async (name) => ({
      name,
      time: (await stat(join(cacheDir, name))).mtimeMs,
    })),
  );
  return found
    .flatMap((result) => (result.status === "fulfilled" ? [result.value] : []))
    .sort((a, b) => a.time - b.time)
    .map(({ name }) => name);
}

/**
 * Persist a calculated fuel answer. If the filesystem is full, evict old
 * cached answers one at a time and retry. The cache is optional, so if there
 * is still no room after eviction, return false and let the request succeed
 * without retaining the answer.
 */
export async function writeFuelCache(
  cacheDir: string,
  path: string,
  data: Uint8Array,
  writeTemporary: WriteTemporary = writeFile,
): Promise<boolean> {
  const temporary = `${path}.tmp`;

  const save = async () => {
    await writeTemporary(temporary, data);
    await rename(temporary, path);
  };

  try {
    await mkdir(cacheDir, { recursive: true });
    await save();
    return true;
  } catch (error) {
    await rm(temporary, { force: true });
    if ((error as NodeJS.ErrnoException).code !== "ENOSPC") throw error;
  }

  let oldEntries: string[];
  try {
    oldEntries = await oldestCacheEntries(cacheDir);
  } catch {
    return false;
  }

  for (const name of oldEntries) {
    try {
      await rm(join(cacheDir, name), { force: true });
      await save();
      return true;
    } catch (error) {
      await rm(temporary, { force: true });
      if ((error as NodeJS.ErrnoException).code !== "ENOSPC") throw error;
    }
  }

  return false;
}
