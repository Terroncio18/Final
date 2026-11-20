import {
  afterNextRender,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  InjectionToken,
  input,
  signal,
  untracked,
  viewChild,
  type EffectRef,
  type OnDestroy,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CountermeasureDisplay } from '../map/countermeasure-display';
import { SpottingDisplay, spotPoint } from '../map/spotting-display';
import { MapService } from '../map/map.service';
import { PlacesService } from '../map/places.service';
import {
  countermeasureCells,
  MOP_UP_MAX_FLAME_M,
  type CountermeasureKind,
  type Countermeasure,
} from '../simulation/countermeasures';
import { CELL_M, domainAround, domainRing, GRID } from '../simulation/domain';
import { groundAgentsAt, passesBetween } from '../simulation/agents';
import { FireSurface } from '../simulation/fire-surface';
import { FORECASTS, FORECAST_COLOURS, forecastOffsets } from '../simulation/fire-display';
import { frontIntensity } from '../simulation/fire-emitters';
import { spread, type SpreadResult } from '../simulation/fire-spread';
import { spreadWinds, type WindChange } from '../simulation/wind';
import { MunicipalitiesService } from '../simulation/municipalities.service';
import {
  formatPoint,
  formatPoints,
  parsePoint,
  parsePoints,
  type Point,
} from '../simulation/point';
import { ProvincesService } from '../simulation/provinces.service';
import {
  formatScenario,
  isOutdated,
  MAX_SCENARIO_SIZE,
  readScenario,
  SCENARIO_DEFAULTS,
  SCENARIO_TOO_LARGE,
  scenarioFileName,
} from '../simulation/scenario';
import {
  CONTROL_CLASSES,
  flameLength,
  FUEL_MODELS,
  fuelBed,
  M_PER_FT,
  midflameWind,
  moisturesFor,
  windFactor,
  type FuelBed,
  type Moistures,
} from '../simulation/rothermel';
import { SLOPE_CLASSES, slopeImage } from '../simulation/slope-classes';
import { cellOf, groundAt } from '../simulation/terrain';
import { TerrainService } from '../simulation/terrain.service';
import { FuelService } from '../simulation/fuel.service';
import {
  catalogEntry,
  checkSettings,
  CountermeasurePlan,
  defaultSettings,
  lastPass,
  workStart,
  type ToolSettings,
} from './countermeasure-plan';
import { AnalysisPanel } from './analysis-panel';
import { FireAnimation } from './fire-animation';
import { FireRun } from './fire-run';
import { CountermeasurePanel, type PastWarning } from './countermeasure-panel';
import { DomainPanel } from './domain-panel';
import { FuelPanel } from './fuel-panel';
import { Icon } from './icon';
import { IgnitionPanel } from './ignition-panel';
import { LayerMenu } from './layer-menu';
import { ScenarioPanel, type ScenarioNote } from './scenario-panel';
import { ScreenWeather } from './screen-weather';
import { ToolSettingsModal, type ToolConfig } from './tool-settings';
import { WeatherService } from './weather.service';
import { compass, trackFill, WeatherPanel, type WindEdit } from './weather-panel';

export const SIMULATE_FIRE = new InjectionToken<typeof spread>('simulate fire', {
  providedIn: 'root',
  factory: () => spread,
});

// Keep this breakpoint in sync with simulator-view.css.
const NARROW_WORKSPACE_QUERY = '(max-width: 860px)';

// Visible horizon in hours: about one burning period before fixed weather and a 30 km domain
// become limiting.
const HORIZON_HOURS = 12;

const FORECAST_MARGIN_MINUTES = 6 * 60 + 30;

// Live fuel moisture as a fraction: fixed at Anderson’s 100% reference, not measured or derived
// from weather.
const LIVE_MOISTURE = 1.0;

// Simulation minutes per wall-clock second at 1× playback.
const PLAYBACK = 0.5;

function readable(point: Point): string {
  const ns = point[1] >= 0 ? 'N' : 'S';
  const ew = point[0] >= 0 ? 'E' : 'O';
  return `${Math.abs(point[1]).toFixed(4)}° ${ns}, ${Math.abs(point[0]).toFixed(4)}° ${ew}`;
}

function heatOf(result: SpreadResult): (cell: number, minute: number) => number {
  return (cell, minute) =>
    result.fuelTreatments?.at(cell, minute)?.bed.heatPerArea ?? result.heat[cell];
}

