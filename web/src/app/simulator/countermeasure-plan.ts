import { computed, signal } from '@angular/core';
import {
  COUNTERMEASURE_CATALOG,
  AIRCRAFT,
  liquidKind,
  liquidCapacity,
  WIDTH_LIMITS,
  DURATION_LIMITS,
  MAX_VERTICES,
  parseCountermeasures,
  CREW_DEFAULTS,
  crewHead,
  crewKind,
  type Countermeasure,
  type CountermeasureKind,
} from '../simulation/countermeasures';
import type { Point } from '../simulation/point';

// Bounds order: west, south, east, north.
export type Bounds = readonly [number, number, number, number];

interface PlanNote {
  readonly text: string;
  readonly failed: boolean;
}

// Tool limits match model validation. A strip narrower than one cell cannot be resolved by the
// grid.
export { WIDTH_LIMITS, DURATION_LIMITS, MAX_VERTICES } from '../simulation/countermeasures';

const BARRIERS: ReadonlySet<CountermeasureKind> = new Set(['defense-line', 'firebreak']);

export function catalogEntry(kind: CountermeasureKind) {
  return COUNTERMEASURE_CATALOG.find((entry) => entry.kind === kind)!;
}

export interface ToolSettings {
  readonly widthM: number;
  readonly litresPerPass?: number;
  readonly passes?: number;
  readonly passIntervalMin?: number;
  readonly fuelRemaining?: number;

  readonly arrivalMin?: number;
  readonly crewSize?: number;
  readonly ratePerPerson?: number;
}

export function defaultSettings(kind: CountermeasureKind): ToolSettings {
  return {
    widthM: catalogEntry(kind).widthM,
    ...(liquidKind(kind)
      ? {
          litresPerPass: kind === 'water-line' ? 1000 : liquidCapacity(kind),
          passes: 1,
          passIntervalMin: 10,
        }
      : {}),
    ...(kind === 'clearing' ? { fuelRemaining: 0.2 } : {}),
    ...(crewKind(kind)
      ? {
          arrivalMin: CREW_DEFAULTS[kind].arrivalMin,
          crewSize: CREW_DEFAULTS[kind].crewSize,
          ratePerPerson: CREW_DEFAULTS[kind].ratePerPerson,
        }
      : {}),
  };
}

export function workStart(measure: Countermeasure): number | null {
  if (measure.crewSize === undefined) return null;
  return (measure.startMin ?? 0) + (measure.arrivalMin ?? 0);
}

// After the last aircraft pass the visual agent disappears; its water remains effective until it
// dries.
export function lastPass(measure: Countermeasure): number | null {
  if (measure.litresPerPass === undefined) return null;
  return (measure.startMin ?? 0) + ((measure.passes ?? 1) - 1) * (measure.passIntervalMin ?? 0);
}

function measureFrom(
  kind: CountermeasureKind,
  settings: ToolSettings,
  id: string,
  points: readonly Point[],
  minute: number,
): Countermeasure {
  const physical = liquidKind(kind) || kind === 'clearing';
  const entry = catalogEntry(kind);
  return {
    id,
    kind,
    points: [...points],
    widthM: settings.widthM,
    strength: physical ? 0 : entry.strength,
    durationMin: physical ? 0 : entry.durationMin,
    ...(liquidKind(kind)
      ? {
          litresPerPass: settings.litresPerPass,
          passes: settings.passes,
          passIntervalMin: settings.passIntervalMin,
        }
      : {}),
    ...(kind === 'clearing' ? { fuelRemaining: settings.fuelRemaining } : {}),
    ...(crewKind(kind) && settings.crewSize !== undefined
      ? {
          arrivalMin: settings.arrivalMin,
          crewSize: settings.crewSize,
          ratePerPerson: settings.ratePerPerson,
        }
      : {}),
    ...(minute > 0 ? { startMin: minute } : {}),
  };
}

