import { formatPoint, formatPoints, parsePoint, parsePoints, type Point } from './point';
import { parseCountermeasures, type Countermeasure } from './countermeasures';
import { domainAround } from './domain';

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
}

/** What the sliders of the screen can hold: a file cannot ask for more. */
const LIMITS = {
  wind: [0, 60],
  humidity: [10, 90],
  temperature: [10, 45],
} as const;

const HEADER = '# IgnisLab · escenari de simulació';
const VERSION = '2';

/**
 * The scenario as a text file: one `key = value` per line, in Catalan, with
 * the units in the comments.
 *
 * Plain text and not JSON on purpose. It is a file somebody keeps, attaches
 * to a report and opens a year later: it should say what it is to whoever
 * opens it with a notepad, and survive being edited by hand.
 */
export function formatScenario(scenario: Scenario, saved: Date): string {
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
    ...(scenario.countermeasures
      ? [
          '',
          '# Pla de contramesures preparat a T=0; coordenades [longitud,latitud].',
          `contramesures = ${JSON.stringify(scenario.countermeasures)}`,
        ]
      : []),
    '',
  ].join('\n');
}

/**
 * Reads a scenario back, or says why it cannot.
 *
 * Strict about what the simulation cannot run without —the domain and the
 * weather— and lenient about the rest: unknown keys are skipped, so a newer
 * file opens in an older screen, and an ignition that does not parse is
 * dropped rather than guessed, as in the address (§11.16).
 */
export function parseScenario(text: string): Scenario | string {
  if (text.length > 1_000_000) return 'El fitxer d’escenari és massa gran.';
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
  if (version !== undefined && version !== '1' && version !== VERSION)
    return 'Versió d’escenari no compatible.';
  const region = code('regio');
  const province = code('provincia');
  const municipality = code('municipi');
  const centre = parsePoint('@' + (values.get('centre') ?? ''));
  if (!region || !province || !municipality || !centre) {
    return 'A l’escenari li falta el domini: regió, província, municipi o centre.';
  }

  // By the key the file uses. A decimal comma is what a hand writes here.
  const number = (key: string, limits?: readonly [number, number]) => {
    const text = values.get(key);
    const value = Number((text ?? '').replace(',', '.'));
    if (text === undefined || text === '' || !Number.isFinite(value)) return null;
    return limits ? Math.min(Math.max(value, limits[0]), limits[1]) : value;
  };
  const wind = number('vent', LIMITS.wind);
  const humidity = number('humitat', LIMITS.humidity);
  const temperature = number('temperatura', LIMITS.temperature);
  const from = number('vent_des_de');
  if (wind === null || humidity === null || temperature === null || from === null) {
    return 'A l’escenari li falta la meteorologia: vent, direcció, humitat o temperatura.';
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

  return {
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
  };
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
