import { Component, computed, inject, input, output } from '@angular/core';
import { MapService } from '../map/map.service';
import { COUNTERMEASURE_CATALOG, type CountermeasureKind } from '../simulation/countermeasures';
import type { SpreadResult } from '../simulation/fire-spread';
import type { Point } from '../simulation/point';
import { cellOf } from '../simulation/terrain';
import type { CountermeasurePlan } from './countermeasure-plan';
import { Icon, iconOr } from './icon';

/**
 * The countermeasure tools, in the two groups the panel shows them in.
 *
 * Two groups because they are two kinds of thing: the ground ones are drawn
 * where a crew or a machine works, and the aerial ones are dropped. What each
 * does to the fire is the model's (simulation/countermeasures.ts); this is
 * only the order of the buttons.
 */
const COUNTERMEASURE_GROUPS = [
  { id: 'ground', title: 'Mitjans terrestres' },
  { id: 'air', title: 'Mitjans aeris' },
].map((group) => ({
  title: group.title,
  items: COUNTERMEASURE_CATALOG.filter((entry) => entry.group === group.id).map((entry) => ({
    ...entry,
    icon: iconOr(entry.icon, 'ruler'),
  })),
}));

/** A measure asked for in the past, and how many deployed after it would go (§11.38). */
export interface PastWarning {
  kind: CountermeasureKind;
  count: number;
}

/**
 * The «Contramesures» block of the configuration column, and under it the
 * fuel of the cell the reader is looking at, as the measures left it.
 *
 * Only what is shown: taking a tool, accepting to rewrite the past, taking a
 * measure off or clearing the plan go back to the console as events, because
 * each of them stops the playback, opens the tool's settings or computes the
 * forecast again (§11.38, §11.39). The plan itself comes in whole, as the
 * object it is, and is read and selected from here.
 */
@Component({
  selector: 'app-countermeasure-panel',
  imports: [Icon],
  templateUrl: './countermeasure-panel.html',
  styleUrls: ['./config-section.css', './countermeasure-panel.css'],
})
export class CountermeasurePanel {
  public readonly plan = input.required<CountermeasurePlan>();
  public readonly computing = input.required<boolean>();
  public readonly pastWarning = input.required<PastWarning | null>();
  /** The forecast has just been updated for a measure deployed during the run. */
  public readonly planStale = input.required<boolean>();
  public readonly result = input.required<SpreadResult | null>();
  public readonly minutes = input.required<number>();
  public readonly centre = input.required<Point | null>();

  public readonly pickMeasure = output<CountermeasureKind>();
  public readonly confirmPast = output();
  public readonly cancelPast = output();
  public readonly cancelTool = output();
  public readonly removeMeasure = output<string>();
  public readonly clearMeasures = output();

  private readonly maps = inject(MapService);

  protected readonly countermeasures = COUNTERMEASURE_GROUPS;

  /**
   * The fuel of one cell at the cursor, as the measures treated it (§11.35):
   * the one under the pointer, or else the first point of the measure
   * selected. Nothing where nothing has been treated.
   */
  protected readonly treatedCell = computed(() => {
    const centre = this.centre();
    const plan = this.plan();
    const selected = plan.measures().find((m) => m.id === plan.selected());
    const point = this.maps.pointer() ?? selected?.points[0];
    if (!centre || !point) return null;
    const cell = cellOf(centre, point);
    const state =
      cell === null ? undefined : this.result()?.fuelTreatments?.at(cell, this.minutes());
    if (!state) return null;
    const format = new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 1 });
    return {
      where: this.maps.pointer() ? 'Cel·la sota el cursor' : 'Cel·la de la mesura seleccionada',
      moisture: format.format(state.moisture1h * 100),
      load: format.format(state.bed.loadTonHa),
      remaining: Math.round(state.remaining * 100),
    };
  });
}
