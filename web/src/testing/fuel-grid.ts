import { GRID } from '../app/simulation/domain';
import type { FuelGrid } from '../app/simulation/fuel-data';

export function fuelGrid(patch: Partial<FuelGrid> = {}): FuelGrid {
  return {
    version: 'anderson13-worldcover2021-v2',
    bounds: [0, 0, 1, 1],
    size: GRID,
    models: new Uint8Array(GRID * GRID),
    quality: new Uint8Array(GRID * GRID),
    officialCells: 0,
    estimatedCells: 0,
    unknownCells: 0,
    nonBurnableCells: 0,
    counts: [],
    sources: [],
    warnings: [],
    ...patch,
  };
}
