import { Injectable, signal } from '@angular/core';
import { AttributionControl, MapLibreMap, ScaleControl, setWorkerUrl } from 'maplibre-gl';

import { VIEWS, type ViewId } from './map.config';
import { buildStyle, LAYERS } from './map.style';

/**
 * MapLibre picks its worker file name at runtime, which neither Vite nor esbuild
 * can follow, so the bundler emits no worker and the map loads nothing at all.
 * angular.json copies the file out of node_modules as a static asset and this
 * points MapLibre at it, which works the same in development and in a build.
 */
setWorkerUrl(new URL('maplibre-gl-worker.mjs', document.baseURI).href);

/** Framing is the same at every level; only the animation changes. */
const FIT = { padding: 24 } as const;

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

  create(container: HTMLElement, initialView: ViewId): void {
    if (this.instance) return;

    const map = new MapLibreMap({
      container,
      style: buildStyle(),
      // A rough starting camera; the initial view is framed once the style is
      // in. Passing `bounds` here would be measured against a container the
      // layout has not sized yet, and MapLibre falls back to the whole world.
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

    // The opening frame is not an animation: there is nothing to travel from.
    map.once('styledata', () => {
      map.fitBounds(VIEWS[initialView].bounds, { ...FIT, duration: 0 });
      this.showRegionsFor(initialView);
    });

    const reveal = () => this.ready.set(true);
    map.once('load', reveal);
    // A worker that fails to start stops `load` firing at all, even though the
    // map renders. `idle` covers that case so the view is never left hidden.
    map.once('idle', reveal);

    this.instance = map;
  }

  /** Moves to one of the fixed scope framings. Ignored until the map exists. */
  goToView(view: ViewId): void {
    this.instance?.fitBounds(VIEWS[view].bounds, { ...FIT, duration: 900 });
  }

  /**
   * Shows only the regions belonging to a scope.
   *
   * The filter runs inside MapLibre against the `scope` property baked into the
   * data, so switching scope costs nothing: no refetch, no new source.
   */
  showRegionsFor(scope: ViewId): void {
    const map = this.instance;
    if (!map) return;
    const filter = ['==', ['get', 'scope'], scope] as never;
    map.setFilter(LAYERS.regionsFill, filter);
    map.setFilter(LAYERS.regionsLine, filter);
  }

  destroy(): void {
    this.instance?.remove();
    this.instance = null;
    this.ready.set(false);
  }
}
