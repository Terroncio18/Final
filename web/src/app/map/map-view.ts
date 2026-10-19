import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';

import { MapService } from './map.service';

/**
 * The map surface.
 *
 * The component owns only the container element. Creating and destroying the
 * map belongs to MapService, so later views can reach the same instance.
 */
@Component({
  selector: 'app-map-view',
  templateUrl: './map-view.html',
  styleUrl: './map-view.css',
})
export class MapView {
  private readonly maps = inject(MapService);

  /** The element MapLibre takes over. Required: the template always renders it. */
  private readonly container = viewChild.required<ElementRef<HTMLDivElement>>('container');

  protected readonly ready = this.maps.ready;

  constructor() {
    // afterNextRender runs once the DOM exists, and only in the browser, which
    // is exactly what MapLibre needs. A plain constructor would be too early.
    afterNextRender(() => this.maps.create(this.container().nativeElement));

    inject(DestroyRef).onDestroy(() => this.maps.destroy());
  }
}