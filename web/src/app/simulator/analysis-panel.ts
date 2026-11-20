import { Component, computed, inject, input, signal } from '@angular/core';
import { CELL_M } from '../simulation/domain';
import type { SpreadResult } from '../simulation/fire-spread';
import { FuelService } from '../simulation/fuel.service';
import { FUEL_MODELS } from '../simulation/rothermel';
import { Icon } from './icon';

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

export interface AnalysisState {
  tag: string;
  title: string;
  detail: string;
}

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
  // Chart cursor position uses the 300-unit SVG viewBox.
  cursor: number;
}

export interface AnalysisConditions {
  dead: string;
  live: number;
  midflame: string;
  base: string;
  head: string;
}

export interface ForecastRow {
  offset: number;
  label: string;
  colour: string;
  available: boolean;
  area: string;
  growth: string;
}

function chartPaths(values: readonly number[], width = 300, height = 100) {
  // A stationary fire needs a zero-height curve, avoiding division by zero.
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

  protected readonly analysisItems = ANALYSIS_ITEMS;
  protected readonly editing = signal(false);
  private readonly hidden = signal<ReadonlySet<string>>(this.storedHidden());

  protected readonly fuelCount = computed(() => this.fuels.grid()?.counts.length ?? 0);

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

  // Scan burned fuel only while visible and once per simulation minute, rather than once per
  // animation frame.
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
      // Storage may be unavailable; keep the choice for this visit.
    }
  }

  private storedHidden(): ReadonlySet<string> {
    try {
      const stored = localStorage.getItem(ANALYSIS_KEY);
      if (stored !== null) return new Set(JSON.parse(stored) as string[]);
    } catch {
      // Use defaults when storage is unavailable or contains an incompatible value.
    }
    return new Set(ANALYSIS_ITEMS.filter((item) => !item.on).map((item) => item.id));
  }
}
