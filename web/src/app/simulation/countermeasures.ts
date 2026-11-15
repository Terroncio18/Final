import { CELL_M, domainAround, GRID } from './domain';
import type { Point } from './point';

export type CountermeasureKind =
  | 'defense-line'
  | 'firebreak'
  | 'clearing'
  | 'water-line'
  | 'backfire'
  | 'helicopter'
  | 'amphibious'
  | 'retardant';

/** A timed intervention; absent startMin means T=0 for legacy scenarios. */
export interface Countermeasure {
  readonly id: string;
  readonly kind: CountermeasureKind;
  readonly points: readonly Point[];
  readonly widthM: number;
  readonly strength: number;
  readonly durationMin: number;
  readonly startMin?: number;
  readonly litresPerPass?: number;
  readonly passes?: number;
  readonly passIntervalMin?: number;
  /** Fraction of the original dry fuel load remaining after removal. */
  readonly fuelRemaining?: number;
}

/** Named reference configurations, not a universal capacity for every aircraft. */
export const AIRCRAFT = {
  helicopter: {
    name: 'Bell 412 · dipòsit ventral',
    capacityL: 1350,
    source:
      'https://firewebext.ffm.vic.gov.au/BurnsToday/sau/SAU_External/documents/Aircraft%20Identification%20Reference%20%28updated%202014%29.pdf',
  },
  amphibious: {
    name: 'Canadair CL-415',
    capacityL: 6137,
    source:
      'https://www.avincis.com/wp-content/uploads/2024/11/A4-CL-415-Specifications-Flyer-Low-Res.pdf',
  },
  retardant: {
    name: 'Air Tractor AT-802F',
    capacityL: 3104,
    source: 'https://airtractor.com/wp-content/uploads/2022/09/Air-Tractor_802F-Brochure_2022.pdf',
  },
} as const;
export const liquidKind = (kind: CountermeasureKind) =>
  kind === 'helicopter' || kind === 'amphibious' || kind === 'water-line' || kind === 'retardant';
export const liquidCapacity = (kind: CountermeasureKind) =>
  kind in AIRCRAFT ? AIRCRAFT[kind as keyof typeof AIRCRAFT].capacityL : 10000;
export const physicalMeasure = (m: Countermeasure) =>
  m.litresPerPass !== undefined || m.fuelRemaining !== undefined;

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
  {
    kind: 'defense-line',
    label: 'Línia de defensa',
    note: 'Barrera ideal sense combustible',
    icon: 'ruler',
    group: 'ground',
    geometry: 'line',
    widthM: 30,
    strength: 0,
    durationMin: 0,
    color: '#d6ae71',
  },
  {
    kind: 'firebreak',
    label: 'Tallafoc',
    note: 'Franja ideal sense combustible',
    icon: 'minus',
    group: 'ground',
    geometry: 'line',
    widthM: 60,
    strength: 0,
    durationMin: 0,
    color: '#e3cb96',
  },
  {
    kind: 'clearing',
    label: 'Tala i desbrossament',
    note: 'Retirada parcial de combustible; conserva restes',
    icon: 'trees',
    group: 'ground',
    geometry: 'line',
    widthM: 60,
    strength: 0.5,
    durationMin: 0,
    color: '#95bb79',
  },
  {
    kind: 'water-line',
    label: "Línia d'aigua",
    note: 'Reducció temporal de propagació',
    icon: 'droplet',
    group: 'ground',
    geometry: 'line',
    widthM: 30,
    strength: 0.7,
    durationMin: 30,
    color: '#5dbad7',
  },
  {
    kind: 'backfire',
    label: 'Contrafoc',
    note: 'Encén la franja en desplegar-la; també crema superfície',
    icon: 'flame',
    group: 'ground',
    geometry: 'line',
    widthM: 30,
    strength: 0,
    durationMin: 0,
    color: '#ec8756',
  },
  {
    kind: 'helicopter',
    label: 'Helicòpter',
    note: 'Bell 412 · fins a 1.350 L per passada',
    icon: 'droplet',
    group: 'air',
    geometry: 'point',
    widthM: 90,
    strength: 0.7,
    durationMin: 20,
    color: '#69c8e1',
  },
  {
    kind: 'amphibious',
    label: 'Avió amfibi',
    note: 'CL-415 · fins a 6.137 L per passada',
    icon: 'plane',
    group: 'air',
    geometry: 'point',
    widthM: 180,
    strength: 0.8,
    durationMin: 30,
    color: '#8bdbea',
  },
  {
    kind: 'retardant',
    label: 'Retardant',
    note: 'AT-802F · fins a 3.104 L per passada',
    icon: 'plane',
    group: 'air',
    geometry: 'line',
    widthM: 60,
    strength: 0.6,
    durationMin: 180,
    color: '#e487a0',
  },
];

