import { test } from 'vitest';
import assert from 'node:assert/strict';
import { HotspotCache, type CachedHotspots } from '../src/hotspot-cache.js';

function entry(fetchedAt = 0): CachedHotspots {
  return { body: { type: 'FeatureCollection', features: [] }, sources: [], fetchedAt };
}

test('evicts the least recently used range when the cache reaches its limit', () => {
  const cache = new HotspotCache(2);
  cache.set('a', entry());
  cache.set('b', entry());
  cache.get('a');
  cache.set('c', entry());
  assert.equal(cache.get('b'), undefined);
  assert.ok(cache.get('a'));
  assert.ok(cache.get('c'));
  assert.equal([...cache.entries()].length, 2);
});

test('refreshing an existing range replaces its value without evicting another range', () => {
  const cache = new HotspotCache(2);
  cache.set('a', entry(1));
  cache.set('b', entry(2));
  cache.set('a', entry(3));
  assert.equal(cache.get('a')?.fetchedAt, 3);
  assert.equal(cache.get('b')?.fetchedAt, 2);
  assert.equal([...cache.entries()].length, 2);
});

test('missing ranges do not change the eviction order', () => {
  const cache = new HotspotCache(2);
  cache.set('a', entry());
  cache.set('b', entry());
  assert.equal(cache.get('missing'), undefined);
  cache.set('c', entry());
  assert.deepEqual(
    [...cache.entries()].map(([key]) => key),
    ['b', 'c'],
  );
});

test('rejects limits that cannot retain a bounded number of entries', () => {
  for (const limit of [0, -1, 0.5, Number.NaN, Infinity]) {
    assert.throws(() => new HotspotCache(limit), RangeError);
  }
});