function recentFront(
  rate: Float32Array,
  intensity: Float32Array,
  heading: Float32Array,
  minute: number,
): { fastest: number; hottest: number; bearing: number } {
  let fastest = 0;
  let hottest = 0;
  let bearing = Number.NaN;
  for (let m = minute; m >= Math.max(minute - 10, 0); m -= 1) {
    if (rate[m] > fastest) fastest = rate[m];
    if (intensity[m] > hottest) hottest = intensity[m];
    if (Number.isNaN(bearing) && !Number.isNaN(heading[m])) bearing = heading[m];
  }
  return { fastest, hottest, bearing };
}

function sameItems<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((item, i) => item === b[i]);
}

@Component({
  selector: 'app-simulator-view',
  imports: [
    RouterLink,
    Icon,
    ToolSettingsModal,
    AnalysisPanel,
    LayerMenu,
    DomainPanel,
    WeatherPanel,
    FuelPanel,
    ScenarioPanel,
    IgnitionPanel,
    CountermeasurePanel,
  ],
  templateUrl: './simulator-view.html',
  styleUrls: ['./simulator-view.css', './countermeasures.css'],

  host: { '(document:keydown.escape)': 'cancelTool()' },
})
export class SimulatorView implements OnDestroy {
  public readonly region = input.required<string>();
  public readonly province = input.required<string>();
  public readonly municipality = input.required<string>();
  public readonly point = input.required<string>();

