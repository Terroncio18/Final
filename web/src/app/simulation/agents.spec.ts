import { describe, expect, it } from 'vitest';

import { agentsAt, aircraftAt, nearest } from './agents';
import type { Countermeasure } from './countermeasures';
import type { Point } from './point';
import type { Resource } from './resources';

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
const resources: Resource[] = [
  { kind: 'water', name: 'lluny', point: [3.2, 39.7], source: 'ICNF' },
  { kind: 'water', name: 'a prop', point: water, source: 'ICNF' },
  { kind: 'aerodrome', name: 'base', point: [2.6, 39.6], source: 'ENAIRE' },
];
const close = (a: Point | null, b: Point) => {
  expect(a).not.toBeNull();
  expect(a![0]).toBeCloseTo(b[0], 6);
  expect(a![1]).toBeCloseTo(b[1], 6);
};

describe('agents', () => {
  it('picks the nearest loading place of the right kind', () => {
    expect(nearest(drop, 'water', resources)).toEqual(water);
    expect(nearest(drop, 'station', resources)).toBeNull();
  });

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
    expect(agentsAt([line], 5, new Map(), [])).toEqual([]);
    const [crew] = agentsAt([line], 10 + 30, new Map(), []);
    expect(crew.kind).toBe('crew');
    expect(crew.point[0]).toBeGreaterThan(2.7);
    expect(crew.point[0]).toBeLessThan(2.72);
    expect(agentsAt([line], 40, new Map([['c', 30]]), [])).toEqual([]);
    expect(agentsAt([line], 10_000, new Map(), [])).toEqual([]);
  });

  it('sends a helicopter to water and a retardant plane to an aerodrome', () => {
    const plane: Countermeasure = {
      ...helicopter,
      id: 'r',
      kind: 'retardant',
      points: [drop, [2.71, 39.7]],
      litresPerPass: 3000,
    };
    const agents = agentsAt([helicopter, plane], 60, new Map(), resources);
    expect(agents.map((a) => [a.kind, a.route?.[0]])).toEqual([
      ['helicopter', water],
      ['plane', [2.6, 39.6]],
    ]);
  });
});
