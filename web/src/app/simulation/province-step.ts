import { Component, computed, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { MapService } from '../map/map.service';
import { RegionsService } from './regions.service';

/**
 * Step two of three: pick a province or an island.
 *
 * The NUTS 3 boundaries are not prepared yet, so the step only confirms the
 * region and frames it. It is here because the hierarchy has to be walkable
 * before there is anything to walk to: the URL, the back button and the map
 * following the choice are what this step proves.
 */
@Component({
  selector: 'app-province-step',
  imports: [RouterLink],
  templateUrl: './province-step.html',
  styleUrl: './step-panel.css',
})
export class ProvinceStep {
  private readonly regions = inject(RegionsService);
  private readonly maps = inject(MapService);

  /** The `:region` segment, bound by withComponentInputBinding(). */
  readonly region = input.required<string>();

  /** Nothing when the URL carries a code that is not a region. */
  protected readonly chosen = computed(() => this.regions.find(this.region()));

  constructor() {
    this.regions.load();

    // The list arrives after the first render, so the framing cannot happen in
    // the constructor: it waits for whichever value makes the region known.
    effect(() => {
      const chosen = this.chosen();
      if (!chosen) return;
      this.maps.goToBounds(chosen.bounds, true);
      this.maps.focusRegion(chosen.id);
    });
  }
}
