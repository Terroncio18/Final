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
const VERSION = '8';

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
interface ScenarioRead {
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
          '# Descàrregues aèries: litresPerPass, nombre de passades i interval entre passades en minuts.',
          `contramesures = ${JSON.stringify(scenario.countermeasures)}`,
        ]
      : []),
    '',
  ].join('\n');
}

/** Largest scenario accepted. The screen checks it on the file before reading it. */
export const MAX_SCENARIO_SIZE = 1_000_000;
export const SCENARIO_TOO_LARGE = 'El fitxer d’escenari és massa gran.';

/** The `key = value` lines of a scenario file, skipping notes and blanks. */
function readValues(text: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const cut = line.indexOf('=');
    if (cut < 0) continue;
    values.set(line.slice(0, cut).trim().toLowerCase(), line.slice(cut + 1).trim());
  }
  return values;
}

/** A newer version is refused whole: what it adds may change the fire. */
function checkVersionSupported(version: string | undefined): string | null {
  const known = ['1', '2', '3', '4', '5', '6', '7', VERSION];
  if (version !== undefined && !known.includes(version)) {
    return 'Versió d’escenari no compatible.';
  }
  return null;
}

/** The domain: the four codes of the address and the centre. Nothing stands for it missing. */
function readDomain(
  values: Map<string, string>,
): { region: string; province: string; municipality: string; centre: Point } | string {
  const code = (key: string) => {
    const value = values.get(key) ?? '';
    return /^[A-Za-z0-9_]+$/.test(value) ? value : null;
  };
  const region = code('regio');
  const province = code('provincia');
  const municipality = code('municipi');
  const centre = parsePoint('@' + (values.get('centre') ?? ''));
  if (!region || !province || !municipality || !centre) {
    return 'A l’escenari li falta el domini: regió, província, municipi o centre.';
  }
  return { region, province, municipality, centre };
}

/**
 * The weather sliders. By the key the file uses. A decimal comma is what a
 * hand writes here. Absent, each takes its default and is named in `filled`;
 * there and unreadable, the whole block is refused.
 */
function readWeather(
  values: Map<string, string>,
  filled: string[],
): { wind: number; from: number; humidity: number; temperature: number } | string {
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
  return { wind, from, humidity, temperature };
}

/** The ember block: absent takes no spotting and is named in `filled`; there and wrong, refused. */
function readSpottingKey(
  values: Map<string, string>,
  filled: string[],
): SpottingOptions | undefined | string {
  if (!values.has('brases')) {
    filled.push('brases');
    return undefined;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(values.get('brases')!);
  } catch {
    return 'Les brases no són un JSON vàlid.';
  }
  return parseSpotting(raw);
}

/** The wind-history block: absent takes a steady wind and is named in `filled`; there and wrong, refused. */
function readWindChangesKey(
  values: Map<string, string>,
  filled: string[],
): readonly WindChange[] | undefined | string {
  if (!values.has('canvis_vent')) {
    filled.push('canvis de vent');
    return undefined;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(values.get('canvis_vent')!);
  } catch {
    return 'Els canvis de vent no són un JSON vàlid.';
  }
  return parseWindChanges(raw);
}

/**
 * The countermeasures plan: absent takes no plan and is named in `filled`;
 * there and wrong, or outside the scenario's domain, refused.
 */
function readCountermeasuresKey(
  values: Map<string, string>,
  filled: string[],
  centre: Point,
): readonly Countermeasure[] | undefined | string {
  if (!values.has('contramesures')) {
    filled.push('contramesures');
    return undefined;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(values.get('contramesures')!);
  } catch {
    return 'El pla de contramesures no és un JSON vàlid.';
  }
  const parsed = parseCountermeasures(raw);
  if (typeof parsed === 'string') return parsed;
  const [w, s, e, n] = domainAround(centre);
  if (parsed.some((m) => m.points.some(([lon, lat]) => lon < w || lon > e || lat < s || lat > n))) {
    return 'Una contramesura surt del domini de l’escenari.';
  }
  return parsed;
}

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
export function readScenario(text: string): ScenarioRead | string {
  if (text.length > MAX_SCENARIO_SIZE) return SCENARIO_TOO_LARGE;
  if (!text.includes('IgnisLab')) return 'El fitxer no és un escenari d’IgnisLab.';

  const values = readValues(text);

  const version = values.get('versio');
  const versionError = checkVersionSupported(version);
  if (versionError) return versionError;

  const domain = readDomain(values);
  if (typeof domain === 'string') return domain;
  const { region, province, municipality, centre } = domain;

  const filled: string[] = [];
  const weather = readWeather(values, filled);
  if (typeof weather === 'string') return weather;
  const { wind, from, humidity, temperature } = weather;

  const spotting = readSpottingKey(values, filled);
  if (typeof spotting === 'string') return spotting;

  const windChanges = readWindChangesKey(values, filled);
  if (typeof windChanges === 'string') return windChanges;

  const countermeasures = readCountermeasuresKey(values, filled, centre);
  if (typeof countermeasures === 'string') return countermeasures;

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
    .replace(/^-|-$/g, '');
  return `ignislab-${slug || 'escenari'}.txt`;
}
