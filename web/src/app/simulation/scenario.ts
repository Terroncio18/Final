import { formatPoint, formatPoints, parsePoint, parsePoints, type Point } from './point';
import { parseCountermeasures, type Countermeasure } from './countermeasures';
import { domainAround } from './domain';
import { parseSpotting, type SpottingOptions } from './spotting';
import { parseWindChanges, type WindChange } from './wind';

/**
 * A scenario: everything it takes to compute the same fire again.
 *
 * The domain —by the four segments of the address (§11.4)—, where it is lit,
 * and the weather that was in force. Nothing computed travels with it: the
 * terrain and the fuel are read again from the centre, and the fire is the
 * same because the computation has no chance in it (§11.19).
 */
export interface Scenario {
  readonly name: string;
  readonly region: string;
  readonly province: string;
  readonly municipality: string;
  readonly centre: Point;
  readonly ignitions: readonly Point[];
  /** km/h, as a station gives it at ten metres. */
  readonly wind: number;
  /** Where the wind comes from, degrees from north, clockwise. */
  readonly windFrom: number;
  /** Relative humidity, %. */
  readonly humidity: number;
  /** °C. */
  readonly temperature: number;
  readonly countermeasures?: readonly Countermeasure[];
  readonly windChanges?: readonly WindChange[];
  readonly spotting?: SpottingOptions;
}

/** What the sliders of the screen can hold: a file cannot ask for more. */
const LIMITS = {
  wind: [0, 60],
  humidity: [10, 90],
  temperature: [10, 45],
} as const;

const HEADER = '# IgnisLab · escenari de simulació';
const VERSION = '7';

/**
 * What a key the file does not carry stands for: the screen's own starting
 * values. They are the values a scenario older than the key ran with —no
 * plan, a steady wind, no embers— and, for the weather, the sliders as the
 * screen opens.
 */
export const SCENARIO_DEFAULTS: {
  readonly wind: number;
  readonly windFrom: number;
  readonly humidity: number;
  readonly temperature: number;
  readonly spotting: SpottingOptions;
} = {
  wind: 22,
  windFrom: 315,
  humidity: 28,
  temperature: 32,
  // Seed 1: a number that reads as a choice, not as a year.
  spotting: { enabled: false, seed: 1 },
};

/**
 * A scenario as read, and how far the file was from the current format: the
 * version it says it is, and the keys that had to be filled with defaults.
 * With either, the screen offers to save it again as a current file.
 */
export interface ScenarioRead {
  readonly scenario: Scenario;
  readonly version: string;
  readonly filled: readonly string[];
}

export const isOutdated = (read: ScenarioRead) =>
  read.version !== VERSION || read.filled.length > 0;

/**
 * The scenario as a text file: one `key = value` per line, in Catalan, with
 * the units in the comments.
 *
 * Plain text and not JSON on purpose. It is a file somebody keeps, attaches
 * to a report and opens a year later: it should say what it is to whoever
 * opens it with a notepad, and survive being edited by hand.
 */