export const MAX_COUNTERMEASURES = 100;
export const WIDTH_LIMITS = { min: CELL_M, max: 3000 } as const;
export const DURATION_LIMITS = { min: 1, max: 720 } as const;
export const MAX_VERTICES = 64;
/** Every field of `Countermeasure`; anything else in a file is refused. */
const FIELDS = new Set<string>([
  'id',
  'kind',
  'points',
  'widthM',
  'strength',
  'durationMin',
  'startMin',
  'litresPerPass',
  'passes',
  'passIntervalMin',
  'fuelRemaining',
] satisfies (keyof Countermeasure)[]);
const temporary = (kind: CountermeasureKind) =>
  kind === 'water-line' || kind === 'helicopter' || kind === 'amphibious' || kind === 'retardant';
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const validPoint = (p: unknown): p is Point =>
  Array.isArray(p) &&
  p.length === 2 &&
  finite(p[0]) &&
  finite(p[1]) &&
  Math.abs(p[0]) <= 180 &&
  Math.abs(p[1]) < 85;

/** Strict, bounded and all-or-nothing: a malformed barrier must never disappear silently. */
export function parseCountermeasures(value: unknown): readonly Countermeasure[] | string {
  if (!Array.isArray(value) || value.length > MAX_COUNTERMEASURES)
    return `El pla admet fins a ${MAX_COUNTERMEASURES} contramesures.`;
  const ids = new Set<string>();
  const result: Countermeasure[] = [];
  let vertices = 0;
  for (const raw of value) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return 'Contramesura incorrecta.';
    // A field this version does not know may be one that changes the fire.
    const unknown = Object.keys(raw).find((key) => !FIELDS.has(key));
    if (unknown !== undefined) return `Camp de contramesura desconegut: «${unknown}».`;
    const def = COUNTERMEASURE_CATALOG.find((d) => d.kind === raw.kind);
    if (!def) return 'Tipus de contramesura desconegut.';
    if (typeof raw.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(raw.id) || ids.has(raw.id))
      return 'Identificador de contramesura incorrecte o repetit.';
    if (
      !Array.isArray(raw.points) ||
      !raw.points.every(validPoint) ||
      (def.geometry === 'point' ? raw.points.length !== 1 : raw.points.length < 2) ||
      raw.points.length > MAX_VERTICES
    )
      return 'Geometria de contramesura incorrecta.';
    vertices += raw.points.length;
    if (vertices > 512) return 'El pla supera els 512 vèrtexs.';
    if (
      def.geometry === 'line' &&
      !raw.points.some((p: Point) => p[0] !== raw.points[0][0] || p[1] !== raw.points[0][1])
    )
      return 'La franja necessita dos punts diferents.';
    if (!finite(raw.widthM) || raw.widthM < WIDTH_LIMITS.min || raw.widthM > WIDTH_LIMITS.max)
      return `L'amplada ha d'estar entre ${CELL_M} i 3000 m.`;
    const liquid =
      raw.litresPerPass !== undefined ||
      raw.passes !== undefined ||
      raw.passIntervalMin !== undefined;
    const removal = raw.fuelRemaining !== undefined;
    if (
      liquid &&
      (!liquidKind(def.kind) ||
        !finite(raw.litresPerPass) ||
        raw.litresPerPass < 1 ||
        raw.litresPerPass > liquidCapacity(def.kind) ||
        !Number.isInteger(raw.passes) ||
        raw.passes < 1 ||
        raw.passes > 20 ||
        !finite(raw.passIntervalMin) ||
        raw.passIntervalMin < 1 ||
        raw.passIntervalMin > 120)
    )
      return `Descàrrega incorrecta: 1–${liquidCapacity(def.kind)} L per passada, 1–20 passades i 1–120 min entre passades.`;
    if (
      removal &&
      (def.kind !== 'clearing' ||
        !finite(raw.fuelRemaining) ||
        raw.fuelRemaining < 0.05 ||
        raw.fuelRemaining > 1)
    )
      return 'La tala ha de conservar entre el 5 i el 100 % de la càrrega original.';
    if ((liquid || removal) && (raw.strength !== 0 || raw.durationMin !== 0))
      return 'Les mesures de líquid o càrrega no admeten reducció artificial ni durada fixa.';
    if (!finite(raw.strength) || raw.strength < 0 || raw.strength > 0.95)
      return 'La reducció ha d’estar entre 0 i 95 %.';
    if (
      !finite(raw.durationMin) ||
      (!liquid && temporary(def.kind)
        ? raw.durationMin < DURATION_LIMITS.min || raw.durationMin > DURATION_LIMITS.max
        : raw.durationMin !== 0)
    )
      return 'Durada incorrecta: 1–720 min per als efectes temporals; 0 per als permanents.';
    ids.add(raw.id);
    if (
      raw.startMin !== undefined &&
      (!finite(raw.startMin) || raw.startMin < 0 || raw.startMin > 720)
    )
      return 'El desplegament ha de ser entre 0 i 720 minuts.';
    result.push({
      id: raw.id,
      kind: def.kind,
      points: raw.points.map((p: Point) => [p[0], p[1]] as Point),
      widthM: raw.widthM,
      strength: raw.strength,
      durationMin: raw.durationMin,
      ...(raw.startMin !== undefined ? { startMin: raw.startMin } : {}),
      ...(liquid
        ? {
            litresPerPass: raw.litresPerPass,
            passes: raw.passes,
            passIntervalMin: raw.passIntervalMin,
          }
        : {}),
      ...(removal ? { fuelRemaining: raw.fuelRemaining } : {}),
    });
  }
  return result;
}