export function checkSettings(kind: CountermeasureKind, settings: ToolSettings): string | null {
  const points: Point[] =
    catalogEntry(kind).geometry === 'point'
      ? [[0, 0]]
      : [
          [0, 0],
          [0.01, 0],
        ];
  const checked = parseCountermeasures([measureFrom(kind, settings, 'probe', points, 0)]);
  return typeof checked === 'string' ? checked : null;
}

function inside(point: Point, [west, south, east, north]: Bounds): boolean {
  return point[0] >= west && point[0] <= east && point[1] >= south && point[1] <= north;
}

// Polyline length in metres, using flat-earth distances over a roughly 30 km domain.
export function lengthM(points: readonly Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const [lon0, lat0] = points[i - 1];
    const [lon1, lat1] = points[i];
    const north = (lat1 - lat0) * 111_320;
    const east = (lon1 - lon0) * 111_320 * Math.cos((((lat0 + lat1) / 2) * Math.PI) / 180);
    total += Math.hypot(north, east);
  }
  return total;
}

function liquidTotals(measure: Countermeasure): {
  litresPerPass: number;
  passes: number;
  passIntervalMin: number;
  totalLitres: number;
} {
  const litresPerPass = measure.litresPerPass ?? 0;
  const passes = measure.passes ?? 1;
  return {
    litresPerPass,
    passes,
    passIntervalMin: measure.passIntervalMin ?? 10,
    totalLitres: litresPerPass * passes,
  };
}

function formatDeployment(start: number): string {
  return `T + ${Math.floor(start / 60)
    .toString()
    .padStart(2, '0')}:${Math.floor(start % 60)
    .toString()
    .padStart(2, '0')}:${Math.floor((start * 60) % 60)
    .toString()
    .padStart(2, '0')}`;
}

function crewStatusLabel(
  stopped: number | undefined,
  minute: number,
  working: number,
  head: ReturnType<typeof crewHead>,
  built: number,
): string {
  if (stopped !== undefined && minute >= stopped) return `Aturada per seguretat · ${built} %`;
  if (minute < working) return 'En camí';
  return head.done ? 'Feta' : `En construcció · ${built} %`;
}

function crewProgress(
  measure: Countermeasure,
  minute: number,
  start: number,
  metres: number,
  stopped: number | undefined,
): { readonly built: number; readonly crewStatus: string | null } {
  if (measure.crewSize === undefined) return { built: 0, crewStatus: null };
  const working = workStart(measure) ?? start;
  const head = crewHead(measure, minute, stopped);
  const built = metres > 0 ? Math.min(100, Math.round((head.builtM / metres) * 100)) : 0;
  return { built, crewStatus: crewStatusLabel(stopped, minute, working, head, built) };
}

function statusLabel(
  start: number,
  minute: number,
  crewStatus: string | null,
  liquid: boolean,
  measure: Countermeasure,
  completed: number,
  expired: boolean,
): string {
  if (start > minute) return 'Programada';
  if (crewStatus) return crewStatus;
  if (liquid) return `${completed}/${measure.passes} passades · humectació`;
  return expired ? 'Caducada' : 'Desplegada';
}

function shapeLabel(
  geometry: 'line' | 'point',
  metres: number,
  whole: Intl.NumberFormat,
  one: Intl.NumberFormat,
): string {
  if (geometry === 'point') return 'Descàrrega puntual';
  return metres >= 1000 ? `${one.format(metres / 1000)} km` : `${whole.format(metres)} m`;
}

function crewTextLabel(
  measure: Countermeasure,
  whole: Intl.NumberFormat,
  one: Intl.NumberFormat,
  crew: boolean,
): string {
  if (!crew) return '';
  const unit = measure.kind === 'mop-up' ? 'ha/h' : 'm/h';
  return `${whole.format(measure.crewSize!)} efectius × ${one.format(measure.ratePerPerson!)} ${unit} · arribada ${whole.format(measure.arrivalMin!)} min`;
}

