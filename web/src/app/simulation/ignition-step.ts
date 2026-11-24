import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  viewChild,
  type OnDestroy,
  type OnInit,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MapService } from '../map/map.service';
import { CELL_M, domainAround, domainRing, GRID, SIDE_M } from './domain';
import { LevelsService } from './levels.service';
import { MunicipalitiesService } from './municipalities.service';
import { formatPoint, parsePoint, type Point } from './point';
import { PointLocator } from './point-locator';
import { ProvincesService } from './provinces.service';
import { TerrainService } from './terrain.service';

// Despite legacy ignition names, this step chooses the domain centre. Fire-start points are added
// inside the simulator.
@Component({
  selector: 'app-ignition-step',
  imports: [RouterLink],
  templateUrl: './ignition-step.html',
  styleUrl: './step-panel.css',
})
export class IgnitionStep implements OnInit, OnDestroy {
  public readonly region = input.required<string>();
  public readonly province = input.required<string>();
  public readonly municipality = input.required<string>();

  public readonly point = input<string>();

  private readonly provinces = inject(ProvincesService);
  private readonly municipalities = inject(MunicipalitiesService);
  private readonly locator = inject(PointLocator);
  private readonly maps = inject(MapService);
  private readonly terrain = inject(TerrainService);
  private readonly levels = inject(LevelsService);
  private readonly router = inject(Router);

  // Identify the point being located so a newer click can supersede it.
  private resolving: Point | null = null;

  private readonly relief = viewChild<ElementRef<HTMLCanvasElement>>('relief');

  protected readonly reading = this.terrain.reading;
  protected readonly failedTerrain = this.terrain.failed;
  protected readonly ground = this.terrain.terrain;

  protected readonly chosen = computed(() => this.municipalities.find(this.municipality()));

  // An unlocated point keeps the URL municipality but is flagged outside it; this can mean sea or
  // a neighbouring province.
  protected readonly outside = computed(() => {
    const point = this.ignition();
    if (!point || !this.municipalities.municipalities().length) return false;
    return this.municipalities.at(point) === null;
  });

  protected readonly ignition = computed(() => parsePoint(this.point()));

  // Display latitude first; URL coordinates are longitude first.
  protected readonly coordinates = computed(() => {
    const point = this.ignition();
    return point ? point[1].toFixed(5) + ', ' + point[0].toFixed(5) : '';
  });

  protected readonly slopes = computed(() => {
    const ground = this.ground();
    if (!ground) return null;
    const degrees = new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 1 });
    return {
      tiles: ground.tiles,
      facts:
        ground.landCells === 0
          ? null
          : {
              max: degrees.format(ground.maxSlope),
              mean: degrees.format(ground.meanSlope),
              low: Math.round(ground.minElevation),
              high: Math.round(ground.maxElevation),
            },
    };
  });

  protected readonly simulation = computed(() => {
    const point = this.ignition();
    if (!point) return null;
    return ['/simulador', this.region(), this.province(), this.municipality(), formatPoint(point)];
  });

  protected readonly domain = {
    km: new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 1 }).format(SIDE_M / 1000),
    grid: GRID,
    cell: CELL_M,
  };

  public constructor() {
    effect(() => {
      // Direct links may arrive before municipality data; the service reuses an existing load.
      const province = this.provinces.find(this.province());
      if (province) {
        this.levels.show('ignition', {
          province: province.id,
          municipality: this.municipality(),
        });
      }

      const chosen = this.chosen();
      if (!chosen) return;

      const point = this.ignition();
      if (point) {
        this.maps.setDomain(domainRing(point));
        this.maps.goToBounds(domainAround(point), true);
      } else {
        this.maps.setDomain(null);
        this.maps.goToBounds(chosen.bounds, true);
      }
    });

    effect(() => this.maps.setIgnition(this.ignition()));

    effect(() => {
      const point = this.ignition();
      if (point) this.terrain.read(point);
      else this.terrain.clear();
    });

    effect(() => this.drawRelief());

    effect(() => {
      const picked = this.maps.picked();
      if (!picked) return;
      // The clicked point determines its municipality, even across the previous selection’s
      // border.
      const local = this.municipalities.at(picked);
      if (local) {
        this.goTo(this.region(), this.province(), local.id, picked);
        return;
      }

      // The local province cannot distinguish sea from another country; PointLocator searches the
      // whole study area.
      this.resolving = picked;
      this.locator
        .locate(picked)
        .then((place) => {
          if (this.resolving !== picked) return;
          if (place) this.goTo(place.region, place.province, place.municipality, picked);
          else this.goTo(this.region(), this.province(), this.municipality(), picked);
        })
        .catch((error: Error) => {
          console.error('[ignition]', error);
          if (this.resolving !== picked) return;
          this.goTo(this.region(), this.province(), this.municipality(), picked);
        });
    });
  }

  public ngOnInit(): void {
    this.provinces.load();
    this.maps.setPicking(true);
  }

  public ngOnDestroy(): void {
    this.maps.setPicking(false);
    this.terrain.clear();
  }

  // Replace an existing coordinate entry so Back returns to the list instead of replaying nudges.
  protected retryTerrain(): void {
    const point = this.ignition();
    if (point) this.terrain.read(point);
  }

  private goTo(region: string, province: string, municipality: string, point: Point): void {
    void this.router.navigate(['/simulacio', region, province, municipality, formatPoint(point)], {
      replaceUrl: this.ignition() !== null,
    });
  }

  // The sampled hillshade helps spot a misaligned grid whose numeric min/max still look plausible.
  private drawRelief(): void {
    const canvas = this.relief()?.nativeElement;
    const ground = this.ground();
    if (!canvas || !ground) return;

    const size = canvas.width;
    const stride = GRID / size;
    const context = canvas.getContext('2d');
    if (!context) return;

    const image = context.createImageData(size, size);
    // North-west illumination at 45° prevents familiar hills from appearing as hollows.
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
