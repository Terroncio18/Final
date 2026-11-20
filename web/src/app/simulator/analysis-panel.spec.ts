import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { vi } from 'vitest';
import { GRID } from '../simulation/domain';
import type { SpreadResult } from '../simulation/fire-spread';
import type { FuelGrid } from '../simulation/fuel-data';
import { FuelService } from '../simulation/fuel.service';
import { AnalysisPanel, type AnalysisFigures } from './analysis-panel';
import { fuelGrid } from '../../testing/fuel-grid';

const centreCell = (GRID / 2) * GRID + GRID / 2;

function resultFor(): SpreadResult {
  const arrival = new Float32Array(GRID * GRID).fill(Infinity);
  arrival[centreCell] = 0;
  arrival[centreCell + 1] = 2;
  arrival[centreCell + GRID] = 4;
  arrival[centreCell + GRID + 1] = 6;
  const values = (scale: number) => Float32Array.from({ length: 1111 }, (_, i) => i * scale);
  return {
    arrival,
    horizon: 1110,
    burnable: GRID * GRID,
    heat: new Float32Array(GRID * GRID).fill(1000),
    reachedEdge: Infinity,
    baseRate: 1,
    series: {
      area: values(1),
      perimeter: values(0.1),
      rate: values(0.5),
      heading: new Float32Array(1111).fill(90),
      intensity: values(100),
      run: values(0.01),
    },
  };
}

function gridOf(models: Uint8Array): FuelGrid {
  return fuelGrid({ models, counts: [{ id: 1, cells: GRID * GRID }] });
}

const figures: AnalysisFigures = {
  area: '120',
  growth: '+60 ha/h ara',
  share: '0,1',
  perimeter: '12',
  rate: '60',
  rateNote: '3,6 km/h · darrers 10 min',
  intensity: '12.000',
  flame: '5,8',
  control: 'Molt difícil',
  controlNote: 'Mitjans aeris',
  controlHard: true,
  run: '1,2',
  heading: 'E',
  headingNote: '90° · cap al est',
  edge: 'No hi arriba',
  edgeNote: 'En 12 h el foc no surt del domini',
  edgeReached: false,
  cursor: 50,
};

describe('AnalysisPanel', () => {
  let fixture: ComponentFixture<AnalysisPanel>;
  let p: AnalysisPanel;
  let grid: ReturnType<typeof signal<FuelGrid | null>>;
  const element = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    localStorage.clear();
    grid = signal<FuelGrid | null>(null);
    TestBed.configureTestingModule({
      providers: [{ provide: FuelService, useValue: { grid } }],
    });
  });
  afterEach(() => {
    fixture?.destroy();
    vi.restoreAllMocks();
  });

  async function open(result: SpreadResult | null, minutes = 0) {
    fixture = TestBed.createComponent(AnalysisPanel);
    p = fixture.componentInstance;
    for (const [key, value] of Object.entries({
      result,
      minutes,
      computing: false,
      horizon: { hours: 12, minutes: 720 },
      state: result
        ? { tag: 'SIMULACRE', title: '', detail: '' }
        : { tag: 'SENSE CÀLCUL', title: 'Posa una ignició', detail: 'Fes clic al terreny.' },
      elapsed: '02:00',
      figures: result ? figures : null,
      conditions: { dead: '5', live: 100, midflame: '12', base: '0,5', head: '8' },
      forecastRows: [],
    }))
      fixture.componentRef.setInput(key, value);
    await fixture.whenStable();
  }

  it('is a landmark of its own and says why there is nothing to show yet', async () => {
    await open(null);
    expect(element().getAttribute('role')).toBe('complementary');
    expect(element().getAttribute('aria-label')).toBe('Anàlisi');
    expect(element().querySelector('.tiny-tag.warn')?.textContent).toContain('SENSE CÀLCUL');
    expect(element().querySelector('.no-run strong')?.textContent).toBe('Posa una ignició');
    expect(p['charts']().area.line).toBe('M0.0 100.0 L300.0 100.0');
    expect(p['burnedFuels']()).toEqual([]);
    expect(p['fuelCount']()).toBe(0);
    expect(element().querySelector<HTMLDetailsElement>('details.chart-section')?.open).toBe(true);
  });

  it('draws the run, lists the fuels burned and skips them while hidden', async () => {
    const models = new Uint8Array(GRID * GRID).fill(1);
    models[centreCell] = 255;
    models[centreCell + 1] = 2;
    grid.set(gridOf(models));
    await open(resultFor(), 10);
    expect(element().querySelector('.no-run')).toBeNull();
    expect(element().querySelectorAll('.metric')).toHaveLength(9);
    expect(element().querySelector('.warning-metric strong')?.textContent).toBe('Molt difícil');
    expect(p['charts']().area.line).toContain('L');
    expect(p['fuelCount']()).toBe(1);
    expect(p['burnedFuels']().find((f) => f.id === 255)?.name).toBe('Sense model');
    expect(p['burnedFuels']()[0]).toMatchObject({ id: 1, share: 50 });
    p['toggleItem']('burnedFuels');
    expect(p['burnedFuels']()).toEqual([]);
  });

  it('lets the reader choose what it shows', async () => {
    await open(resultFor());
    const edit = element().querySelector<HTMLButtonElement>('.panel-heading button')!;
    expect(edit.getAttribute('aria-pressed')).toBe('false');
    expect(element().querySelector('.analysis-options')).toBeNull();
    edit.click();
    await fixture.whenStable();
    expect(edit.getAttribute('aria-pressed')).toBe('true');
    expect(edit.textContent?.trim()).toBe('Fet');
    const boxes = element().querySelectorAll<HTMLInputElement>('.analysis-options input');
    expect(boxes).toHaveLength(15);
    boxes[0].click();
    await fixture.whenStable();
    expect(p['shows']('area')).toBe(false);
    expect(element().querySelectorAll('.metric')).toHaveLength(8);
  });

  it('keeps analysis preferences when storage works and falls back when it does not', async () => {
    localStorage.setItem('ignislab.analysis.hidden', '["area"]');
    await open(null);
    expect(p['shows']('area')).toBe(false);
    p['toggleItem']('area');
    expect(p['shows']('area')).toBe(true);
    expect(localStorage.getItem('ignislab.analysis.hidden')).toBe('[]');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(p['storedHidden']().has('base')).toBe(true);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    p['toggleItem']('area');
    expect(p['shows']('area')).toBe(false);
  });
});
