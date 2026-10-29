/**
 * A LAU unit: the last administrative level of the hierarchy.
 *
 * Not the same thing on each side of the border, and the code says so. Spain
 * declares the municipio; Portugal declares the freguesia, the civil parish,
 * which is one level below its concelho. One source and one criterion was
 * preferred to mixing two registers (§2.25).
 */
export interface Municipality {
  /** GISCO identifier: `ES_25120`, `PT_030260`. This is what travels in the URL. */
  readonly id: string;
  readonly name: string;
  /** The NUTS 3 code it was assigned to, by a point in polygon test. */
  readonly province: string;
  /** `[west, south, east, north]`, the order MapLibre's fitBounds takes. */
  readonly bounds: [number, number, number, number];
}
