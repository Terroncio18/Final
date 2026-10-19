import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  viewChild,
} from '@angular/core';

import { INITIAL_VIEW, VIEWS, type ViewId } from './map.config';
import { MapService } from './map.service';

/**
 * The map surface.
 *
 * The component owns only the container element and the camera's connection to
 * the URL. Creating and destroying the map belongs to MapService, so later
 * views can reach the same instance.
 */
@Component({
  selector: 'app-map-view',
  templateUrl: './map-view.html',
  styleUrl: './map-view.css',
})
export class MapView {
  private readonly maps = inject(MapService);

  // The element MapLibre takes over. Required: the template always renders it.
  private readonly container = viewChild.required<ElementRef<HTMLDivElement>>('container');

  // The `:scope` route parameter, bound by withComponentInputBinding().
  readonly scope = input<string>();

  // The route accepts any text, so an unknown scope falls back to the default.
  private readonly view = computed<ViewId>(() => {
    const raw = this.scope();
    return raw !== undefined && raw in VIEWS ? (raw as ViewId) : INITIAL_VIEW;
  });

  protected readonly ready = this.maps.ready;

  constructor() {
    // The first value is handled by create(), which frames it without animating.
    let opening = true;

    effect(() => {
      const view = this.view();
      if (opening) {
        opening = false;
        return;
      }
      this.maps.goToView(view);
      this.maps.showRegionsFor(view);
    });

    // afterNextRender runs once the DOM exists, and only in the browser, which
    // is exactly what MapLibre needs. A plain constructor would be too early.
    afterNextRender(() => this.maps.create(this.container().nativeElement, this.view()));

    inject(DestroyRef).onDestroy(() => this.maps.destroy());
  }
}
