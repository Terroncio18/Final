import type { SpreadResult } from '../app/simulation/fire-spread';

export function spreadResult(patch: Partial<SpreadResult> = {}): SpreadResult {
  return {
    arrival: new Float32Array(),
    heat: new Float32Array(),
    horizon: 0,
    burnable: 0,
    reachedEdge: Infinity,
    baseRate: 0,
    series: {
      area: new Float32Array(1),
      perimeter: new Float32Array(1),
      rate: new Float32Array(1),
      heading: new Float32Array(1),
      intensity: new Float32Array(1),
      run: new Float32Array(1),
    },
    ...patch,
  };
}
