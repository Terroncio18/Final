import { describe, expect, it } from 'vitest';
import {
  AIRCRAFT,
  distanceM,
  legMin,
  parseCountermeasures,
  passInterval,
  type Countermeasure,
} from './countermeasures';
import type { Point } from './point';
import { formatScenario, parseScenario, type Scenario } from './scenario';

const drop: Point = [2.7, 39.7];
/** About 8,6 km east. */
const load: Point = [2.8, 39.7];

function scooper(loadPoint: Point = load, loadMin = 0.2): Countermeasure {
  return {
    id: 'a',
    kind: 'amphibious',
    points: [drop],
    widthM: 180,
    strength: 0,
    durationMin: 0,
    startMin: 30,
    litresPerPass: 7000,
    passes: 3,
    passIntervalMin: passInterval('amphibious', drop, loadPoint, loadMin),
    loadPoint,
    loadMin,
  };
}

describe('load points (§11.44)', () => {
  it('makes the interval the flight there and back at cruise speed, and the load', () => {
    const metres = distanceM(drop, load);
    expect(metres).toBeGreaterThan(8500);
    expect(metres).toBeLessThan(8700);
    // 180 kt = 5556 m/min.
    expect(legMin('amphibious', drop, load)).toBeCloseTo(metres / ((180 * 1852) / 60), 9);
    expect(passInterval('amphibious', drop, load, 0.2)).toBeCloseTo(
      2 * legMin('amphibious', drop, load) + 0.2,
      9,
    );
    expect(AIRCRAFT.amphibious.capacityL).toBe(7000);
    expect(AIRCRAFT.helicopter.loadMin).toBeNull();
  });

  it('takes a consistent discharge and refuses one whose interval does not match', () => {
    expect(parseCountermeasures([scooper()])).toEqual([scooper()]);
    expect(parseCountermeasures([{ ...scooper(), passIntervalMin: 10 }])).toMatch(/interval/);
    expect(parseCountermeasures([scooper(load, 1)])).toMatch(/12|0,2|0.2/);
    const { loadMin: _, ...half } = scooper();
    expect(parseCountermeasures([half])).toMatch(/càrrega/);
  });

  it('lets the helicopter load time be typed, and refuses a load point on a ground measure', () => {
    const heli: Countermeasure = {
      ...scooper(),
      kind: 'helicopter',
      litresPerPass: 1000,
      passIntervalMin: passInterval('helicopter', drop, load, 3),
      loadMin: 3,
    };
    expect(parseCountermeasures([heli])).toEqual([heli]);
    const line: Countermeasure = {
      id: 'w',
      kind: 'water-line',
      points: [drop, load],
      widthM: 30,
      strength: 0,
      durationMin: 0,
      litresPerPass: 1000,
      passes: 1,
      passIntervalMin: 10,
      loadPoint: load,
      loadMin: 1,
    };
    expect(parseCountermeasures([line])).toMatch(/aèria/);
  });

  it('keeps the load point in the scenario file', () => {
    const scenario = {
      ...(parseScenario(
        formatScenario(
          {
            name: 'x',
            centre: [2.71, 39.76],
            region: 'ES53',
            ignitions: [],
            wind: 10,
            windFrom: 0,
            humidity: 30,
            temperature: 25,
          } as unknown as Scenario,
          new Date(0),
        ),
      ) as Scenario),
    };
    const planned: Scenario = { ...scenario, countermeasures: [scooper()] };
    expect(parseScenario(formatScenario(planned, new Date(0)))).toEqual(planned);
  });
});
