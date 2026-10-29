import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { MapService } from '../map/map.service';
import { RegionsService } from './regions.service';

/**
 * Spain first, then Portugal. A heading each, because NUTS 2 already says which
 * country a region belongs to and asking first would be a step whose answer the
 * next click gives anyway (§2.18).
 */
const COUNTRIES = [
  { code: 'ES', label: 'Espanya' },
  { code: 'PT', label: 'Portugal' },
] as const;

/**
 * Step one of three: pick a NUTS 2 region.
 *
 * The list rules and the map is the preview (§2.10). The scope is not asked
 * for: the map stays on the one the header's toggle already chose, and the only
 * movement is the room the panel needs.
 */
@Component({
  selector: 'app-region-step',
  imports: [RouterLink],
  templateUrl: './region-step.html',
  styleUrl: './step-panel.css',
})
export class RegionStep {
  private readonly regions = inject(RegionsService);
  private readonly maps = inject(MapService);

  protected readonly failed = this.regions.failed;

  /**
   * By name and not by code: seventeen entries is a list to scan, and nobody
   * looks for Galicia under E.
   */
  protected readonly groups = computed(() => {
    const all = this.regions.regions();
    return COUNTRIES.map((country) => ({
      code: country.code,
      label: country.label,
      regions: all
        .filter((region) => region.country === country.code)
        .sort((a, b) => a.name.localeCompare(b.name, 'ca')),
    })).filter((group) => group.regions.length > 0);
  });

  /** The region the pointer or the keyboard is on. Null clears the outline. */
  protected focus(id: string | null): void {
    this.maps.focusRegion(id);
  }

  constructor() {
    this.regions.load();

    // Back from a later step: nothing is chosen here, so nothing is outlined.
    this.maps.focusRegion(null);

    // Read once and not tracked: what matters is the scope on arrival. The
    // framing is repeated so the panel does not cover what it frames, which
    // also brings the map back when a later step returns here.
    this.maps.goToView(this.maps.scope(), true);
  }
}
