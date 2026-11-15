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
  type Countermeasure,
  type CountermeasureKind,
} from '../simulation/countermeasures';
import type { Point } from '../simulation/point';

/** `[west, south, east, north]`, as domainAround() gives it. */
export type Bounds = readonly [number, number, number, number];

/** What the plan last had to say: a confirmation, or why something was refused. */
export interface PlanNote {
  readonly text: string;
  readonly failed: boolean;
}

/**
 * What the inputs of the list accept.
 *
 * The same bounds the model's own validation holds (parseCountermeasures), so
 * that a plan a scenario file may carry is one these inputs can show and
 * edit. The lower width is the cell: a strip narrower than thirty metres is
 * one the grid cannot resolve. These constants come from the model;
 * commit() validates the complete plan before accepting any edit.
 */
export { WIDTH_LIMITS, DURATION_LIMITS, MAX_VERTICES } from '../simulation/countermeasures';

/**
 * What each tool has to say about itself while it is in the hand: what the
 * model does with it and, where it matters, what it does not.
 *
 * Kept on this side and not in the catalogue because it is the screen's
 * wording; what the model does is the model's, and docs/contramesures.md is
 * where that is argued.
 */
const HELP: Readonly<Record<CountermeasureKind, string>> = {
  'defense-line':
    'Barrera al foc de superfície. Amb brases activades hi pot haver salts. Construcció instantània.',
  firebreak:
    'Barrera al foc de superfície. Les brases poden encendre combustible més enllà de la franja.',
  clearing: 'Tala amb retirada de material. Conserva un percentatge de combustible i recalcula el model.',
  'water-line': 'Litres per passada i interval en minuts: humecta el combustible fi de la franja.',
  backfire:
    'Encén la línia en desplegar-la: el que crema compta com a superfície cremada i pot ampliar l’incendi.',
  helicopter: 'Un clic fixa el disc de descàrrega. Ajusta litres, passades i temps entre passades.',
  amphibious: 'Un clic fixa el disc de descàrrega. Ajusta litres, passades i temps entre passades.',
  retardant: 'Descàrregues sobre una franja. Només humectació equivalent; no modela el residu químic.',
};

const BARRIERS: ReadonlySet<CountermeasureKind> = new Set(['defense-line', 'firebreak']);

export function catalogEntry(kind: CountermeasureKind) {
  return COUNTERMEASURE_CATALOG.find((entry) => entry.kind === kind)!;
}

function inside(point: Point, [west, south, east, north]: Bounds): boolean {
  return point[0] >= west && point[0] <= east && point[1] >= south && point[1] <= north;
}

/** Metres along a polyline. Flat-earth, which thirty kilometres can afford. */
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

/**
 * The countermeasure plan and the drawing in progress, away from the map and
 * from the template.
 *
 * A plain class of signals, not a service: the plan belongs to one simulation
 * screen and dies with it, and being plain is what lets the rules of drawing
 * —what a click means, what Escape undoes, what is refused— be tested without
 * a map or a DOM.
 *
 * New measures are timestamped at the paused playback cursor. Measures that
 * have already affected its past cannot be edited or deleted retroactively.
 *
 * The plan is not in the address, unlike the ignitions: a few polylines are
 * more than a link should carry. It travels in the scenario file.
 */
export class CountermeasurePlan {
  /** What will be handed to the model. Only ever replaced whole. */
  readonly measures = signal<readonly Countermeasure[]>([]);
  /** The tool in the hand, if any. */
  readonly kind = signal<CountermeasureKind | null>(null);
  /** The vertices clicked so far of a line not yet finished. */
  readonly draft = signal<readonly Point[]>([]);
  readonly selected = signal<string | null>(null);
  readonly note = signal<PlanNote | null>(null);
  readonly minute = signal(0);
  readonly hasEditable = computed(() =>
    this.measures().some((m) => (m.startMin ?? 0) >= this.minute()),
  );

  isLocked(id: string): boolean {
    const measure = this.measures().find((m) => m.id === id);
    return !!measure && (measure.startMin ?? 0) < this.minute();
  }

  private nextId = 1;

  readonly tool = computed(() => {
    const kind = this.kind();
    return kind ? { ...catalogEntry(kind), help: HELP[kind] } : null;
  });

  /** A line needs two points to be one. */
  readonly canFinish = computed(() => this.draft().length >= 2);

