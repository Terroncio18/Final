import { describe, expect, it } from 'vitest';

import { COUNTERMEASURE_CATALOG } from '../simulation/countermeasures';
import { domainAround } from '../simulation/domain';
import type { Point } from '../simulation/point';
import { CountermeasurePlan, lengthM, MAX_VERTICES, WIDTH_LIMITS } from './countermeasure-plan';

const centre: Point = [2.71009, 39.76552];
const bounds = domainAround(centre);
const a: Point = [2.7, 39.76];
const b: Point = [2.71, 39.765];
const c: Point = [2.72, 39.77];
/** Thirty kilometres to the east: well outside a domain of 30,7 km of side. */
const outside: Point = [3.2, 39.76];

const line = COUNTERMEASURE_CATALOG.find((entry) => entry.geometry === 'line')!;
const point = COUNTERMEASURE_CATALOG.find((entry) => entry.geometry === 'point')!;
const temporary = COUNTERMEASURE_CATALOG.find(
  (entry) => entry.geometry === 'line' && entry.durationMin > 0,
)!;

function drawn(kind = line.kind, points: readonly Point[] = [a, b]): CountermeasurePlan {
  const plan = new CountermeasurePlan();
  plan.begin(kind);
  for (const vertex of points) plan.click(vertex, bounds);
  plan.finish();
  return plan;
}