function effectLabel(
  measure: Countermeasure,
  whole: Intl.NumberFormat,
  liquid: boolean,
  removal: boolean,
  backfire: boolean,
  barrier: boolean,
  percent: number,
): string {
  if (liquid)
    return `${whole.format(measure.litresPerPass!)} L × ${measure.passes} · cada ${measure.passIntervalMin} min`;
  if (removal) return `${Math.round(measure.fuelRemaining! * 100)} % de combustible restant`;
  if (backfire) return 'Ignició en desplegar-la';
  if (barrier) return 'Barrera permanent';
  return measure.durationMin > 0
    ? `−${percent} % de propagació, ${measure.durationMin} min`
    : `−${percent} % de propagació, permanent`;
}

// New measures use the paused playback cursor. Measures that have already affected the past cannot
// be edited retroactively.
export class CountermeasurePlan {
  public readonly measures = signal<readonly Countermeasure[]>([]);

  public readonly kind = signal<CountermeasureKind | null>(null);

  public readonly draft = signal<readonly Point[]>([]);
  public readonly selected = signal<string | null>(null);
  public readonly note = signal<PlanNote | null>(null);
  public readonly minute = signal(0);
  // Stop time in simulation minutes, keyed by measure id and supplied by the model.
  public readonly crewStops = signal<ReadonlyMap<string, number>>(new Map());

  public readonly discarding = signal(false);
  public guard: ((measure: Countermeasure) => string | null) | null = null;

  private nextId = 1;

  public readonly settings = signal<ToolSettings | null>(null);
  public readonly later = computed(() =>
    this.measures().filter((measure) => (measure.startMin ?? 0) > this.minute()),
  );
  public readonly hasEditable = computed(() =>
    this.measures().some((m) => (m.startMin ?? 0) >= this.minute()),
  );

  public readonly tool = computed(() => {
    const kind = this.kind();
    if (!kind) return null;
    const settings = this.settings() ?? defaultSettings(kind);
    return { ...catalogEntry(kind), widthM: settings.widthM };
  });

  public readonly openRows = computed(() => this.rows().filter((row) => !row.finished));
  public readonly finishedRows = computed(() => this.rows().filter((row) => row.finished));

  public readonly canFinish = computed(() => this.draft().length >= 2);

