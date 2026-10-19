import { Injectable, signal } from '@angular/core';
import { AttributionControl, MapLibreMap, ScaleControl, setWorkerUrl } from 'maplibre-gl';

import { INITIAL_VIEW, VIEWS } from './map.config';
import { buildStyle } from './map.style';

/**
 * MapLibre picks its worker file name at runtime, which neither Vite nor esbuild
 * can follow, so the bundler emits no worker and the map loads nothing at all.
 * angular.json copies the file out of node_modules as a static asset and this
 * points MapLibre at it, which works the same in development and in a build.
 */
setWorkerUrl('maplibre-gl-worker.mjs');

/**
 * Owns the MapLibre instance.
 *
 * The map is deliberately kept out of Angular's view: it has its own canvas and
 * its own render loop, and Angular only decides where the container element
 * sits. Everything else talks to it imperatively through this service.
 *
 * The application is zoneless, so map events do not trigger change detection by
 * themselves. Anything the template must react to is published as a signal.
 */
@Injectable({ providedIn: 'root' })
export class MapService {
  private instance: MapLibreMap | null = null;

  /** False until the style has loaded and the first view is framed. */
  readonly ready = signal(false);

  get map(): MapLibreMap | null {
    return this.instance;
  }

  create(container: HTMLElement): void {
    if (this.instance) return;

    const map = new MapLibreMap({
      container,
      style: buildStyle(),
      // A rough starting camera; fitBounds refines it once the style is in.
      // Passing `bounds` here would be measured against a container the layout
      // has not sized yet, and MapLibre falls back to showing the whole world.
      center: [-3.7, 40.0],
      zoom: 4.5,
      pitch: 0,
      maxZoom: 17,
      attributionControl: false,
    });

    map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left');
    map.addControl(
      new AttributionControl({ compact: true, customAttribution: 'IgnisLab · TFG UOC' }),
      'bottom-right',
    );

    // A style that fails to load leaves a blank map and a camera frozen at its
    // initial pose, which is easy to mistake for a slow network. Say so instead.
    map.on('error', (event) => {
      console.error('[mapa]', event.error?.message ?? event.error);
    });

    map.once('load', () => {
      map.fitBounds(VIEWS[INITIAL_VIEW].bounds, { padding: 24, duration: 0 });
      this.ready.set(true);
    });

    this.instance = map;
  }

  destroy(): void {
    this.instance?.remove();
    this.instance = null;
    this.ready.set(false);
  }
}