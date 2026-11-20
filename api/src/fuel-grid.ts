/** Shared by the offline importer and API. Categorical values never interpolate. */
export type Bounds = readonly [number, number, number, number];
export const UNKNOWN = 255;
const TILE_DEGREES = 0.125;
export const TILE_SIZE = 512;
export type Ring = readonly (readonly number[])[];
export type Polygon = readonly Ring[];

export function validateGrid(
  bbox: string | undefined,
  sizeText?: string,
): { bounds: Bounds; size: number } {
  const parts = bbox?.split(",");
  if (!parts || parts.length !== 4 || parts.some((s) => !s.trim()))
    throw new Error("Cal bbox=oest,sud,est,nord");
  const [w, s, e, n] = parts.map(Number) as [number, number, number, number];
  const size = Number(sizeText ?? 1024);
  if (
    ![w, s, e, n].every(Number.isFinite) ||
    w >= e ||
    s >= n ||
    e - w > 0.8 ||
    n - s > 0.8 ||
    w < -32 ||
    e > 5 ||
    s < 27 ||
    n > 44.5 ||
    !Number.isInteger(size) ||
    size < 16 ||
    size > 1024
  ) {
    throw new Error(
      "Domini fora de rang (Espanya/Portugal, màxim 0,8 graus; mida 16–1024)",
    );
  }
  return { bounds: [w, s, e, n], size };
}

/** A declared approximation, versioned separately from the satellite product. */
export function worldCoverModel(cover: number): number {
  switch (cover) {
    case 10:
    case 95:
      return 8; // tree cover: compact litter, canopy/understorey unknown
    case 20:
      return 5; // shrubland: low shrub assumption
    case 30:
    case 40:
    case 100:
      return 1; // cured fine fuel
    case 60:
      return 0; // bare or sparse ground: too little cover to carry a surface fire
    case 90:
      return 3; // herbaceous wetland can carry a surface fire
    case 50:
    case 70:
    case 80:
      return 0; // built-up, snow/ice, permanent water
    default:
      return UNKNOWN;
  }
}

export function tileBounds(x: number, y: number): Bounds {
  return [
    x * TILE_DEGREES,
    y * TILE_DEGREES,
    (x + 1) * TILE_DEGREES,
    (y + 1) * TILE_DEGREES,
  ];
}

export function tileKeys(bounds: Bounds): [number, number][] {
  const [w, s, e, n] = bounds;
  const keys: [number, number][] = [];
  for (
    let y = Math.floor(s / TILE_DEGREES);
    y < Math.ceil(n / TILE_DEGREES);
    y++
  ) {
    for (
      let x = Math.floor(w / TILE_DEGREES);
      x < Math.ceil(e / TILE_DEGREES);
      x++
    )
      keys.push([x, y]);
  }
  return keys;
}

/** Even/odd scanline fill at pixel centres; honours holes regardless of ring winding. */
export function paintPolygon(
  polygon: Polygon,
  bounds: Bounds,
  size: number,
  target: Uint8Array,
  model: number,
): void {
  const [w, s, e, n] = bounds;
  const dx = (e - w) / size,
    dy = (n - s) / size;
  let minY = Infinity,
    maxY = -Infinity;
  for (const ring of polygon)
    for (const p of ring) {
      minY = Math.min(minY, p[1]!);
      maxY = Math.max(maxY, p[1]!);
    }
  const start = Math.max(0, Math.ceil((n - maxY) / dy - 0.5));
  const end = Math.min(size - 1, Math.floor((n - minY) / dy - 0.5));
  for (let row = start; row <= end; row++) {
    const lat = n - (row + 0.5) * dy;
    const crossings: number[] = [];
    for (const ring of polygon) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const a = ring[j]!,
          b = ring[i]!;
        if (a[1]! > lat !== b[1]! > lat)
          crossings.push(
            a[0]! + ((lat - a[1]!) * (b[0]! - a[0]!)) / (b[1]! - a[1]!),
          );
      }
    }
    crossings.sort((a, b) => a - b);
    for (let i = 0; i + 1 < crossings.length; i += 2) {
      const left = Math.max(0, Math.ceil((crossings[i]! - w) / dx - 0.5));
      const right = Math.min(
        size,
        Math.ceil((crossings[i + 1]! - w) / dx - 0.5),
      );
      if (right > left)
        target.fill(model, row * size + left, row * size + right);
    }
  }
}

/** Flattened triples: model, provenance (0 unknown / 1 official / 2 estimated), count. */
export function encodeRuns(models: Uint8Array, quality: Uint8Array): number[] {
  if (models.length !== quality.length) throw new Error("Grid lengths differ");
  const runs: number[] = [];
  for (let i = 0; i < models.length;) {
    let j = i + 1;
    while (
      j < models.length &&
      models[j] === models[i] &&
      quality[j] === quality[i]
    )
      j++;
    runs.push(models[i]!, quality[i]!, j - i);
    i = j;
  }
  return runs;
}
