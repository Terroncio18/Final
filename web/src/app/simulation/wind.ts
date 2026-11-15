import { FUEL_MODELS, midflameWind } from './rothermel';

/** An instantaneous change in the 10 m wind, held until the next change. */
export interface WindChange {
  readonly startMin: number;
  readonly speedKmh: number;
  readonly fromDeg: number;
}

/** Wind in the units of the propagation solver, adjusted for each fuel model. */
export interface SpreadWind {
  readonly startMin: number;
  readonly towardsDeg: number;
  readonly speedKmh: number;
  readonly midflame: number;
  readonly fuelMidflame: Readonly<Record<number, number>>;
}

export function parseWindChanges(value: unknown): readonly WindChange[] | string {
  if (!Array.isArray(value) || value.length > 100) return 'S’admeten fins a 100 canvis de vent.';
  let previous = -1;
  const changes: WindChange[] = [];
  for (const raw of value) {
    if (
      !raw ||
      typeof raw !== 'object' ||
      ![raw.startMin, raw.speedKmh, raw.fromDeg].every(
        (n) => typeof n === 'number' && Number.isFinite(n),
      ) ||
      raw.startMin < 0 ||
      raw.startMin > 720 ||
      raw.startMin <= previous ||
      raw.speedKmh < 0 ||
      raw.speedKmh > 60 ||
      raw.fromDeg < 0 ||
      raw.fromDeg >= 360
    )
      return 'Canvi de vent incorrecte: minuts únics i ordenats (0–720), 0–60 km/h i origen 0–359°.';
    changes.push({ startMin: raw.startMin, speedKmh: raw.speedKmh, fromDeg: raw.fromDeg });
    previous = raw.startMin;
  }
  return changes;
}

export function windAt(changes: readonly WindChange[], minute: number): WindChange | undefined {
  for (let i = changes.length - 1; i >= 0; i--) {
    if (changes[i].startMin <= minute) return changes[i];
  }
  return undefined;
}

export function spreadWinds(changes: readonly WindChange[]): readonly SpreadWind[] {
  const checked = parseWindChanges(changes);
  if (typeof checked === 'string') throw new Error(checked);
  return checked.map((change) => ({
    startMin: change.startMin,
    towardsDeg: (change.fromDeg + 180) % 360,
    speedKmh: change.speedKmh,
    midflame: midflameWind(FUEL_MODELS[1], change.speedKmh),
    fuelMidflame: Object.fromEntries(
      Object.values(FUEL_MODELS).map((model) => [model.id, midflameWind(model, change.speedKmh)]),
    ),
  }));
}
