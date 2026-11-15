import { CELL_M, domainAround, GRID } from './domain';
import type { Point } from './point';

export type CountermeasureKind =
  | 'defense-line' | 'firebreak' | 'clearing' | 'water-line'
  | 'backfire' | 'helicopter' | 'amphibious' | 'retardant';

/** A plan prepared at T=0, not a real-time dispatch or a calibrated suppression model. */
export interface Countermeasure {
  readonly id: string;
  readonly kind: CountermeasureKind;
  readonly points: readonly Point[];
  readonly widthM: number;
  readonly strength: number;
  readonly durationMin: number;
}

interface MeasureDefinition {
  readonly kind: CountermeasureKind;
  readonly label: string;
  readonly note: string;
  readonly icon: string;
  readonly group: 'ground' | 'air';
  readonly geometry: 'line' | 'point';
  readonly widthM: number;
  readonly strength: number;
  readonly durationMin: number;
  readonly color: string;
}

/** Illustrative, editable numerical parameters; NOT empirical equipment performance. */
export const COUNTERMEASURE_CATALOG: readonly MeasureDefinition[] = [
  { kind: 'defense-line', label: 'Línia de defensa', note: 'Barrera ideal sense combustible', icon: 'ruler', group: 'ground', geometry: 'line', widthM: 30, strength: 0, durationMin: 0, color: '#d6ae71' },
  { kind: 'firebreak', label: 'Tallafoc', note: 'Franja ideal sense combustible', icon: 'minus', group: 'ground', geometry: 'line', widthM: 60, strength: 0, durationMin: 0, color: '#e3cb96' },
  { kind: 'clearing', label: 'Tala i desbrossament', note: 'Reducció permanent de propagació', icon: 'trees', group: 'ground', geometry: 'line', widthM: 60, strength: 0.5, durationMin: 0, color: '#95bb79' },
  { kind: 'water-line', label: "Línia d'aigua", note: 'Reducció temporal de propagació', icon: 'droplet', group: 'ground', geometry: 'line', widthM: 30, strength: 0.7, durationMin: 30, color: '#5dbad7' },
  { kind: 'backfire', label: 'Contrafoc', note: 'Encén la franja a T=0; també crema superfície', icon: 'flame', group: 'ground', geometry: 'line', widthM: 30, strength: 0, durationMin: 0, color: '#ec8756' },
  { kind: 'helicopter', label: 'Helicòpter', note: "Disc d'aigua temporal idealitzat", icon: 'droplet', group: 'air', geometry: 'point', widthM: 90, strength: 0.7, durationMin: 20, color: '#69c8e1' },
  { kind: 'amphibious', label: 'Avió amfibi', note: "Disc d'aigua temporal idealitzat", icon: 'plane', group: 'air', geometry: 'point', widthM: 180, strength: 0.8, durationMin: 30, color: '#8bdbea' },
  { kind: 'retardant', label: 'Retardant', note: 'Franja de reducció temporal idealitzada', icon: 'plane', group: 'air', geometry: 'line', widthM: 60, strength: 0.6, durationMin: 180, color: '#e487a0' },
];

export const MAX_COUNTERMEASURES = 100;
const temporary = (kind: CountermeasureKind) =>
  kind === 'water-line' || kind === 'helicopter' || kind === 'amphibious' || kind === 'retardant';
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const validPoint = (p: unknown): p is Point => Array.isArray(p) && p.length === 2
  && finite(p[0]) && finite(p[1]) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) < 85;

/** Strict, bounded and all-or-nothing: a malformed barrier must never disappear silently. */
export function parseCountermeasures(value: unknown): readonly Countermeasure[] | string {
  if (!Array.isArray(value) || value.length > MAX_COUNTERMEASURES)
    return `El pla admet fins a ${MAX_COUNTERMEASURES} contramesures.`;
  const ids = new Set<string>();
  const result: Countermeasure[] = [];
  let vertices = 0;
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') return 'Contramesura incorrecta.';
    const def = COUNTERMEASURE_CATALOG.find(d => d.kind === raw.kind);
    if (!def) return 'Tipus de contramesura desconegut.';
    if (typeof raw.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(raw.id) || ids.has(raw.id))
      return 'Identificador de contramesura incorrecte o repetit.';
    if (!Array.isArray(raw.points) || !raw.points.every(validPoint)
      || (def.geometry === 'point' ? raw.points.length !== 1 : raw.points.length < 2)
      || raw.points.length > 64) return 'Geometria de contramesura incorrecta.';
    vertices += raw.points.length;
    if (vertices > 512) return 'El pla supera els 512 vèrtexs.';
    if (def.geometry === 'line' && !raw.points.some((p: Point) => p[0] !== raw.points[0][0] || p[1] !== raw.points[0][1]))
      return 'La franja necessita dos punts diferents.';
    if (!finite(raw.widthM) || raw.widthM < CELL_M || raw.widthM > 3000)
      return `L'amplada ha d'estar entre ${CELL_M} i 3000 m.`;
    if (!finite(raw.strength) || raw.strength < 0 || raw.strength > 0.95)
      return 'La reducció ha d’estar entre 0 i 95 %.';
    if (!finite(raw.durationMin) || (temporary(def.kind)
      ? raw.durationMin < 1 || raw.durationMin > 720 : raw.durationMin !== 0))
      return 'Durada incorrecta: 1–720 min per als efectes temporals; 0 per als permanents.';
    ids.add(raw.id);
    result.push({ id: raw.id, kind: def.kind, points: raw.points.map((p: Point) => [p[0], p[1]] as Point), widthM: raw.widthM, strength: raw.strength, durationMin: raw.durationMin });
  }
  return result;
}

