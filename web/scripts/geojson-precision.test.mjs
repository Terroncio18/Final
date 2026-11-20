import assert from 'node:assert/strict';
import { test } from 'node:test';
import { roundGeoJSONCoordinates } from './geojson-precision.mjs';

test('rounds longitude and latitude to six decimals and keeps extra ordinates', () => {
  assert.deepEqual(
    roundGeoJSONCoordinates([2.123456789, -39.987654321, 12]),
    [2.123457, -39.987654, 12],
  );
});

test('preserves nested geometry shape and closed rings', () => {
  const ring = [
    [2.123456789, 39.123456789],
    [2.2, 39.123456789],
    [2.2, 39.2],
    [2.123456789, 39.123456789],
  ];
  const rounded = roundGeoJSONCoordinates([ring]);
  assert.equal(rounded.length, 1);
  assert.deepEqual(rounded[0][0], rounded[0].at(-1));
  assert.deepEqual(rounded[0][0], [2.123457, 39.123457]);
});
