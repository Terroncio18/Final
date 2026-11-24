import { CELL_M, domainAround, GRID } from './domain';
import type { Point } from './point';
import type { JsonObject, JsonValue } from './json-value';

export type CountermeasureKind =
  | 'defense-line'
  | 'firebreak'
  | 'clearing'
  | 'water-line'
  | 'backfire'
  | 'helicopter'
  | 'amphibious'
  | 'retardant'
  | 'mop-up';

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
  // Without crew fields the measure activates whole at startMin. With all three, construction
  // advances from the first vertex in drawing order.
  /** Minutes from the decision (startMin) until the crew starts working on site. */
  readonly arrivalMin?: number;

  readonly crewSize?: number;
  /** Production per person: metres of line per hour, or hectares per hour for mop-up. */
  readonly ratePerPerson?: number;
}

const CREW_KINDS = ['defense-line', 'firebreak', 'clearing', 'water-line', 'mop-up'] as const;
export type CrewKind = (typeof CREW_KINDS)[number];
export const crewKind = (kind: CountermeasureKind): kind is CrewKind =>
  (CREW_KINDS as readonly string[]).includes(kind);
const crewMeasure = (m: Countermeasure) => m.crewSize !== undefined;

interface CrewDefault {
  readonly arrivalMin: number;
  readonly crewSize: number;
  readonly ratePerPerson: number;
  readonly unit: 'm/h' | 'ha/h';
  readonly source: string;
  /** True where no published rate was found: an editable stand-in, not a datum. */
  readonly placeholder: boolean;
}

// NWCG's sustained 471 ft/h is for a 20-person crew in brush (model 5), Type II direct attack:
// about 7 m/h per person. The hose rate is for initial action, not sustained work.
export const CREW_DEFAULTS: Readonly<Record<CrewKind, CrewDefault>> = {
  'defense-line': {
    arrivalMin: 0,
    crewSize: 20,
    ratePerPerson: 7,
    unit: 'm/h',
    source:
      'NWCG Fire Line Production Rate Tables (2021), sustained line production for a 20-person crew, fuel model 5 (brush), Type II & II IA direct attack: 471 ft/h, about 7 m/h per person',
    placeholder: false,
  },
  firebreak: {
    arrivalMin: 0,
    crewSize: 20,
    ratePerPerson: 40.2,
    unit: 'm/h',
    source: 'Placeholder: editable firebreak production assumption; no published source',
    placeholder: true,
  },
  clearing: {
    arrivalMin: 0,
    crewSize: 20,
    ratePerPerson: 40.2,
    unit: 'm/h',
    source: 'Placeholder: editable clearing production assumption; no published source',
    placeholder: true,
  },
  'water-line': {
    arrivalMin: 0,
    crewSize: 4,
    ratePerPerson: 80.5,
    unit: 'm/h',
    source:
      'NWCG Fire Line Production Rate Tables (2021), initial action by engine crews, fuel model 5, 4 persons, 16 chains/h',
    placeholder: false,
  },
  'mop-up': {
    arrivalMin: 0,
    crewSize: 20,
    ratePerPerson: 0.05,
    unit: 'ha/h',
    source: 'Placeholder: no published mop-up rate found (Ortega et al. 2023 exclude mop-up)',
    placeholder: true,
  },
};
export const CREW_LIMITS = {
  arrivalMin: { min: 0, max: 720 },
  crewSize: { min: 1, max: 500 },
  'm/h': { min: 1, max: 2000 },
  'ha/h': { min: 0.001, max: 10 },
} as const;

interface CrewSchedule {
  readonly cells: readonly number[];
  /** Minute each cell is done, aligned with cells. */
  readonly minutes: Float32Array;
  readonly workStart: number;
  readonly workEnd: number;
  /** Length of the polyline, metres. */
  readonly lengthM: number;
}

interface CrewHead {
  readonly point: Point;
  readonly builtM: number;
  readonly done: boolean;
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
    name: 'De Havilland DHC-515',
    capacityL: 7000,
    source: 'https://dehavilland.com/wp-content/uploads/2025/01/DHC-515_Spec_Sheet_v14_DIGITAL.pdf',
  },
  retardant: {
    name: 'Air Tractor AT-802F',
    capacityL: 3104,
    source: 'https://airtractor.com/wp-content/uploads/2022/09/Air-Tractor_802F-Brochure_2022.pdf',
  },
} as const;