export function formatScenario(scenario: Scenario, saved: Date): string {
  if (scenario.spotting && typeof parseSpotting(scenario.spotting) === 'string')
    throw new Error('Configuració de brases incorrecta.');
  if (scenario.windChanges) {
    const winds = parseWindChanges(scenario.windChanges);
    if (typeof winds === 'string') throw new Error(winds);
  }
  if (scenario.countermeasures) {
    const measures = parseCountermeasures(scenario.countermeasures);
    if (typeof measures === 'string') throw new Error(measures);
  }
  return [
    HEADER,
    '# Es pot obrir des del simulador amb «Carregar». Les línies amb # són notes.',
    '',
    `versio = ${VERSION}`,
    `nom = ${scenario.name.replace(/[\r\n]+/g, ' ').trim()}`,
    `desat = ${saved.toISOString()}`,
    '',
    '# Domini: els codis de la jerarquia i el centre (longitud, latitud).',
    `regio = ${scenario.region}`,
    `provincia = ${scenario.province}`,
    `municipi = ${scenario.municipality}`,
    `centre = ${formatPoint(scenario.centre).slice(1)}`,
    '',
    '# Ignicions: longitud,latitud de cadascuna, separades per punt i coma.',
    `ignicions = ${formatPoints(scenario.ignitions)}`,
    '',
    '# Meteorologia: vent en km/h i d’on ve en graus des del nord; humitat',
    '# relativa en %; temperatura en °C.',
    `vent = ${scenario.wind}`,
    `vent_des_de = ${scenario.windFrom}`,
    `humitat = ${scenario.humidity}`,
    `temperatura = ${scenario.temperature}`,
    ...(scenario.spotting ? [`brases = ${JSON.stringify(scenario.spotting)}`] : []),
    ...(scenario.windChanges
      ? [
          '',
          '# Canvis de vent: startMin en minuts, speedKmh a 10 m i fromDeg d’on ve.',
          `canvis_vent = ${JSON.stringify(scenario.windChanges)}`,
        ]
      : []),
    ...(scenario.countermeasures
      ? [
          '',
          '# Contramesures: startMin és el minut de desplegament (absent = 0).',
          '# durationMin compta des del desplegament; coordenades [longitud,latitud].',
          '# Brigades: arrivalMin en minuts, crewSize en efectius i ratePerPerson en m/h (extinció de restes: ha/h).',
          '# Descàrregues aèries: loadPoint [longitud,latitud] i loadMin en minuts; passIntervalMin en surt.',
          `contramesures = ${JSON.stringify(scenario.countermeasures)}`,
        ]
      : []),
    '',
  ].join('\n');
}

/** Largest scenario accepted. The screen checks it on the file before reading it. */
export const MAX_SCENARIO_SIZE = 1_000_000;
export const SCENARIO_TOO_LARGE = 'El fitxer d’escenari és massa gran.';

/**
 * Reads a scenario back, or says why it cannot.
 *
 * - **A newer version is refused whole**: what it adds may change the fire,
 *   and opening it without that would answer another question in silence.
 * - **Strict with what changes the fire.** Without the domain or the weather
 *   the file is refused; a malformed plan, wind or ember block is refused
 *   whole, and so is a countermeasure carrying a field this version does not
 *   know.
 * - **Lenient with the rest**: an unknown `key = value` line is skipped,
 *   which is what lets a file edited by hand carry notes; a slider value out
 *   of range is clamped; and an ignition that does not parse is dropped
 *   rather than guessed, as in the address (§11.16).
 * - **An older file is brought up to date** (§11.33): a key it does not
 *   carry takes its default, and is named in `filled`. Without the domain
 *   it is still refused, because nothing can stand for where the fire is;
 *   a key that is there but unreadable is refused too, as it is not missing
 *   but wrong.
 */
export function parseScenario(text: string): Scenario | string {
  const read = readScenario(text);
  return typeof read === 'string' ? read : read.scenario;
}

