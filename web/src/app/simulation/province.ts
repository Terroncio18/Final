// NUTS 3 uses provinces or islands in Spain and statistical sub-regions in Portugal, rather than
// ICNF districts.
export interface Province {
  /** NUTS 2024 code, e.g. `ES511`. This is what travels in the URL. */
  readonly id: string;
  readonly name: string;
  /** The NUTS 2 code it belongs to, which is its own code minus the last character. */
  readonly region: string;
  /** `[west, south, east, north]`, the order MapLibre's fitBounds takes. */
  readonly bounds: [number, number, number, number];
}