export function dropPoint(measure: Pick<Countermeasure, 'points'>): Point {
  const points = measure.points;
  if (points.length === 1) return points[0];
  const i = Math.floor((points.length - 1) / 2);
  const a = points[i],
    b = points[i + 1] ?? a;
  return points.length % 2 === 0 ? [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] : a;
}

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
    note: 'DHC-515 · fins a 7.000 L per passada',
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
  {
    kind: 'mop-up',
    label: 'Extinció de restes',
    note: 'Brigades · flames fins a 1,2 m',
    icon: 'flame',
    group: 'ground',
    geometry: 'line',
    widthM: 60,
    strength: 0,
    durationMin: 0,
    color: '#8fc3dc',
  },
];

// Maximum hand-tool flame length: 4 ft, the first Andrews & Rothermel (1982) control band. Mop-up
// is refused above it.
export const MOP_UP_MAX_FLAME_M = 1.2;

const MAX_COUNTERMEASURES = 100;
export const WIDTH_LIMITS = { min: CELL_M, max: 3000 } as const;
export const DURATION_LIMITS = { min: 1, max: 720 } as const;
export const MAX_VERTICES = 64;

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
  'arrivalMin',
  'crewSize',
  'ratePerPerson',
] satisfies (keyof Countermeasure)[]);
const temporary = (kind: CountermeasureKind) =>
  kind === 'water-line' || kind === 'helicopter' || kind === 'amphibious' || kind === 'retardant';
const finite = (n: JsonValue | undefined): n is number =>
  typeof n === 'number' && Number.isFinite(n);
const validPoint = (p: JsonValue | Point | undefined): p is Point =>
  Array.isArray(p) &&
  p.length === 2 &&
  finite(p[0]) &&
  finite(p[1]) &&
  Math.abs(p[0]) <= 180 &&
  Math.abs(p[1]) < 85;

type UncheckedMeasure = JsonObject | Countermeasure;

