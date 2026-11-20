import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  AREAS,
  AVAILABILITY_TTL_MS,
  CACHE_TTL_MS,
  DEFAULT_DAYS,
  FIRMS_PLATFORMS,
  MAX_RANGE_DAYS,
  WINDOW_DAYS,
} from '../src/config.js';

test('the two areas are boxes, and they are the ones the frontend frames', () => {
  for (const area of AREAS) {
    assert.ok(area.west < area.east, `${area.scope}: west is not west of east`);
    assert.ok(area.south < area.north, `${area.scope}: south is not south of north`);
    assert.ok(area.west >= -180 && area.east <= 180);
    assert.ok(area.south >= -90 && area.north <= 90);
  }

  const peninsula = AREAS.find((area) => area.scope === 'peninsula');
  const canaries = AREAS.find((area) => area.scope === 'canaries');
  assert.ok(peninsula && canaries, 'both framings have to exist');

  for (const [lon, lat] of [
    [-9.14, 38.73],
    [2.65, 39.57],
    [0.65, 42.65],
  ] as const) {
    assert.ok(lon >= peninsula.west && lon <= peninsula.east && lat >= peninsula.south);
  }
  for (const [lon, lat] of [
    [-18.0, 27.7],
    [-13.5, 29.0],
  ] as const) {
    assert.ok(lon >= canaries.west && lon <= canaries.east && lat >= canaries.south);
  }

  assert.ok(canaries.east < peninsula.west || canaries.north < peninsula.south);
});

test('the window fits what the FIRMS API takes, and a month fits in whole windows', () => {
  assert.ok(WINDOW_DAYS >= 1 && WINDOW_DAYS <= 5, 'day_range is 1 to 5');
  assert.ok(MAX_RANGE_DAYS >= WINDOW_DAYS);
  assert.equal(MAX_RANGE_DAYS, 31, 'a month is the case this exists for');
  assert.equal(Math.ceil(MAX_RANGE_DAYS / WINDOW_DAYS), 7, 'seven windows per platform');
  assert.ok(DEFAULT_DAYS >= 1 && DEFAULT_DAYS <= MAX_RANGE_DAYS);
});

test('each platform names two different sources, and no source is repeated', () => {
  assert.equal(FIRMS_PLATFORMS.length, 3, 'SNPP, NOAA-20 and NOAA-21');
  const sources = FIRMS_PLATFORMS.flatMap((platform) => [platform.nrt, platform.sp]);
  assert.equal(new Set(sources).size, sources.length, 'a repeated source would be asked twice');
  for (const platform of FIRMS_PLATFORMS) {
    assert.ok(platform.nrt.endsWith('_NRT'));
    assert.ok(platform.sp.endsWith('_SP'));
    assert.equal(platform.nrt.replace('_NRT', ''), platform.sp.replace('_SP', ''));
  }
});

test('the caches are reused for less time than the thing they cache changes', () => {
  assert.ok(CACHE_TTL_MS > 0 && CACHE_TTL_MS <= 60 * 60 * 1000);
  assert.ok(AVAILABILITY_TTL_MS > CACHE_TTL_MS);
  assert.ok(AVAILABILITY_TTL_MS <= 24 * 60 * 60 * 1000);
});
