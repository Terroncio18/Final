import { describe, expect, it } from 'vitest';

import { agentsAt, aircraftAt } from './agents';
import type { Countermeasure } from './countermeasures';
import type { Point } from './point';

const drop: Point = [2.7, 39.7];
const water: Point = [2.8, 39.7];
const helicopter: Countermeasure = {
  id: 'h',
  kind: 'helicopter',
  points: [drop],
  widthM: 90,
  strength: 0,
  durationMin: 0,
  startMin: 60,
  litresPerPass: 1000,
  passes: 3,
  passIntervalMin: 20,
};
const close = (a: Point | null, b: Point) => {
  expect(a).not.toBeNull();
  expect(a![0]).toBeCloseTo(b[0], 6);
  expect(a![1]).toBeCloseTo(b[1], 6);
};

describe('agents', () => {
  it('flies an aircraft between its load and each pass, on the model schedule', () => {
    expect(aircraftAt(helicopter, 49, water)).toBeNull();
    close(aircraftAt(helicopter, 50, water), water);
    close(aircraftAt(helicopter, 60, water), drop);
    close(aircraftAt(helicopter, 70, water), water);
    close(aircraftAt(helicopter, 80, water), drop);
    close(aircraftAt(helicopter, 100, water), drop);
    close(aircraftAt(helicopter, 110, water), water);
    expect(aircraftAt(helicopter, 111, water)).toBeNull();
    close(aircraftAt(helicopter, 65, water), [2.75, 39.7]);
  });

  it('with nowhere to load, shows the aircraft over the drop at each pass only', () => {
    close(aircraftAt(helicopter, 80, null), drop);
    expect(aircraftAt(helicopter, 70, null)).toBeNull();
    expect(aircraftAt(helicopter, 120, null)).toBeNull();
  });

  it('puts a crew at the head of its line while it works, and nowhere once stopped', () => {
    const line: Countermeasure = {
      id: 'c',
      kind: 'defense-line',
      points: [
        [2.7, 39.7],
        [2.72, 39.7],
      ],
      widthM: 30,
      strength: 0,
      durationMin: 0,
      startMin: 0,
      arrivalMin: 10,
      crewSize: 10,
      ratePerPerson: 10,
    };
    expect(agentsAt([line], 5, new Map())).toEqual([]);
    const [crew] = agentsAt([line], 10 + 30, new Map());
    expect(crew.kind).toBe('crew');
    expect(crew.point[0]).toBeGreaterThan(2.7);
    expect(crew.point[0]).toBeLessThan(2.72);
    expect(agentsAt([line], 40, new Map([['c', 30]]))).toEqual([]);
    expect(agentsAt([line], 10_000, new Map())).toEqual([]);
  });

  it.each([
    ['defense-line', 'crew'],
    ['mop-up', 'crew'],
    ['firebreak', 'bulldozer'],
    ['clearing', 'bulldozer'],
    ['water-line', 'fire-engine'],
  ] as const)('draws %s as %s without changing when or where it works', (kind, expected) => {
    const measure: Countermeasure = {
      id: 'ground',
      kind,
      points: [drop, [2.72, 39.7]],
      widthM: 30,
      strength: 0,
      durationMin: 0,
      startMin: 0,
      arrivalMin: 10,
      crewSize: 10,
      ratePerPerson: kind === 'mop-up' ? 0.05 : 10,
    };
    expect(agentsAt([measure], 9, new Map())).toEqual([]);
    expect(agentsAt([measure], 10, new Map())).toEqual([
      { id: 'ground', kind: expected, point: drop },
    ]);
    const [agent] = agentsAt([measure], 40, new Map());
    expect(agent.kind).toBe(expected);
    expect(agent.point[0]).toBeGreaterThan(drop[0]);
    expect(agent.point[0]).toBeLessThan(2.72);
    expect(agentsAt([measure], 40, new Map([['ground', 30]]))).toEqual([]);
    expect(agentsAt([measure], 10_000, new Map())).toEqual([]);
  });

  it.each([
    ['helicopter', 'helicopter'],
    ['amphibious', 'scooper'],
    ['retardant', 'tanker'],
  ] as const)('draws %s as %s, with its route only when it has a load point', (kind, expected) => {
    const measure: Countermeasure = { ...helicopter, kind };
    expect(agentsAt([measure], 60, new Map())).toEqual([
      { id: measure.id, kind: expected, point: drop },
    ]);
    const loaded: Countermeasure = { ...measure, loadPoint: water, loadMin: 0 };
    expect(agentsAt([loaded], 60, new Map())[0].route).toEqual([water, drop]);
  });
});
