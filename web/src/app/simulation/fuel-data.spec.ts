import { describe, expect, it } from 'vitest';
import { decodeFuels } from './fuel-data';

const bounds = [-9, 38, -8.9, 38.1];
const response = {
  version: 'anderson13-worldcover2021-v2',
  size: 2,
  bounds,
  runs: [5, 1, 2, 0, 2, 1, 255, 0, 1],
  sources: [],
  warnings: [],
};
describe('fuel response decoding', () => {
  it('preserves known, estimated, non-burnable and unknown cells separately', () => {
    const grid = decodeFuels(response, bounds, 2);
    expect([...grid.models]).toEqual([5, 5, 0, 255]);
    expect([...grid.quality]).toEqual([1, 1, 2, 0]);
    expect([
      grid.officialCells,
      grid.estimatedCells,
      grid.unknownCells,
      grid.nonBurnableCells,
    ]).toEqual([2, 1, 1, 1]);
  });
  it('rejects truncated, overflowing, invalid and unaligned grids', () => {
    for (const runs of [
      [5, 1, 3],
      [5, 1, 5],
      [14, 1, 4],
      [255, 2, 4],
      [0, 0, 4],
      [1, 1, -1],
      [1, 1, 4.1],
      [1, 1, 4, 0],
    ]) {
      expect(() => decodeFuels({ ...response, runs }, bounds, 2)).toThrow();
    }
    expect(() => decodeFuels({ ...response, bounds: [0, 0, 1, 1] }, bounds, 2)).toThrow();
    expect(() => decodeFuels({ ...response, version: 'other' }, bounds, 2)).toThrow();
  });
});
