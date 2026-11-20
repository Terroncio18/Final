import { Component, computed, inject, input } from '@angular/core';
import { SIDE_M } from '../simulation/domain';
import { TerrainService } from '../simulation/terrain.service';
import { Icon } from './icon';

/**
 * The «Àrea d'estudi» block of the configuration column: which square this
 * is, and its ground.
 *
 * The place and the province are the console's, which also names them in the
 * bar and over the map, and come in already resolved. The ground is read from
 * the elevation this block shares with the whole screen (TerrainService).
 */
@Component({
  selector: 'app-domain-panel',
  imports: [Icon],
  templateUrl: './domain-panel.html',
  styleUrls: ['./config-section.css', './domain-panel.css'],
})
export class DomainPanel {
  /** The municipality's name, or nothing when it is not known. */
  public readonly place = input.required<string | null>();
  public readonly province = input.required<string>();

  private readonly terrain = inject(TerrainService);

  /** The side of the square, as the card says it (§2.27). */
  protected readonly km = new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 1 }).format(
    SIDE_M / 1000,
  );

  /**
   * The ground of the domain, in the figures the form's last step gives.
   *
   * The same read and the same rounding as there (§2.28), on purpose: the two
   * screens name the same square, and a slope that said 25,8° in one and 26° in
   * the other would be two terrains. Unlike the analysis column, these come
   * from the elevation and not from SAMPLE.
   */
  protected readonly ground = computed(() => {
    const ground = this.terrain.terrain();
    if (!ground) return null;
    const degrees = new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 1 });
    return {
      low: Math.round(ground.minElevation),
      high: Math.round(ground.maxElevation),
      mean: degrees.format(ground.meanSlope),
      max: degrees.format(ground.maxSlope),
    };
  });

  protected readonly terrainFailed = this.terrain.failed;
}