function pointSegmentDistance(x: number, y: number, a: Point, b: Point): number {
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  const t =
    dx || dy
      ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)))
      : 0;
  return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
}

/** Distance from a closed cell square to a segment. Touching counts, conservatively. */
function cellDistance(x: number, y: number, a: Point, b: Point): number {
  let lo = 0,
    hi = 1;
  for (let axis = 0; axis < 2; axis++) {
    const min = axis === 0 ? x : y,
      d = b[axis] - a[axis];
    if (d === 0) {
      if (a[axis] < min || a[axis] > min + 1) {
        hi = -1;
        break;
      }
    } else {
      const t0 = (min - a[axis]) / d,
        t1 = (min + 1 - a[axis]) / d;
      lo = Math.max(lo, Math.min(t0, t1));
      hi = Math.min(hi, Math.max(t0, t1));
    }
  }
  if (lo <= hi) return 0;
  const pointRect = (p: Point) =>
    Math.hypot(Math.max(x - p[0], 0, p[0] - x - 1), Math.max(y - p[1], 0, p[1] - y - 1));
  return Math.min(
    pointRect(a),
    pointRect(b),
    pointSegmentDistance(x, y, a, b),
    pointSegmentDistance(x + 1, y, a, b),
    pointSegmentDistance(x, y + 1, a, b),
    pointSegmentDistance(x + 1, y + 1, a, b),
  );
}

/** Every cell touched by the disc/capsule, clipped at the domain boundary. */
export function countermeasureCells(centre: Point, measure: Countermeasure): readonly number[] {
  if (!validPoint(centre)) throw new Error('Centre del domini incorrecte.');
  const [w, s, e, n] = domainAround(centre);
  const points: Point[] = measure.points.map(([lon, lat]) => {
    if (lon < w || lon > e || lat < s || lat > n)
      throw new Error('Una contramesura surt del domini.');
    return [((lon - w) / (e - w)) * GRID, ((n - lat) / (n - s)) * GRID];
  });
  const radius = measure.widthM / CELL_M / 2;
  const cells = new Set<number>();
  for (let i = 0; i < Math.max(1, points.length - 1); i++) {
    const a = points[i],
      b = points[i + 1] ?? a;
    const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0]) - radius));
    const x1 = Math.min(GRID - 1, Math.floor(Math.max(a[0], b[0]) + radius));
    const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1]) - radius));
    const y1 = Math.min(GRID - 1, Math.floor(Math.max(a[1], b[1]) + radius));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++)
        if (cellDistance(x, y, a, b) <= radius + 1e-9) cells.add(y * GRID + x);
  }
  return [...cells];
}

