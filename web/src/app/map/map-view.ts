import { Component, computed, effect, inject, input } from '@angular/core';

import { HotspotPanel } from '../hotspot-panel/hotspot-panel';
import { INITIAL_VIEW, VIEWS, type ViewId } from './map.config';
import { MapService } from './map.service';

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
})
export class MapView {
  private readonly maps = inject(MapService);

  // The `:scope` route parameter, bound by withComponentInputBinding().
  readonly scope = input<string>();

  // The route accepts any text, so an unknown scope falls back to the default.
  private readonly view = computed<ViewId>(() => {
    const raw = this.scope();
    return raw !== undefined && raw in VIEWS ? (raw as ViewId) : INITIAL_VIEW;
  });

  protected readonly selected = this.maps.selected;

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
