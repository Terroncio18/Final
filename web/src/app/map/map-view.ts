import { Component, computed, effect, inject, input } from '@angular/core';

import { HotspotPanel } from '../hotspot-panel/hotspot-panel';
import { HotspotsService } from './hotspots.service';
import { INITIAL_VIEW, VIEWS, type ViewId } from './map.config';
import { MapService } from './map.service';
import { HOTSPOT_DATE_STOPS, HOTSPOT_STOPS } from './map.style';

/**
 * The overview: active detections over a fixed framing.
 *
 * The map itself belongs to MapShell, which outlives this component. All this
 * one does is tie the `:scope` segment to the camera and show the panel of
 * whichever detection has been clicked.
 */
@Component({
  selector: 'app-map-view',
  imports: [HotspotPanel],
  templateUrl: './map-view.html',
  styleUrl: './map-view.css',
})
export class MapView {
  private readonly maps = inject(MapService);
  private readonly hotspots = inject(HotspotsService);

  // The `:scope` route parameter, bound by withComponentInputBinding().
  readonly scope = input<string>();

  // The route accepts any text, so an unknown scope falls back to the default.
  private readonly view = computed<ViewId>(() => {
    const raw = this.scope();
    return raw !== undefined && raw in VIEWS ? (raw as ViewId) : INITIAL_VIEW;
  });

  protected readonly selected = this.maps.selected;

  /**
   * True while the colour of the marks says the date and not the power.
   *
   * Read from the map and not worked out from the range: the map switches
   * when the detections arrive, and the legend must describe what is painted
   * and not what has been asked for.
   */
  protected readonly byDate = computed(() => this.maps.hotspotColourBy() === 'date');

  /** The ramp of the dates, as the bar of the legend. */
  protected readonly dateRamp =
    'linear-gradient(to right, ' +
    HOTSPOT_DATE_STOPS.map((stop) => `${stop.colour} ${stop.at * 100}%`).join(', ') +
    ')';

  /** The two ends of the bar, as short dates, in UTC as FIRMS dates them. */
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

  /** The marks shrink when the view is crowded, and the legend with them. */
  protected readonly scale = this.maps.hotspotScale;

  /**
   * The legend's rows: the layer's own stops, with the figure written out.
   *
   * «1.000 MW o més» and not «1.000 MW», because the last stop is where the
   * mark stops growing and not where the power stops.
   */
  protected readonly stops = HOTSPOT_STOPS.map((stop, index) => {
    const figure = new Intl.NumberFormat('ca-ES').format(stop.mw);
    return {
      ...stop,
      label: index === HOTSPOT_STOPS.length - 1 ? `${figure} MW o més` : `${figure} MW`,
    };
  });

  constructor() {
    // Runs before the map exists on a cold load, which is why MapService keeps
    // the work and replays it once the style is in.
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
