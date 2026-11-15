import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { Chrome } from '../chrome';
import { MapService } from '../map/map.service';
import { PlacesService } from '../map/places.service';
import { CELL_M, domainAround, domainRing, GRID, SIDE_M } from '../simulation/domain';
import { FireSurface } from '../simulation/fire-surface';
import { FORECASTS, FORECAST_COLOURS, forecastOffsets } from '../simulation/fire-display';
import { frontEmitters } from '../simulation/fire-emitters';
import { spread, type SpreadResult } from '../simulation/fire-spread';
import { MunicipalitiesService } from '../simulation/municipalities.service';
import {
  formatPoint,
  formatPoints,
  parsePoint,
  parsePoints,
  type Point,
} from '../simulation/point';
import { ProvincesService } from '../simulation/provinces.service';
import { formatScenario, parseScenario, scenarioFileName } from '../simulation/scenario';
import {
  CONTROL_CLASSES,
  flameLength,
  FUEL_MODELS,
  fuelBed,
  M_PER_FT,
  midflameWind,
  moisturesFor,
  windFactor,
} from '../simulation/rothermel';
import { SLOPE_CLASSES, slopeImage } from '../simulation/slope-classes';
import { cellOf, groundAt } from '../simulation/terrain';
import { TerrainService } from '../simulation/terrain.service';
import { FuelService } from '../simulation/fuel.service';
import { Icon } from './icon';
import { WeatherService } from './weather.service';

/**
 * What the analysis column can show, and whether it does on a first visit.
 *
 * The column is the reader's to arrange: someone looking at how a front
 * behaves wants intensity and flame length, someone looking at how much
 * burns wants the areas, and both at once is a column to scroll. What is
 * switched off is kept in the browser, under ANALYSIS_KEY.
 */
const ANALYSIS_ITEMS = [
  { id: 'area', label: 'Superfície', on: true },
  { id: 'perimeter', label: 'Perímetre', on: true },
  { id: 'rate', label: 'Velocitat', on: true },
  { id: 'heading', label: 'Direcció', on: true },
  { id: 'intensity', label: 'Intensitat', on: true },
  { id: 'flame', label: 'Flama', on: true },
  { id: 'control', label: 'Control', on: true },
  { id: 'run', label: 'Avanç màxim', on: true },
  { id: 'edge', label: 'Vora del domini', on: true },
  { id: 'base', label: 'Sense vent', on: false },
  { id: 'areaChart', label: 'Gràfica: superfície', on: true },
  { id: 'rateChart', label: 'Gràfica: velocitat', on: true },
  { id: 'forecast', label: 'Previsió', on: true },
  { id: 'burnedFuels', label: 'Combustible', on: true },
  { id: 'conditions', label: 'Condicions', on: true },
] as const;

const ANALYSIS_KEY = 'ignislab.analysis.hidden';

/** The eight points of the compass, for naming a bearing. */
const DIRECTIONS = [
  { degrees: 0, short: 'N', name: 'nord' },
  { degrees: 45, short: 'NE', name: 'nord-est' },
  { degrees: 90, short: 'E', name: 'est' },
  { degrees: 135, short: 'SE', name: 'sud-est' },
  { degrees: 180, short: 'S', name: 'sud' },
  { degrees: 225, short: 'SO', name: 'sud-oest' },
  { degrees: 270, short: 'O', name: 'oest' },
  { degrees: 315, short: 'NO', name: 'nord-oest' },
] as const;

/**
 * What the extinction services do to a fire, as the tools the sandbox will
 * offer. The list is the real one —what Spanish and Portuguese services
 * actually deploy— and none of it acts on anything yet: with no model there is
 * nothing for a firebreak to stop.
 *
 * Two groups because they are two kinds of thing for a model: the ground ones
 * change the fuel of a strip of cells and stay changed, and the aerial ones
 * wet or coat an area for a while and wear off.
 */
const COUNTERMEASURES = [
  {
    title: 'Mitjans terrestres',
    items: [
      { label: 'Línia de defensa', note: 'Brigada amb eines manuals', icon: 'ruler' },
      { label: 'Tallafoc', note: 'Maquinària pesant', icon: 'minus' },
      { label: 'Tala i desbrossament', note: 'Treure combustible', icon: 'trees' },
      { label: "Línia d'aigua", note: 'Autobomba i mànegues', icon: 'droplet' },
      { label: 'Contrafoc', note: "Crema d'eixamplament", icon: 'flame' },
    ],
  },
  {
    title: 'Mitjans aeris',
    items: [
      { label: 'Helicòpter', note: "Descàrrega d'aigua", icon: 'droplet' },
      { label: 'Avió amfibi', note: "Descàrrega d'aigua", icon: 'plane' },
      { label: 'Retardant', note: "Línia des de l'aire", icon: 'plane' },
    ],
  },
] as const;

/**
 * How far the timeline runs.
 *
 * Twelve hours, and the domain is why. From the centre to the edge of the
 * square there are 15,4 km (§2.27), and a head fire running at 20 m/min —fast,
 * and not exceptional in a wind-driven Mediterranean fire— covers that in a
 * little under thirteen hours: past twelve, a fire that matters has left the
 * ground the model knows. It is also about one burning period, which is as
 * long as a single set of weather can honestly be held constant.
 */
const HORIZON_HOURS = 12;

/**
 * How far past the timeline the fire is computed, and never shown as "now".
 *
 * Two reasons, and both are about the last minute of the timeline. The fire's
 * final outline is then an isochrone inside the computed field, interpolated
 * like every other, instead of the ragged edge of the cells the computation
 * happened to stop at. And the longest forecast (+6 h) exists there too.
 *
 * Half an hour more than that forecast, so its line falls inside the field
 * and not on the very edge of it, where half of it would be cut away.
 */
const FORECAST_MARGIN_MINUTES = 6 * 60 + 30;

/**
 * Live fuel moisture, as a fraction: 100 %, Anderson's own reference value.
 * Not measured and not derived from the weather; a constant until something
 * better than a constant is available.
 */
const LIVE_MOISTURE = 1.0;

/**
 * Simulated minutes per second of playback at 1×: thirty seconds of fire
 * every second, twelve hours in twenty-four minutes.
 *
 * It was twelve times that, and the fire was over before it could be read:
 * under a canopy a front makes a few cells an hour (§11.21), and at two
 * minutes for the whole run each of them went by in a blink. At 1× a front
 * is now something to watch arrive; the selector beside the button goes up
 * to 60×, which is the two-minute summary it used to be, and a little more.
 */
const PLAYBACK = 0.5;

