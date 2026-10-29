import type { ViewId } from '../map/map.config';

/**
 * A NUTS 2 region: the first level of the navigation hierarchy.
 *
 * Read from the same GeoJSON the map draws its borders from, so a name in the
 * list and a border on the map cannot drift apart.
 */
export interface Region {
  /** NUTS 2024 code, e.g. `ES51`. This is what travels in the URL. */
  readonly id: string;
  readonly name: string;
  /** `ES` or `PT`. A heading in the list, never a step (§2.18). */
  readonly country: string;
  /** Which of the two map framings the region belongs to. */
  readonly scope: ViewId;
  /**
   * `[west, south, east, north]`, the order MapLibre's fitBounds takes.
   *
   * The tuple is not readonly because LngLatBoundsLike is not: MapLibre takes a
   * mutable array and marking ours as immutable only moves the cast elsewhere.
   */
  readonly bounds: [number, number, number, number];
}
