import { Component, computed, inject, input } from '@angular/core';
import { GRID } from '../simulation/domain';
import { FuelService } from '../simulation/fuel.service';
import type { Point } from '../simulation/point';
import { FUEL_MODELS } from '../simulation/rothermel';
import { TerrainService } from '../simulation/terrain.service';

/**
 * The «Combustible» block of the configuration column: what the fuel map of
 * the square says, and where it comes from.
 *
 * Read from the fuel grid and the elevation the whole screen shares
 * (FuelService, TerrainService); whether that fuel lets the simulation start
 * is the console's to say, and it says it under the start button.
 */
@Component({
  selector: 'app-fuel-panel',
  templateUrl: './fuel-panel.html',
  styleUrls: ['./config-section.css', './fuel-panel.css'],
})
export class FuelPanel {
  /** The centre of the domain, to ask for its fuels again; nothing when the address has none. */
  public readonly centre = input.required<Point | null>();

  protected readonly fuels = inject(FuelService);
  private readonly terrain = inject(TerrainService);

  protected readonly fuelModels = computed(() =>
    (this.fuels.grid()?.counts ?? []).map(({ id, cells }) => ({
      id,
      name: FUEL_MODELS[id].name,
      share: this.fuelPercent(cells),
    })),
  );

  /** How much of the square is ground, which is how much of it can burn. */
  protected readonly burnableShare = computed(() => {
    const terrain = this.terrain.terrain();
    const fuels = this.fuels.grid();
    if (!terrain || !fuels) return '—';
    let land = 0;
    for (let i = 0; i < terrain.elevation.length; i += 1)
      if (terrain.elevation[i] > 0 && fuels.models[i] >= 1 && fuels.models[i] <= 13) land += 1;
    return `${Math.round((land / terrain.elevation.length) * 100)} %`;
  });

  protected fuelPercent(cells: number): string {
    return `${((100 * cells) / (GRID * GRID)).toLocaleString('ca-ES', { maximumFractionDigits: 1 })} %`;
  }

  protected retryFuels(): void {
    const centre = this.centre();
    if (centre) void this.fuels.read(centre, true);
  }
}
