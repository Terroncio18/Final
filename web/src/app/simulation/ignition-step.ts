import {
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { MapService } from '../map/map.service';
import { CELL_M, domainAround, domainRing, GRID, SIDE_M } from './domain';
import { LevelsService } from './levels.service';
import { MunicipalitiesService } from './municipalities.service';
import { formatPoint, parsePoint } from './point';
import { ProvincesService } from './provinces.service';
import { TerrainService } from './terrain.service';

/**
 * The end of the hierarchy: the ignition point.
 *
 * The map is already framed on the municipality, so this step only has to turn
 * the canvas into something to click on and put what was clicked into the URL.
 * From there a whole simulation is a link, which is what §2.19 was for.
 *
 * The 3D view and the simulation itself do not exist yet.
 */
@Component({
  selector: 'app-ignition-step',
  imports: [RouterLink],
  templateUrl: './ignition-step.html',
  styleUrl: './step-panel.css',
})
export class IgnitionStep {
  private readonly provinces = inject(ProvincesService);
  private readonly municipalities = inject(MunicipalitiesService);
  private readonly maps = inject(MapService);
  private readonly terrain = inject(TerrainService);
  private readonly levels = inject(LevelsService);
  private readonly router = inject(Router);

  /** Only in the template once there is a point, so it is not required. */
  private readonly relief = viewChild<ElementRef<HTMLCanvasElement>>('relief');

  readonly region = input.required<string>();
  readonly province = input.required<string>();
  readonly municipality = input.required<string>();

  /** The `@lon,lat` segment, absent until something has been clicked. */
  readonly point = input<string>();

  protected readonly chosen = computed(() => this.municipalities.find(this.municipality()));

  /** Nothing when the segment is absent or does not parse. */
  protected readonly ignition = computed(() => parsePoint(this.point()));

  /** Latitude first for reading, longitude first for the URL: see point.ts. */
  protected readonly coordinates = computed(() => {
    const point = this.ignition();
    return point ? point[1].toFixed(5) + ', ' + point[0].toFixed(5) : '';
  });

  protected readonly reading = this.terrain.reading;
  protected readonly failedTerrain = this.terrain.failed;
  protected readonly ground = this.terrain.terrain;

  /** One decimal: the slope of a 30 m cell does not know more than that. */
  protected readonly slopes = computed(() => {
    const ground = this.ground();
    if (!ground) return null;
    const degrees = new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 1 });
    return {
      max: degrees.format(ground.maxSlope),
      mean: degrees.format(ground.meanSlope),
      low: Math.round(ground.minElevation),
      high: Math.round(ground.maxElevation),
      tiles: ground.tiles,
    };
  });

  /** What the square on the map is, in the three numbers that define it. */
  protected readonly domain = {
    km: new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 1 }).format(SIDE_M / 1000),
    grid: GRID,
    cell: CELL_M,
  };

  constructor() {
    this.provinces.load();

    effect(() => {
      // Reached straight from a link, the municipalities of this province may
      // not be in yet; asking again is free once they are.
      const province = this.provinces.find(this.province());
      if (province) {
        this.levels.show('ignition', {
          province: province.id,
          municipality: this.municipality(),
        });
      }

      const chosen = this.chosen();
      if (!chosen) return;

      // Once there is a point the domain is the thing to look at, and it is
      // usually wider than the municipality, so the camera follows it. Every
      // move reframes: the square is what the user is judging, not the town.
      const point = this.ignition();
      if (point) {
        this.maps.setDomain(domainRing(point));
        this.maps.goToBounds(domainAround(point), true);
      } else {
        this.maps.setDomain(null);
        this.maps.goToBounds(chosen.bounds, true);
      }
    });

    // The URL is what the map draws: the point is never held here.
    effect(() => this.maps.setIgnition(this.ignition()));

    effect(() => {
      const point = this.ignition();
      if (point) this.terrain.read(point);
      else this.terrain.clear();
    });

    effect(() => this.drawRelief());

    this.maps.setPicking(true);
    inject(DestroyRef).onDestroy(() => this.maps.setPicking(false));

    effect(() => {
      const picked = this.maps.picked();
      if (!picked) return;
      void this.router.navigate(
        ['/simulacio', this.region(), this.province(), this.municipality(), formatPoint(picked)],
        // Moving a point that is already set replaces the entry instead of
        // stacking one: otherwise the back button would walk a trail of nudges
        // rather than returning to the list.
        { replaceUrl: this.ignition() !== null },
      );
    });

    inject(DestroyRef).onDestroy(() => this.terrain.clear());
  }

  /**
   * A hillshade of what was read, as a check that it is the right ground.
   *
   * Numbers alone would not catch a sampling bug: a grid off by one tile still
   * has a plausible minimum and maximum. A relief does not — it either looks
   * like the valley on the map beside it or it does not.
   */
  private drawRelief(): void {
    const canvas = this.relief()?.nativeElement;
    const ground = this.ground();
    if (!canvas || !ground) return;

    const size = canvas.width;
    const stride = GRID / size;
    const context = canvas.getContext('2d');
    if (!context) return;

    const image = context.createImageData(size, size);
    // Light from the north-west at 45°, which is the convention every relief
    // map uses: lit from elsewhere, hills read as hollows.
    const zenith = Math.PI / 4;
    const azimuth = (315 * Math.PI) / 180;

    for (let row = 0; row < size; row += 1) {
      for (let column = 0; column < size; column += 1) {
        const index = Math.min(row * stride, GRID - 2) * GRID + Math.min(column * stride, GRID - 2);
        const slope = (ground.slope[index] * Math.PI) / 180;
        const east = ground.elevation[index + 1] - ground.elevation[index];
        const south = ground.elevation[index + GRID] - ground.elevation[index];
        const aspect = Math.atan2(south, -east);

        const shade =
          Math.cos(zenith) * Math.cos(slope) +
          Math.sin(zenith) * Math.sin(slope) * Math.cos(azimuth - aspect);
        const value = Math.round(Math.max(0, Math.min(1, shade)) * 255);

        const pixel = (row * size + column) * 4;
        image.data[pixel] = value;
        image.data[pixel + 1] = value;
        image.data[pixel + 2] = value;
        image.data[pixel + 3] = 255;
      }
    }

    context.putImageData(image, 0, 0);
  }
}
