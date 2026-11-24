import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { vi } from 'vitest';
import { COUNTERMEASURE_CATALOG, type CountermeasureKind } from '../simulation/countermeasures';
import { defaultSettings } from './countermeasure-plan';
import { ToolSettingsModal, type ToolConfig } from './tool-settings';
import { inputEvent as input } from '../../testing/events';

const configFor = (kind: CountermeasureKind, patch: Partial<ToolConfig> = {}): ToolConfig => ({
  kind,
  discard: false,
  settings: defaultSettings(kind),
  error: null,
  ...patch,
});

describe('ToolSettingsModal', () => {
  let fixture: ComponentFixture<ToolSettingsModal>;
  let m: ToolSettingsModal;
  const element = () => fixture.nativeElement as HTMLElement;
  const button = (selector: string) => element().querySelector<HTMLButtonElement>(selector)!;

  async function open(config: ToolConfig | null) {
    fixture = TestBed.createComponent(ToolSettingsModal);
    m = fixture.componentInstance;
    fixture.componentRef.setInput('config', config);
    await fixture.whenStable();
  }
  afterEach(() => fixture?.destroy());

  it('shows nothing and edits nothing while closed', async () => {
    await open(null);
    expect(m['configView']()).toBeNull();
    expect(element().querySelector('.tool-modal')).toBeNull();
    m['setSetting']('widthM', input('50'));
    m['resetSettings']();
    expect(m.config()).toBeNull();
  });

  it('shows each tool with its own fields, sources and limits', async () => {
    for (const entry of COUNTERMEASURE_CATALOG) {
      await open(configFor(entry.kind));
      const view = m['configView']()!;
      expect(view.label).toBe(entry.label);
      expect(element().querySelector('.tool-modal h3')?.textContent).toBe(entry.label);
      expect(view.widthLabel).toBe(entry.geometry === 'point' ? 'Diàmetre' : 'Amplada');
      expect(element().querySelectorAll('.measure-fields input')).toHaveLength(
        1 + (view.liquid ? 3 : 0) + (view.removal ? 1 : 0) + (view.crew ? 3 : 0),
      );
      fixture.destroy();
    }
    await open(configFor('helicopter'));
    expect(m['configView']()!.aircraft?.capacityL).toBe(1350);
    expect(element().querySelector('.tool-modal a')?.textContent).toContain('capacitat 1350 L');
    fixture.destroy();
    await open(configFor('defense-line'));
    // The hand line cites the NWCG sustained tables since the 12.25 (b) decision, not Ortega.
    expect(element().querySelector('.tool-modal > a')?.textContent).toContain('NWCG 2021');
    expect(element().querySelector('.tool-modal > a')?.getAttribute('href')).toBe(
      'https://www.frames.gov/documents/behaveplus/publications/NWCG_2021_FireLineProductionRates.pdf',
    );
    fixture.destroy();
    await open(configFor('firebreak'));
    expect(m['configView']()!.crew?.url).toBe('');
    expect(element().querySelector('.crew-source')).not.toBeNull();
  });

  it('reads what is typed, shows what is kept and resets to the defaults', async () => {
    await open(configFor('clearing', { error: 'refused' }));
    expect(element().querySelector('[role="alert"]')?.textContent).toBe('refused');
    m['setSetting']('fuelRemaining', input('25,5'));
    expect(m.config()!.settings.fuelRemaining).toBe(0.255);
    expect(m.config()!.error).toBeNull();
    m['setSetting']('widthM', input(' '));
    expect(m.config()!.settings.widthM).toBeNaN();
    await fixture.whenStable();
    expect(element().querySelector<HTMLInputElement>('.measure-fields input')!.value).toBe('');
    m['setSetting']('widthM', input('40'));
    expect(m.config()!.settings.widthM).toBe(40);
    m.config.update((config) => config && { ...config, error: 'refused' });
    button('.tool-modal-actions button:first-child').click();
    expect(m.config()).toEqual(configFor('clearing'));
    expect(m['shown'](undefined)).toBe('');
    expect(m['shown'](NaN)).toBe('');
    expect(m['shown'](0.25, true)).toBe(25);
    expect(m['shown'](30)).toBe(30);
  });

  it('closes on the backdrop and on cancel, and leaves applying to its parent', async () => {
    await open(configFor('helicopter'));
    const applied = vi.fn();
    m.apply.subscribe(applied);
    button('.tool-modal .primary').click();
    expect(applied).toHaveBeenCalledOnce();
    expect(m.config()).toEqual(configFor('helicopter'));
    element().querySelector<HTMLElement>('.modal-backdrop')!.click();
    expect(m.config()).toBeNull();
    m.config.set(configFor('helicopter'));
    await fixture.whenStable();
    button('.tool-modal-actions button:nth-child(2)').click();
    expect(m.config()).toBeNull();
  });
});