  public readonly ignicions = input<string>();
  private readonly simulate = inject(SIMULATE_FIRE);
  private readonly maps = inject(MapService);
  private readonly municipalities = inject(MunicipalitiesService);
  private readonly provinces = inject(ProvincesService);
  private readonly places = inject(PlacesService);
  private readonly terrain = inject(TerrainService);
  protected readonly fuels = inject(FuelService);
  private readonly observations = inject(WeatherService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly minutes = signal(0);

  protected readonly runs = new FireRun();
  protected readonly weather = new ScreenWeather(this.observations, {
    country: () => this.country(),
    centre: () => this.ignition(),
    minute: () => this.minutes(),
  });

  protected readonly spottingEnabled = signal(SCENARIO_DEFAULTS.spotting.enabled);
  protected readonly spottingSeed = signal(SCENARIO_DEFAULTS.spotting.seed);

  private planDomain: string | null = null;

  protected readonly tool = signal<'ignition' | null>(null);

  protected readonly speed = signal('1');

  protected readonly playing = signal(false);

  protected readonly forecasts = signal(true);
  private redrawFire: ((minute: number, forecast: boolean) => void) | null = null;

  protected readonly relief = signal(true);
  protected readonly contours = signal(true);
  protected readonly labels = signal(true);

  protected readonly slopes = signal(false);
  protected readonly layersOpen = signal(false);

  protected readonly scenarioName = signal('');

  protected readonly scenarioNote = signal<ScenarioNote | null>(null);

  protected readonly pastWarning = signal<PastWarning | null>(null);

  protected readonly configuring = signal<ToolConfig | null>(null);
  // Screen north turns opposite to the map bearing.
  protected readonly compassTurn = computed(() => `rotate(${-this.maps.bearing()}deg)`);
  private readonly fireAnimation: EffectRef;
  private readonly playback: EffectRef;

  private readonly container = viewChild.required<ElementRef<HTMLDivElement>>('container');

  protected readonly ready = this.maps.ready;

  protected readonly plan = new CountermeasurePlan();
  private readonly measureDisplay = new CountermeasureDisplay();
  private readonly spottingDisplay = new SpottingDisplay();
  private readonly spottingConfig = computed(() => ({
    enabled: this.spottingEnabled(),
    seed: this.spottingSeed(),
  }));
  protected readonly visibleSpots = computed(
    () => (this.runs.result()?.spotIgnitions ?? []).filter((s) => s.minute <= this.minutes()),
    // Reuse lists until their items change: MapService rebuilds the layer on each new list.
    { equal: sameItems },
  );
  // Reuse the measure list during playback; rebuilding strips and discs on every frame is
  // expensive.
  private readonly shownMeasures = computed(
    () =>
      this.plan
        .measures()
        .filter(
          (measure) =>
            !this.runs.result() ||
            ((measure.startMin ?? 0) <= this.minutes() &&
              (!measure.durationMin ||
                this.minutes() < (measure.startMin ?? 0) + measure.durationMin) &&
              !((lastPass(measure) ?? Infinity) < this.minutes())),
        ),
    { equal: sameItems },
  );
  protected readonly spotRows = computed(() =>
    this.visibleSpots().map((s, i) => ({
      ...s,
      label: `Focus per brasa ${i + 1}`,
      time: this.clock(s.minute),
      distance: Math.round(s.distanceM),
    })),
  );

  protected readonly horizon = {
    hours: HORIZON_HOURS,
    minutes: HORIZON_HOURS * 60,
    ticks: Array.from({ length: HORIZON_HOURS / 2 + 1 }, (_, i) => (i ? `+${i * 2} h` : 'Inici')),
  };
  protected readonly windRows = computed(() =>
    this.weather.changes().map((change) => ({
      ...change,
      time: this.clock(change.startMin),
      origin: compass(change.fromDeg).short,
      pending: change.startMin > this.minutes(),
    })),
  );
  protected readonly starts = computed<readonly Point[]>(() => {
    const centre = this.ignition();
    if (!centre) return [];
    const [west, south, east, north] = domainAround(centre);
    return parsePoints(this.ignicions()).filter(
      ([lon, lat]) => lon >= west && lon <= east && lat >= south && lat <= north,
    );
  });

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

  protected readonly fill = trackFill;
  private readonly visibleForecasts = computed(() => this.forecasts() && !this.runs.computing());
  protected readonly forecastRows = computed(() => {
    const result = this.runs.result();
    if (!result || this.runs.computing()) return [];
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
  protected readonly slopeClasses = SLOPE_CLASSES;

  private readonly narrowQuery = matchMedia(NARROW_WORKSPACE_QUERY);
  protected readonly narrowWorkspace = signal(this.narrowQuery.matches);

  protected readonly ignition = computed(() => parsePoint(this.point()));

  protected readonly chosen = computed(() => this.municipalities.find(this.municipality()));

  protected readonly provinceName = computed(
    () => this.provinces.find(this.province())?.name ?? this.province(),
  );

  protected readonly coordinates = computed(() => {
    const point = this.ignition();
    return point ? readable(point) : '';
  });

  // Read elevation and slope from the model grid, not MapLibre’s display mesh.
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

  protected readonly domain = {
    grid: GRID,
    cell: CELL_M,
  };

  protected readonly back = computed(() => [
    '/simulacio',
    this.region(),
    this.province(),
    this.municipality(),
    this.point(),
  ]);

  protected readonly country = computed<'ES' | 'PT'>(() =>
    this.region().startsWith('PT') ? 'PT' : 'ES',
  );

  protected readonly scenarioSummary = computed(() => {
    const starts = this.starts().length;
    const fires = starts === 1 ? '1 ignició' : `${starts} ignicions`;
    const planned = this.plan.measures().length;
    const measures =
      planned === 1 ? '1 contramesura · ' : planned ? `${planned} contramesures · ` : '';
    const now = this.weather.now();
    return (
      `${fires} · ${measures}vent ${now.wind} km/h ${compass(now.fromDeg).short} · ` +
      `${now.humidity} % · ${now.temperatureText} °C`
    );
  });

  protected readonly elapsed = computed(() => this.clock(this.minutes()));

  private readonly fuelState = computed(() => {
    const now = this.weather.now();
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
      // Convert feet per minute to the station’s km/h.
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
      !this.runs.computing() &&
      this.plan.draft().length === 0 &&
      this.terrain.terrain() !== null &&
      this.starts().length > 0 &&
      !this.fuelIssue(),
  );

  protected readonly state = computed(() => {
    if (this.runs.computing()) {
      const share = Math.round(this.runs.progress() * 100);
      return {
        tag: 'CALCULANT',
        short: `${this.runs.result() ? 'Actualitzant previsió' : 'Calculant'}… ${share} %`,
        title: 'Calculant la propagació',
        detail: "El foc es calcula en l'ordre en què crema.",
      };
    }
    if (this.runs.result()) {
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
    const issue = this.fuelIssue() ?? this.runs.error();
    if (issue)
      return { tag: 'SENSE CÀLCUL', short: issue, title: 'Combustibles del domini', detail: issue };
    return {
      tag: 'SENSE CÀLCUL',
      short: 'A punt',
      title: 'A punt per calcular',
      detail: 'Inicia la simulació per veure com avança el foc en dotze hores.',
    };
  });

  protected readonly figures = computed(() => {
    const result = this.runs.result();
    if (!result) return null;
    const { area, perimeter, rate, heading, intensity, run } = result.series;
    const minute = Math.min(Math.floor(this.minutes()), area.length - 1);
    const one = new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 1 });
    const whole = new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 0 });
    const size = (value: number) => (value < 100 ? one : whole).format(value);

    const { fastest, hottest, bearing } = recentFront(rate, intensity, heading, minute);
    const back = Math.max(minute - 30, 0);
    const perHour = minute > back ? ((area[minute] - area[back]) / (minute - back)) * 60 : 0;
    const total = result.burnable * ((CELL_M * CELL_M) / 10_000);
    const towards = Number.isNaN(bearing) ? null : compass(bearing);
    // Byram flame length is undefined for a stopped front.
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
      ...this.edgeFigures(result.reachedEdge, minute),
      cursor: (minute / this.horizon.minutes) * 300,
    };
  });

