import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { Terrain } from '../simulation/terrain';
import { TerrainService } from '../simulation/terrain.service';
import { DomainPanel } from './domain-panel';

describe('DomainPanel', () => {
  let fixture: ComponentFixture<DomainPanel>;
  let terrain: ReturnType<typeof signal<Terrain | null>>;
  let failed: ReturnType<typeof signal<boolean>>;
  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  beforeEach(async () => {
    terrain = signal<Terrain | null>(null);
    failed = signal(false);
    TestBed.configureTestingModule({
      providers: [{ provide: TerrainService, useValue: { terrain, failed } }],
    });
    fixture = TestBed.createComponent(DomainPanel);
    fixture.componentRef.setInput('place', null);
    fixture.componentRef.setInput('province', 'Mallorca');
    await fixture.whenStable();
  });
  afterEach(() => fixture.destroy());

  it('names the square and says how its elevation is going', async () => {
    expect(text()).toContain('Municipi desconegut');
    expect(text()).toContain('Mallorca · 30,7 × 30,7 km');
    expect(text()).toContain("Llegint l'elevació");
    failed.set(true);
    await fixture.whenStable();
    expect(text()).toContain("No s'ha pogut llegir");
    fixture.componentRef.setInput('place', 'Sóller');
    terrain.set({
      landCells: 1024 * 1024,
      minElevation: 12.4,
      maxElevation: 1044.6,
      meanSlope: 18.26,
      maxSlope: 61,
    } as Terrain);
    await fixture.whenStable();
    expect(text()).toContain('Sóller');
    expect(fixture.componentInstance['ground']()).toEqual({
      facts: { low: 12, high: 1045, mean: '18,3', max: '61' },
    });
    expect(text()).toContain('12–1045 m');

    // A domain with no land says so instead of printing figures that describe the sea floor.
    terrain.set({
      landCells: 0,
      minElevation: 0,
      maxElevation: 0,
      meanSlope: 0,
      maxSlope: 0,
    } as Terrain);
    await fixture.whenStable();
    expect(text()).toContain('tot mar');
    expect(text()).not.toContain('Altitud');
  });
});
