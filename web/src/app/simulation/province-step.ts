import { Component, computed, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { MapService } from '../map/map.service';
import { ProvincesService } from './provinces.service';
import { RegionsService } from './regions.service';

/**
 * Step two of three: pick a province or an island.
 *
 * The same shape as the first step, on purpose: a list that rules, a map that
 * previews, and an outline that follows the pointer. What changes is the level.
 */
@Component({
  selector: 'app-province-step',
  imports: [RouterLink],
  templateUrl: './province-step.html',
  styleUrl: './step-panel.css',
})
export class ProvinceStep {
  private readonly regions = inject(RegionsService);
  private readonly provinces = inject(ProvincesService);
  private readonly maps = inject(MapService);

  /** The `:region` segment, bound by withComponentInputBinding(). */
  readonly region = input.required<string>();

  protected readonly failed = this.provinces.failed;

  /** Nothing when the URL carries a code that is not a region. */
  protected readonly chosen = computed(() => this.regions.find(this.region()));

  /** By name, like the first step: a list is read, not decoded. */
  protected readonly options = computed(() =>
    [...this.provinces.of(this.region())].sort((a, b) => a.name.localeCompare(b.name, 'ca')),
  );

  /**
   * Nine of the twenty-four regions have a single NUTS 3 —Madrid, Navarra,
   * Astúries, the Algarve— so the list is sometimes one row. It is still shown
   * rather than skipped: a redirect would make the back button a trap, because
   * returning to this step would immediately throw the user forward again.
   */
  protected readonly single = computed(() => this.options().length === 1);

  constructor() {
    this.regions.load();
    this.provinces.load();

    effect(() => {
      const chosen = this.chosen();
      if (!chosen) return;
      this.maps.goToBounds(chosen.bounds, true);

      // The region's own outline belongs to the first step; here the camera has
      // already framed it. What the map draws now is the level below.
      this.maps.focusRegion(null);
      this.maps.showProvincesOf(chosen.id);
    });
  }

  /** The province the pointer or the keyboard is on. Null clears the outline. */
  protected focus(id: string | null): void {
    this.maps.focusProvince(id);
  }
}
