export interface FuelSource {
  label: string;
  sourceUrl: string;
  sourceDate: string;
  attribution: string;
}

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

/** Strict decoding prevents a truncated/misaligned response from becoming fuel. */
export function decodeFuels(raw: unknown, bounds: readonly number[], size: number): FuelGrid {
  const data = raw as Record<string, unknown> | null;
  const fail = (): never => {
    throw new Error('Resposta de combustibles invàlida.');
  };
  if (!data || data['version'] !== 'anderson13-worldcover2021-v2' || data['size'] !== size)
    return fail();
  const received = data['bounds'];
  if (!Array.isArray(received) || received.length !== 4 || received.some((n, i) => n !== bounds[i]))
    return fail();
  const runs = data['runs'];
  if (!Array.isArray(runs) || runs.length % 3) return fail();
  const models = new Uint8Array(size * size),
    quality = new Uint8Array(size * size);
  let offset = 0,
    officialCells = 0,
    estimatedCells = 0,
    unknownCells = 0,
    nonBurnableCells = 0;
  const counts = new Map<number, number>();
  for (let i = 0; i < runs.length; i += 3) {
    const [model, source, length] = runs.slice(i, i + 3) as number[];
    if (
      !Number.isInteger(model) ||
      !((model >= 0 && model <= 13) || model === 255) ||
      ![0, 1, 2].includes(source) ||
      (model === 255) !== (source === 0) ||
      !Number.isInteger(length) ||
      length < 1 ||
      offset + length > models.length
    )
      return fail();
    models.fill(model, offset, offset + length);
    quality.fill(source, offset, offset + length);
    offset += length;
    if (source === 1) officialCells += length;
    else if (source === 2) estimatedCells += length;
    else unknownCells += length;
    if (model === 0) nonBurnableCells += length;
    else if (model !== 255) counts.set(model, (counts.get(model) ?? 0) + length);
  }
  if (offset !== models.length) return fail();
  const sources = data['sources'],
    warnings = data['warnings'];
  if (
    !Array.isArray(sources) ||
    !sources.every(
      (s) =>
        s &&
        ['label', 'sourceUrl', 'sourceDate', 'attribution'].every(
          (k) => typeof s[k] === 'string',
        ) &&
        /^https:\/\//.test(s.sourceUrl),
    ) ||
    !Array.isArray(warnings) ||
    !warnings.every((s) => typeof s === 'string')
  )
    return fail();
  return {
    version: data['version'],
    bounds,
    size,
    models,
    quality,
    officialCells,
    estimatedCells,
    unknownCells,
    nonBurnableCells,
    counts: [...counts].map(([id, cells]) => ({ id, cells })).sort((a, b) => b.cells - a.cells),
    sources: sources as FuelSource[],
    warnings,
  };
}
