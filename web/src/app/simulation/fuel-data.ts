import { isJsonObject, type JsonObject, type JsonValue } from './json-value';

type FuelSource = {
  label: string;
  sourceUrl: string;
  sourceDate: string;
  attribution: string;
};

export interface FuelGrid {
  version: string;
  bounds: readonly number[];
  size: number;
  models: Uint8Array;
  quality: Uint8Array;
  officialCells: number;
  estimatedCells: number;
  unknownCells: number;
  nonBurnableCells: number;
  counts: { id: number; cells: number }[];
  sources: FuelSource[];
  warnings: string[];
}

function hasValidHeader(
  data: JsonValue,
  bounds: readonly number[],
  size: number,
): data is JsonObject {
  if (
    !isJsonObject(data) ||
    data['version'] !== 'anderson13-worldcover2021-v2' ||
    data['size'] !== size
  )
    return false;
  const received = data['bounds'];
  return (
    Array.isArray(received) && received.length === 4 && !received.some((n, i) => n !== bounds[i])
  );
}

function hasValidRunsShape(runs: JsonValue): runs is JsonValue[] {
  return Array.isArray(runs) && runs.length % 3 === 0;
}

function isValidRun(
  model: number,
  source: number,
  length: number,
  offset: number,
  totalLength: number,
): boolean {
  return (
    Number.isInteger(model) &&
    ((model >= 0 && model <= 13) || model === 255) &&
    [0, 1, 2].includes(source) &&
    (model === 255) === (source === 0) &&
    Number.isInteger(length) &&
    length >= 1 &&
    offset + length <= totalLength
  );
}

interface RunsResult {
  officialCells: number;
  estimatedCells: number;
  unknownCells: number;
  nonBurnableCells: number;
  counts: Map<number, number>;
}

function applyRuns(runs: JsonValue[], models: Uint8Array, quality: Uint8Array): RunsResult | null {
  let offset = 0,
    officialCells = 0,
    estimatedCells = 0,
    unknownCells = 0,
    nonBurnableCells = 0;
  const counts = new Map<number, number>();
  for (let i = 0; i < runs.length; i += 3) {
    const [model, source, length] = runs.slice(i, i + 3);
    if (typeof model !== 'number' || typeof source !== 'number' || typeof length !== 'number')
      return null;
    if (!isValidRun(model, source, length, offset, models.length)) return null;
    models.fill(model, offset, offset + length);
    quality.fill(source, offset, offset + length);
    offset += length;
    if (source === 1) officialCells += length;
    else if (source === 2) estimatedCells += length;
    else unknownCells += length;
    if (model === 0) nonBurnableCells += length;
    else if (model !== 255) counts.set(model, (counts.get(model) ?? 0) + length);
  }
  if (offset !== models.length) return null;
  return { officialCells, estimatedCells, unknownCells, nonBurnableCells, counts };
}

function hasValidSources(sources: JsonValue): sources is FuelSource[] {
  return (
    Array.isArray(sources) &&
    sources.every(
      (s) =>
        isJsonObject(s) &&
        ['label', 'sourceUrl', 'sourceDate', 'attribution'].every(
          (k) => typeof s[k] === 'string',
        ) &&
        typeof s['sourceUrl'] === 'string' &&
        /^https:\/\//.test(s['sourceUrl']),
    )
  );
}

function hasValidWarnings(warnings: JsonValue): warnings is string[] {
  return Array.isArray(warnings) && warnings.every((s) => typeof s === 'string');
}

/** Strict decoding prevents a truncated/misaligned response from becoming fuel. */
export function decodeFuels(data: JsonValue, bounds: readonly number[], size: number): FuelGrid {
  const fail = (): never => {
    throw new Error('Resposta de combustibles invàlida.');
  };
  if (!hasValidHeader(data, bounds, size)) return fail();
  const runs = data['runs'];
  if (!hasValidRunsShape(runs)) return fail();
  const models = new Uint8Array(size * size),
    quality = new Uint8Array(size * size);
  const runsResult = applyRuns(runs, models, quality);
  if (!runsResult) return fail();
  const { officialCells, estimatedCells, unknownCells, nonBurnableCells, counts } = runsResult;
  const sources = data['sources'],
    warnings = data['warnings'];
  if (!hasValidSources(sources) || !hasValidWarnings(warnings)) return fail();
  return {
    version: 'anderson13-worldcover2021-v2',
    bounds,
    size,
    models,
    quality,
    officialCells,
    estimatedCells,
    unknownCells,
    nonBurnableCells,
    counts: [...counts].map(([id, cells]) => ({ id, cells })).sort((a, b) => b.cells - a.cells),
    sources,
    warnings,
  };
}
