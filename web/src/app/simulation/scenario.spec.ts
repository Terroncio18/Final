import { describe, expect, it } from 'vitest';
import { formatScenario, parseScenario, scenarioFileName, type Scenario } from './scenario';

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
});
