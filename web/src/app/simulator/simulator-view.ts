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
import { MunicipalitiesService } from '../simulation/municipalities.service';
import { formatPoints, parsePoint, parsePoints, type Point } from '../simulation/point';
import { ProvincesService } from '../simulation/provinces.service';
import { SLOPE_CLASSES, slopeImage } from '../simulation/slope-classes';
import { groundAt } from '../simulation/terrain';
import { TerrainService } from '../simulation/terrain.service';
import { Icon } from './icon';

/** The eight points of the compass, as the wind selector offers them. */
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

const FUELS = [
  { id: 'pine', label: 'Pinar mediterrani', note: 'Continuïtat alta', load: 'Càrrega alta' },
  { id: 'scrub', label: 'Matollar i brossa', note: 'Propagació ràpida', load: 'Càrrega mitjana' },
  { id: 'mixed', label: 'Bosc mixt', note: 'Continuïtat irregular', load: 'Càrrega mitjana' },
  { id: 'oak', label: 'Alzinar', note: 'Continuïtat baixa', load: 'Càrrega baixa' },
] as const;

const SCENARIOS = [
  { id: 'base', label: 'Base', icon: 'sun' },
  { id: 'wind', label: 'Vent fort', icon: 'wind' },
  { id: 'humid', label: 'Humitat alta', icon: 'droplet' },
] as const;

/**
 * The figures the right-hand column shows while there is no model.
 *
 * Every one of them is invented, and that is the whole reason they are in one
 * place with this name on it: a number that comes from here must never be able
 * to pass for one that came from a computation. The screen says so three
 * times —in the heading, in the note under the analysis, and in the status
 * bar— and the day the model lands this constant is what disappears.
 *
 * The shapes are plausible rather than arbitrary: a front that accelerates and
 * then eases, and a burned area that accumulates. A flat line would make the
 * layout look right for the wrong reason.
 */
const SAMPLE = {
  risk: { title: 'Risc alt', detail: 'Propagació cap a zona urbana', level: 4, of: 5 },
  area: '48,0',
  areaTrend: '+14,8 ha en 30 min',
  spread: '8,2',
  heading: { short: 'SE', degrees: 135, name: 'sud-est' },
  containment: 18,
  eta: 46,
  homes: 24,
  forecast: [12, 18, 26, 31, 39, 44, 48, 55, 63, 68, 71, 74],
  history: [2, 6, 11, 15, 22, 29, 34, 41, 48],
  comparison: [
    { id: 'base', label: 'Base', value: 74, of: 120, colour: '#f7a541' },
    { id: 'wind', label: 'Vent fort', value: 118, of: 120, colour: '#ed6547' },
    { id: 'humid', label: 'Humitat alta', value: 46, of: 120, colour: '#8fbb94' },
  ],
} as const;

/**
 * A line and the area under it, as two SVG paths.
 *
 * Drawn here and not with a charting library: two paths over a fixed viewBox
 * is what these charts are, and a dependency for that would be heavier than
 * the thing it draws. `preserveAspectRatio="none"` lets the viewBox stretch to
 * whatever width the column has.
 */
/** Latitude first for reading, longitude first for the URL: see point.ts. */
function readable(point: Point): string {
  const ns = point[1] >= 0 ? 'N' : 'S';
  const ew = point[0] >= 0 ? 'E' : 'O';
  return `${Math.abs(point[1]).toFixed(4)}° ${ns}, ${Math.abs(point[0]).toFixed(4)}° ${ew}`;
}

function chartPaths(values: readonly number[], width = 300, height = 100) {
  const top = Math.max(...values);
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
 * **The model does not exist yet** (§12.5). What is real here is the ground,
 * the place, the domain and the controls that will feed it; what is invented
 * is everything the analysis column shows, and it comes from one constant
 * called SAMPLE so that it cannot be mistaken for anything else. The layout is
 * the FireCast prototype's, as §11.7 settled.
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
  protected readonly sample = SAMPLE;
  protected readonly directions = DIRECTIONS;
  protected readonly fuels = FUELS;
  protected readonly scenarios = SCENARIOS;

  // ---- What the user can set. None of it feeds anything yet. ----

  protected readonly wind = signal(22);
  protected readonly direction = signal(315);
  protected readonly humidity = signal(28);
  protected readonly temperature = signal(32);
  protected readonly fuel = signal<string>('pine');
  protected readonly scenario = signal<string>('base');
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
   * At zero and not movable until there is a model: a clock that could be
   * dragged to «T + 02:00» with nothing running would be a time of nothing.
   */
  protected readonly minutes = signal(0);
  protected readonly speed = signal('1');

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

  protected readonly from = computed(
    () => DIRECTIONS.find((d) => d.degrees === this.direction()) ?? DIRECTIONS[7],
  );

  /**
   * Where the wind takes the fire, which is the opposite of where it comes
   * from. Spelled out because the two readings of «vent del nord-oest» are
   * 180° apart and only one of them is the fire's.
   */
  protected readonly towards = computed(() => {
    const degrees = (this.direction() + 180) % 360;
    return DIRECTIONS.find((d) => d.degrees === degrees) ?? DIRECTIONS[3];
  });

  protected readonly fuelDetail = computed(
    () => FUELS.find((f) => f.id === this.fuel()) ?? FUELS[0],
  );

  /** `T + 02:00`, from the timeline's minutes. */
  protected readonly elapsed = computed(() => {
    const total = this.minutes();
    const hours = Math.floor(total / 60);
    return `${String(hours).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  });

  protected readonly forecastChart = chartPaths(SAMPLE.forecast);
  protected readonly historyChart = chartPaths(SAMPLE.history, 300, 64);

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
      if (point) this.terrain.read(point);
      else this.terrain.clear();
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

    inject(DestroyRef).onDestroy(() => {
      this.terrain.clear();
      chrome.visible.set(true);
      this.maps.destroy();
    });
  }

  protected setNumber(which: 'wind' | 'humidity' | 'temperature', event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    ({ wind: this.wind, humidity: this.humidity, temperature: this.temperature })[which].set(value);
  }

  protected setDirection(event: Event): void {
    this.direction.set(Number((event.target as HTMLSelectElement).value));
  }

  protected setFuel(event: Event): void {
    this.fuel.set((event.target as HTMLSelectElement).value);
  }

  protected setMinutes(event: Event): void {
    this.minutes.set(Number((event.target as HTMLInputElement).value));
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
    return `${((value - min) / (max - min)) * 100}%`;
  }
}