describe('the countermeasure plan', () => {
  it('timestamps points and completed lines at the paused simulation cursor', () => {
    const plan = new CountermeasurePlan();
    plan.minute.set(135.5);
    plan.begin(point.kind);
    plan.click(a, bounds);
    plan.begin(line.kind);
    plan.click(a, bounds);
    plan.click(b, bounds);
    plan.finish();
    expect(plan.measures().map((m) => m.startMin)).toEqual([135.5, 135.5]);
    expect(plan.rows()[0].deployment).toBe('T + 02:15:30');
  });

  it('protects past deployments and only clears current or future ones', () => {
    const plan = drawn();
    const past = plan.measures()[0];
    plan.minute.set(60);
    plan.begin(point.kind);
    plan.click(c, bounds);
    const current = plan.measures()[1];
    expect(plan.setWidth(past.id, 300)).toBe(false);
    plan.remove(past.id);
    expect(plan.measures()[0]).toEqual(past);
    expect(plan.setWidth(current.id, 300)).toBe(true);
    plan.clear();
    expect(plan.measures()).toEqual([past]);
    expect(plan.hasEditable()).toBe(false);
    plan.minute.set(0);
    expect(plan.setWidth(past.id, 120)).toBe(true);
    plan.clear();
    expect(plan.measures()).toEqual([]);
  });

  it('reports pending, deployed and expired states on timeline seeks', () => {
    const plan = new CountermeasurePlan();
    plan.minute.set(100);
    plan.begin(point.kind);
    plan.click(a, bounds);
    plan.minute.set(99);
    expect(plan.rows()[0]).toMatchObject({ status: 'Programada', locked: false });
    plan.minute.set(100);
    expect(plan.rows()[0]).toMatchObject({ status: 'Desplegada', locked: false });
    plan.minute.set(100 + point.durationMin);
    expect(plan.rows()[0]).toMatchObject({ status: 'Caducada', locked: true });
  });

  it('draws a line vertex by vertex and only keeps it once finished', () => {
    const plan = new CountermeasurePlan();
    plan.begin(line.kind);
    plan.click(a, bounds);
    plan.click(b, bounds);
    plan.click(c, bounds);
    expect(plan.draft()).toEqual([a, b, c]);
    expect(plan.measures()).toEqual([]);

    plan.finish();
    expect(plan.measures()).toHaveLength(1);
    expect(plan.measures()[0]).toMatchObject({
      kind: line.kind,
      points: [a, b, c],
      widthM: line.widthM,
      strength: line.strength,
      durationMin: line.durationMin,
    });
    // The line is closed and the tool stays in the hand for the next one.
    expect(plan.draft()).toEqual([]);
    expect(plan.kind()).toBe(line.kind);
    expect(plan.note()?.failed).toBe(false);
  });

  it('refuses to finish a line of fewer than two points, and says so', () => {
    const plan = new CountermeasurePlan();
    plan.begin(line.kind);
    plan.click(a, bounds);
    expect(plan.canFinish()).toBe(false);
    plan.finish();
    expect(plan.measures()).toEqual([]);
    expect(plan.draft()).toEqual([a]);
    expect(plan.note()?.failed).toBe(true);
  });

  it('takes the last vertex back, and ignores a click repeated on the same spot', () => {
    const plan = new CountermeasurePlan();
    plan.begin(line.kind);
    plan.click(a, bounds);
    plan.click(a, bounds);
    plan.click(b, bounds);
    expect(plan.draft()).toEqual([a, b]);
    plan.undo();
    expect(plan.draft()).toEqual([a]);
    plan.undo();
    plan.undo();
    expect(plan.draft()).toEqual([]);
  });

  it('cancels with nothing kept: the draft goes and the tool is put down', () => {
    const plan = drawn();
    plan.click(a, bounds);
    plan.click(c, bounds);
    plan.cancel();
    expect(plan.draft()).toEqual([]);
    expect(plan.kind()).toBeNull();
    expect(plan.measures()).toHaveLength(1);
  });

  it('places a point discharge with a single click', () => {
    const plan = new CountermeasurePlan();
    plan.begin(point.kind);
    plan.click(a, bounds);
    plan.click(b, bounds);
    expect(plan.measures().map((measure) => measure.points)).toEqual([[a], [b]]);
    expect(plan.draft()).toEqual([]);
  });

  it('refuses a click outside the domain aloud and does not move the draft', () => {
    const plan = new CountermeasurePlan();
    plan.begin(line.kind);
    plan.click(a, bounds);
    plan.click(outside, bounds);
    expect(plan.draft()).toEqual([a]);
    expect(plan.note()?.failed).toBe(true);

    plan.begin(point.kind);
    plan.click(outside, bounds);
    expect(plan.measures()).toEqual([]);
  });

  it('stops a line at the vertices the model accepts, and says so', () => {
    const plan = new CountermeasurePlan();
    plan.begin(line.kind);
    for (let i = 0; i <= MAX_VERTICES; i += 1) plan.click([2.7 + i * 0.0005, 39.76], bounds);
    expect(plan.draft()).toHaveLength(MAX_VERTICES);
    expect(plan.note()?.failed).toBe(true);
    plan.finish();
    expect(plan.measures()).toHaveLength(1);
  });

  it('does nothing with a click when no tool is in the hand', () => {
    const plan = new CountermeasurePlan();
    plan.click(a, bounds);
    expect(plan.draft()).toEqual([]);
    expect(plan.measures()).toEqual([]);
  });

  it('switching tools throws the unfinished line away; the same tool again puts it down', () => {
    const plan = new CountermeasurePlan();
    plan.begin(line.kind);
    plan.click(a, bounds);
    plan.begin(point.kind);
    expect(plan.draft()).toEqual([]);
    expect(plan.kind()).toBe(point.kind);
    plan.begin(point.kind);
    expect(plan.kind()).toBeNull();
  });

  it('replaces the array on every edit, so whoever watches it sees the change', () => {
    const plan = drawn();
    const before = plan.measures();
    const id = before[0].id;
    expect(plan.setWidth(id, 90)).toBe(true);
    expect(plan.measures()).not.toBe(before);
    expect(plan.measures()[0].widthM).toBe(90);
  });

  it('refuses widths the 30 m grid cannot resolve and leaves the measure as it was', () => {
    const plan = drawn();
    const [{ id, widthM }] = plan.measures();
    const before = plan.measures();
    for (const bad of [0, 29, WIDTH_LIMITS.max + 1, NaN]) {
      expect(plan.setWidth(id, bad)).toBe(false);
      expect(plan.note()?.failed).toBe(true);
    }
    expect(plan.measures()).toBe(before);
    expect(plan.measures()[0].widthM).toBe(widthM);
  });

  it('edits the duration of a temporary measure within its limits', () => {
    const plan = drawn(temporary.kind);
    const id = plan.measures()[0].id;
    expect(plan.setDuration(id, 90)).toBe(true);
    expect(plan.measures()[0].durationMin).toBe(90);
    expect(plan.setDuration(id, 0)).toBe(false);
    expect(plan.measures()[0].durationMin).toBe(90);
    expect(plan.rows()[0].durationEditable).toBe(true);
  });

  it('removes one, or all, and drops a selection that no longer exists', () => {
    const plan = drawn();
    plan.click(b, bounds);
    plan.click(c, bounds);
    plan.finish();
    const [first, second] = plan.measures();
    plan.select(second.id);
    plan.remove(second.id);
    expect(plan.measures()).toEqual([first]);
    expect(plan.selected()).toBeNull();
    plan.clear();
    expect(plan.measures()).toEqual([]);
  });

  it('names the rows by kind and order', () => {
    const plan = drawn();
    plan.click(b, bounds);
    plan.click(c, bounds);
    plan.finish();
    expect(plan.rows().map((row) => row.name)).toEqual([`${line.label} 1`, `${line.label} 2`]);
  });

  it('edits experimental strength and rejects invalid percentages without changing the plan', () => {
    const plan = drawn(temporary.kind);
    const id = plan.measures()[0].id;
    expect(plan.setStrength(id, 45)).toBe(true);
    expect(plan.measures()[0].strength).toBe(0.45);
    const before = plan.measures();
    for (const invalid of [-1, 96, NaN, Infinity])
      expect(plan.setStrength(id, invalid)).toBe(false);
    expect(plan.measures()).toBe(before);
    expect(plan.rows()[0].strengthPercent).toBe(45);
  });

  it('clears an unfinished draft along with the committed plan', () => {
    const plan = drawn();
    plan.click(c, bounds);
    plan.clear();
    expect(plan.measures()).toEqual([]);
    expect(plan.draft()).toEqual([]);
    expect(plan.kind()).toBeNull();
  });

  it('keeps the current plan when a replacement is invalid', () => {
    const plan = drawn();
    const before = plan.measures();
    plan.replace([{ ...before[0], widthM: NaN }], bounds);
    expect(plan.measures()).toBe(before);
    expect(plan.note()?.failed).toBe(true);
  });

  it('takes off what falls outside a new domain, and says how many', () => {
    const plan = drawn();
    const far = domainAround([3.2, 39.76]);
    plan.confine(far);
    expect(plan.measures()).toEqual([]);
    expect(plan.note()).toEqual({
      text: 'S’ha tret 1 contramesura que quedava fora del domini.',
      failed: true,
    });
  });

  it('keeps the whole plan, silently, when the domain still holds it', () => {
    const plan = drawn();
    const before = plan.measures();
    plan.confine(bounds);
    expect(plan.measures()).toBe(before);
    expect(plan.note()?.failed).toBe(false);
  });

  it('loads the plan of a scenario with ids of its own', () => {
    const source = drawn();
    const plan = drawn(point.kind, []);
    plan.begin(point.kind);
    plan.click(c, bounds);
    plan.replace([...source.measures(), ...source.measures()], bounds);
    expect(plan.measures()).toHaveLength(2);
    expect(new Set(plan.measures().map((measure) => measure.id)).size).toBe(2);
    expect(plan.measures()[0].points).toEqual([a, b]);
    expect(plan.kind()).toBeNull();
  });
});

describe('lengthM', () => {
  it('measures a polyline in metres', () => {
    // A hundredth of a degree of latitude is 1113,2 m by the domain's own constant.
    expect(
      lengthM([
        [2.7, 39.76],
        [2.7, 39.77],
      ]),
    ).toBeCloseTo(1113.2, 0);
    expect(lengthM([a])).toBe(0);
  });
});