  private readonly lastSettings = new Map<CountermeasureKind, ToolSettings>();

  public constructor() {
    this.plan.guard = (measure) => this.mopUpGuard(measure);
    this.narrowQuery.addEventListener('change', this.onNarrowChange);
    this.watchGroundAgents();
    this.watchAircraftPasses();
    this.configureMap();
    this.watchDomainData();
    this.watchTools();
    this.watchDomainPlan();
    this.watchCountermeasures();
    this.watchPlanDrawing();
    this.watchTerrainLayers();
    this.watchResultInputs();
    this.fireAnimation = this.watchFireAnimation();
    this.watchBackgroundRedraw();
    this.playback = this.watchPlayback();
  }

  protected saveScenario(): void {
    if (this.plan.draft().length || this.weather.draft() || this.runs.computing()) {
      this.scenarioNote.set({
        text: 'Finalitza els canvis pendents i espera que acabi el càlcul abans de desar.',
        failed: true,
      });
      return;
    }
    const centre = this.ignition();
    if (!centre) return;
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
        ...this.weather.snapshot(),
        countermeasures: this.plan.measures(),
        spotting: this.spottingConfig(),
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

  protected async loadScenario(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > MAX_SCENARIO_SIZE) {
      this.scenarioNote.set({ text: SCENARIO_TOO_LARGE, failed: true });
      return;
    }
    const read = readScenario(await file.text());
    if (typeof read === 'string') {
      this.scenarioNote.set({ text: read, failed: true });
      return;
    }
    const scenario = read.scenario;
    this.reset();
    this.weather.restore(scenario);
    this.spottingEnabled.set(scenario.spotting?.enabled ?? false);
    this.spottingSeed.set(scenario.spotting?.seed ?? SCENARIO_DEFAULTS.spotting.seed);
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
    // Navigate first so plan validation uses the scenario’s domain.
    this.planDomain = formatPoint(scenario.centre);
    this.plan.replace(scenario.countermeasures ?? [], domainAround(scenario.centre));
    const loaded = `Carregat: ${scenario.name || file.name}`;
    if (!isOutdated(read)) {
      this.scenarioNote.set({ text: loaded, failed: false });
      return;
    }
    const filled = read.filled.length
      ? ` S'hi han afegit amb els valors per defecte: ${read.filled.join(', ')}.`
      : '';
    this.scenarioNote.set({
      text: `${loaded}. És un escenari de la versió ${read.version}.${filled}`,
      failed: false,
      outdated: true,
    });
  }

  public ngOnDestroy(): void {
    this.narrowQuery.removeEventListener('change', this.onNarrowChange);
    this.runs.abandon();
    this.fireAnimation.destroy();
    this.playback.destroy();
    this.spottingDisplay.detach();
    this.measureDisplay.detach();
    this.plan.cancel();
    this.terrain.clear();
    this.fuels.clear();
    this.weather.release();
    this.maps.destroy();
  }

  // Before a run, wind edits set initial weather; after a run, they become changes at the paused
  // cursor.
  protected editWind(change: WindEdit): void {
    if (this.runs.computing()) return;
    const now = this.weather.now();
    const next = { speedKmh: now.wind, fromDeg: now.fromDeg, ...change };
    if (!this.runs.result()) {
      this.weather.setInitial(next);
      return;
    }
    this.playing.set(false);
    this.plan.cancel();
    this.tool.set(null);
    this.weather.draft.set(next);
  }

