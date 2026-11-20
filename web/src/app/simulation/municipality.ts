// LAU units are Spanish municipios and Portuguese freguesias, one level below concelhos.
export interface Municipality {
  /** GISCO identifier: `ES_25120`, `PT_030260`. This is what travels in the URL. */
  readonly id: string;
  readonly name: string;
  /** The NUTS 3 code it was assigned to, by a point in polygon test. */
  readonly province: string;
  /** `[west, south, east, north]`, the order MapLibre's fitBounds takes. */
  readonly bounds: [number, number, number, number];
}
