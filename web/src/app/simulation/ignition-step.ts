import { Component, computed, DestroyRef, effect, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { MapService } from '../map/map.service';
import { MunicipalitiesService } from './municipalities.service';
import { formatPoint, parsePoint } from './point';
import { ProvincesService } from './provinces.service';

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
  private readonly router = inject(Router);

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

  constructor() {
    this.provinces.load();

    effect(() => {
      // Reached straight from a link, the municipalities of this province may
      // not be in yet; asking again is free once they are.
      const province = this.provinces.find(this.province());
      if (province) this.municipalities.load(province.id);

      const chosen = this.chosen();
      if (!chosen) return;
      this.maps.goToBounds(chosen.bounds, true);
      this.maps.focusMunicipality(chosen.id);
    });

    // The URL is what the map draws: the point is never held here.
    effect(() => this.maps.setIgnition(this.ignition()));

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
  }
}
