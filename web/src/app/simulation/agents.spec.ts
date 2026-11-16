import { describe, expect, it } from 'vitest';

import { bearing, groundAgentsAt, passesBetween } from './agents';
import type { Countermeasure } from './countermeasures';
import type { Point } from './point';

const drop: Point = [2.7, 39.7];
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

describe('agents', () => {
  it('measures bearings clockwise from north', () => {
    expect(bearing([0, 0], [0, 1])).toBeCloseTo(0, 6);
    expect(bearing([0, 0], [1, 0])).toBeCloseTo(90, 6);
    expect(bearing([0, 0], [0, -1])).toBeCloseTo(180, 6);
    expect(bearing([0, 0], [-1, 0])).toBeCloseTo(270, 6);
  });

  it.each([
    ['defense-line', 'crew'],
    ['mop-up', 'crew'],
    ['firebreak', 'bulldozer'],
    ['clearing', 'bulldozer'],
    ['water-line', 'fire-engine'],
  ] as const)('keeps %s on the ground as %s until its work is done', (kind, expected) => {
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
    expect(groundAgentsAt([measure], 9, new Map())).toEqual([]);
    const [start] = groundAgentsAt([measure], 10, new Map());
    expect(start).toMatchObject({ id: 'ground', kind: expected, point: drop });
    // The line runs east.
    expect(start.heading).toBeCloseTo(90, 3);
    const [working] = groundAgentsAt([measure], 40, new Map());
    expect(working.point[0]).toBeGreaterThan(drop[0]);
    expect(working.point[0]).toBeLessThan(2.72);
    expect(groundAgentsAt([measure], 40, new Map([['ground', 30]]))).toEqual([]);
    expect(groundAgentsAt([measure], 10_000, new Map())).toEqual([]);
  });

  it('finds the passes the clock has just gone past, and only those', () => {
    expect(passesBetween([helicopter], 0, 59, 0)).toEqual([]);
    expect(passesBetween([helicopter], 59, 60, 315).map((p) => p.id)).toEqual(['h-0']);
    expect(passesBetween([helicopter], 60, 60.5, 315)).toEqual([]);
    expect(passesBetween([helicopter], 60, 100, 315).map((p) => p.id)).toEqual(['h-1', 'h-2']);
    const [pass] = passesBetween([helicopter], 59, 60, 315);
    expect(pass).toEqual({
      id: 'h-0',
      kind: 'helicopter',
      drop,
      heading: 315,
      liquid: 'water',
    });
  });

  it('flies a line of retardant along its drawing, and tells the aircraft apart', () => {
    const plane: Countermeasure = {
      ...helicopter,
      id: 'r',
      kind: 'retardant',
      points: [drop, [2.7, 39.72]],
      litresPerPass: 3000,
      passes: 1,
    };
    const scooper: Countermeasure = { ...helicopter, id: 'a', kind: 'amphibious', passes: 1 };
    const passes = passesBetween([plane, scooper], 59, 60, 90);
    expect(passes.map((p) => [p.kind, p.liquid])).toEqual([
      ['tanker', 'retardant'],
      ['scooper', 'water'],
    ]);
    expect(passes[0].heading).toBeCloseTo(0, 3);
    expect(passes[1].heading).toBe(90);
  });
});
