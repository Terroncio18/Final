import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { SpreadResult } from '../simulation/fire-spread';
import { CountermeasurePlan } from './countermeasure-plan';
import { IgnitionPanel } from './ignition-panel';
import type { ComponentInputs } from '../../testing/component-inputs';
import { inputEvent } from '../../testing/events';

describe('IgnitionPanel', () => {
  let fixture: ComponentFixture<IgnitionPanel>;
  let p: IgnitionPanel;
  let plan: CountermeasurePlan;
  const element = () => fixture.nativeElement as HTMLElement;
  const set = async (inputs: ComponentInputs<IgnitionPanel>) => {
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    await fixture.whenStable();
  };

  beforeEach(async () => {
    plan = new CountermeasurePlan();
    fixture = TestBed.createComponent(IgnitionPanel);
    p = fixture.componentInstance;
    await set({
      tool: null,
      spottingEnabled: false,
      spottingSeed: 1,
      plan,
      startRows: [],
      result: null,
      computing: false,
      spotCount: 0,
      spotRows: [],
      elapsed: '00:00',
    });
  });
  afterEach(() => fixture.destroy());

  it('takes the ignition tool, putting a countermeasure down, and lists the ignitions', async () => {
    const [tool, clear] = element().querySelectorAll<HTMLButtonElement>('.tools-row button');
    expect(clear.disabled).toBe(true);
    expect(element().querySelector('.empty-list')).not.toBeNull();
    plan.begin('firebreak');
    tool.click();
    await fixture.whenStable();
    expect(plan.kind()).toBeNull();
    expect(p.tool()).toBe('ignition');
    expect(tool.getAttribute('aria-pressed')).toBe('true');
    expect(element().querySelector('.tool-hint')).not.toBeNull();
    tool.click();
    expect(p.tool()).toBeNull();

    const removed: number[] = [];
    let cleared = 0;
    p.removeStart.subscribe((index) => removed.push(index));
    p.clearStarts.subscribe(() => (cleared += 1));
    await set({
      startRows: [
        { index: 0, label: 'Ignició 1', coordinates: '39.7000° N, 2.7000° E', ground: '100 m' },
        { index: 1, label: 'Ignició 2', coordinates: '39.7100° N, 2.7000° E', ground: null },
      ],
    });
    const rows = element().querySelectorAll('.start-list li');
    expect(rows[0].textContent).toContain('· 100 m');
    expect(rows[1].textContent).not.toContain('·');
    rows[1].querySelector('button')!.click();
    clear.click();
    expect(removed).toEqual([1]);
    expect(cleared).toBe(1);
  });

  it('keeps the spotting settings and lists the spot fires of a run', async () => {
    const box = element().querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    box.click();
    expect(p.spottingEnabled()).toBe(true);
    const seed = (value: string) => {
      const event = inputEvent(value);
      p['setSpottingSeed'](event);
      return (event.target as HTMLInputElement).value;
    };
    expect(seed('9')).toBe('9');
    for (const bad of ['-1', '1.5', '4294967296', 'bad']) expect(seed(bad)).toBe('9');
    expect(p.spottingSeed()).toBe(9);
    await set({ computing: true });
    expect(seed('5')).toBe('9');
    expect(box.disabled).toBe(true);

    const focused: number[] = [];
    p.focusSpot.subscribe((cell) => focused.push(cell));
    await set({
      computing: false,
      result: {} as SpreadResult,
      spotCount: 3,
      elapsed: '02:00',
      spotRows: [{ cell: 42, label: 'Focus per brasa 3', time: '01:10', distance: 240 }],
    });
    expect(seed('5')).toBe('9');
    expect(element().querySelector('[role="status"]')?.textContent).toContain(
      '3 focus per brases fins a T + 02:00 h',
    );
    const spot = [...element().querySelectorAll<HTMLButtonElement>('.tools-row button')].at(-1)!;
    expect(spot.querySelector('strong')?.textContent).toBe('Focus per brasa 3');
    expect(spot.querySelector('span')?.textContent).toContain('01:10 h · 240 m');
    spot.click();
    expect(focused).toEqual([42]);
  });
});
