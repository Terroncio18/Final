import { AIRCRAFT, crewHead, dropPoint, type Countermeasure } from './countermeasures';
import type { Point } from './point';

/**
 * Who is working, where (12.20, §11.50): crews and machinery at the head of
 * their line while they work, and the passes of the aircraft. Nothing here is
 * decided: every position and every pass follows from what the model already
 * computed —the crew's schedule and stop (12.19), the passes of a discharge
 * (§11.31)— and none of it changes the fire.
 */
type GroundKind = 'crew' | 'bulldozer' | 'fire-engine';
type AircraftFigure = 'helicopter' | 'scooper' | 'tanker';

export interface GroundAgent {
  readonly id: string;
  readonly kind: GroundKind;
  readonly point: Point;
  /** Where it faces: along its line, degrees clockwise from north. */
  readonly heading: number;
}

export interface Pass {
  readonly id: string;
  readonly kind: AircraftFigure;
  readonly drop: Point;
  /** Where it flies towards over the drop, degrees clockwise from north. */
  readonly heading: number;
  readonly liquid: 'water' | 'retardant';
}

/** Clockwise from north, flat-earth: a few kilometres can afford it. */
export function bearing(a: Point, b: Point): number {
  const east = (b[0] - a[0]) * Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180);
  const north = b[1] - a[1];
  return ((Math.atan2(east, north) * 180) / Math.PI + 360) % 360;
}

/** The direction of the segment of a line nearest a point on it. */
function headingAlong(points: readonly Point[], at: Point): number {
  let best = 0,
    bestDistance = Infinity;
  for (let i = 0; i + 1 < points.length; i++) {
    const [a, b] = [points[i], points[i + 1]];
    const dx = b[0] - a[0],
      dy = b[1] - a[1];
    const t =
      dx || dy
        ? Math.max(
            0,
            Math.min(1, ((at[0] - a[0]) * dx + (at[1] - a[1]) * dy) / (dx * dx + dy * dy)),
          )
        : 0;
    const distance = Math.hypot(at[0] - a[0] - t * dx, at[1] - a[1] - t * dy);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  }
  return points.length > 1 ? bearing(points[best], points[best + 1]) : 0;
}

/** Machinery shares the crew's schedule (§11.42); only its figure changes. */
const groundKind = (measure: Countermeasure): GroundKind =>
  measure.kind === 'firebreak' || measure.kind === 'clearing'
    ? 'bulldozer'
    : measure.kind === 'water-line'
      ? 'fire-engine'
      : 'crew';

/**
 * The crews and machines at work at a minute: from when they start on site
 * until their measure is done (§11.50), at the head of the work and facing
 * along the line. A crew stopped for safety is gone (§11.42).
 */
export function groundAgentsAt(
  measures: readonly Countermeasure[],
  minute: number,
  stops: ReadonlyMap<string, number>,
): GroundAgent[] {
  const agents: GroundAgent[] = [];
  for (const measure of measures) {
    if (measure.crewSize === undefined) continue;
    const workStart = (measure.startMin ?? 0) + (measure.arrivalMin ?? 0);
    const stopped = stops.get(measure.id);
    if (minute < workStart) continue;
    const head = crewHead(measure, minute, stopped);
    if (head.done || (stopped !== undefined && minute >= stopped)) continue;
    agents.push({
      id: measure.id,
      kind: groundKind(measure),
      point: head.point,
      heading: headingAlong(measure.points, head.point),
    });
  }
  return agents;
}

/**
 * The aircraft passes whose minute falls in `(from, to]`: the ones the clock
 * has just gone past. A line of retardant is flown along its drawing; a drop
 * on a point, into the wind (`windFromDeg`), which is only a choice of how it
 * looks.
 */
export function passesBetween(
  measures: readonly Countermeasure[],
  from: number,
  to: number,
  windFromDeg: number,
): Pass[] {
  const passes: Pass[] = [];
  for (const measure of measures) {
    if (!(measure.kind in AIRCRAFT) || measure.litresPerPass === undefined) continue;
    const start = measure.startMin ?? 0,
      interval = measure.passIntervalMin ?? 0;
    for (let k = 0; k < (measure.passes ?? 1); k++) {
      const minute = start + k * interval;
      if (minute <= from || minute > to) continue;
      const points = measure.points;
      passes.push({
        id: `${measure.id}-${k}`,
        kind:
          measure.kind === 'helicopter'
            ? 'helicopter'
            : measure.kind === 'amphibious'
              ? 'scooper'
              : 'tanker',
        drop: dropPoint(measure),
        heading: points.length > 1 ? bearing(points[0], points[points.length - 1]) : windFromDeg,
        liquid: measure.kind === 'retardant' ? 'retardant' : 'water',
      });
    }
  }
  return passes;
}
