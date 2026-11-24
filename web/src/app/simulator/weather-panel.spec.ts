import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { vi } from 'vitest';
import type { SpreadResult } from '../simulation/fire-spread';
import type { Point } from '../simulation/point';
import { compass, trackFill, WeatherPanel, type WeatherNow, type WindEdit } from './weather-panel';
import { WeatherService, type Observation } from './weather.service';
import type { ComponentInputs } from '../../testing/component-inputs';
import { inputEvent } from '../../testing/events';

const centre: Point = [2.7, 39.7];
const observation: Observation = {
  source: 'AEMET',
  station: { id: 'B013X', name: 'Sóller', lon: 2.7, lat: 39.76 },
  observedAt: '2024-08-01T12:00:00Z',
  windKmh: 18,
  windFromDeg: 90,
  humidity: 40,
  temperature: 29,
  distanceKm: 3.2,
  stale: false,
};
const now: WeatherNow = {
  wind: 20,
  fromDeg: 315,
  towardsDeg: 135,
  humidity: 30,
  temperature: 28,
  temperatureText: '28',
};

describe('WeatherPanel', () => {
  let fixture: ComponentFixture<WeatherPanel>;
  let p: WeatherPanel;
  let edits: WindEdit[];
  // The real service answers only for the domain it was asked about; this double does the same.
  const reading = signal<Observation | null>(null);
  const weather = {
    loading: signal(false),
    failed: signal(false),
    load: vi.fn(),
    observationFor: vi.fn((country: 'ES' | 'PT', point: Point | null) =>
      // Latitude too: the real service compares country, longitude and latitude, and a double that
      // only looked at longitude would keep the station while the centre moved north or south.
      country === 'ES' && point?.[0] === centre[0] && point[1] === centre[1] ? reading() : null,
    ),
  };
  const element = () => fixture.nativeElement as HTMLElement;
  const set = async (inputs: ComponentInputs<WeatherPanel>) => {
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    await fixture.whenStable();
  };

  beforeEach(async () => {
    weather.load.mockClear();
    reading.set(null);
    TestBed.configureTestingModule({ providers: [{ provide: WeatherService, useValue: weather }] });
    fixture = TestBed.createComponent(WeatherPanel);
    p = fixture.componentInstance;
    edits = [];
    p.windEdit.subscribe((edit) => edits.push(edit));
    await set({
      weatherMode: 'manual',
      humidity: 30,
      temperature: 28,
      windDraft: null,
      now,
      windRows: [],
      result: null,
      computing: false,
      canStart: true,
      elapsed: '00:00',
      country: 'ES',
      centre,
    });
  });
  afterEach(() => fixture.destroy());

  it('names the wind both ways and paints the tracks within their ends', () => {
    expect(compass(183).short).toBe('S');
    expect(compass(-10).short).toBe('N');
    expect(p['fromPhrase']()).toBe('del nord-oest');
    expect(p['towards']().short).toBe('SE');
    expect(element().querySelector('.wind-needle')?.getAttribute('style')).toContain('135deg');
    expect(trackFill(-1, 0, 100)).toBe('0%');
    expect(trackFill(150, 0, 100)).toBe('100%');
    expect(trackFill(50, 0, 100)).toBe('50%');
  });

  it('switches the source of the weather and locks the sliders to a station', async () => {
    const [live, manual] = element().querySelectorAll<HTMLButtonElement>('.mode-switch button');
    live.click();
    await fixture.whenStable();
    expect(p.weatherMode()).toBe('live');
    expect(element().querySelector('.source-card strong')?.textContent).toBe('AEMET OpenData');
    expect(element().querySelector('.weather-values.locked')).not.toBeNull();
    expect(element().querySelector<HTMLInputElement>('#humidity')?.disabled).toBe(true);
    expect(element().querySelector<HTMLInputElement>('#wind')?.disabled).toBe(true);
    expect(element().querySelector('.wind-rose')?.getAttribute('tabindex')).toBe('-1');
    element().querySelector<HTMLButtonElement>('.ghost-button')!.click();
    expect(weather.load).toHaveBeenCalledWith('ES', centre);
    await set({ country: 'PT', centre: null });
    expect(p['weatherSource']().short).toBe("l'IPMA");
    p['refreshWeather']();
    expect(weather.load).toHaveBeenCalledTimes(1);
    await set({ result: {} as SpreadResult });
    expect(element().querySelector('.wind-rose')?.getAttribute('tabindex')).toBe('0');
    expect(live.disabled).toBe(true);
    await set({ result: null });
    manual.click();
    await fixture.whenStable();
    expect(p.weatherMode()).toBe('manual');
    expect(element().querySelector('.source-card')).toBeNull();
  });

  it('shows the station only while it belongs to the domain on screen', async () => {
    reading.set(observation);
    await set({ weatherMode: 'live' });
    expect(weather.observationFor).toHaveBeenCalledWith('ES', centre);
    expect(p['station']()).toMatchObject({ name: 'Sóller', distance: '3,2 km' });
    expect(p['liveState']().tag).toBe('EN DIRECTE');
    await set({ country: 'PT' });
    expect(p['station']()).toBeNull();
    expect(p['liveState']().tag).toBe('SENSE CONNEXIÓ');
    expect(p['liveState']().note).toContain("l'IPMA");
    // Only the latitude moves: same country, same longitude. A station of another latitude does
    // not describe this domain, and a double that compared longitude alone would keep it.
    await set({ country: 'ES', centre: [centre[0], centre[1] + 1] as Point });
    expect(p['station']()).toBeNull();
    await set({ country: 'ES', centre: null });
    expect(p['station']()).toBeNull();
    expect(weather.observationFor).toHaveBeenCalledWith('ES', null);
    weather.loading.set(true);
    expect(p['liveState']().tag).toBe('LLEGINT');
    weather.loading.set(false);
    await set({ centre });
    weather.failed.set(true);
    expect(p['liveState']().tag).toBe('DADA ANTIGA');
    weather.failed.set(false);
  });

  it('sends the wind out and keeps the humidity and the temperature', async () => {
    const slide = (id: string, value: string) => {
      const range = element().querySelector<HTMLInputElement>(`#${id}`)!;
      range.value = value;
      range.dispatchEvent(new Event('input'));
    };
    slide('wind', '35');
    slide('humidity', '55');
    slide('temperature', '33');
    expect(edits).toEqual([{ speedKmh: 35 }]);
    expect([p.humidity(), p.temperature()]).toEqual([55, 33]);
    await set({ computing: true });
    p['setNumber']('humidity', inputEvent('70'));
    expect(p.humidity()).toBe(55);
  });

  it('shows a pending change of wind with its two answers, and the changes made', async () => {
    let applied = 0;
    p.applyWind.subscribe(() => (applied += 1));
    await set({
      windDraft: { speedKmh: 30, fromDeg: 0 },
      elapsed: '01:30',
      windRows: [
        { startMin: 0, speedKmh: 10, fromDeg: 0, time: '00:00', origin: 'N', pending: false },
        { startMin: 90, speedKmh: 30, fromDeg: 0, time: '01:30', origin: 'N', pending: true },
      ],
    });
    expect(element().querySelector('[role="status"]')?.textContent).toContain('T + 01:30 h');
    const rows = element().querySelectorAll('.start-list li');
    expect(rows).toHaveLength(2);
    expect(rows[1].textContent).toContain('Programat');
    const [apply, cancel] = element().querySelectorAll<HTMLButtonElement>('.tools-row button');
    apply.click();
    expect(applied).toBe(1);
    cancel.click();
    expect(p.windDraft()).toBeNull();
  });
});
