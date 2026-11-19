import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { HotspotsService } from './hotspots.service';
import { MapService } from './map.service';

/**
 * The map surface, and the only place the map is created.
 *
 * It sits on a route with an empty path, which matches every URL beneath it, so
 * the router keeps this component alive while the hierarchy changes underneath.
 * That is the whole point: the map is a WebGL context and a style with four
 * sources, and rebuilding it at every step would blank the screen for a second
 * each time.
 *
 * Whatever is on screen draws over it —the detection panel, the steps of the
 * form— and moves the camera through MapService. The shell itself has no
 * opinion about what is being shown.
 */
@Component({
  selector: 'app-map-shell',
  imports: [RouterOutlet],
  templateUrl: './map-shell.html',
  styleUrl: './map-shell.css',
})
export class MapShell {
  private readonly maps = inject(MapService);

  /**
   * Injected and not called: building it is what starts the detections.
   *
   * It watches the dates in the URL and feeds the source, and it belongs to
   * whatever owns the map rather than to a route under it —the detections
   * outlive every step of the form, which only hides them (§2.21).
   */
  private readonly hotspots = inject(HotspotsService);

  // The element MapLibre takes over. Required: the template always renders it.
  private readonly container = viewChild.required<ElementRef<HTMLDivElement>>('container');

  protected readonly ready = this.maps.ready;

  public constructor() {
    // afterNextRender runs once the DOM exists, and only in the browser, which
    // is exactly what MapLibre needs. A plain constructor would be too early.
    afterNextRender(() => this.maps.create(this.container().nativeElement));

    inject(DestroyRef).onDestroy(() => this.maps.destroy());
  }
}