/** Piecewise-constant speed factors, valid from T=0 up to each `until`. */
export interface TreatmentWindow {
  readonly until: number;
  readonly factor: number;
}
export interface CountermeasureField {
  readonly blocked: Uint8Array;
  readonly permanent: Float32Array;
  readonly temporary: ReadonlyMap<number, readonly TreatmentWindow[]>;
  readonly ignitions: readonly number[];
  readonly timedIgnitions: readonly { cell: number; minute: number }[];
}

export function compileCountermeasures(
  centre: Point,
  input: readonly Countermeasure[],
): CountermeasureField {
  const measures = parseCountermeasures(input);
  if (typeof measures === 'string') throw new Error(measures);
  const blocked = new Uint8Array(GRID * GRID);
  const permanent = new Float32Array(GRID * GRID).fill(1);
  const intervals = new Map<number, { from: number; until: number; factor: number }[]>();
  const wet = new Map<number, TreatmentWindow[]>();
  const ignitions = new Set<number>();
  const timedIgnitions = new Map<number, number>();
  for (const measure of measures) {
    if (physicalMeasure(measure)) continue;
    const from = measure.startMin ?? 0;
    for (const cell of countermeasureCells(centre, measure)) {
      const barrier = measure.kind === 'firebreak' || measure.kind === 'defense-line';
      if (barrier && from === 0) blocked[cell] = 1;
      else if (measure.kind === 'clearing' && from === 0)
        permanent[cell] = Math.min(permanent[cell], 1 - measure.strength);
      else if (measure.kind === 'backfire') {
        if (from === 0) ignitions.add(cell);
        else timedIgnitions.set(cell, Math.min(timedIgnitions.get(cell) ?? Infinity, from));
      } else if (barrier || measure.strength > 0) {
        let windows = intervals.get(cell);
        if (!windows) intervals.set(cell, (windows = []));
        windows.push({
          from,
          until: measure.durationMin ? from + measure.durationMin : Infinity,
          factor: barrier ? 0 : 1 - measure.strength,
        });
      }
    }
  }
  for (const [cell, windows] of intervals) {
    const cuts = [...new Set([0, ...windows.flatMap((w) => [w.from, w.until]), Infinity])].sort(
      (a, b) => a - b,
    );
    const schedule: TreatmentWindow[] = [];
    for (let i = 0; i < cuts.length - 1; i++) {
      const factor =
        Math.min(
          permanent[cell],
          ...windows.filter((w) => w.from <= cuts[i] && w.until > cuts[i]).map((w) => w.factor),
        ) / permanent[cell];
      const last = schedule.at(-1);
      if (last?.factor === factor) schedule[schedule.length - 1] = { until: cuts[i + 1], factor };
      else schedule.push({ until: cuts[i + 1], factor });
    }
    wet.set(cell, schedule);
  }
  return {
    blocked,
    permanent,
    temporary: wet,
    ignitions: [...ignitions],
    timedIgnitions: [...timedIgnitions]
      .filter(([cell]) => !ignitions.has(cell))
      .map(([cell, minute]) => ({ cell, minute })),
  };
}

export function treatmentFactor(
  windows: readonly TreatmentWindow[] | undefined,
  minute: number,
): number {
  return windows?.find((w) => minute < w.until)?.factor ?? 1;
}

/** Integrate distance, splitting at expiry. This preserves FIFO arrival times for Dijkstra. */
export function treatedTravel(
  distance: number,
  rate: number,
  start: number,
  windows: readonly TreatmentWindow[] | undefined,
): number {
  let remaining = distance,
    now = start;
  for (const window of windows ?? []) {
    if (window.until <= now) continue;
    const speed = rate * window.factor;
    if (speed === 0 && window.until === Infinity) return Infinity;
    const available = window.until - now;
    if (remaining <= speed * available) return now - start + remaining / speed;
    remaining -= speed * available;
    now = window.until;
  }
  return now - start + remaining / rate;
}
