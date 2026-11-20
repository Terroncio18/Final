import { Component, computed, effect, inject, input } from '@angular/core';
import { HotspotPanel } from '../hotspot-panel/hotspot-panel';
import { HotspotsService } from './hotspots.service';
import { INITIAL_VIEW, VIEWS, type ViewId } from './map.config';
import { MapService } from './map.service';
import { HOTSPOT_DATE_STOPS, HOTSPOT_STOPS } from './map.style';

function isViewId(value: string): value is ViewId {
  return Object.hasOwn(VIEWS, value);
}

@Component({
  selector: 'app-map-view',
  imports: [HotspotPanel],
  templateUrl: './map-view.html',
  styleUrl: './map-view.css',
})
export class MapView {
  public readonly scope = input<string>();

  private readonly maps = inject(MapService);
  private readonly hotspots = inject(HotspotsService);

  protected readonly selected = this.maps.selected;
  protected readonly scale = this.maps.hotspotScale;

  private readonly view = computed<ViewId>(() => {
    const raw = this.scope();
    return raw && isViewId(raw) ? raw : INITIAL_VIEW;
  });

  protected readonly byDate = computed(() => this.maps.hotspotColourBy() === 'date');

  protected readonly dateRamp =
    'linear-gradient(to right, ' +
    HOTSPOT_DATE_STOPS.map((stop) => `${stop.colour} ${stop.at * 100}%`).join(', ') +
    ')';

  protected readonly ends = computed(() => {
    const short = new Intl.DateTimeFormat('ca-ES', {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    });
    const range = this.hotspots.range();
    return {
      from: short.format(new Date(range.from + 'T00:00:00Z')),
      to: short.format(new Date(range.to + 'T00:00:00Z')),
    };
  });

  protected readonly stops = HOTSPOT_STOPS.map((stop, index) => {
    const figure = new Intl.NumberFormat('ca-ES').format(stop.mw);
    return {
      ...stop,
      label: index === HOTSPOT_STOPS.length - 1 ? `${figure} MW o més` : `${figure} MW`,
    };
  });

  public constructor() {
    effect(() => {
      const view = this.view();
      this.maps.goToView(view);
      this.maps.showRegionsFor(view);
    });
  }

  protected clearSelection(): void {
    this.maps.clearSelection();
  }
}
