// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readJson } from './read-json';

describe('readJson', () => {
  let fetcher: ReturnType<typeof vi.fn<typeof fetch>>;
  beforeEach(() => {
    fetcher = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetcher);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('resolves a relative url against the document base', async () => {
    fetcher.mockResolvedValue(new Response('{"a":1}', { status: 200 }));
    expect(await readJson<{ a: number }>('data/x.geojson')).toEqual({ a: 1 });
    expect(fetcher.mock.calls[0]![0]).toBe(new URL('data/x.geojson', document.baseURI).href);
  });

  it('leaves an absolute and a root-relative url alone', async () => {
    // A fresh Response each time: a body can only be read once.
    fetcher.mockImplementation(() => Promise.resolve(new Response('[]', { status: 200 })));
    await readJson('/api/hotspots?from=2024-08-01');
    expect(String(fetcher.mock.calls[0]![0])).toContain('/api/hotspots?from=2024-08-01');
    await readJson('https://example.test/a.json');
    expect(fetcher.mock.calls[1]![0]).toBe('https://example.test/a.json');
  });

  it('complains with the status when the answer is not ok', async () => {
    fetcher.mockResolvedValue(new Response('nope', { status: 503, statusText: 'Unavailable' }));
    await expect(readJson('data/x.json')).rejects.toThrow('503 Unavailable');
  });

  it('passes the abort signal through and lets its rejection out', async () => {
    const control = new AbortController();
    fetcher.mockImplementation((_url, init) =>
      Promise.reject(new Error(init?.signal?.aborted ? 'aborted' : 'not aborted')),
    );
    control.abort();
    await expect(readJson('data/x.json', control.signal)).rejects.toThrow('aborted');
  });
});
