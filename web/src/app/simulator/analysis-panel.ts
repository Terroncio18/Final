import { Component, computed, inject, input, signal } from '@angular/core';
import { CELL_M } from '../simulation/domain';
import type { SpreadResult } from '../simulation/fire-spread';
import { FuelService } from '../simulation/fuel.service';
import { FUEL_MODELS } from '../simulation/rothermel';
import { Icon } from './icon';

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

/** Where the simulation stands, as the column's heading and its empty state say it. */
export interface AnalysisState {
  tag: string;
  title: string;
  detail: string;
}

/** The figures of the fire at the minute the timeline is on, already written out. */
export interface AnalysisFigures {
  area: string;
  growth: string;
  share: string;
  perimeter: string;
  rate: string;
  rateNote: string;
  intensity: string;
  flame: string;
  control: string;
  controlNote: string;
  controlHard: boolean;
  run: string;
  heading: string;
  headingNote: string;
  edge: string;
  edgeNote: string;
  edgeReached: boolean;
  /** Where the minute falls on the charts' 300-wide viewBox. */
  cursor: number;
}

/** What Rothermel is given for the weather in force, and what it answers. */
export interface AnalysisConditions {
  dead: string;
  live: number;
  midflame: string;
  base: string;
  head: string;
}

/** One of the forecast bands, as the column lists it. */
export interface ForecastRow {
  offset: number;
  label: string;
  colour: string;
  available: boolean;
  area: string;
  growth: string;
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
 * The right-hand column of the console: what comes out of the computation.
 *
 * The figures, the conditions and the forecast are the screen's, worked out
 * with the clock and the compass it also uses elsewhere, and come in already
 * written. What is the column's own is what it draws from the run —the two
 * curves and the fuels burned— and which of its blocks the reader keeps on.
 * It is its own landmark: the console gives it the place of a sidebar.
 */
@Component({
  selector: 'app-analysis-panel',
  imports: [Icon],
  templateUrl: './analysis-panel.html',
  styleUrl: './analysis-panel.css',
  host: { role: 'complementary', 'aria-label': 'Anàlisi' },
})
export class AnalysisPanel {
  public readonly result = input.required<SpreadResult | null>();
  public readonly minutes = input.required<number>();
  public readonly computing = input.required<boolean>();
  public readonly horizon = input.required<{ hours: number; minutes: number }>();
  public readonly state = input.required<AnalysisState>();
  public readonly elapsed = input.required<string>();
  public readonly figures = input.required<AnalysisFigures | null>();
  public readonly conditions = input.required<AnalysisConditions>();
  public readonly forecastRows = input.required<readonly ForecastRow[]>();

  private readonly fuels = inject(FuelService);

  // ---- What the column shows. ----
  protected readonly analysisItems = ANALYSIS_ITEMS;
  protected readonly editing = signal(false);
  private readonly hidden = signal<ReadonlySet<string>>(this.storedHidden());

  /** How many fuel models the domain has, which is what the conditions are worked out for. */
  protected readonly fuelCount = computed(() => this.fuels.grid()?.counts.length ?? 0);

  /** The two curves of the column, sampled every five minutes. */
  protected readonly charts = computed(() => {
    const result = this.result();
    if (!result) return { area: chartPaths([0, 0]), rate: chartPaths([0, 0], 300, 64) };
    const { area, rate } = result.series;
    const areas: number[] = [];
    const rates: number[] = [];
    for (let minute = 0; minute <= this.horizon().minutes; minute += 5) {
      areas.push(area[minute]);
      let fastest = 0;
      for (let m = Math.max(minute - 4, 0); m <= minute; m += 1)
        fastest = Math.max(fastest, rate[m]);
      rates.push(fastest);
    }
    return { area: chartPaths(areas), rate: chartPaths(rates, 300, 64) };
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

  private storedHidden(): ReadonlySet<string> {
    try {
      const stored = localStorage.getItem(ANALYSIS_KEY);
      if (stored !== null) return new Set(JSON.parse(stored) as string[]);
    } catch {
      // No storage, or something else's value under the key: the defaults.
    }
    return new Set(ANALYSIS_ITEMS.filter((item) => !item.on).map((item) => item.id));
  }
}
