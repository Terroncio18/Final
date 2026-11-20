import { Component, computed, effect, inject, input, type OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MapService } from '../map/map.service';
import { LevelsService } from './levels.service';
import { ProvincesService } from './provinces.service';
import { RegionsService } from './regions.service';
import { SearchBox } from './search-box';

@Component({
  selector: 'app-province-step',
  imports: [RouterLink, SearchBox],
  templateUrl: './province-step.html',
  styleUrl: './step-panel.css',
})
export class ProvinceStep implements OnInit {
  public readonly region = input.required<string>();

  private readonly regions = inject(RegionsService);
  private readonly provinces = inject(ProvincesService);
  private readonly maps = inject(MapService);
  private readonly levels = inject(LevelsService);

  protected readonly failed = this.provinces.failed;

  protected readonly chosen = computed(() => this.regions.find(this.region()));

  protected readonly options = computed(() =>
    [...this.provinces.of(this.region())].sort((a, b) => a.name.localeCompare(b.name, 'ca')),
  );

  // Show single-province regions too: automatic redirection would trap Back by immediately
  // forwarding again.
  protected readonly single = computed(() => this.options().length === 1);

  public constructor() {
    effect(() => {
      const chosen = this.chosen();
      if (!chosen) return;
      this.maps.goToBounds(chosen.bounds, true);

      this.levels.show('province', { region: chosen.id });
    });
  }

  public ngOnInit(): void {
    this.regions.load();
    this.provinces.load();
  }

  protected focus(id: string | null): void {
    this.maps.focusProvince(id);
  }
}
