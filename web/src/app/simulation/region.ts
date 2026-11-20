import type { ViewId } from '../map/map.config';

export interface Region {
  /** NUTS 2024 code, e.g. `ES51`. This is what travels in the URL. */
  readonly id: string;
  readonly name: string;

  readonly country: string;

  readonly scope: ViewId;
  // Bounds order: west, south, east, north. MapLibre’s bounds contract requires a mutable tuple.
  readonly bounds: [number, number, number, number];
}
