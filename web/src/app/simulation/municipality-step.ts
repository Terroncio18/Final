import { Component, computed, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MapService } from '../map/map.service';
import { LevelsService } from './levels.service';
import { MunicipalitiesService } from './municipalities.service';
import { ProvincesService } from './provinces.service';
import { SearchBox } from './search-box';

/**
 * Step three of three: pick a municipality.
 *
 * The same shape as the two steps above it. What changes is that the data is
 * not one file but eighty-one, so this is the first step that has to say which
 * one it wants before it can list anything.
 */
@Component({
  selector: 'app-municipality-step',
  imports: [RouterLink, SearchBox],
  templateUrl: './municipality-step.html',
  styleUrl: './step-panel.css',
})
export class MunicipalityStep {
  /** The two segments above, bound by withComponentInputBinding(). */
  public readonly region = input.required<string>();
  public readonly province = input.required<string>();

  private readonly provinces = inject(ProvincesService);
  private readonly municipalities = inject(MunicipalitiesService);
  private readonly maps = inject(MapService);
  private readonly levels = inject(LevelsService);

  protected readonly failed = this.municipalities.failed;
  protected readonly options = this.municipalities.municipalities;

  /** Nothing when the URL carries a code that is not a province. */
  protected readonly chosen = computed(() => this.provinces.find(this.province()));

  /**
   * What the level is called here.
   *
   * LAU is not the same unit on each side of the border: Spain declares the
   * municipio and Portugal the freguesia, the civil parish. Calling both
   * «municipi» would be stating something false about half the list.
   */
  protected readonly label = computed(() =>
    this.province().startsWith('PT') ? 'una freguesia' : 'un municipi',
  );

  public constructor() {
    this.provinces.load();

    effect(() => {
      const chosen = this.chosen();
      if (!chosen) return;

      this.levels.show('municipality', { province: chosen.id });
      this.maps.goToBounds(chosen.bounds, true);
    });
  }

  /** The municipality the pointer or the keyboard is on. */
  protected focus(id: string | null): void {
    this.maps.focusMunicipality(id);
  }
}
