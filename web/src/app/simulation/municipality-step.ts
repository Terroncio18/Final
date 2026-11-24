import { Component, computed, effect, inject, input, type OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MapService } from '../map/map.service';
import { LevelsService } from './levels.service';
import { MunicipalitiesService } from './municipalities.service';
import { ProvincesService } from './provinces.service';
import { SearchBox } from './search-box';

@Component({
  selector: 'app-municipality-step',
  imports: [RouterLink, SearchBox],
  templateUrl: './municipality-step.html',
  styleUrl: './step-panel.css',
})
export class MunicipalityStep implements OnInit {
  public readonly region = input.required<string>();
  public readonly province = input.required<string>();

  private readonly provinces = inject(ProvincesService);
  private readonly municipalities = inject(MunicipalitiesService);
  private readonly maps = inject(MapService);
  private readonly levels = inject(LevelsService);

  protected readonly failed = this.municipalities.failed;
  protected readonly options = this.municipalities.municipalities;

  protected readonly chosen = computed(() => this.provinces.find(this.province()));

  // LAU means municipio in Spain and freguesia (civil parish) in Portugal.
  protected readonly label = computed(() =>
    this.province().startsWith('PT') ? 'una freguesia' : 'un municipi',
  );

  public constructor() {
    effect(() => {
      const chosen = this.chosen();
      if (!chosen) return;

      this.levels.show('municipality', { province: chosen.id });
      this.maps.goToBounds(chosen.bounds, true);
    });
  }

  public ngOnInit(): void {
    this.provinces.load();
  }

  protected retry(): void {
    this.municipalities.load(this.province());
  }

  protected focus(id: string | null): void {
    this.maps.focusMunicipality(id);
  }
}