export function readScenario(text: string): ScenarioRead | string {
  if (text.length > MAX_SCENARIO_SIZE) return SCENARIO_TOO_LARGE;
  if (!text.includes('IgnisLab')) return 'El fitxer no és un escenari d’IgnisLab.';

  const values = new Map<string, string>();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const cut = line.indexOf('=');
    if (cut < 0) continue;
    values.set(line.slice(0, cut).trim().toLowerCase(), line.slice(cut + 1).trim());
  }

  const code = (key: string) => {
    const value = values.get(key) ?? '';
    return /^[A-Za-z0-9_]+$/.test(value) ? value : null;
  };
  const version = values.get('versio');
  if (
    version !== undefined &&
    version !== '1' &&
    version !== '2' &&
    version !== '3' &&
    version !== '4' &&
    version !== '5' &&
    version !== '6' &&
    version !== VERSION
  )
    return 'Versió d’escenari no compatible.';
  const region = code('regio');
  const province = code('provincia');
  const municipality = code('municipi');
  const centre = parsePoint('@' + (values.get('centre') ?? ''));
  if (!region || !province || !municipality || !centre) {
    return 'A l’escenari li falta el domini: regió, província, municipi o centre.';
  }

  const filled: string[] = [];
  // By the key the file uses. A decimal comma is what a hand writes here.
  // Absent, it takes the default and says so; there and unreadable, null.
  const number = (
    key: string,
    label: string,
    fallback: number,
    limits?: readonly [number, number],
  ) => {
    const text = values.get(key);
    if (text === undefined) {
      filled.push(label);
      return fallback;
    }
    const value = Number(text.replace(',', '.'));
    if (text === '' || !Number.isFinite(value)) return null;
    return limits ? Math.min(Math.max(value, limits[0]), limits[1]) : value;
  };
  const d = SCENARIO_DEFAULTS;
  const wind = number('vent', 'vent', d.wind, LIMITS.wind);
  const from = number('vent_des_de', 'direcció del vent', d.windFrom);
  const humidity = number('humitat', 'humitat', d.humidity, LIMITS.humidity);
  const temperature = number('temperatura', 'temperatura', d.temperature, LIMITS.temperature);
  if (wind === null || humidity === null || temperature === null || from === null) {
    return 'La meteorologia de l’escenari no es pot llegir: vent, direcció, humitat o temperatura.';
  }
  if (!values.has('brases')) filled.push('brases');
  if (!values.has('canvis_vent')) filled.push('canvis de vent');
  if (!values.has('contramesures')) filled.push('contramesures');
  let spotting: SpottingOptions | undefined;
  if (values.has('brases')) {
    let raw: unknown;
    try {
      raw = JSON.parse(values.get('brases')!);
    } catch {
      return 'Les brases no són un JSON vàlid.';
    }
    const checked = parseSpotting(raw);
    if (typeof checked === 'string') return checked;
    spotting = checked;
  }
  let windChanges: readonly WindChange[] | undefined;
  if (values.has('canvis_vent')) {
    let raw: unknown;
    try {
      raw = JSON.parse(values.get('canvis_vent')!);
    } catch {
      return 'Els canvis de vent no són un JSON vàlid.';
    }
    const checked = parseWindChanges(raw);
    if (typeof checked === 'string') return checked;
    windChanges = checked;
  }
  let countermeasures: readonly Countermeasure[] | undefined;
  if (values.has('contramesures')) {
    let raw: unknown;
    try {
      raw = JSON.parse(values.get('contramesures')!);
    } catch {
      return 'El pla de contramesures no és un JSON vàlid.';
    }
    const parsed = parseCountermeasures(raw);
    if (typeof parsed === 'string') return parsed;
    const [w, s, e, n] = domainAround(centre);
    if (parsed.some((m) => m.points.some(([lon, lat]) => lon < w || lon > e || lat < s || lat > n)))
      return 'Una contramesura surt del domini de l’escenari.';
    countermeasures = parsed;
  }

  const scenario: Scenario = {
    name: values.get('nom') ?? '',
    region,
    province,
    municipality,
    centre,
    ignitions: parsePoints(values.get('ignicions')),
    wind: Math.round(wind),
    windFrom: ((Math.round(from) % 360) + 360) % 360,
    humidity: Math.round(humidity),
    temperature: Math.round(temperature),
    ...(countermeasures !== undefined ? { countermeasures } : {}),
    ...(windChanges !== undefined ? { windChanges } : {}),
    ...(spotting !== undefined ? { spotting } : {}),
  };
  return { scenario, version: version ?? '1', filled };
}

/** A file name out of a scenario's name: `ignislab-tramuntana-forta.txt`. */
export function scenarioFileName(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `ignislab-${slug || 'escenari'}.txt`;
}
