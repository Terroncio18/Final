export type HotspotScope = 'peninsula' | 'canaries';

export type HotspotSatellite = 'N' | 'N20' | 'N21' | '?';

/** FIRMS VIIRS confidence codes: `l` low, `n` nominal, `h` high. */
export type HotspotConfidence = 'l' | 'n' | 'h' | '';

export type HotspotDaynight = 'D' | 'N' | '';

// The panel gets lon/lat from feature geometry; those coordinates are not API properties.
export interface Hotspot {
  readonly id: string;
  readonly scope: HotspotScope;
  /** Platform code from FIRMS; `?` is used when its value is missing. */
  readonly satellite: HotspotSatellite;
  /** Overpass time, UTC, ISO 8601. */
  readonly observedAt: string;
  // Fire radiative power, in megawatts.
  readonly frp: number;
  readonly confidence: HotspotConfidence;
  readonly daynight: HotspotDaynight;
  readonly lon: number;
  readonly lat: number;
}