  protected async applyWind(): Promise<void> {
    const draft = this.weather.draft();
    if (!draft || !this.runs.result() || !this.canStart()) return;
    const before = this.weather.changes();
    const changes = this.weather.withChangeAt(draft, this.minutes());
    if (typeof changes === 'string') {
      this.runs.error.set(changes);
      return;
    }
    this.weather.changes.set(changes);
    this.weather.draft.set(null);
    await this.start(this.minutes(), undefined, before);
  }

  protected setMinutes(event: Event): void {
    if (this.runs.computing()) return;
    this.weather.draft.set(null);
    this.pastWarning.set(null);

    this.playing.set(false);
    this.minutes.set(Number((event.target as HTMLInputElement).value));
  }

  protected focusFire(): void {
    const result = this.runs.result(),
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

  // Snapshot all inputs once so an asynchronous run computes one consistent scenario.
  protected async start(
    continueAt?: number,
    previousPlan?: readonly Countermeasure[],
    previousWinds?: readonly WindChange[],
  ): Promise<void> {
    const terrain = this.terrain.terrain();
    const centre = this.ignition();
    const fuels = this.fuels.grid();
    if (!terrain || !centre || !fuels || !this.canStart()) return;

    const baseline = this.weather.base();
    const moistures = moisturesFor(baseline.temperature, baseline.humidity, LIVE_MOISTURE);
    const beds = this.fuelBedsFor(moistures, baseline.wind);
    const { bed, midflame } = beds[1];
    const ignitions = this.starts()
      .map((point) => cellOf(centre, point))
      .filter((cell): cell is number => cell !== null);

    const mine = this.beginRun(continueAt);
    const measures = this.plan.measures();

    try {
      const result = await this.simulate(
        {
          elevation: terrain.elevation,
          bed,
          midflame,
          fuels: fuels.models,
          fuelBeds: beds,
          towardsDeg: baseline.towardsDeg,
          windChanges: spreadWinds(this.weather.changes()),
          fuelMoistures: moistures,
          spotting: this.spottingConfig(),
          wind10mKmh: baseline.wind,
          temperatureC: baseline.temperature,
          ignitions,
          horizon: this.horizon.minutes + FORECAST_MARGIN_MINUTES,

          ...(measures.length ? { countermeasures: { centre, measures } } : {}),
        },
        (share) => this.runs.report(mine, share),
      );
      if (!this.runs.owns(mine)) return;

      this.publishRun(mine, result, continueAt);
    } catch (error) {
      if (this.runs.owns(mine)) {
        if (previousPlan) this.plan.measures.set(previousPlan);
        if (previousWinds) this.weather.changes.set(previousWinds);
        this.runs.fail(
          mine,
          error instanceof Error ? error.message : 'No s’ha pogut calcular el foc.',
        );
      }
    } finally {
      this.runs.settle(mine);
    }
  }

  protected reset(): void {
    this.weather.draft.set(null);
    this.runs.discard();
    this.playing.set(false);
    this.minutes.set(0);
    this.plan.minute.set(0);
  }

  protected togglePlay(): void {
    if (!this.runs.result() || this.runs.computing() || this.weather.draft()) return;
    this.plan.cancel();
    this.tool.set(null);
    this.pastWarning.set(null);

    if (!this.playing() && this.minutes() >= this.horizon.minutes) this.minutes.set(0);
    this.runs.stale.set(false);
    this.playing.update((on) => !on);
  }

  protected setSpeed(event: Event): void {
    this.speed.set((event.target as HTMLSelectElement).value);
  }

  protected pickMeasure(kind: CountermeasureKind): void {
    if (this.runs.computing()) return;
    this.weather.draft.set(null);
    this.playing.set(false);
    this.plan.minute.set(this.runs.result() ? this.minutes() : 0);

    if (this.plan.kind() === kind || this.configuring()?.kind === kind) {
      this.cancelTool();
      return;
    }

    const later = this.runs.result() ? this.plan.later().length : 0;
    if (later) {
      this.plan.cancel();
      this.configuring.set(null);
      this.pastWarning.set({ kind, count: later });
      return;
    }
    this.pastWarning.set(null);
    this.openSettings(kind, false);
  }

  protected confirmPastMeasure(): void {
    const warning = this.pastWarning();
    if (!warning) return;
    this.pastWarning.set(null);
    this.openSettings(warning.kind, true);
  }

  protected applySettings(): void {
    const config = this.configuring();
    if (!config) return;
    const error = checkSettings(config.kind, config.settings);
    if (error) {
      this.configuring.set({ ...config, error });
      return;
    }
    this.lastSettings.set(config.kind, config.settings);
    this.configuring.set(null);
    this.plan.begin(config.kind, config.discard, config.settings);
  }

  protected cancelPastMeasure(): void {
    this.pastWarning.set(null);
  }

  protected finishMeasure(): void {
    this.editPlan(() => this.plan.finish());
  }

  protected cancelTool(): void {
    this.plan.cancel();
    this.tool.set(null);
    this.pastWarning.set(null);
    this.configuring.set(null);
  }

  protected removeMeasure(id: string): void {
    this.editPlan(() => this.plan.remove(id));
  }

  protected clearMeasures(): void {
    this.editPlan(() => this.plan.clear());
  }

  protected focusSpot(cell: number): void {
    const centre = this.ignition();
    if (!centre) return;
    const [lon, lat] = spotPoint(cell, centre);
    this.maps.goToBounds([lon - 0.005, lat - 0.004, lon + 0.005, lat + 0.004]);
  }

  protected recentre(): void {
    const point = this.ignition();
    if (point) this.maps.goToBounds(domainAround(point));
  }

  protected removeStart(index: number): void {
    this.writeStarts(this.starts().filter((_, i) => i !== index));
  }

  protected clearStarts(): void {
    this.writeStarts([]);
  }

  protected zoom(levels: number): void {
    this.maps.zoomBy(levels);
  }

  private fuelBedsFor(
    moistures: Moistures,
    wind: number,
  ): Record<number, { bed: FuelBed; midflame: number }> {
    return Object.fromEntries(
      Object.values(FUEL_MODELS).map((model) => [
        model.id,
        { bed: fuelBed(model, moistures), midflame: midflameWind(model, wind) },
      ]),
    );
  }

  private beginRun(continueAt?: number): number {
    const mine = this.runs.begin(continueAt !== undefined);
    this.playing.set(false);
    this.weather.draft.set(null);
    if (continueAt === undefined) {
      this.minutes.set(0);
      this.plan.cancel();
    }
    return mine;
  }

  private publishRun(mine: number, result: SpreadResult, continueAt?: number): void {
    this.runs.publish(mine, result, continueAt !== undefined);
    this.minutes.set(continueAt ?? 0);
    this.playing.set(continueAt === undefined);
  }

  private readonly onNarrowChange = (event: MediaQueryListEvent) =>
    this.narrowWorkspace.set(event.matches);

  private clock(minutes: number): string {
    const total = Math.floor(minutes);
    const hours = Math.floor(total / 60);
    return `${String(hours).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }

  private edgeFigures(arrival: number, minute: number) {
    const reachedEdge = arrival <= this.horizon.minutes ? arrival : Infinity;
    const edgeReached = reachedEdge <= minute;
    if (!Number.isFinite(reachedEdge))
      return {
        edge: 'No hi arriba',
        edgeNote: `En ${this.horizon.hours} h el foc no surt del domini`,
        edgeReached,
      };
    return {
      edge: `T + ${this.clock(reachedEdge)}`,
      edgeNote: edgeReached
        ? "A partir d'aquí el foc surt del que es calcula"
        : 'Més enllà el foc surt del que es calcula',
      edgeReached,
    };
  }

  // Mop-up requires burned ground and intensity low enough for hand tools.
  private mopUpGuard(measure: Countermeasure): string | null {
    if (measure.kind !== 'mop-up') return null;
    const result = this.runs.result(),
      centre = this.ignition();
    if (!result || !centre) return 'L’extinció de restes necessita un foc calculat.';
    // Crew work begins on arrival, not at deployment time.
    const minute = workStart(measure) ?? measure.startMin ?? 0;
    const cells = new Set(countermeasureCells(centre, measure));
    if (![...cells].some((cell) => result.arrival[cell] <= minute))
      return 'Aquí encara no ha cremat res: no hi ha restes a extingir.';
    const flame = flameLength(frontIntensity(result.arrival, minute, cells, heatOf(result)));
    if (flame > MOP_UP_MAX_FLAME_M) {
      const metres = (value: number) => value.toFixed(1).replace('.', ',');
      return (
        `Front massa intens per a les brigades: flames de ${Number.isFinite(flame) ? metres(flame) : 'més de 12'} m, ` +
        `i el límit és ${metres(MOP_UP_MAX_FLAME_M)} m.`
      );
    }
    return null;
  }

  private editPlan(edit: () => void): void {
    if (this.runs.computing()) return;
    const before = this.plan.measures();
    const had = this.runs.result() !== null;
    this.playing.set(false);
    this.plan.minute.set(had ? this.minutes() : 0);
    edit();
    if (had && this.plan.measures() !== before) {
      this.plan.draft.set([]);
      void this.start(this.minutes(), before);
    }
  }

  private openSettings(kind: CountermeasureKind, discard: boolean): void {
    this.plan.cancel();
    this.configuring.set({
      kind,
      discard,
      settings: this.lastSettings.get(kind) ?? defaultSettings(kind),
      error: null,
    });
  }

  private writeStarts(starts: readonly Point[]): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { ignicions: starts.length ? formatPoints(starts) : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private watchGroundAgents(): void {
    effect(() => this.plan.crewStops.set(this.runs.result()?.crewStops ?? new Map()));
    effect(() => {
      const result = this.runs.result();
      this.maps.setGroundAgents(
        result
          ? groundAgentsAt(this.plan.measures(), this.minutes(), result.crewStops ?? new Map())
          : [],
      );
    });
  }

  private watchAircraftPasses(): void {
    this.maps.setAgentsMotion(!matchMedia('(prefers-reduced-motion: reduce)').matches);
    let passClock = untracked(this.minutes);
    effect(() => {
      const minute = this.minutes(),
        playing = this.playing(),
        result = this.runs.result();
      const from = passClock;
      passClock = minute;
      if (!result) {
        this.maps.landPasses();
        return;
      }
      if (!playing || minute <= from || minute - from > 30) return;
      const windFrom = untracked(this.weather.active).fromDeg;
      for (const pass of passesBetween(untracked(this.plan.measures), from, minute, windFrom))
        this.maps.flyPass(pass);
    });
    let known = new Set(untracked(this.plan.measures).map((m) => m.id));
    effect(() => {
      const measures = this.plan.measures();
      const fresh = measures.filter((m) => !known.has(m.id));
      known = new Set(measures.map((m) => m.id));
      if (!fresh.length || !untracked(this.runs.result)) return;
      const minute = untracked(this.minutes);
      const windFrom = untracked(this.weather.active).fromDeg;
      for (const pass of passesBetween(fresh, minute - 1e-6, minute, windFrom))
        this.maps.flyPass(pass);
    });
  }

  private configureMap(): void {
    this.provinces.load();
    afterNextRender(() => this.maps.create(this.container().nativeElement));
    effect(() => {
      // LevelsService configures form steps and would disable this screen’s relief.
      this.maps.setHotspotsVisible(false);
      this.maps.setRegionsVisible(false);
      this.maps.showProvincesOf(null);

      this.municipalities.load(this.province());
      this.maps.focusMunicipality(null);

      const point = this.ignition();
      if (!point) return;

      this.maps.setIgnition(point);
      this.maps.setDomain(domainRing(point));

      this.maps.setDomainMask(true);

      // Set terrain before framing so fitBounds uses the right pitch; disabling relief also
      // restores north-up.
      this.maps.setTerrain3D(this.relief());
      this.maps.setOrbit(this.relief());

      // The simulator map has its own column, so form-panel fit padding would shrink the domain
      // incorrectly.
      this.maps.goToBounds(domainAround(point));

      this.maps.setSandboxBounds(domainAround(point));
    });
    effect(() => this.maps.setContours(this.contours()));
    this.maps.setReliefEmphasis(true);
    effect(() => {
      const point = this.ignition();
      if (!point) return;

      if (this.labels()) this.places.load(this.province(), domainAround(point));
      else this.places.release();
    });
  }

  private watchDomainData(): void {
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
    effect(() => this.weather.readLive());
  }

  private watchTools(): void {
    effect(() =>
      this.maps.setPicking(
        !this.runs.computing() && (this.tool() === 'ignition' || this.plan.kind() !== null),
      ),
    );
    effect(() => {
      const minute = this.runs.result() ? this.minutes() : 0;
      untracked(() => this.plan.minute.set(minute));
    });
    effect(() => {
      if (this.plan.kind()) untracked(() => this.tool.set(null));
    });
    effect(() => {
      const picked = this.maps.picked();
      if (!picked) return;
      untracked(() => {
        if (this.runs.computing()) return;
        if (this.plan.kind()) {
          const centre = this.ignition();
          if (centre)
            this.editPlan(() => this.plan.click([picked[0], picked[1]], domainAround(centre)));
          return;
        }
        if (this.tool() !== 'ignition') return;

        this.writeStarts([...this.starts(), [picked[0], picked[1]]]);
      });
    });
  }

  private watchDomainPlan(): void {
    effect(() => {
      const centre = this.ignition();
      untracked(() => {
        const key = centre ? formatPoint(centre) : '';
        if (key === this.planDomain) return;
        this.planDomain = key;
        this.plan.confine(centre ? domainAround(centre) : null);
      });
    });
  }

  private watchCountermeasures(): void {
    effect(() => {
      const map = this.maps.ready() ? this.maps.map : null;
      if (!map) return;
      this.measureDisplay.attach(map, (id) => this.plan.select(id));
      this.measureDisplay.setMeasures(
        this.shownMeasures().map((measure) => {
          const entry = catalogEntry(measure.kind);
          return {
            id: measure.id,
            points: measure.points,
            widthM: measure.widthM,
            colour: entry.color,
            disc: entry.geometry === 'point',
          };
        }),
        this.plan.selected(),
      );
    });
    effect(() => {
      const map = this.maps.ready() ? this.maps.map : null,
        centre = this.ignition();
      if (map && centre) this.spottingDisplay.set(map, centre, this.visibleSpots());
    });
  }

  private watchPlanDrawing(): void {
    let rightClicks = untracked(this.maps.rightClicks);
    effect(() => {
      const clicks = this.maps.rightClicks();
      untracked(() => {
        if (clicks === rightClicks) return;
        rightClicks = clicks;
        const tool = this.plan.tool();
        if (!tool || this.runs.computing()) return;
        if (tool.geometry === 'point') this.cancelTool();
        else this.plan.undo();
      });
    });
    effect(() => {
      if (!this.maps.ready()) return;
      const tool = this.plan.tool();
      this.measureDisplay.setDraft(
        tool
          ? {
              points: this.plan.draft(),
              pointer: this.maps.pointer(),
              widthM: tool.widthM,
              colour: tool.color,
              disc: tool.geometry === 'point',
            }
          : null,
      );
    });
  }

  private watchTerrainLayers(): void {
    effect(() => {
      const starts = this.starts();
      this.maps.setFireStarts(
        starts.map((point, index) => ({ point, label: `Ignició ${index + 1}` })),
      );
    });
    effect(() => {
      const point = this.ignition();
      const terrain = this.terrain.terrain();
      if (this.slopes() && point && terrain) {
        this.maps.setSlopes(slopeImage(terrain), domainAround(point));
      } else {
        this.maps.setSlopes(null);
      }
    });
  }

  private watchResultInputs(): void {
    effect(() => {
      this.starts();
      this.weather.base();
      this.spottingConfig();
      this.terrain.terrain();
      this.fuels.grid();
      untracked(() => {
        if (this.runs.result() || this.runs.computing()) this.reset();
      });
    });
  }

  private watchFireAnimation(): EffectRef {
    return effect((onCleanup) => {
      const result = this.runs.result(),
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
        this.runs.error.set('No s’ha pogut dibuixar el foc.');
        console.error(error);
        return;
      }
      const animation = new FireAnimation(this.maps, painter, {
        result,
        centre,
        elevation: terrain.elevation,
        heatAt: heatOf(result),
        minute: () => untracked(this.minutes),
        forecast: () => untracked(this.visibleForecasts),
        weather: () => untracked(this.weather.active),
      });
      this.redrawFire = (minute, forecast) => animation.redraw(minute, forecast);
      animation.start();
      onCleanup(() => {
        this.redrawFire = null;
        animation.dispose();
      });
    });
  }

  private watchBackgroundRedraw(): void {
    effect(() => {
      const minute = this.minutes(),
        forecast = this.visibleForecasts();
      if (document.hidden) untracked(() => this.redrawFire?.(minute, forecast));
    });
  }

  private watchPlayback(): EffectRef {
    return effect((onCleanup) => {
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
  }
}