/** Latitude first for reading, longitude first for the URL: see point.ts. */
function readable(point: Point): string {
  const ns = point[1] >= 0 ? 'N' : 'S';
  const ew = point[0] >= 0 ? 'E' : 'O';
  return `${Math.abs(point[1]).toFixed(4)}° ${ns}, ${Math.abs(point[0]).toFixed(4)}° ${ew}`;
}

/**
 * A line and the area under it, as two SVG paths.
 *
 * Drawn here and not with a charting library: two paths over a fixed viewBox
 * is what these charts are, and a dependency for that would be heavier than
 * the thing it draws. `preserveAspectRatio="none"` lets the viewBox stretch to
 * whatever width the column has.
 */
function chartPaths(values: readonly number[], width = 300, height = 100) {
  // A fire that has not moved is a flat line at the bottom, not a division by zero.
  const top = Math.max(...values) || 1;
  const step = width / (values.length - 1);
  const points = values.map(
    (value, i) => [i * step, height - (value / top) * (height - 10)] as const,
  );
  const line = points
    .map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(' ');
  return { line, area: `${line} L${width} ${height} L0 ${height} Z` };
}

/**
 * The simulation screen: the domain, in relief, inside a console.
 *
 * A screen of its own and not a fifth step of the form. The form asks «where»
 * and wants a map that is easy to point at —flat, north up, the whole
 * municipality at once (§2.8). This one answers «what would happen here», and
 * for that the ground is the subject: the fire runs up a slope and stops at a
 * ridge, and neither of those is visible from directly above.
 *
 * It takes the same four segments as the last step of the form, so the link in
 * the address bar is the same simulation in both screens (§2.26), and it opens
 * in a tab of its own: going back to the form must not mean losing the point
 * that was chosen.
 *
 * **What it runs is a drill** (§11.19): Rothermel's surface fire, spread over
 * the real slope of each cell with the weather in force, on a fuel that is
 * assumed and the same everywhere. The ground, the weather and the arithmetic
 * are real; the fuel is not yet, and the screen says so. The layout is the
 * FireCast prototype's, as §11.7 settled.
 */