function pointSegmentDistance(x: number, y: number, a: Point, b: Point): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = dx || dy ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy))) : 0;
  return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
}

/** Distance from a closed cell square to a segment. Touching counts, conservatively. */
function cellDistance(x: number, y: number, a: Point, b: Point): number {
  let lo = 0, hi = 1;
  for (let axis = 0; axis < 2; axis++) {
    const min = axis === 0 ? x : y, d = b[axis] - a[axis];
    if (d === 0) { if (a[axis] < min || a[axis] > min + 1) { hi = -1; break; } }
    else {
      const t0 = (min - a[axis]) / d, t1 = (min + 1 - a[axis]) / d;
      lo = Math.max(lo, Math.min(t0, t1)); hi = Math.min(hi, Math.max(t0, t1));
    }
  }
  if (lo <= hi) return 0;
  const pointRect = (p: Point) => Math.hypot(Math.max(x - p[0], 0, p[0] - x - 1), Math.max(y - p[1], 0, p[1] - y - 1));
  return Math.min(pointRect(a), pointRect(b),
    pointSegmentDistance(x, y, a, b), pointSegmentDistance(x + 1, y, a, b),
    pointSegmentDistance(x, y + 1, a, b), pointSegmentDistance(x + 1, y + 1, a, b));
}

/** Every cell touched by the disc/capsule, clipped at the domain boundary. */
export function countermeasureCells(centre: Point, measure: Countermeasure): readonly number[] {
  if (!validPoint(centre)) throw new Error('Centre del domini incorrecte.');
  const [w, s, e, n] = domainAround(centre);
  const points: Point[] = measure.points.map(([lon, lat]) => {
    if (lon < w || lon > e || lat < s || lat > n) throw new Error('Una contramesura surt del domini.');
    return [(lon - w) / (e - w) * GRID, (n - lat) / (n - s) * GRID];
  });
  const radius = measure.widthM / CELL_M / 2;
  const cells = new Set<number>();
  for (let i = 0; i < Math.max(1, points.length - 1); i++) {
    const a = points[i], b = points[i + 1] ?? a;
    const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0]) - radius));
    const x1 = Math.min(GRID - 1, Math.floor(Math.max(a[0], b[0]) + radius));
    const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1]) - radius));
    const y1 = Math.min(GRID - 1, Math.floor(Math.max(a[1], b[1]) + radius));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++)
      if (cellDistance(x, y, a, b) <= radius + 1e-9) cells.add(y * GRID + x);
  }
  return [...cells];
}

/** Piecewise-constant speed factors, valid from T=0 up to each `until`. */
export interface TreatmentWindow { readonly until: number; readonly factor: number; }
export interface CountermeasureField {
  readonly blocked: Uint8Array;
  readonly permanent: Float32Array;
  readonly temporary: ReadonlyMap<number, readonly TreatmentWindow[]>;
  readonly ignitions: readonly number[];
}

export function compileCountermeasures(centre: Point, input: readonly Countermeasure[]): CountermeasureField {
  const measures = parseCountermeasures(input);
  if (typeof measures === 'string') throw new Error(measures);
  const blocked = new Uint8Array(GRID * GRID);
  const permanent = new Float32Array(GRID * GRID).fill(1);
  const wet = new Map<number, TreatmentWindow[]>();
  const ignitions = new Set<number>();
  for (const measure of measures) {
    for (const cell of countermeasureCells(centre, measure)) {
      if (measure.kind === 'firebreak' || measure.kind === 'defense-line') blocked[cell] = 1;
      else if (measure.kind === 'clearing') permanent[cell] = Math.min(permanent[cell], 1 - measure.strength);
      else if (measure.kind === 'backfire') ignitions.add(cell);
      else if (measure.strength > 0) {
        let windows = wet.get(cell);
        if (!windows) wet.set(cell, windows = []);
        windows.push({ until: measure.durationMin, factor: 1 - measure.strength });
      }
    }
  }
  for (const [cell, windows] of wet) {
    const ends = [...new Set(windows.map(w => w.until))].sort((a, b) => a - b);
    wet.set(cell, ends.map(until => ({ until,
      // Permanent is already in the underlying rate; don't multiply overlapping reductions.
      factor: Math.min(permanent[cell], ...windows.filter(w => w.until >= until).map(w => w.factor)) / permanent[cell],
    })));
  }
  return { blocked, permanent, temporary: wet, ignitions: [...ignitions] };
}

export function treatmentFactor(windows: readonly TreatmentWindow[] | undefined, minute: number): number {
  return windows?.find(w => minute < w.until)?.factor ?? 1;
}

/** Integrate distance, splitting at expiry. This preserves FIFO arrival times for Dijkstra. */
export function treatedTravel(distance: number, rate: number, start: number, windows: readonly TreatmentWindow[] | undefined): number {
  let remaining = distance, now = start;
  for (const window of windows ?? []) {
    if (window.until <= now) continue;
    const speed = rate * window.factor;
    const available = window.until - now;
    if (remaining <= speed * available) return now - start + remaining / speed;
    remaining -= speed * available;
    now = window.until;
  }
  return now - start + remaining / rate;
}
