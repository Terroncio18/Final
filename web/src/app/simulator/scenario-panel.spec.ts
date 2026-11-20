import { vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ScenarioPanel } from './scenario-panel';

describe('ScenarioPanel', () => {
  let fixture: ComponentFixture<ScenarioPanel>;
  let p: ScenarioPanel;
  const element = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    fixture = TestBed.createComponent(ScenarioPanel);
    p = fixture.componentInstance;
    fixture.componentRef.setInput('name', '');
    fixture.componentRef.setInput('summary', '1 ignició · vent 20 km/h NO');
    fixture.componentRef.setInput('note', null);
    await fixture.whenStable();
  });
  afterEach(() => fixture.destroy());

  it('shows what would be kept, takes the name and hands over the buttons and the file', async () => {
    expect(element().querySelector('.scenario-now strong')?.textContent).toBe(
      '1 ignició · vent 20 km/h NO',
    );
    const name = element().querySelector<HTMLInputElement>('.scenario-name input')!;
    name.value = 'Tramuntana';
    name.dispatchEvent(new Event('input'));
    expect(p.name()).toBe('Tramuntana');

    let saved = 0;
    const loaded: Event[] = [];
    p.saveScenario.subscribe(() => (saved += 1));
    p.loadScenario.subscribe((event) => loaded.push(event));
    const [save, load] = element().querySelectorAll<HTMLButtonElement>('.tools-row button');
    save.click();
    const file = element().querySelector<HTMLInputElement>('#scenarioFile')!;
    const pick = vi.spyOn(file, 'click').mockImplementation(() => {});
    load.click();
    expect(pick).toHaveBeenCalled();
    file.dispatchEvent(new Event('change'));
    expect(loaded[0].target).toBe(file);

    fixture.componentRef.setInput('note', { text: 'Fitxer malmès', failed: true });
    await fixture.whenStable();
    expect(element().querySelector('.terrain-note')?.getAttribute('role')).toBe('alert');
    fixture.componentRef.setInput('note', { text: 'Carregat', failed: false, outdated: true });
    await fixture.whenStable();
    expect(element().querySelector('.terrain-note')?.getAttribute('role')).toBe('status');
    const buttons = element().querySelectorAll<HTMLButtonElement>('.tools-row button');
    expect(buttons).toHaveLength(3);
    buttons[2].click();
    expect(saved).toBe(2);
  });
});
