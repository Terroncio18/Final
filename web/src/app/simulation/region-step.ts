import { Component, computed, inject, type OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MapService } from '../map/map.service';
import { LevelsService } from './levels.service';
import { RegionsService } from './regions.service';
import { SearchBox } from './search-box';

const COUNTRIES = [
  { code: 'ES', label: 'Espanya' },
  { code: 'PT', label: 'Portugal' },
] as const;

@Component({
  selector: 'app-region-step',
  imports: [RouterLink, SearchBox],
  templateUrl: './region-step.html',
  styleUrl: './step-panel.css',
})
export class RegionStep implements OnInit {
  private readonly regions = inject(RegionsService);
  private readonly maps = inject(MapService);
  private readonly levels = inject(LevelsService);

  protected readonly failed = this.regions.failed;

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

  public ngOnInit(): void {
    this.regions.load();

    this.levels.show('region');

    // Read scope only on entry; later scope changes must not retrigger this initial framing.
    this.maps.goToView(this.maps.scope(), true);
  }

  protected focus(id: string | null): void {
    this.maps.focusRegion(id);
  }
}