@Component({
  selector: 'app-simulator-view',
  imports: [RouterLink, Icon],
  templateUrl: './simulator-view.html',
  styleUrl: './simulator-view.css',
})
export class SimulatorView {
  private readonly maps = inject(MapService);
  private readonly municipalities = inject(MunicipalitiesService);
  private readonly provinces = inject(ProvincesService);
  private readonly places = inject(PlacesService);
  private readonly terrain = inject(TerrainService);
  protected readonly fuels = inject(FuelService);
  protected readonly runError = signal<string | null>(null);
  private readonly weather = inject(WeatherService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** The element MapLibre takes over. This screen owns its map (§2.20). */
  private readonly container = viewChild.required<ElementRef<HTMLDivElement>>('container');

  readonly region = input.required<string>();
  readonly province = input.required<string>();
  readonly municipality = input.required<string>();
  readonly point = input.required<string>();

  /** The `?ignicions=` parameter: where the fire starts, if anywhere yet. */
  readonly ignicions = input<string>();

  protected readonly ready = this.maps.ready;
  protected readonly countermeasures = COUNTERMEASURES;

  /** The timeline's length, with a tick every two hours. */
  protected readonly horizon = {
    hours: HORIZON_HOURS,
    minutes: HORIZON_HOURS * 60,
    ticks: Array.from({ length: HORIZON_HOURS / 2 + 1 }, (_, i) => (i ? `+${i * 2} h` : 'Inici')),
  };

  // ---- What the user can set. ----

  protected readonly wind = signal(22);
  protected readonly direction = signal(315);
  protected readonly humidity = signal(28);
  protected readonly temperature = signal(32);

  /**
   * Where the weather comes from: an observation, or the sliders.
   *
   * Manual by default because it is the only one that is true today. The live
   * one is laid out and not connected, and says so where it is shown.
   */
  protected readonly weatherMode = signal<'live' | 'manual'>('manual');
  protected readonly tool = signal<string | null>(null);
  /**
   * Where the fire starts: the places the ignition tool has been clicked on.
   *
   * **The URL is the only place they are**, as with the centre (§2.26): this
   * is what the address says and nothing is kept beside it, so a link opened
   * and a point clicked give the same state. They travel in a query parameter
   * and not in a fifth segment, because the four segments name the domain and
   * these are what is done inside it —optional, and any number of them.
   *
   * A point outside the square is dropped: a link edited by hand must not
   * light a cell that does not exist (§11.8).
   */
  protected readonly starts = computed<readonly Point[]>(() => {
    const centre = this.ignition();
    if (!centre) return [];
    const [west, south, east, north] = domainAround(centre);
    return parsePoints(this.ignicions()).filter(
      ([lon, lat]) => lon >= west && lon <= east && lat >= south && lat <= north,
    );
  });

  /** Each one with what the grid says of the ground it was put on. */
  protected readonly startRows = computed(() => {
    const centre = this.ignition();
    const terrain = this.terrain.terrain();
    const degrees = new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 1 });
    return this.starts().map((point, index) => {
      const ground = centre && terrain ? groundAt(terrain, centre, point) : null;
      return {
        index,
        label: `Ignició ${index + 1}`,
        coordinates: readable(point),
        ground: ground
          ? `${Math.round(ground.elevation)} m · ${degrees.format(ground.slope)}°`
          : null,
      };
    });
  });

  /**
   * The minute of the simulation being looked at. Not movable until there is
   * a result: a clock that could be dragged to «T + 02:00» with nothing
   * computed would be a time of nothing.
   */
  protected readonly minutes = signal(0);
  protected readonly speed = signal('1');

  // ---- The simulation. ----

  /** The last fire computed, or nothing: when each cell burns (fire-spread.ts). */
  protected readonly result = signal<SpreadResult | null>(null);
  protected readonly computing = signal(false);
  /** How far the computation has got, from 0 to 1. */
  protected readonly progress = signal(0);
  protected readonly playing = signal(false);

  /** Counts the runs, so one that was abandoned cannot publish over a newer one. */
  private run = 0;

  /** The picture of the fire MapLibre reads: one pixel per cell. */
  protected readonly forecasts = signal(true);
  private redrawFire: ((minute: number, forecast: boolean) => void) | null = null;
  protected readonly forecastRows = computed(() => {
    const result = this.result();
    if (!result) return [];
    const minute = Math.floor(this.minutes());
    const available = forecastOffsets(this.minutes(), result.horizon);
    const format = new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 1 });
    return FORECASTS.map((offset, index) => ({
      offset,
      label: `+${offset / 60} h`,
      colour: FORECAST_COLOURS[index],
      available: available.includes(offset),
      area: available.includes(offset) ? format.format(result.series.area[minute + offset]) : '—',
      growth: available.includes(offset)
        ? format.format(result.series.area[minute + offset] - result.series.area[minute])
        : '—',
    }));
  });

  /** The relief is on by default: it is what this screen exists to show. */
  protected readonly relief = signal(true);
  protected readonly contours = signal(true);
  protected readonly labels = signal(true);

  /**
   * Off by default: it covers the photograph, and the photograph is how the
   * place is recognised. It is a layer to turn on to ask a question.
   */
  protected readonly slopes = signal(false);
  protected readonly slopeClasses = SLOPE_CLASSES;
  protected readonly layersOpen = signal(false);

  // ---- What is real. ----

  /** Nothing when the segment does not parse, the same rule as the form's. */
  protected readonly ignition = computed(() => parsePoint(this.point()));

  protected readonly chosen = computed(() => this.municipalities.find(this.municipality()));

  protected readonly provinceName = computed(
    () => this.provinces.find(this.province())?.name ?? this.province(),
  );

  protected readonly coordinates = computed(() => {
    const point = this.ignition();
    return point ? readable(point) : '';
  });

  /**
   * The cell under the pointer: where it is, how high and how steep.
   *
   * The elevation and the slope are the grid's own —the two arrays the model
   * will read (§2.28)— and not a query to the map's terrain mesh, so what is
   * read here is what a cell will be given and not what the picture shows.
   * Nothing while the pointer is off the square or the elevation has not
   * arrived; the bar then goes back to saying where the centre is.
   */
  protected readonly under = computed(() => {
    const centre = this.ignition();
    const pointer = this.maps.pointer();
    const terrain = this.terrain.terrain();
    if (!centre || !pointer || !terrain) return null;

    const ground = groundAt(terrain, centre, pointer);
    if (!ground) return null;
    return {
      coordinates: readable(pointer),
      elevation: Math.round(ground.elevation),
      slope: new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 1 }).format(ground.slope),
    };
  });

  /** What the square is, in the three numbers that define it (§2.27). */
  protected readonly domain = {
    km: new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 1 }).format(SIDE_M / 1000),
    grid: GRID,
    cell: CELL_M,
  };

  /**
   * The ground of the domain, in the figures the form's last step gives.
   *
   * The same read and the same rounding as there (§2.28), on purpose: the two
   * screens name the same square, and a slope that said 25,8° in one and 26° in
   * the other would be two terrains. Unlike the analysis column, these come
   * from the elevation and not from SAMPLE.
   */
  protected readonly ground = computed(() => {
    const ground = this.terrain.terrain();
    if (!ground) return null;
    const degrees = new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 1 });
    return {
      low: Math.round(ground.minElevation),
      high: Math.round(ground.maxElevation),
      mean: degrees.format(ground.meanSlope),
      max: degrees.format(ground.maxSlope),
    };
  });

  protected readonly terrainFailed = this.terrain.failed;

  /** Back to the step this screen was opened from, with the point intact. */
  protected readonly back = computed(() => [
    '/simulacio',
    this.region(),
    this.province(),
    this.municipality(),
    this.point(),
  ]);

  // ---- Derived from the controls. ----

  /**
   * The weather in force: the station's, or the sliders'.
   *
   * One place decides which, so that everything that shows or will use the
   * weather —the rose, the figures, the summary of a scenario, the model—
   * reads the same four numbers and none of them has to ask what mode this
   * is. In live mode with nothing read yet, it is the manual values: the
   * card above says so, and a blank would be a wind of zero.
   *
   * The manual signals are never overwritten by an observation, so going back
   * to manual finds the sliders where they were left.
   */
  protected readonly now = computed(() => {
    const seen = this.weatherMode() === 'live' ? this.weather.observation() : null;
    const wind = seen ? Math.round(seen.windKmh) : this.wind();
    const fromDeg = seen ? seen.windFromDeg : this.direction();
    const temperature = seen ? seen.temperature : this.temperature();
    return {
      live: seen !== null,
      wind,
      fromDeg,
      // Where the wind takes the fire: the opposite of where it comes from.
      towardsDeg: (fromDeg + 180) % 360,
      humidity: seen ? Math.round(seen.humidity) : this.humidity(),
      temperature,
      temperatureText: new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 1 }).format(
        temperature,
      ),
    };
  });

  /** The point of the compass a bearing is nearest to. */
  private compass(degrees: number) {
    const index = Math.round((((degrees % 360) + 360) % 360) / 45) % 8;
    return DIRECTIONS[index];
  }

  /** Where the wind comes from, by name: a station reports 183° and that is «sud». */
  protected readonly from = computed(() => this.compass(this.now().fromDeg));

  /** «del nord», but «de l'est» and «de l'oest»: the article gives way to a vowel. */
  protected readonly fromPhrase = computed(() => {
    const { name } = this.from();
    return /^[eo]/.test(name) ? `de l'${name}` : `del ${name}`;
  });

  /**
   * Where the wind takes the fire. Spelled out because the two readings of
   * «vent del nord-oest» are 180° apart and only one of them is the fire's.
   */
  protected readonly towards = computed(() => this.compass(this.now().towardsDeg));

  /**
   * Who would be asked for the weather here: the country decides.
   *
   * AEMET for Spain and IPMA for Portugal, each the state service of its
   * side of the border (§5). The first segment of the address says which,
   * because a NUTS code starts with the country.
   */
  protected readonly weatherSource = computed(() =>
    this.country() === 'PT'
      ? { name: 'IPMA', short: "l'IPMA" }
      : { name: 'AEMET OpenData', short: "l'AEMET" },
  );

  private readonly country = computed<'ES' | 'PT'>(() =>
    this.region().startsWith('PT') ? 'PT' : 'ES',
  );

  protected readonly weatherLoading = this.weather.loading;

  /** The station that is speaking for the domain, in the words the card uses. */
  protected readonly station = computed(() => {
    const seen = this.weather.observation();
    if (!seen) return null;
    const when = new Intl.DateTimeFormat('ca-ES', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    }).format(new Date(seen.observedAt));
    return {
      name: seen.station.name,
      distance:
        new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 1 }).format(seen.distanceKm) +
        ' km',
      observedAt: `${when} UTC`,
    };
  });

  /**
   * What the live card says about itself: a tag and a sentence.
   *
   * Four states and each one says what the figures below are, because that is
   * the one thing this card must never leave unsaid: an observation, an old
   * observation, or the manual values standing in for one.
   */
  protected readonly liveState = computed(() => {
    const seen = this.weather.observation();
    const service = this.weatherSource().short;
    if (this.weather.loading() && !seen) {
      return { tag: 'LLEGINT', warn: false, note: `Demanant l'observació a ${service}…` };
    }
    if (!seen) {
      return {
        tag: 'SENSE CONNEXIÓ',
        warn: true,
        note: `No s'ha pogut llegir ${service}. Els valors de sota són els manuals i no una observació.`,
      };
    }
    if (this.weather.failed() || seen.stale) {
      return {
        tag: 'DADA ANTIGA',
        warn: true,
        note: `${service} no respon ara: es manté la darrera observació llegida.`,
      };
    }
    return {
      tag: 'EN DIRECTE',
      warn: false,
      note: 'Una sola estació parla per tot el domini: la més propera al centre, sense interpolar.',
    };
  });

  protected readonly fuelModels = computed(() =>
    (this.fuels.grid()?.counts ?? []).map(({ id, cells }) => ({
      id,
      name: FUEL_MODELS[id].name,
      share: this.fuelPercent(cells),
    })),
  );

  protected fuelPercent(cells: number): string {
    return `${((100 * cells) / (GRID * GRID)).toLocaleString('ca-ES', { maximumFractionDigits: 1 })} %`;
  }

  protected retryFuels(): void {
    const centre = this.ignition();
    if (centre) void this.fuels.read(centre, true);
  }

  // ---- Scenarios: a text file out, a text file in (§11.26). ----
  protected readonly scenarioName = signal('');
  /** What the last save or load came to, for the line under the buttons. */
  protected readonly scenarioNote = signal<{ text: string; failed: boolean } | null>(null);

  protected setScenarioName(event: Event): void {
    this.scenarioName.set((event.target as HTMLInputElement).value);
  }

  /**
   * Writes the scenario to a file the browser downloads.
   *
   * The weather kept is the one in force, whatever its source: a scenario has
   * to give the same fire again, and «the station's reading at the time» is
   * not something a file can ask for later. It comes back as manual values.
   */
  protected saveScenario(): void {
    const centre = this.ignition();
    if (!centre) return;
    const now = this.now();
    const place = this.chosen()?.name ?? this.municipality();
    const name = this.scenarioName().trim() || `${place} · ${this.scenarioSummary()}`;
    const text = formatScenario(
      {
        name,
        region: this.region(),
        province: this.province(),
        municipality: this.municipality(),
        centre,
        ignitions: this.starts(),
        wind: Math.round(now.wind),
        windFrom: Math.round(now.fromDeg),
        humidity: Math.round(now.humidity),
        temperature: Math.round(now.temperature),
      },
      new Date(),
    );
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    link.download = scenarioFileName(name);
    link.click();
    URL.revokeObjectURL(link.href);
    this.scenarioNote.set({ text: `Desat com a ${link.download}`, failed: false });
  }

  /**
   * Reads a scenario file and puts the screen where it says.
   *
   * The weather goes into the manual values and the rest into the address,
   * which is what draws the domain and the ignitions (§2.26, §11.16): a
   * loaded scenario and a pasted link end in the same state.
   */
  protected async loadScenario(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // So that choosing the same file again is still a change.
    input.value = '';
    if (!file) return;
    const scenario = parseScenario(await file.text());
    if (typeof scenario === 'string') {
      this.scenarioNote.set({ text: scenario, failed: true });
      return;
    }
    this.weatherMode.set('manual');
    this.wind.set(scenario.wind);
    this.direction.set(scenario.windFrom);
    this.humidity.set(scenario.humidity);
    this.temperature.set(scenario.temperature);
    this.scenarioName.set(scenario.name);
    await this.router.navigate(
      [
        '/simulador',
        scenario.region,
        scenario.province,
        scenario.municipality,
        formatPoint(scenario.centre),
      ],
      {
        queryParams: {
          ignicions: scenario.ignitions.length ? formatPoints(scenario.ignitions) : null,
        },
      },
    );
    this.scenarioNote.set({ text: `Carregat: ${scenario.name || file.name}`, failed: false });
  }

  /** What saving a scenario would keep, read from what is set right now. */
  protected readonly scenarioSummary = computed(() => {
    const starts = this.starts().length;
    const fires = starts === 1 ? '1 ignició' : `${starts} ignicions`;
    return (
      `${fires} · vent ${this.now().wind} km/h ${this.from().short} · ` +
      `${this.now().humidity} % · ${this.now().temperatureText} °C`
    );
  });

  /** `T + 02:00`, from the timeline's minutes. */
  protected readonly elapsed = computed(() => this.clock(this.minutes()));

  private clock(minutes: number): string {
    const total = Math.floor(minutes);
    const hours = Math.floor(total / 60);
    return `${String(hours).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }

  /**
   * What Rothermel is given, and what it answers before any terrain: the
   * fuel bed for the weather in force.
   *
   * Worked out whether or not a simulation has run, because it is what the
   * weather *means* for a fire —28 % of humidity is 5 % of moisture in the
   * fine dead fuel— and that is worth seeing while the sliders move.
   */
  private readonly fuelState = computed(() => {
    const now = this.now();
    const moistures = moisturesFor(now.temperature, now.humidity, LIVE_MOISTURE);
    const beds = Object.fromEntries(
      Object.values(FUEL_MODELS).map((model) => [
        model.id,
        {
          bed: fuelBed(model, moistures),
          midflame: midflameWind(model, now.wind),
        },
      ]),
    );
    return { moistures, beds };
  });

  protected readonly conditions = computed(() => {
    const { moistures, beds } = this.fuelState();
    const present = (this.fuels.grid()?.counts ?? []).map(({ id }) => beds[id]);
    const one = new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 1 });
    const two = new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 2 });
    const range = (values: number[], format: Intl.NumberFormat): string => {
      if (!values.length) return '—';
      const low = format.format(Math.min(...values)),
        high = format.format(Math.max(...values));
      return low === high ? low : `${low}–${high}`;
    };
    return {
      dead: one.format(moistures.dead1 * 100),
      live: Math.round(moistures.live * 100),
      // Feet per minute back to the unit the station gave.
      midflame: range(
        present.map(({ midflame }) => (midflame * M_PER_FT * 60) / 1000),
        one,
      ),
      base: range(
        present.map(({ bed }) => bed.r0 * M_PER_FT),
        two,
      ),
      head: range(
        present.map(({ bed, midflame }) => bed.r0 * M_PER_FT * (1 + windFactor(bed, midflame))),
        one,
      ),
    };
  });

  /** How much of the square is ground, which is how much of it can burn. */
  protected readonly burnableShare = computed(() => {
    const terrain = this.terrain.terrain();
    const fuels = this.fuels.grid();
    if (!terrain || !fuels) return '—';
    let land = 0;
    for (let i = 0; i < terrain.elevation.length; i += 1)
      if (terrain.elevation[i] > 0 && fuels.models[i] >= 1 && fuels.models[i] <= 13) land += 1;
    return `${Math.round((land / terrain.elevation.length) * 100)} %`;
  });

  private readonly unknownLand = computed(() => {
    const terrain = this.terrain.terrain(),
      fuels = this.fuels.grid();
    if (!terrain || !fuels) return 0;
    let count = 0;
    for (let i = 0; i < fuels.models.length; i++)
      if (terrain.elevation[i] > 0 && fuels.models[i] === 255) count++;
    return count;
  });

  protected readonly fuelIssue = computed(() => {
    if (this.fuels.reading()) return 'Llegint els combustibles del domini…';
    if (this.fuels.error()) return this.fuels.error();
    const fuels = this.fuels.grid(),
      terrain = this.terrain.terrain(),
      centre = this.ignition();
    if (!fuels) return 'Falta la cartografia de combustibles.';
    if (this.unknownLand())
      return 'Hi ha terreny sense dades de combustible. Torna a carregar la cartografia.';
    if (
      terrain &&
      centre &&
      this.starts().some((point) => {
        const cell = cellOf(centre, point);
        return cell === null || terrain.elevation[cell] <= 0 || fuels.models[cell] === 0;
      })
    )
      return 'Mou la ignició a una cel·la amb combustible.';
    return null;
  });

  protected readonly canStart = computed(
    () =>
      !this.computing() &&
      this.terrain.terrain() !== null &&
      this.starts().length > 0 &&
      !this.fuelIssue(),
  );

  /** Where the simulation stands, in the three lengths the screen says it in. */
  protected readonly state = computed(() => {
    if (this.computing()) {
      return {
        tag: 'CALCULANT',
        short: `Calculant… ${Math.round(this.progress() * 100)} %`,
        title: 'Calculant la propagació',
        detail: "El foc es calcula en l'ordre en què crema.",
      };
    }
    if (this.result()) {
      return { tag: 'SIMULACRE', short: 'Simulacre calculat', title: '', detail: '' };
    }
    if (!this.terrain.terrain()) {
      return {
        tag: 'SENSE CÀLCUL',
        short: 'Llegint el terreny',
        title: 'Llegint el terreny',
        detail: 'La pendent de cada cel·la és una entrada del model.',
      };
    }
    if (!this.starts().length) {
      return {
        tag: 'SENSE CÀLCUL',
        short: 'Falta una ignició',
        title: 'Posa una ignició',
        detail: "Amb l'eina «Punt d'ignició», fes clic al terreny on comença el foc.",
      };
    }
    const issue = this.fuelIssue() ?? this.runError();
    if (issue)
      return { tag: 'SENSE CÀLCUL', short: issue, title: 'Combustibles del domini', detail: issue };
    return {
      tag: 'SENSE CÀLCUL',
      short: 'A punt',
      title: 'A punt per calcular',
      detail: 'Inicia la simulació per veure com avança el foc en dotze hores.',
    };
  });

  /**
   * The figures of the fire at the minute the timeline is on.
   *
   * Read out of the result's minute-by-minute series, so moving the timeline
   * costs a few array reads. The rate and the heading look back over the last
   * ten minutes: the front is what has just burned, and a single minute can
   * be a handful of cells.
   */
  protected readonly figures = computed(() => {
    const result = this.result();
    if (!result) return null;
    const { area, perimeter, rate, heading, intensity, run } = result.series;
    const minute = Math.min(Math.floor(this.minutes()), area.length - 1);
    const one = new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 1 });
    const whole = new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 0 });
    const size = (value: number) => (value < 100 ? one : whole).format(value);

    let fastest = 0;
    let hottest = 0;
    let bearing = NaN;
    for (let m = minute; m >= Math.max(minute - 10, 0); m -= 1) {
      if (rate[m] > fastest) fastest = rate[m];
      if (intensity[m] > hottest) hottest = intensity[m];
      if (Number.isNaN(bearing) && !Number.isNaN(heading[m])) bearing = heading[m];
    }

    const back = Math.max(minute - 30, 0);
    const perHour = minute > back ? ((area[minute] - area[back]) / (minute - back)) * 60 : 0;
    const total = result.burnable * ((CELL_M * CELL_M) / 10_000);
    const towards = Number.isNaN(bearing) ? null : this.compass(bearing);
    // Past the timeline the fire is still computed (FORECAST_MARGIN_MINUTES), but
    // an arrival at the edge out there is not something this screen reports.
    const reachedEdge = result.reachedEdge <= this.horizon.minutes ? result.reachedEdge : Infinity;
    const edgeReached = reachedEdge <= minute;
    // Byram's flame length for that intensity, and the band of the fire
    // characteristics chart it falls in. A stopped front has neither.
    const flame = flameLength(hottest);
    const control = hottest ? CONTROL_CLASSES.find((band) => flame < band.upTo)! : null;

    return {
      area: size(area[minute]),
      growth: `+${size(perHour)} ha/h ara`,
      share: one.format(total ? (area[minute] / total) * 100 : 0),
      perimeter: one.format(perimeter[minute]),
      rate: one.format(fastest),
      rateNote: fastest
        ? `${one.format((fastest * 60) / 1000)} km/h · darrers 10 min`
        : 'Front aturat',
      intensity: hottest ? whole.format(hottest) : '—',
      flame: hottest ? one.format(flame) : '—',
      control: control ? control.name : '—',
      controlNote: control ? control.note : 'Front aturat',
      controlHard: flame >= 2.4,
      run: one.format(run[minute]),
      heading: towards ? towards.short : '—',
      headingNote: towards
        ? `${Math.round(bearing)}° · cap al ${towards.name}`
        : 'Sense front actiu',
      edge: Number.isFinite(reachedEdge) ? `T + ${this.clock(reachedEdge)}` : 'No hi arriba',
      edgeNote: !Number.isFinite(reachedEdge)
        ? `En ${this.horizon.hours} h el foc no surt del domini`
        : edgeReached
          ? "A partir d'aquí el foc surt del que es calcula"
          : 'Més enllà el foc surt del que es calcula',
      edgeReached,
      cursor: (minute / this.horizon.minutes) * 300,
    };
  });

  /**
   * What has burned so far, by fuel model: which fuels the fire is living on.
   *
   * A pass over the grid, so it is only made while the block is on screen,
   * and once per minute of the timeline rather than per frame of it.
   */
  protected readonly burnedFuels = computed(() => {
    const result = this.result();
    const fuels = this.fuels.grid();
    if (!result || !fuels || !this.shows('burnedFuels')) return [];
    const minute = Math.floor(this.minutes());
    const cells = new Map<number, number>();
    let all = 0;
    for (let i = 0; i < result.arrival.length; i += 1) {
      if (result.arrival[i] > minute) continue;
      cells.set(fuels.models[i], (cells.get(fuels.models[i]) ?? 0) + 1);
      all += 1;
    }
    const one = new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 1 });
    return [...cells]
      .sort((a, b) => b[1] - a[1])
      .map(([id, count]) => ({
        id,
        name: FUEL_MODELS[id]?.name ?? 'Sense model',
        area: one.format((count * CELL_M * CELL_M) / 10_000),
        share: Math.round((count / all) * 100),
      }));
  });

  // ---- What the analysis column shows. ----
  protected readonly analysisItems = ANALYSIS_ITEMS;
  protected readonly editing = signal(false);
  private readonly hidden = signal<ReadonlySet<string>>(this.storedHidden());

  private storedHidden(): ReadonlySet<string> {
    try {
      const stored = localStorage.getItem(ANALYSIS_KEY);
      if (stored !== null) return new Set(JSON.parse(stored) as string[]);
    } catch {
      // No storage, or something else's value under the key: the defaults.
    }
    return new Set(ANALYSIS_ITEMS.filter((item) => !item.on).map((item) => item.id));
  }

  protected shows(id: (typeof ANALYSIS_ITEMS)[number]['id']): boolean {
    return !this.hidden().has(id);
  }

  protected toggleItem(id: string): void {
    const hidden = new Set(this.hidden());
    if (!hidden.delete(id)) hidden.add(id);
    this.hidden.set(hidden);
    try {
      localStorage.setItem(ANALYSIS_KEY, JSON.stringify([...hidden]));
    } catch {
      // Not kept for the next visit; it still holds for this one.
    }
  }

  /** The two curves of the column, sampled every five minutes. */
  protected readonly charts = computed(() => {
    const result = this.result();
    if (!result) return { area: chartPaths([0, 0]), rate: chartPaths([0, 0], 300, 64) };
    const { area, rate } = result.series;
    const areas: number[] = [];
    const rates: number[] = [];
    for (let minute = 0; minute <= this.horizon.minutes; minute += 5) {
      areas.push(area[minute]);
      let fastest = 0;
      for (let m = Math.max(minute - 4, 0); m <= minute; m += 1)
        fastest = Math.max(fastest, rate[m]);
      rates.push(fastest);
    }
    return { area: chartPaths(areas), rate: chartPaths(rates, 300, 64) };
  });

  constructor() {
    const chrome = inject(Chrome);
    chrome.visible.set(false);

    this.provinces.load();

    // After the first render, which is when the element exists, and only in the
    // browser. The same reasoning as MapShell's, and the reason this screen can
    // be a sibling of it rather than a child: the map belongs to whoever is
    // showing it, and in a tab of its own there is no map to inherit.
    afterNextRender(() => this.maps.create(this.container().nativeElement));

    effect(() => {
      // What this screen is not: the portada, or a step of the form. Said here
      // and not through LevelsService, which answers for the levels of the
      // form and would turn the relief off along with everything else.
      this.maps.setHotspotsVisible(false);
      this.maps.setRegionsVisible(false);
      this.maps.showProvincesOf(null);

      // The file is still read, because the name of the municipality is what
      // the bar and the card say. Its outline is not drawn: inside the sandbox
      // the only edge that means anything is the domain's, and an
      // administrative line across it is the one thing on the ground the fire
      // does not see (§11.8). It was there while this screen was a map of a
      // place; it is now a map of a domain.
      this.municipalities.load(this.province());
      this.maps.focusMunicipality(null);

      const point = this.ignition();
      if (!point) return;

      this.maps.setIgnition(point);
      this.maps.setDomain(domainRing(point));

      // Only the square. What is outside it is not simulated, and a map that
      // keeps showing it invites reading a fire into ground the model never
      // touches (§11.8).
      this.maps.setDomainMask(true);

      // The relief goes on **before** the framing and in the same effect as
      // it: the lean is an argument of fitBounds and not a move of its own
      // (§13.2), so `goToBounds` has to find the terrain already set. Turning
      // the relief off therefore reframes, which is what puts north back up.
      this.maps.setTerrain3D(this.relief());
      this.maps.setOrbit(this.relief());

      // Without `clearOfPanel`, unlike every step of the form: there the panel
      // sits over the canvas and the framing has to dodge it, and here the map
      // has a column of its own. Asking for that padding in a card 450 px wide
      // left the domain about a fifth of the width and framed the island.
      this.maps.goToBounds(domainAround(point));

      // And the square is also the wall: the pointer can move and the wheel
      // can zoom, as far as the domain and no further (§11.10).
      this.maps.setSandboxBounds(domainAround(point));
    });

    // The two layers the toolbar switches that do not touch the camera, and
    // the lighting, which does not either.
    effect(() => this.maps.setContours(this.contours()));

    // On for the whole screen and not only in relief: a flat view of thirty
    // kilometres of mountain is just as hard to read without it.
    this.maps.setReliefEmphasis(true);

    effect(() => {
      const point = this.ignition();
      if (!point) return;
      // The names of the ground underneath, which is the difference between a
      // relief and a place: a ridge with a name is where a fire stops being an
      // abstraction. Cut to the domain, because the rest of the province is
      // not what this screen is about.
      if (this.labels()) this.places.load(this.province(), domainAround(point));
      else this.places.release();
    });

    // The elevation under the square, read here as the form reads it. In a tab
    // of its own there is no read to inherit, and the tiles are the ones the
    // map is already fetching for the relief.
    effect(() => {
      const point = this.ignition();
      if (point) {
        this.terrain.read(point);
        void this.fuels.read(point);
      } else {
        this.terrain.clear();
        this.fuels.clear();
      }
    });

    // The live weather is asked for on entering the mode and whenever the
    // domain is another one; «Actualitzar» asks again. Not on a timer: the
    // services publish once an hour and the server already holds the answer
    // for twenty minutes.
    effect(() => {
      const centre = this.ignition();
      if (this.weatherMode() !== 'live' || !centre) return;
      this.weather.load(this.country(), centre);
    });

    // The ignition tool. While it is on, a click on the ground is a place
    // where the fire starts; the map only reports clicks while it is asked to
    // (setPicking), which is also what turns the pointer into a crosshair.
    effect(() => this.maps.setPicking(this.tool() === 'ignition'));

    effect(() => {
      const picked = this.maps.picked();
      if (!picked) return;
      // Written to the address and read back from it. A click outside the
      // square goes the same way and is dropped on the way back, by the one
      // rule `starts` already applies.
      this.writeStarts([...untracked(this.starts), [picked[0], picked[1]]]);
    });

    effect(() => {
      const starts = this.starts();
      this.maps.setFireStarts(
        starts.map((point, index) => ({ point, label: `Ignició ${index + 1}` })),
      );
    });

    // The slope as a layer, painted from the same grid the figures and the
    // reading under the pointer come from. Only drawn once it is asked for:
    // the picture is a megapixel and most visits never turn it on.
    effect(() => {
      const point = this.ignition();
      const terrain = this.terrain.terrain();
      if (this.slopes() && point && terrain) {
        this.maps.setSlopes(slopeImage(terrain), domainAround(point));
      } else {
        this.maps.setSlopes(null);
      }
    });

    // A result answers for the inputs it was computed with. Change any of them
    // —an ignition, the weather, the domain— and it is the fire of another
    // question: it is taken off rather than left on screen under new sliders.
    effect(() => {
      this.starts();
      this.fuelState();
      this.now().towardsDeg;
      this.terrain.terrain();
      this.fuels.grid();
      untracked(() => {
        if (this.result() || this.computing()) this.reset();
      });
    });

    // Both clocks are independent: scrub simulation time without altering arrivals;
    // pause propagation while the FireCast flames, smoke and shimmer stay alive.
    effect((onCleanup) => {
      const result = this.result(),
        centre = this.ignition();
      const terrain = untracked(() => this.terrain.terrain());
      if (!result || !centre || !terrain) {
        this.maps.setFire(null);
        this.maps.setFireParticles(null);
        return;
      }
      let painter: FireSurface;
      try {
        painter = new FireSurface(result.arrival, result.horizon);
      } catch (error) {
        this.runError.set('No s’ha pogut dibuixar el foc.');
        console.error(error);
        return;
      }
      const bounds = domainAround(centre),
        weather = untracked(this.now);
      const reduced = matchMedia('(prefers-reduced-motion: reduce)');
      const scale = () => this.maps.metresPerPixel() ?? undefined;
      painter.paint(untracked(this.minutes), 0, untracked(this.forecasts), scale());
      this.maps.setFire(painter.canvas, painter.bounds(bounds));
      let frame = 0,
        last = performance.now(),
        lastPaint = -Infinity,
        lastEmitters = -Infinity;
      let visualSeconds = 0,
        emittersMinute = NaN,
        previousMinute = NaN;
      let paintedMinute = NaN,
        paintedScale: number | undefined,
        paintedForecast: boolean | undefined,
        motionWas: boolean | undefined;
      this.redrawFire = (minute, forecast) => {
        painter.paint(minute, reduced.matches ? 0 : visualSeconds, forecast, scale());
        this.maps.refreshFire();
        this.maps.resetFireParticles();
        this.maps.setFireParticles(
          frontEmitters(result.arrival, terrain.elevation, minute, bounds),
          weather.towardsDeg,
          weather.wind,
        );
        paintedMinute = minute;
        paintedForecast = forecast;
        emittersMinute = minute;
      };
      const draw = (now: number) => {
        const dt = Math.min(Math.max((now - last) / 1000, 0), 0.1);
        last = now;
        const motion = !reduced.matches;
        if (!document.hidden) {
          if (motion) visualSeconds += dt;
          const minute = untracked(this.minutes),
            forecast = untracked(this.forecasts),
            metres = scale();
          const jumped =
            Number.isFinite(previousMinute) &&
            (minute < previousMinute || minute - previousMinute > 3);
          if (
            now - lastPaint >= 33 &&
            (motion ||
              minute !== paintedMinute ||
              metres !== paintedScale ||
              forecast !== paintedForecast ||
              motion !== motionWas)
          ) {
            painter.paint(minute, motion ? visualSeconds : 0, forecast, metres);
            this.maps.refreshFire();
            lastPaint = now;
            paintedMinute = minute;
            paintedScale = metres;
            paintedForecast = forecast;
          }
          if (minute !== emittersMinute && (now - lastEmitters >= 100 || jumped)) {
            if (jumped) this.maps.resetFireParticles();
            this.maps.setFireParticles(
              frontEmitters(result.arrival, terrain.elevation, minute, bounds),
              weather.towardsDeg,
              weather.wind,
            );
            emittersMinute = minute;
            lastEmitters = now;
          }
          this.maps.setFireMotion(motion);
          motionWas = motion;
          previousMinute = minute;
        }
        frame = requestAnimationFrame(draw);
      };
      draw(performance.now());
      onCleanup(() => {
        this.redrawFire = null;
        cancelAnimationFrame(frame);
        this.maps.setFireParticles(null);
        this.maps.setFire(null);
        painter.dispose();
      });
    });

    // Explicit timeline/layer edits must redraw even while an inactive tab's
    // animation clock is suspended (e.g. a background preview).
    effect(() => {
      const minute = this.minutes(),
        forecast = this.forecasts();
      if (document.hidden) untracked(() => this.redrawFire?.(minute, forecast));
    });

    // Playback: the clock advances with real time, at the speed chosen.
    effect((onCleanup) => {
      if (!this.playing()) return;
      let last = performance.now();
      let frame = 0;
      const step = (time: number) => {
        const seconds = (time - last) / 1000;
        last = time;
        const next = untracked(this.minutes) + seconds * PLAYBACK * Number(untracked(this.speed));
        if (next >= this.horizon.minutes) {
          this.minutes.set(this.horizon.minutes);
          this.playing.set(false);
          return;
        }
        this.minutes.set(next);
        frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
      onCleanup(() => cancelAnimationFrame(frame));
    });

    inject(DestroyRef).onDestroy(() => {
      this.run += 1;
      this.terrain.clear();
      this.fuels.clear();
      this.weather.clear();
      chrome.visible.set(true);
      this.maps.destroy();
    });
  }

  protected setNumber(which: 'wind' | 'humidity' | 'temperature', event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    ({ wind: this.wind, humidity: this.humidity, temperature: this.temperature })[which].set(value);
  }

  /**
   * Turns the compass with the pointer: the needle follows it.
   *
   * The needle points where the wind **goes**, so the angle under the pointer
   * is that, and the bearing kept is the opposite one, where it comes from.
   * In steps of five degrees: finer than that is more than a hand on a 92 px
   * dial can mean, and more than one station can tell.
   */
  protected turnWind(event: PointerEvent): void {
    if (this.weatherMode() === 'live') return;
    const dial = event.currentTarget as HTMLElement;
    if (event.type === 'pointerdown') {
      // Captured, so the drag carries on outside the dial. A pointer that is
      // not a live one —a scripted event— cannot be captured, and then the
      // press still sets the direction; only the drag is lost.
      try {
        dial.setPointerCapture(event.pointerId);
      } catch {
        /* nothing to follow */
      }
      dial.focus();
    } else if (!dial.hasPointerCapture(event.pointerId)) {
      return;
    }
    const box = dial.getBoundingClientRect();
    const east = event.clientX - (box.left + box.width / 2);
    const south = event.clientY - (box.top + box.height / 2);
    // Too close to the pivot the angle is noise.
    if (Math.hypot(east, south) < 6) return;
    const towards = (Math.atan2(east, -south) * 180) / Math.PI;
    this.direction.set((((Math.round(towards / 5) * 5 + 180) % 360) + 360) % 360);
  }

  /** The same with the keyboard: arrows by five degrees, page keys by a point. */
  protected nudgeWind(event: KeyboardEvent): void {
    if (this.weatherMode() === 'live') return;
    const steps: Record<string, number> = {
      ArrowRight: 5,
      ArrowUp: 5,
      ArrowLeft: -5,
      ArrowDown: -5,
      PageUp: 45,
      PageDown: -45,
    };
    const step = steps[event.key];
    if (step === undefined && event.key !== 'Home') return;
    event.preventDefault();
    this.direction.set(event.key === 'Home' ? 0 : (this.direction() + step + 360) % 360);
  }

  protected setMinutes(event: Event): void {
    // Dragging the clock is taking it over: the playback stops.
    this.playing.set(false);
    this.minutes.set(Number((event.target as HTMLInputElement).value));
  }

  protected focusFire(): void {
    const result = this.result(),
      centre = this.ignition();
    if (!result || !centre) return;
    const until = Math.min(
      this.minutes() + (this.forecasts() ? FORECASTS[FORECASTS.length - 1] : 0),
      result.horizon,
    );
    let left = GRID,
      right = 0,
      top = GRID,
      bottom = 0;
    for (let i = 0; i < result.arrival.length; i++) {
      if (result.arrival[i] > until) continue;
      const x = i % GRID,
        y = Math.floor(i / GRID);
      left = Math.min(left, x);
      right = Math.max(right, x + 1);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y + 1);
    }
    if (left === GRID) return;
    const [w, s, e, n] = domainAround(centre);
    this.maps.focusFire([
      w + (left / GRID) * (e - w),
      n - (bottom / GRID) * (n - s),
      w + (right / GRID) * (e - w),
      n - (top / GRID) * (n - s),
    ]);
  }

  /**
   * Computes the fire for what is on screen now, and plays it.
   *
   * The inputs are read once, here, and handed over as plain data: the
   * weather in force, the fuel bed it gives, the elevation of the domain and
   * the cells the ignitions fall in. Nothing is read again while it runs, so
   * what is computed is one consistent question.
   */
  protected async start(): Promise<void> {
    const terrain = this.terrain.terrain();
    const centre = this.ignition();
    const fuels = this.fuels.grid();
    if (!terrain || !centre || !fuels || !this.canStart()) return;

    const { beds } = this.fuelState();
    const { bed, midflame } = beds[1];
    const ignitions = this.starts()
      .map((point) => cellOf(centre, point))
      .filter((cell): cell is number => cell !== null);

    const mine = (this.run += 1);
    this.playing.set(false);
    this.result.set(null);
    this.minutes.set(0);
    this.progress.set(0);
    this.computing.set(true);
    this.runError.set(null);

    try {
      const result = await spread(
        {
          elevation: terrain.elevation,
          bed,
          midflame,
          fuels: fuels.models,
          fuelBeds: beds,
          towardsDeg: this.now().towardsDeg,
          ignitions,
          horizon: this.horizon.minutes + FORECAST_MARGIN_MINUTES,
        },
        (share) => {
          if (mine === this.run) this.progress.set(share);
        },
      );
      if (mine !== this.run) return;

      this.computing.set(false);
      this.result.set(result);
      this.playing.set(true);
    } catch (error) {
      if (mine === this.run)
        this.runError.set(
          error instanceof Error ? error.message : 'No s’ha pogut calcular el foc.',
        );
    } finally {
      if (mine === this.run) this.computing.set(false);
    }
  }

  /** Takes the simulation off, whether it has finished or not. */
  protected reset(): void {
    this.runError.set(null);
    this.run += 1;
    this.playing.set(false);
    this.computing.set(false);
    this.result.set(null);
    this.minutes.set(0);
  }

  protected togglePlay(): void {
    if (!this.result()) return;
    // Pressing play at the end starts over, which is what the button means there.
    if (!this.playing() && this.minutes() >= this.horizon.minutes) this.minutes.set(0);
    this.playing.update((on) => !on);
  }

  protected setSpeed(event: Event): void {
    this.speed.set((event.target as HTMLSelectElement).value);
  }

  /** The same button turns a tool off, which is what makes it a toggle. */
  protected toggleTool(name: string): void {
    this.tool.update((current) => (current === name ? null : name));
  }

  /** Frames the domain again, from wherever the camera has been dragged to. */
  protected recentre(): void {
    const point = this.ignition();
    if (point) this.maps.goToBounds(domainAround(point));
  }

  /** Takes one ignition off; the ones after it are renumbered. */
  protected removeStart(index: number): void {
    this.writeStarts(this.starts().filter((_, i) => i !== index));
  }

  protected refreshWeather(): void {
    const centre = this.ignition();
    if (centre) this.weather.load(this.country(), centre);
  }

  protected clearStarts(): void {
    this.writeStarts([]);
  }

  /**
   * Puts the ignitions in the address, which is what draws them.
   *
   * Replacing the entry and not stacking one, as moving the centre does
   * (§2.26): otherwise the back button would walk every point placed instead
   * of leaving the screen. With none left the parameter goes away, so a
   * simulation with no ignitions keeps the address it had.
   */
  private writeStarts(starts: readonly Point[]): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { ignicions: starts.length ? formatPoints(starts) : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /** One level in or out. The sandbox's own limits stop it (§11.10). */
  protected zoom(levels: number): void {
    this.maps.zoomBy(levels);
  }

  /** How full the range's track is painted, as a percentage. */
  protected fill(value: number, min: number, max: number): string {
    // Clamped: a station can report 97 % of humidity or 8 °C, outside what the
    // sliders offer, and the track must not paint past its own ends.
    const share = Math.min(Math.max((value - min) / (max - min), 0), 1);
    return `${share * 100}%`;
  }
}
