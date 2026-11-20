import { Component, computed, inject, input } from '@angular/core';
import { GRID } from '../simulation/domain';
import { FuelService } from '../simulation/fuel.service';
import type { Point } from '../simulation/point';
import { FUEL_MODELS } from '../simulation/rothermel';
import { TerrainService } from '../simulation/terrain.service';

@Component({
  selector: 'app-fuel-panel',
  templateUrl: './fuel-panel.html',
  styleUrls: ['./config-section.css', './fuel-panel.css'],
})
export class FuelPanel {
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
