import { FUEL_MODELS, midflameWind } from './rothermel';
import type { JsonObject, JsonValue } from './json-value';

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

function windValues(value: JsonValue | WindChange): WindChange | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as JsonObject | WindChange;
  const { startMin, speedKmh, fromDeg } = raw;
  if (
    typeof startMin !== 'number' ||
    !Number.isFinite(startMin) ||
    typeof speedKmh !== 'number' ||
    !Number.isFinite(speedKmh) ||
    typeof fromDeg !== 'number' ||
    !Number.isFinite(fromDeg)
  )
    return null;
  return { startMin, speedKmh, fromDeg };
}

export function parseWindChanges(
  value: JsonValue | readonly WindChange[],
): readonly WindChange[] | string {
  if (!Array.isArray(value) || value.length > 100) return 'S’admeten fins a 100 canvis de vent.';
  let previous = -1;
  const changes: WindChange[] = [];
  const entries: readonly (JsonValue | WindChange)[] = value;
  for (const entry of entries) {
    const raw = windValues(entry);
    if (
      !raw ||
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
