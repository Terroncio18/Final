import { describe, expect, it } from 'vitest';
import {
  formatScenario,
  isOutdated,
  parseScenario,
  readScenario,
  SCENARIO_DEFAULTS,
  scenarioFileName,
  type Scenario,
} from './scenario';

const scenario: Scenario = {
  name: 'Tramuntana forta',
  region: 'ES53',
  province: 'ES532',
  municipality: 'ES_07061',
  centre: [2.71009, 39.76552],
  ignitions: [
    [2.70378, 39.75517],
    [2.72, 39.76],
  ],
  wind: 35,
  windFrom: 315,
  humidity: 22,
  temperature: 34,
};

describe('scenario files', () => {
  it('round-trips crew fields in version 6 and reads every previous version', () => {
    const planned: Scenario = {
      ...scenario,
      countermeasures: [
        {
          id: 'crew',
          kind: 'defense-line',
          points: [
            [2.7, 39.76],
            [2.71, 39.76],
          ],
          widthM: 30,
          strength: 0,
          durationMin: 0,
          startMin: 12,
          arrivalMin: 15,
          crewSize: 50,
          ratePerPerson: 40.2,
        },
      ],
    };
    const text = formatScenario(planned, new Date(0));
    expect(text).toContain('versio = 6');
    expect(parseScenario(text)).toEqual(planned);
    const legacy = formatScenario(scenario, new Date(0));
    for (const version of ['1', '2', '3', '4', '5']) {
      const read = readScenario(legacy.replace('versio = 6', `versio = ${version}`));
      expect(typeof read).not.toBe('string');
      if (typeof read !== 'string') {
        expect(read.version).toBe(version);
        expect(read.scenario).toEqual(scenario);
        expect(isOutdated(read)).toBe(true);
      }
    }
  });
  it('round-trips wind history, liquid passes, residual fuel and the ember seed together', () => {
    const complete: Scenario = {
      ...scenario,
      windChanges: [{ startMin: 90, speedKmh: 40, fromDeg: 180 }],
      spotting: { enabled: true, seed: 31415 },
      countermeasures: [
        {
          id: 'h',
          kind: 'helicopter',
          points: [[2.71, 39.76]],
          widthM: 90,
          strength: 0,
          durationMin: 0,
          startMin: 100,
          litresPerPass: 1200,
          passes: 3,
          passIntervalMin: 12,
        },
        {
          id: 'c',
          kind: 'clearing',
          points: [
            [2.7, 39.76],
            [2.71, 39.76],
          ],
          widthM: 60,
          strength: 0,
          durationMin: 0,
          fuelRemaining: 0.2,
        },
      ],
    };
    expect(parseScenario(formatScenario(complete, new Date(0)))).toEqual(complete);
    const text = formatScenario(scenario, new Date(0));
    expect(typeof parseScenario(text + 'canvis_vent = [{"startMin":-1}]')).toBe('string');
    expect(typeof parseScenario(text + 'brases = {"enabled":true,"seed":-1}')).toBe('string');
    expect(parseScenario(text.replace('versio = 6', 'versio = 3'))).toEqual(scenario);
  });
  it('reads back exactly what it wrote', () => {
    const text = formatScenario(scenario, new Date('2026-11-14T19:00:00Z'));
    expect(parseScenario(text)).toEqual(scenario);
    expect(text).toContain('desat = 2026-11-14T19:00:00.000Z');
  });

  it('survives a hand edit: Windows line ends, spaces, a decimal comma, an unknown key', () => {
    const text = formatScenario(scenario, new Date(0))
      .replace('vent = 35', 'vent   =   35,4')
      .replace('humitat = 22', 'humitat = 22\ncoses_noves = 7')
      .replace(/\n/g, '\r\n');
    expect(parseScenario(text)).toEqual(scenario);
  });

  it('keeps a file within what the screen can hold', () => {
    const text = formatScenario(scenario, new Date(0))
      .replace('vent = 35', 'vent = 400')
      .replace('vent_des_de = 315', 'vent_des_de = -45')
      .replace('temperatura = 34', 'temperatura = -20');
    expect(parseScenario(text)).toMatchObject({ wind: 60, windFrom: 315, temperature: 10 });
  });

  it('drops an ignition it cannot read and keeps the others', () => {
    const text = formatScenario(scenario, new Date(0)).replace('2.72000,39.76000', 'aquí');
    expect(parseScenario(text)).toMatchObject({ ignitions: [[2.70378, 39.75517]] });
  });

  it('refuses what is not a scenario, and says what is missing', () => {
    expect(parseScenario('una llista de la compra')).toMatch(/no és un escenari/);
    const text = formatScenario(scenario, new Date(0));
    expect(parseScenario(text.replace(/^centre = .*$/m, ''))).toMatch(/domini/);
    expect(parseScenario(text.replace(/^regio = .*$/m, 'regio = ../../x'))).toMatch(/domini/);
    expect(parseScenario(text.replace(/^humitat = .*$/m, 'humitat = molta'))).toMatch(
      /meteorologia/,
    );
  });

  it('names the file after the scenario', () => {
    expect(scenarioFileName('Tramuntana forta · Sóller')).toBe(
      'ignislab-tramuntana-forta-soller.txt',
    );
    expect(scenarioFileName('  ')).toBe('ignislab-escenari.txt');
  });

  it('round-trips a complete countermeasure plan and still reads version 1 files', () => {
    const planned: Scenario = {
      ...scenario,
      countermeasures: [
        {
          id: 'water-1',
          kind: 'helicopter',
          points: [[2.71, 39.76]],
          widthM: 90,
          strength: 0.7,
          durationMin: 20,
          startMin: 135.5,
        },
      ],
    };
    expect(formatScenario(planned, new Date(0))).toContain('versio = 6');
    expect(parseScenario(formatScenario(planned, new Date(0)))).toEqual(planned);
    const legacy = {
      ...planned,
      countermeasures: planned.countermeasures!.map(({ startMin, ...m }) => m),
    };
    expect(
      parseScenario(formatScenario(legacy, new Date(0)).replace('versio = 6', 'versio = 2')),
    ).toEqual(legacy);
    expect(
      parseScenario(formatScenario(scenario, new Date(0)).replace('versio = 6', 'versio = 1')),
    ).toEqual(scenario);
  });

  it('refuses corrupted, outside-domain or unsupported plans without dropping measures', () => {
    const text = formatScenario(scenario, new Date(0));
    expect(parseScenario(text + 'contramesures = nope')).toMatch(/JSON/);
    expect(parseScenario(text + 'contramesures = [{}]')).toMatch(/desconegut/);
    expect(parseScenario(text.replace('versio = 6', 'versio = 99'))).toMatch(/Versió/);
    const outside = [
      { id: 'x', kind: 'helicopter', points: [[0, 0]], widthM: 30, strength: 0.7, durationMin: 20 },
    ];
    expect(parseScenario(text + 'contramesures = ' + JSON.stringify(outside))).toMatch(/domini/);
  });

  it('brings an older file up to date, naming every key it had to fill', () => {
    const old = formatScenario(scenario, new Date(0))
      .replace('versio = 6\n', '')
      .replace(/^humitat = .*\n/m, '')
      .replace(/^temperatura = .*\n/m, '');
    const read = readScenario(old);
    if (typeof read === 'string') throw new Error(read);
    expect(read.version).toBe('1');
    expect(read.filled).toEqual([
      'humitat',
      'temperatura',
      'brases',
      'canvis de vent',
      'contramesures',
    ]);
    expect(read.scenario).toMatchObject({
      humidity: SCENARIO_DEFAULTS.humidity,
      temperature: SCENARIO_DEFAULTS.temperature,
      wind: 35,
    });
    expect(isOutdated(read)).toBe(true);
  });

  it('fills nothing in a complete current file', () => {
    const complete: Scenario = {
      ...scenario,
      countermeasures: [],
      windChanges: [],
      spotting: SCENARIO_DEFAULTS.spotting,
    };
    const read = readScenario(formatScenario(complete, new Date(0)));
    if (typeof read === 'string') throw new Error(read);
    expect(read.filled).toEqual([]);
    expect(isOutdated(read)).toBe(false);
    expect(read.scenario).toEqual(complete);
  });
});
