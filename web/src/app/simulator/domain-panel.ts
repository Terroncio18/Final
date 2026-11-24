import { Component, computed, inject, input } from '@angular/core';
import { SIDE_M } from '../simulation/domain';
import { TerrainService } from '../simulation/terrain.service';
import { Icon } from './icon';

@Component({
  selector: 'app-domain-panel',
  imports: [Icon],
  templateUrl: './domain-panel.html',
  styleUrls: ['./config-section.css', './domain-panel.css'],
})
export class DomainPanel {
  public readonly place = input.required<string | null>();
  public readonly province = input.required<string>();

  private readonly terrain = inject(TerrainService);

  protected readonly km = new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 1 }).format(
    SIDE_M / 1000,
  );

  // Use the same terrain read and rounding as the form so both screens report identical domain
  // figures.
  protected readonly ground = computed(() => {
    const ground = this.terrain.terrain();
    if (!ground) return null;
    if (ground.landCells === 0) return { facts: null };
    const degrees = new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 1 });
    return {
      facts: {
        low: Math.round(ground.minElevation),
        high: Math.round(ground.maxElevation),
        mean: degrees.format(ground.meanSlope),
        max: degrees.format(ground.maxSlope),
      },
    };
  });

  protected readonly terrainFailed = this.terrain.failed;
}
