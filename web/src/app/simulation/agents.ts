import { crewHead, type Countermeasure, type CountermeasureKind } from './countermeasures';
import type { Point } from './point';
import type { Resource, ResourceKind } from './resources';

/**
 * Who is working, where, at a minute (12.20): a crew at the head of its line,
 * an aircraft between where it loads and where it drops. Nothing here is
 * decided: every position follows from what the model already computed —
 * the crew's schedule and stop (12.19), the passes of a discharge (§11.31) —
 * and the loading places on the map (12.23). They change nothing in the fire.
 */
export type AgentKind = 'crew' | 'helicopter' | 'plane';

export interface Agent {
  readonly id: string;
  readonly kind: AgentKind;
  readonly point: Point;
  /** Where an aircraft is flying between, when it has somewhere to load. */
  readonly route?: readonly [Point, Point];
}

/** Where each aircraft loads: a helicopter or a scooper at water, a retardant plane at a base. */
const LOADS_AT: Partial<Record<CountermeasureKind, ResourceKind>> = {
  helicopter: 'water',
  amphibious: 'water',
  retardant: 'aerodrome',
};

/** Flat-earth distance in metres, enough to pick the nearest place in a domain. */
function distanceM(a: Point, b: Point): number {
  const north = (b[1] - a[1]) * 111_320;
  const east = (b[0] - a[0]) * 111_320 * Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180);
  return Math.hypot(north, east);
}

/** The nearest resource of a kind to a point, or null if the map has none. */
export function nearest(
  point: Point,
  kind: ResourceKind,
  resources: readonly Resource[],
): Point | null {
  let best: Point | null = null,
    bestM = Infinity;
  for (const resource of resources) {
    if (resource.kind !== kind) continue;
    const m = distanceM(point, resource.point);
    if (m < bestM) ((best = resource.point), (bestM = m));
  }
  return best;
}

const lerp = (a: Point, b: Point, t: number): Point => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
];

/** The middle of a drop: the point of a discharge, or the middle vertex of a line of retardant. */
function dropPoint(measure: Countermeasure): Point {
  const points = measure.points;
  if (points.length === 1) return points[0];
  const a = points[Math.floor((points.length - 1) / 2)],
    b = points[Math.floor((points.length - 1) / 2) + 1] ?? a;
  return lerp(a, b, points.length % 2 === 0 ? 0.5 : 0);
}

/**
 * Where an aircraft is at a minute, or null when it is not in the air.
 *
 * Pass k drops at start + k·interval. Between two passes it flies out to load
 * in the first half of the interval and back in the second; it comes in from
 * the loading point half an interval before the first pass and goes back
 * half an interval after the last. The interval is the model's (§11.31), not
 * a speed: the drawing follows the schedule, it does not question it. With
 * nowhere to load on the map, it is drawn over the drop at each pass only.
 */
export function aircraftAt(
  measure: Countermeasure,
  minute: number,
  load: Point | null,
): Point | null {
  if (measure.litresPerPass === undefined || !measure.passes || !measure.passIntervalMin)
    return null;
  const start = measure.startMin ?? 0,
    interval = measure.passIntervalMin,
    last = start + (measure.passes - 1) * interval,
    drop = dropPoint(measure),
    half = interval / 2;
  if (!load) {
    const k = Math.round((minute - start) / interval);
    const pass = start + k * interval;
    return k >= 0 && k < measure.passes && Math.abs(minute - pass) <= Math.min(1, half)
      ? drop
      : null;
  }
  if (minute < start - half || minute > last + half) return null;
  if (minute <= start) return lerp(load, drop, (minute - (start - half)) / half);
  if (minute >= last) return lerp(drop, load, (minute - last) / half);
  const phase = ((minute - start) % interval) / interval;
  return phase < 0.5 ? lerp(drop, load, phase * 2) : lerp(load, drop, (phase - 0.5) * 2);
}

/** Every agent at a minute. `stops` is the model's crewStops. */
export function agentsAt(
  measures: readonly Countermeasure[],
  minute: number,
  stops: ReadonlyMap<string, number>,
  resources: readonly Resource[],
): Agent[] {
  const agents: Agent[] = [];
  for (const measure of measures) {
    if (measure.crewSize !== undefined) {
      const workStart = (measure.startMin ?? 0) + (measure.arrivalMin ?? 0);
      const stopped = stops.get(measure.id);
      // On site from when it starts working until it is done or has stopped.
      if (minute < workStart) continue;
      const head = crewHead(measure, minute, stopped);
      if (head.done || (stopped !== undefined && minute >= stopped)) continue;
      agents.push({ id: measure.id, kind: 'crew', point: head.point });
      continue;
    }
    const loadsAt = LOADS_AT[measure.kind];
    if (!loadsAt) continue;
    const load = nearest(dropPoint(measure), loadsAt, resources);
    const point = aircraftAt(measure, minute, load);
    if (point)
      agents.push({
        id: measure.id,
        kind: measure.kind === 'helicopter' ? 'helicopter' : 'plane',
        point,
        ...(load ? { route: [load, dropPoint(measure)] as const } : {}),
      });
  }
  return agents;
}