  public readonly rows = computed(() => {
    const counts = new Map<CountermeasureKind, number>();
    const whole = new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 0 });
    const one = new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 1 });
    return this.measures().map((measure) => this.describeMeasure(measure, whole, one, counts));
  });

  public isLocked(id: string): boolean {
    const measure = this.measures().find((m) => m.id === id);
    return !!measure && (measure.startMin ?? 0) < this.minute();
  }

  public begin(kind: CountermeasureKind, discard = false, settings?: ToolSettings): void {
    const same = this.kind() === kind && !settings;
    this.draft.set([]);
    this.kind.set(same ? null : kind);
    this.settings.set(same ? null : (settings ?? null));
    this.discarding.set(!same && discard);
    this.note.set(null);
  }

  public cancel(): void {
    this.draft.set([]);
    this.kind.set(null);
    this.settings.set(null);
    this.discarding.set(false);
  }

  public click(point: Point, bounds: Bounds): void {
    const tool = this.tool();
    if (!tool) return;
    if (!inside(point, bounds)) {
      this.note.set({ text: 'Fora del domini: fes clic dins del quadrat simulat.', failed: true });
      return;
    }
    const here: Point = [point[0], point[1]];

    if (tool.geometry === 'point') {
      if (this.add(tool.kind, [here])) this.cancel();
      return;
    }
    const last = this.draft().at(-1);
    if (last && last[0] === here[0] && last[1] === here[1]) return;
    if (this.draft().length >= MAX_VERTICES) {
      this.note.set({
        text: `Una línia admet fins a ${MAX_VERTICES} vèrtexs: finalitza-la i continua amb una altra.`,
        failed: true,
      });
      return;
    }
    this.draft.update((points) => [...points, here]);
    this.note.set(null);
  }

  public undo(): void {
    if (this.draft().length <= 1) {
      this.cancel();
      return;
    }
    this.draft.update((points) => points.slice(0, -1));
  }

  public finish(): void {
    const kind = this.kind();
    if (!kind) return;
    if (!this.canFinish()) {
      this.note.set({ text: 'Una línia necessita almenys dos punts.', failed: true });
      return;
    }
    if (this.add(kind, this.draft())) this.cancel();
  }

  public remove(id: string): void {
    if (this.isLocked(id)) {
      this.historyNote();
      return;
    }
    this.commit(
      this.measures().filter((measure) => measure.id !== id),
      null,
    );
    if (this.selected() === id) this.selected.set(null);
  }

  public clear(): void {
    this.cancel();
    const retained = this.measures().filter((m) => this.isLocked(m.id));
    if (retained.length === this.measures().length && retained.length) {
      this.historyNote();
      return;
    }
    this.commit(retained, retained.length ? 'Es conserven les mesures ja desplegades.' : null);
    this.selected.set(null);
  }

  public select(id: string | null): void {
    this.selected.set(id && this.measures().some((measure) => measure.id === id) ? id : null);
  }

  public setWidth(id: string, value: number): boolean {
    if (!Number.isFinite(value) || value < WIDTH_LIMITS.min || value > WIDTH_LIMITS.max) {
      this.note.set({
        text: `L’amplada ha d’anar de ${WIDTH_LIMITS.min} a ${WIDTH_LIMITS.max} m: la graella és de 30 m i no resol franges més estretes.`,
        failed: true,
      });
      return false;
    }
    return this.patch(id, { widthM: Math.round(value) });
  }

  public setDuration(id: string, value: number): boolean {
    if (!Number.isFinite(value) || value < DURATION_LIMITS.min || value > DURATION_LIMITS.max) {
      this.note.set({
        text: `La durada ha d’anar de ${DURATION_LIMITS.min} a ${DURATION_LIMITS.max} minuts.`,
        failed: true,
      });
      return false;
    }
    return this.patch(id, { durationMin: Math.round(value) });
  }

  public setStrength(id: string, percent: number): boolean {
    if (!Number.isFinite(percent) || percent < 0 || percent > 95) {
      this.note.set({ text: 'La reducció experimental ha d’anar de 0 a 95 %.', failed: true });
      return false;
    }
    return this.patch(id, { strength: percent / 100 });
  }

  public replace(measures: readonly Countermeasure[], bounds: Bounds | null): void {
    const renumbered = measures.map((measure, i) => ({ ...measure, id: `m${i + 1}` }));
    const checked = parseCountermeasures(renumbered);
    if (typeof checked === 'string') {
      this.note.set({ text: checked, failed: true });
      return;
    }
    this.cancel();
    this.selected.set(null);
    // Regenerate ids because separate scenario files may both contain m1.
    this.nextId = checked.length + 1;
    this.measures.set(checked);
    this.note.set(null);
    this.confine(bounds);
  }

  public confine(bounds: Bounds | null): void {
    this.draft.set([]);
    const plan = this.measures();
    if (!plan.length) return;
    const kept = bounds
      ? plan.filter((measure) => measure.points.every((point) => inside(point, bounds)))
      : [];
    const lost = plan.length - kept.length;
    if (!lost) return;
    this.measures.set(kept);
    if (!kept.some((measure) => measure.id === this.selected())) this.selected.set(null);
    this.note.set({
      text:
        lost === 1
          ? 'S’ha tret 1 contramesura que quedava fora del domini.'
          : `S’han tret ${lost} contramesures que quedaven fora del domini.`,
      failed: true,
    });
  }

  public setLiquid(
    id: string,
    field: 'litresPerPass' | 'passes' | 'passIntervalMin',
    value: number,
  ): boolean {
    return this.patch(id, { [field]: value });
  }
  public setRemaining(id: string, percent: number): boolean {
    return this.patch(id, { fuelRemaining: percent / 100 });
  }

  private describeMeasure(
    measure: Countermeasure,
    whole: Intl.NumberFormat,
    one: Intl.NumberFormat,
    counts: Map<CountermeasureKind, number>,
  ) {
    const entry = catalogEntry(measure.kind);
    const ordinal = (counts.get(measure.kind) ?? 0) + 1;
    counts.set(measure.kind, ordinal);
    const metres = lengthM(measure.points);
    const percent = Math.round(measure.strength * 100);
    const backfire = measure.kind === 'backfire';
    const barrier = BARRIERS.has(measure.kind);
    const start = measure.startMin ?? 0;
    const liquid = measure.litresPerPass !== undefined;
    const removal = measure.fuelRemaining !== undefined;
    const aircraft =
      measure.kind in AIRCRAFT ? AIRCRAFT[measure.kind as keyof typeof AIRCRAFT] : null;
    const minute = this.minute();
    const completed = liquid
      ? Math.max(
          0,
          Math.min(measure.passes!, Math.floor((minute - start) / measure.passIntervalMin!) + 1),
        )
      : 0;
    const expired = measure.durationMin > 0 && minute >= start + measure.durationMin;
    const crew = measure.crewSize !== undefined;
    const stopped = this.crewStops().get(measure.id);
    const { built, crewStatus } = crewProgress(measure, minute, start, metres, stopped);
    const liquids = liquidTotals(measure);
    return {
      id: measure.id,
      locked: start < minute,
      deployed: start,
      deployment: formatDeployment(start),
      finished: (lastPass(measure) ?? Infinity) < minute,
      crew,
      built,
      status: statusLabel(start, minute, crewStatus, liquid, measure, completed, expired),
      name: `${entry.label} ${ordinal}`,
      colour: entry.color,
      icon: entry.icon,
      shape: shapeLabel(entry.geometry, metres, whole, one),
      liquid,
      litresPerPass: liquids.litresPerPass,
      passes: liquids.passes,
      passIntervalMin: liquids.passIntervalMin,
      capacityL: liquidCapacity(measure.kind),
      aircraft,
      remainingPercent: Math.round((measure.fuelRemaining ?? 1) * 100),
      removal,
      totalLitres: liquids.totalLitres,
      crewText: crewTextLabel(measure, whole, one, crew),
      effect: effectLabel(measure, whole, liquid, removal, backfire, barrier, percent),
      widthM: measure.widthM,
      widthEditable: true,
      strengthPercent: percent,
      strengthEditable: !liquid && !removal && !backfire && !barrier,
      widthLabel: entry.geometry === 'point' ? 'Diàmetre' : 'Amplada',
      durationMin: measure.durationMin,
      durationEditable: !liquid && measure.durationMin > 0,
    };
  }

  private add(kind: CountermeasureKind, points: readonly Point[]): boolean {
    const entry = catalogEntry(kind);
    const measure = measureFrom(
      kind,
      this.settings() ?? defaultSettings(kind),
      `m${this.nextId++}`,
      points,
      this.minute(),
    );
    const refused = this.guard?.(measure);
    if (refused) {
      this.note.set({ text: refused, failed: true });
      return false;
    }
    const later = this.discarding() ? this.later() : [];
    const kept = this.measures().filter((other) => !later.includes(other));
    const ordinal = kept.filter((other) => other.kind === kind).length + 1;
    const dropped =
      later.length === 1
        ? ' S’ha eliminat 1 mesura posterior.'
        : later.length
          ? ` S’han eliminat ${later.length} mesures posteriors.`
          : '';
    const done = this.commit([...kept, measure], `Afegit: ${entry.label} ${ordinal}.${dropped}`);
    if (done) {
      this.selected.set(measure.id);
      this.discarding.set(false);
    }
    return done;
  }

  private patch(id: string, change: Partial<Countermeasure>): boolean {
    if (this.isLocked(id)) {
      this.historyNote();
      return false;
    }
    return this.commit(
      this.measures().map((measure) => (measure.id === id ? { ...measure, ...change } : measure)),
      null,
    );
  }

  private historyNote(): void {
    this.note.set({
      text: 'Aquesta mesura ja forma part del passat. Torna a l’inici per editar el pla.',
      failed: true,
    });
  }

  private commit(next: readonly Countermeasure[], said: string | null): boolean {
    const checked = parseCountermeasures(next);
    if (typeof checked === 'string') {
      this.note.set({ text: checked, failed: true });
      return false;
    }
    this.measures.set(checked);
    this.note.set(said ? { text: said, failed: false } : null);
    return true;
  }
}
