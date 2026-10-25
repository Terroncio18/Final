/**
 * One FIRMS detection, as the API serves it.
 *
 * Declared here as well as in `api/src/firms.ts` on purpose: the two projects
 * share no package, and inventing one for a handful of fields would cost more
 * than it saves. Same reasoning as the framings in `map.config.ts`.
 *
 * `lon` and `lat` do not travel in the properties —they are the geometry— but
 * the panel needs them and should not have to know about GeoJSON to get them.
 */
export interface Hotspot {
  readonly id: string;
  readonly scope: string;
  /** Platform that saw it, as FIRMS writes it: `N`, `N20`, `N21`. */
  readonly satellite: string;
  /** Overpass time, UTC, ISO 8601. */
  readonly observedAt: string;
  /** Fire radiative power, in megawatts: how much energy the fire is releasing. */
  readonly frp: number;
  /** VIIRS codes confidence as a letter: low, nominal, high. */
  readonly confidence: string;
  /** `D` or `N`. A night detection is more reliable: no sunglint. */
  readonly daynight: string;
  readonly lon: number;
  readonly lat: number;
}
