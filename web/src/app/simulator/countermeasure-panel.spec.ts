import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { vi } from 'vitest';
import { MapService } from '../map/map.service';
import { COUNTERMEASURE_CATALOG, type Countermeasure } from '../simulation/countermeasures';
import type { SpreadResult } from '../simulation/fire-spread';
import type { FuelTreatments } from '../simulation/fuel-treatments';
import type { Point } from '../simulation/point';
import { CountermeasurePanel } from './countermeasure-panel';
import { CountermeasurePlan } from './countermeasure-plan';

const centre: Point = [2.7, 39.7];
const line = (patch: Partial<Countermeasure> = {}): Countermeasure => ({
  id: 'm1',
  kind: 'defense-line',
  points: [
    [2.7, 39.7],
    [2.71, 39.7],
  ],
  widthM: 30,
  strength: 0,
  durationMin: 0,
  ...patch,
});

describe('CountermeasurePanel', () => {
  let fixture: ComponentFixture<CountermeasurePanel>;
  let p: CountermeasurePanel;
  let plan: CountermeasurePlan;
  const pointer = signal<Point | null>(null);
  const element = () => fixture.nativeElement as HTMLElement;
  const set = async (inputs: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    await fixture.whenStable();
  };

  beforeEach(async () => {
    pointer.set(null);
    plan = new CountermeasurePlan();
    TestBed.configureTestingModule({ providers: [{ provide: MapService, useValue: { pointer } }] });
    fixture = TestBed.createComponent(CountermeasurePanel);
    p = fixture.componentInstance;
    await set({
      plan,
      computing: false,
      pastWarning: null,
      planStale: false,
      result: null,
      minutes: 0,
      centre,
    });
  });
  afterEach(() => fixture.destroy());

  it('offers every tool in its group and hands the choice over', async () => {
    const picked: string[] = [];
    p.pickMeasure.subscribe((kind) => picked.push(kind));
    const tools = element().querySelectorAll<HTMLButtonElement>('.measure-grid button');
    expect(tools).toHaveLength(COUNTERMEASURE_CATALOG.length);
    expect([...element().querySelectorAll('h4')].map((h) => h.textContent)).toEqual([
      'Mitjans terrestres',
      'Mitjans aeris',
    ]);
    tools[0].click();
    expect(picked).toEqual([COUNTERMEASURE_CATALOG.find((e) => e.group === 'ground')!.kind]);
    await set({ computing: true });
    expect(tools[0].disabled).toBe(true);
    expect(element().querySelector('.empty-list')).not.toBeNull();
  });

  it('asks before rewriting the past and says how to draw the tool in the hand', async () => {
    let confirmed = 0,
      cancelled = 0,
      put = 0;
    p.confirmPast.subscribe(() => (confirmed += 1));
    p.cancelPast.subscribe(() => (cancelled += 1));
    p.cancelTool.subscribe(() => (put += 1));
    await set({ pastWarning: { kind: 'backfire', count: 1 } });
    expect(element().querySelector('.past-warning')?.textContent).toContain('la mesura posterior');
    await set({ pastWarning: { kind: 'backfire', count: 3 } });
    expect(element().querySelector('.past-warning')?.textContent).toContain('les 3 mesures');
    const [yes, no] = element().querySelectorAll<HTMLButtonElement>('.past-warning button');
    yes.click();
    no.click();
    expect([confirmed, cancelled]).toEqual([1, 1]);
    plan.begin('helicopter');
    await set({ planStale: true });
    expect(element().querySelector('.measure-drawing .tool-hint')?.textContent).toContain(
      'aplicar',
    );
    element().querySelector<HTMLButtonElement>('.measure-drawing button')!.click();
    expect(put).toBe(1);
    expect(element().textContent).toContain('Previsió actualitzada');
    plan.begin('firebreak');
    await fixture.whenStable();
    expect(element().querySelector('.measure-drawing .tool-hint')?.textContent).toContain('vèrtex');
  });

  it('lists the plan, selects from it and hands over what is taken off', async () => {
    const removed: string[] = [];
    let cleared = 0;
    p.removeMeasure.subscribe((id) => removed.push(id));
    p.clearMeasures.subscribe(() => (cleared += 1));
    plan.measures.set([line()]);
    await fixture.whenStable();
    expect(element().querySelector('.tiny-tag')?.textContent).toBe('1 AL PLA');
    const name = element().querySelector<HTMLButtonElement>('.measure-name')!;
    name.click();
    expect(plan.selected()).toBe('m1');
    name.click();
    expect(plan.selected()).toBeNull();
    element().querySelector<HTMLButtonElement>('.measure-remove')!.click();
    element().querySelector<HTMLButtonElement>('.measure-clear button')!.click();
    expect(removed).toEqual(['m1']);
    expect(cleared).toBe(1);
  });

  it('reads the treated fuel of the cell under the pointer or of the measure selected', async () => {
    const treated = () => p['treatedCell']();
    const at = vi.fn(() => ({ moisture1h: 0.15, bed: { loadTonHa: 8 }, remaining: 0.5 }));
    const result = { fuelTreatments: { at } as unknown as FuelTreatments } as SpreadResult;
    expect(treated()).toBeNull();
    pointer.set(centre);
    await set({ result, minutes: 30 });
    expect(treated()).toEqual({
      where: 'Cel·la sota el cursor',
      moisture: '15',
      load: '8',
      remaining: 50,
    });
    expect(at).toHaveBeenLastCalledWith(expect.any(Number), 30);
    expect(element().querySelector('[aria-label="Combustible tractat"]')?.textContent).toContain(
      '8 t/ha',
    );
    pointer.set(null);
    expect(treated()).toBeNull();
    plan.measures.set([line()]);
    plan.selected.set('m1');
    expect(treated()?.where).toBe('Cel·la de la mesura seleccionada');
    pointer.set([0, 0]);
    expect(treated()).toBeNull();
    await set({ centre: null });
    expect(treated()).toBeNull();
  });
});