function isMeasureObject(value: JsonValue | Countermeasure): value is UncheckedMeasure {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function identifyMeasure(
  raw: JsonValue | Countermeasure,
): { raw: UncheckedMeasure; definition: MeasureDefinition } | string {
  if (!isMeasureObject(raw)) return 'Contramesura incorrecta.';
  // A field this version does not know may be one that changes the fire.
  const unknown = Object.keys(raw).find((key) => !FIELDS.has(key));
  if (unknown !== undefined) return `Camp de contramesura desconegut: «${unknown}».`;
  const def = COUNTERMEASURE_CATALOG.find((d) => d.kind === raw.kind);
  return def ? { raw, definition: def } : 'Tipus de contramesura desconegut.';
}

function validateCrewFields(
  raw: UncheckedMeasure,
  def: MeasureDefinition,
): Pick<Countermeasure, 'arrivalMin' | 'crewSize' | 'ratePerPerson'> | string {
  const crew = ['arrivalMin', 'crewSize', 'ratePerPerson'].some((key) => key in raw);
  if (!crew) return {};
  if (!crewKind(def.kind)) return 'Aquest tipus de contramesura no admet brigades.';
  const { arrivalMin, crewSize, ratePerPerson } = raw;
  if (!finite(arrivalMin) || !finite(crewSize) || !finite(ratePerPerson))
    return 'La brigada necessita arribada, efectius i rendiment, tots tres numèrics.';
  if (arrivalMin < CREW_LIMITS.arrivalMin.min || arrivalMin > CREW_LIMITS.arrivalMin.max)
    return 'L’arribada de la brigada ha de ser entre 0 i 720 minuts.';
  if (
    !Number.isInteger(crewSize) ||
    crewSize < CREW_LIMITS.crewSize.min ||
    crewSize > CREW_LIMITS.crewSize.max
  )
    return 'La brigada ha de tenir entre 1 i 500 efectius, sense decimals.';
  const unit = def.kind === 'mop-up' ? 'ha/h' : 'm/h';
  const limits = CREW_LIMITS[unit];
  if (ratePerPerson < limits.min || ratePerPerson > limits.max)
    return `El rendiment per efectiu ha de ser entre ${limits.min} i ${limits.max} ${unit}.`;
  return { arrivalMin, crewSize, ratePerPerson };
}

function validateIdentifier(
  raw: UncheckedMeasure,
  ids: ReadonlySet<string>,
): Pick<Countermeasure, 'id'> | string {
  if (typeof raw.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(raw.id) || ids.has(raw.id))
    return 'Identificador de contramesura incorrecte o repetit.';
  return { id: raw.id };
}

function validatePointsShape(
  raw: UncheckedMeasure,
  def: MeasureDefinition,
): Pick<Countermeasure, 'points'> | string {
  if (
    !Array.isArray(raw.points) ||
    !raw.points.every(validPoint) ||
    (def.geometry === 'point' ? raw.points.length !== 1 : raw.points.length < 2) ||
    raw.points.length > MAX_VERTICES
  )
    return 'Geometria de contramesura incorrecta.';
  return { points: raw.points };
}

function validateLineDistinct(
  points: readonly Point[],
  def: MeasureDefinition,
): string | undefined {
  if (
    def.geometry === 'line' &&
    !points.some((p) => p[0] !== points[0][0] || p[1] !== points[0][1])
  )
    return 'La franja necessita dos punts diferents.';
  return undefined;
}

function validateWidth(raw: UncheckedMeasure): Pick<Countermeasure, 'widthM'> | string {
  if (!finite(raw.widthM) || raw.widthM < WIDTH_LIMITS.min || raw.widthM > WIDTH_LIMITS.max)
    return `L'amplada ha d'estar entre ${CELL_M} i 3000 m.`;
  return { widthM: raw.widthM };
}

function physicalFlags(raw: UncheckedMeasure): { liquid: boolean; removal: boolean } {
  const liquid =
    raw.litresPerPass !== undefined ||
    raw.passes !== undefined ||
    raw.passIntervalMin !== undefined;
  const removal = raw.fuelRemaining !== undefined;
  return { liquid, removal };
}

function validateLiquid(
  raw: UncheckedMeasure,
  def: MeasureDefinition,
  liquid: boolean,
): Pick<Countermeasure, 'litresPerPass' | 'passes' | 'passIntervalMin'> | string {
  if (!liquid) return {};
  if (
    !liquidKind(def.kind) ||
    !finite(raw.litresPerPass) ||
    raw.litresPerPass < 1 ||
    raw.litresPerPass > liquidCapacity(def.kind) ||
    !finite(raw.passes) ||
    !Number.isInteger(raw.passes) ||
    raw.passes < 1 ||
    raw.passes > 20 ||
    !finite(raw.passIntervalMin) ||
    raw.passIntervalMin < 1 ||
    raw.passIntervalMin > 120
  )
    return `Descàrrega incorrecta: 1–${liquidCapacity(def.kind)} L per passada, 1–20 passades i 1–120 min entre passades.`;
  return {
    litresPerPass: raw.litresPerPass,
    passes: raw.passes,
    passIntervalMin: raw.passIntervalMin,
  };
}

function validateRemoval(
  raw: UncheckedMeasure,
  def: MeasureDefinition,
  removal: boolean,
): Pick<Countermeasure, 'fuelRemaining'> | string {
  if (!removal) return {};
  if (
    def.kind !== 'clearing' ||
    !finite(raw.fuelRemaining) ||
    raw.fuelRemaining < 0.05 ||
    raw.fuelRemaining > 1
  )
    return 'La tala ha de conservar entre el 5 i el 100 % de la càrrega original.';
  return { fuelRemaining: raw.fuelRemaining };
}

function validateStrengthDuration(
  raw: UncheckedMeasure,
  def: MeasureDefinition,
  liquid: boolean,
  removal: boolean,
): Pick<Countermeasure, 'strength' | 'durationMin'> | string {
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
  return { strength: raw.strength, durationMin: raw.durationMin };
}

function validateStartMin(raw: UncheckedMeasure): Pick<Countermeasure, 'startMin'> | string {
  if (
    raw.startMin !== undefined &&
    (!finite(raw.startMin) || raw.startMin < 0 || raw.startMin > 720)
  )
    return 'El desplegament ha de ser entre 0 i 720 minuts.';
  return raw.startMin !== undefined ? { startMin: raw.startMin } : {};
}

/** Strict, bounded and all-or-nothing: a malformed barrier must never disappear silently. */
export function parseCountermeasures(
  value: JsonValue | readonly Countermeasure[],
): readonly Countermeasure[] | string {
  if (!Array.isArray(value) || value.length > MAX_COUNTERMEASURES)
    return `El pla admet fins a ${MAX_COUNTERMEASURES} contramesures.`;
  const ids = new Set<string>();
  const result: Countermeasure[] = [];
  const measures: readonly (JsonValue | Countermeasure)[] = value;
  let vertices = 0;
  for (const measure of measures) {
    const identified = identifyMeasure(measure);
    if (typeof identified === 'string') return identified;
    const { raw, definition } = identified;
    const crew = validateCrewFields(raw, definition);
    if (typeof crew === 'string') return crew;
    const identifier = validateIdentifier(raw, ids);
    if (typeof identifier === 'string') return identifier;
    const geometry = validatePointsShape(raw, definition);
    if (typeof geometry === 'string') return geometry;
    vertices += geometry.points.length;
    if (vertices > 512) return 'El pla supera els 512 vèrtexs.';
    const lineError = validateLineDistinct(geometry.points, definition);
    if (lineError) return lineError;
    const width = validateWidth(raw);
    if (typeof width === 'string') return width;
    const { liquid, removal } = physicalFlags(raw);
    const liquidFields = validateLiquid(raw, definition, liquid);
    if (typeof liquidFields === 'string') return liquidFields;
    const removalFields = validateRemoval(raw, definition, removal);
    if (typeof removalFields === 'string') return removalFields;
    const strengthDuration = validateStrengthDuration(raw, definition, liquid, removal);
    if (typeof strengthDuration === 'string') return strengthDuration;
    ids.add(identifier.id);
    const start = validateStartMin(raw);
    if (typeof start === 'string') return start;
    result.push({
      ...identifier,
      kind: definition.kind,
      points: geometry.points.map((point): Point => [point[0], point[1]]),
      ...width,
      ...strengthDuration,
      ...start,
      ...liquidFields,
      ...removalFields,
      ...crew,
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

/** Metres per minute, with mop-up's area production converted to line length. */
function crewSpeed(m: Countermeasure): number {
  const production = (m.crewSize! * m.ratePerPerson!) / 60;
  return m.kind === 'mop-up' ? (production * 10000) / m.widthM : production;
}

function lineLengths(points: readonly Point[]): number[] {
  return points.slice(1).map((b, i) => Math.hypot(b[0] - points[i][0], b[1] - points[i][1]));
}

/** Project cell centres, retaining the first segment when distances tie. */
export function crewSchedule(centre: Point, m: Countermeasure): CrewSchedule | undefined {
  if (!crewMeasure(m)) return undefined;
  const cells = countermeasureCells(centre, m);
  const [w, s, e, n] = domainAround(centre);
  const points: Point[] = m.points.map(([lon, lat]) => [
    ((lon - w) / (e - w)) * GRID * CELL_M,
    ((n - lat) / (n - s)) * GRID * CELL_M,
  ]);
  const lengths = lineLengths(points);
  const lengthM = lengths.reduce((sum, length) => sum + length, 0);
  const workStart = (m.startMin ?? 0) + m.arrivalMin!;
  const speed = crewSpeed(m);
  const minutes = new Float32Array(cells.length);
  const bits = new Uint32Array(minutes.buffer);
  for (let c = 0; c < cells.length; c++) {
    const x = ((cells[c] % GRID) + 0.5) * CELL_M;
    const y = (Math.floor(cells[c] / GRID) + 0.5) * CELL_M;
    let nearest = Infinity,
      along = 0,
      passed = 0;
    for (let i = 0; i < lengths.length; i++) {
      const a = points[i],
        b = points[i + 1];
      const dx = b[0] - a[0],
        dy = b[1] - a[1];
      const fraction = lengths[i]
        ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (lengths[i] * lengths[i])))
        : 0;
      const distance = Math.hypot(x - a[0] - fraction * dx, y - a[1] - fraction * dy);
      if (distance < nearest) {
        nearest = distance;
        along = passed + fraction * lengths[i];
      }
      passed += lengths[i];
    }
    const activation = workStart + along / speed;
    minutes[c] = activation;
    // As with timed ignitions, stored precision must not deploy work in the past.
    if (minutes[c] < activation) bits[c] += 1;
  }
  return { cells, minutes, workStart, workEnd: workStart + lengthM / speed, lengthM };
}

export function crewHead(m: Countermeasure, minute: number, stoppedMin = Infinity): CrewHead {
  // A local domain supplies the same metric as the grid without needing its centre.
  const origin: Point = [
    (Math.min(...m.points.map((p) => p[0])) + Math.max(...m.points.map((p) => p[0]))) / 2,
    (Math.min(...m.points.map((p) => p[1])) + Math.max(...m.points.map((p) => p[1]))) / 2,
  ];
  const [w, s, e, n] = domainAround(origin);
  const metric: Point[] = m.points.map(([lon, lat]) => [
    ((lon - w) / (e - w)) * GRID * CELL_M,
    ((n - lat) / (n - s)) * GRID * CELL_M,
  ]);
  const lengths = lineLengths(metric);
  const lengthM = lengths.reduce((sum, length) => sum + length, 0);
  const workStart = (m.startMin ?? 0) + (m.arrivalMin ?? 0);
  const builtM = crewMeasure(m)
    ? Math.max(0, Math.min(lengthM, (Math.min(minute, stoppedMin) - workStart) * crewSpeed(m)))
    : minute >= workStart
      ? lengthM
      : 0;
  let remaining = builtM;
  for (let i = 0; i < lengths.length; i++) {
    if (remaining <= lengths[i] && lengths[i] > 0) {
      const f = remaining / lengths[i],
        a = m.points[i],
        b = m.points[i + 1];
      return {
        point: [a[0] + f * (b[0] - a[0]), a[1] + f * (b[1] - a[1])],
        builtM,
        done: builtM >= lengthM,
      };
    }
    remaining -= lengths[i];
  }
  return { point: m.points[m.points.length - 1], builtM, done: builtM >= lengthM };
}

/** Piecewise-constant speed factors, valid from T=0 up to each `until`. */
interface TreatmentWindow {
  readonly until: number;
  readonly factor: number;
}
interface CountermeasureField {
  // Mopped-up cells neither emit nor receive fire from the specified minute.
  readonly mopUp: ReadonlyMap<number, number>;
  readonly blocked: Uint8Array;
  readonly permanent: Float32Array;
  readonly temporary: ReadonlyMap<number, readonly TreatmentWindow[]>;
  readonly ignitions: readonly number[];
  readonly timedIgnitions: readonly { cell: number; minute: number }[];
}

interface PendingWindow {
  readonly from: number;
  readonly until: number;
  readonly factor: number;
}

interface MeasureEffects {
  readonly blocked: Uint8Array;
  readonly permanent: Float32Array;
  readonly intervals: Map<number, PendingWindow[]>;
  readonly ignitions: Set<number>;
  readonly timedIgnitions: Map<number, number>;
  readonly mopUp: Map<number, number>;
}

const isBarrierKind = (kind: CountermeasureKind): boolean =>
  kind === 'firebreak' || kind === 'defense-line' || kind === 'mop-up';

function applyMeasureEffect(
  measure: Countermeasure,
  cell: number,
  from: number,
  effects: MeasureEffects,
): void {
  const { blocked, permanent, intervals, ignitions, timedIgnitions, mopUp } = effects;
  // Mop-up closes the cell like a late barrier and also extinguishes fire already present there.
  if (measure.kind === 'mop-up') mopUp.set(cell, Math.min(mopUp.get(cell) ?? Infinity, from));
  const barrier = isBarrierKind(measure.kind);
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

function applyMeasure(
  centre: Point,
  measure: Countermeasure,
  crewStops: ReadonlyMap<string, number>,
  effects: MeasureEffects,
): void {
  const schedule = crewSchedule(centre, measure);
  const cells = schedule?.cells ?? countermeasureCells(centre, measure);
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const from = schedule?.minutes[i] ?? measure.startMin ?? 0;
    if (schedule && from > (crewStops.get(measure.id) ?? Infinity)) continue;
    applyMeasureEffect(measure, cell, from, effects);
  }
}

function buildTreatmentWindows(
  intervals: ReadonlyMap<number, readonly PendingWindow[]>,
  permanent: Float32Array,
): Map<number, TreatmentWindow[]> {
  const wet = new Map<number, TreatmentWindow[]>();
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
  return wet;
}

export function compileCountermeasures(
  centre: Point,
  input: readonly Countermeasure[],
  crewStops: ReadonlyMap<string, number> = new Map(),
): CountermeasureField {
  const measures = parseCountermeasures(input);
  if (typeof measures === 'string') throw new Error(measures);
  const effects: MeasureEffects = {
    blocked: new Uint8Array(GRID * GRID),
    permanent: new Float32Array(GRID * GRID).fill(1),
    intervals: new Map(),
    ignitions: new Set(),
    timedIgnitions: new Map(),
    mopUp: new Map(),
  };
  for (const measure of measures) {
    if (physicalMeasure(measure)) continue;
    applyMeasure(centre, measure, crewStops, effects);
  }
  return {
    mopUp: effects.mopUp,
    blocked: effects.blocked,
    permanent: effects.permanent,
    temporary: buildTreatmentWindows(effects.intervals, effects.permanent),
    ignitions: [...effects.ignitions],
    timedIgnitions: [...effects.timedIgnitions]
      .filter(([cell]) => !effects.ignitions.has(cell))
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
