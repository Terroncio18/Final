import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { vi } from 'vitest';
import { GRID } from '../simulation/domain';
import type { FuelGrid } from '../simulation/fuel-data';
import { FuelService } from '../simulation/fuel.service';
import type { Point } from '../simulation/point';
import type { Terrain } from '../simulation/terrain';
import { TerrainService } from '../simulation/terrain.service';
import { FuelPanel } from './fuel-panel';
import { fuelGrid } from '../../testing/fuel-grid';

const centre: Point = [2.7, 39.7];

function gridWith(patch: Partial<FuelGrid>): FuelGrid {
  const models = new Uint8Array(GRID * GRID).fill(1);
  models[0] = 0;
  return fuelGrid({
    models,
    officialCells: GRID * GRID,
    estimatedCells: 0,
    unknownCells: 0,
    nonBurnableCells: 1,
    counts: [{ id: 1, cells: GRID * GRID - 1 }],
    sources: [
      { label: 'Mapa', sourceUrl: 'https://example.org', sourceDate: '2024', attribution: 'X' },
    ],
    warnings: ['Avís'],
    ...patch,
  });
}

describe('FuelPanel', () => {
  let fixture: ComponentFixture<FuelPanel>;
  let p: FuelPanel;
  const fuels = {
    grid: signal<FuelGrid | null>(null),
    reading: signal(false),
    error: signal<string | null>(null),
    read: vi.fn().mockResolvedValue(undefined),
  };
  const terrain = signal<Terrain | null>(null);
  const element = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    fuels.grid.set(null);
    fuels.reading.set(false);
    fuels.error.set(null);
    fuels.read.mockClear();
    terrain.set(null);
    TestBed.configureTestingModule({
      providers: [
        { provide: FuelService, useValue: fuels },
        { provide: TerrainService, useValue: { terrain } },
      ],
    });
    fixture = TestBed.createComponent(FuelPanel);
    p = fixture.componentInstance;
    fixture.componentRef.setInput('centre', centre);
    await fixture.whenStable();
  });
  afterEach(() => fixture.destroy());

  it('says what is being read, and offers to read it again when it failed', async () => {
    expect(p['burnableShare']()).toBe('—');
    expect(element().querySelector('button')).toBeNull();
    fuels.reading.set(true);
    fuels.error.set('Sense connexió');
    await fixture.whenStable();
    expect(element().querySelector('[role="status"]')?.textContent).toContain('Llegint');
    expect(element().querySelector('[role="alert"]')?.textContent).toBe('Sense connexió');
    expect(element().querySelector('button')?.disabled).toBe(true);
    fuels.reading.set(false);
    await fixture.whenStable();
    element().querySelector('button')!.click();
    expect(fuels.read).toHaveBeenCalledWith(centre, true);
    fixture.componentRef.setInput('centre', null);
    await fixture.whenStable();
    element().querySelector('button')!.click();
    expect(fuels.read).toHaveBeenCalledTimes(1);
  });

  it('describes the fuel map: its tag, its shares, its models and its sources', async () => {
    const tag = () => element().querySelector('.tiny-tag');
    fuels.grid.set(gridWith({}));
    await fixture.whenStable();
    expect(tag()?.textContent?.trim()).toBe('CARTOGRAFIAT');
    expect(tag()?.classList.contains('warn')).toBe(false);
    expect(p['fuelModels']()).toEqual([{ id: 1, name: expect.any(String), share: '100 %' }]);
    expect(p['fuelPercent'](GRID * GRID)).toBe('100 %');
    expect(element().querySelector('a')?.getAttribute('href')).toBe('https://example.org');
    expect(element().textContent).toContain('Avís');
    const elevation = new Float32Array(GRID * GRID).fill(10);
    elevation.fill(0, 0, (GRID * GRID) / 2);
    terrain.set({ elevation } as Terrain);
    expect(p['burnableShare']()).toBe('50 %');
    for (const [patch, label] of [
      [{ estimatedCells: 5 }, 'MIXT'],
      [{ officialCells: 0, estimatedCells: 5 }, 'ESTIMAT'],
      [{ unknownCells: 5 }, 'INCOMPLET'],
    ] as const) {
      fuels.grid.set(gridWith(patch));
      await fixture.whenStable();
      expect(tag()?.textContent?.trim()).toBe(label);
      expect(tag()?.classList.contains('warn')).toBe(true);
    }
    // Unknown cells alone are not worth a retry: open sea or a raster that stops short stays so.
    expect(element().querySelector('button')).toBeNull();
    fuels.grid.set(gridWith({ unknownCells: 5, retry: true }));
    await fixture.whenStable();
    expect(element().querySelector('button')?.textContent).toContain('Torna a carregar');
  });
});
