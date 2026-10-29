/**
 * A NUTS 3 area: the second level of the navigation hierarchy.
 *
 * In Spain these are the provinces, except in the Balearics and the Canaries,
 * where they are the islands — which for fires is the better cut, because
 * Mallorca and Menorca are separate fire domains. In Portugal they are the
 * statistical sub-regions, which are not the districts the ICNF works with
 * (§3.4).
 */
export interface Province {
  /** NUTS 2024 code, e.g. `ES511`. This is what travels in the URL. */
  readonly id: string;
  readonly name: string;
  /** The NUTS 2 code it belongs to, which is its own code minus the last character. */
  readonly region: string;
  /** `[west, south, east, north]`, the order MapLibre's fitBounds takes. */
  readonly bounds: [number, number, number, number];
}