  /** Each measure in the words the list uses. */
  readonly rows = computed(() => {
    const counts = new Map<CountermeasureKind, number>();
    const whole = new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 0 });
    const one = new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 1 });
    return this.measures().map((measure) => {
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
      const completed = liquid
        ? Math.max(
            0,
            Math.min(
              measure.passes!,
              Math.floor((this.minute() - start) / measure.passIntervalMin!) + 1,
            ),
          )
        : 0;
      const expired = measure.durationMin > 0 && this.minute() >= start + measure.durationMin;
      return {
        id: measure.id,
        locked: start < this.minute(),
        deployed: start,
        deployment: `T + ${Math.floor(start / 60)
          .toString()
          .padStart(2, '0')}:${Math.floor(start % 60)
          .toString()
          .padStart(2, '0')}:${Math.floor((start * 60) % 60)
          .toString()
          .padStart(2, '0')}`,
        status:
          start > this.minute()
            ? 'Programada'
            : liquid
              ? `${completed}/${measure.passes} passades · humectació`
              : expired
                ? 'Caducada'
                : 'Desplegada',
        name: `${entry.label} ${ordinal}`,
        colour: entry.color,
        icon: entry.icon,
        shape:
          entry.geometry === 'point'
            ? 'Descàrrega puntual'
            : metres >= 1000
              ? `${one.format(metres / 1000)} km`
              : `${whole.format(metres)} m`,
        liquid,
        litresPerPass: measure.litresPerPass ?? 0,
        passes: measure.passes ?? 1,
        passIntervalMin: measure.passIntervalMin ?? 10,
        capacityL: liquidCapacity(measure.kind),
        aircraft,
        remainingPercent: Math.round((measure.fuelRemaining ?? 1) * 100),
        removal,
        totalLitres: (measure.litresPerPass ?? 0) * (measure.passes ?? 1),
        effect: liquid
          ? `${whole.format(measure.litresPerPass!)} L × ${measure.passes} · cada ${measure.passIntervalMin} min`
          : removal
            ? `${Math.round(measure.fuelRemaining! * 100)} % de combustible restant`
            : backfire
              ? 'Ignició en desplegar-la'
              : barrier
                ? 'Barrera permanent'
                : measure.durationMin > 0
                  ? `−${percent} % de propagació, ${measure.durationMin} min`
                  : `−${percent} % de propagació, permanent`,
        widthM: measure.widthM,
        widthEditable: true,
        strengthPercent: percent,
        strengthEditable: !liquid && !removal && !backfire && !barrier,
        widthLabel: entry.geometry === 'point' ? 'Diàmetre' : 'Amplada',
        durationMin: measure.durationMin,
        durationEditable: !liquid && measure.durationMin > 0,
      };
    });
  });

  /** Takes a tool, or puts it down if it was the one in the hand. */
  begin(kind: CountermeasureKind): void {
    const same = this.kind() === kind;
    this.draft.set([]);
    this.kind.set(same ? null : kind);
    this.note.set(null);
  }

  /** Escape: the line being drawn is thrown away and the tool put down. */
  cancel(): void {
    this.draft.set([]);
    this.kind.set(null);
  }

  /**
   * A click on the ground with a tool in the hand.
   *
   * A point tool is done in one click; a line tool gains a vertex. Outside the
   * domain it is refused aloud, not dropped: a click that does nothing looks
   * like a broken tool.
   */
  click(point: Point, bounds: Bounds): void {
    const tool = this.tool();
    if (!tool) return;
    if (!inside(point, bounds)) {
      this.note.set({ text: 'Fora del domini: fes clic dins del quadrat simulat.', failed: true });
      return;
    }
    const here: Point = [point[0], point[1]];
    if (tool.geometry === 'point') {
      this.add(tool.kind, [here]);
      return;
    }
    const last = this.draft().at(-1);
    // A second click on the same spot would be a segment of no length.
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

  /** Takes the last vertex back. */
  undo(): void {
    this.draft.update((points) => points.slice(0, -1));
  }

  /** Turns the line drawn into a measure. The tool stays, for the next one. */
  finish(): void {
    const kind = this.kind();
    if (!kind) return;
    if (!this.canFinish()) {
      this.note.set({ text: 'Una línia necessita almenys dos punts.', failed: true });
      return;
    }
    if (this.add(kind, this.draft())) this.draft.set([]);
  }

  remove(id: string): void {
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

  clear(): void {
    this.cancel();
    const retained = this.measures().filter((m) => this.isLocked(m.id));
    if (retained.length === this.measures().length && retained.length) {
      this.historyNote();
      return;
    }
    this.commit(retained, retained.length ? 'Es conserven les mesures ja desplegades.' : null);
    this.selected.set(null);
  }

  select(id: string | null): void {
    this.selected.set(id && this.measures().some((measure) => measure.id === id) ? id : null);
  }

  /** False, and a note saying why, if the value is not one the grid can hold. */
  setWidth(id: string, value: number): boolean {
    if (!Number.isFinite(value) || value < WIDTH_LIMITS.min || value > WIDTH_LIMITS.max) {
      this.note.set({
        text: `L’amplada ha d’anar de ${WIDTH_LIMITS.min} a ${WIDTH_LIMITS.max} m: la graella és de 30 m i no resol franges més estretes.`,
        failed: true,
      });
      return false;
    }
    return this.patch(id, { widthM: Math.round(value) });
  }

  setDuration(id: string, value: number): boolean {
    if (!Number.isFinite(value) || value < DURATION_LIMITS.min || value > DURATION_LIMITS.max) {
      this.note.set({
        text: `La durada ha d’anar de ${DURATION_LIMITS.min} a ${DURATION_LIMITS.max} minuts.`,
        failed: true,
      });
      return false;
    }
    return this.patch(id, { durationMin: Math.round(value) });
  }

  setStrength(id: string, percent: number): boolean {
    if (!Number.isFinite(percent) || percent < 0 || percent > 95) {
      this.note.set({ text: 'La reducció experimental ha d’anar de 0 a 95 %.', failed: true });
      return false;
    }
    return this.patch(id, { strength: percent / 100 });
  }

  /**
   * Puts a whole plan in place: the one a scenario file carried.
   *
   * What falls outside the domain is left out and counted aloud, the same as
   * when the domain moves under a plan.
   */
  replace(measures: readonly Countermeasure[], bounds: Bounds | null): void {
    const renumbered = measures.map((measure, i) => ({ ...measure, id: `m${i + 1}` }));
    const checked = parseCountermeasures(renumbered);
    if (typeof checked === 'string') {
      this.note.set({ text: checked, failed: true });
      return;
    }
    this.cancel();
    this.selected.set(null);
    // Fresh ids: two files may both have an «m1», and the list tracks by id.
    this.nextId = checked.length + 1;
    this.measures.set(checked);
    this.note.set(null);
    this.confine(bounds);
  }

  /**
   * The domain is another one: what no longer fits is taken off, and said.
   *
   * A measure half outside would be a strip the model clips where the reader
   * cannot see why, so it goes whole; and it never goes silently.
   */
  confine(bounds: Bounds | null): void {
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

  private add(kind: CountermeasureKind, points: readonly Point[]): boolean {
    const entry = catalogEntry(kind);
    const measure: Countermeasure = {
      id: `m${this.nextId++}`,
      kind,
      points: [...points],
      widthM: entry.widthM,
      strength: liquidKind(kind) || kind === 'clearing' ? 0 : entry.strength,
      durationMin: liquidKind(kind) || kind === 'clearing' ? 0 : entry.durationMin,
      ...(liquidKind(kind)
        ? {
            litresPerPass: kind === 'water-line' ? 1000 : liquidCapacity(kind),
            passes: 1,
            passIntervalMin: 10,
          }
        : {}),
      ...(kind === 'clearing' ? { fuelRemaining: 0.2 } : {}),
      ...(this.minute() > 0 ? { startMin: this.minute() } : {}),
    };
    const ordinal = this.measures().filter((other) => other.kind === kind).length + 1;
    const done = this.commit([...this.measures(), measure], `Afegit: ${entry.label} ${ordinal}.`);
    if (done) this.selected.set(measure.id);
    return done;
  }

  setLiquid(
    id: string,
    field: 'litresPerPass' | 'passes' | 'passIntervalMin',
    value: number,
  ): boolean {
    return this.patch(id, { [field]: value });
  }
  setRemaining(id: string, percent: number): boolean {
    return this.patch(id, { fuelRemaining: percent / 100 });
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

  /**
   * The one door into `measures`: nothing gets in that the model's own
   * validation would refuse, so what the list shows is what can be computed.
   */
  private commit(next: readonly Countermeasure[], said: string | null): boolean {
    const checked = parseCountermeasures(next);
    if (typeof checked === 'string') {
      this.note.set({ text: checked, failed: true });
      return false;
    }
    // What the validation returns, not what it was given: its copy is the
    // one the scenario file and the model will see.
    this.measures.set(checked);
    this.note.set(said ? { text: said, failed: false } : null);
    return true;
  }
}
