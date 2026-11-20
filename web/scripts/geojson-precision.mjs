export const COORDINATE_DECIMALS = 6;

/**
 * Keep geographic positions to roughly eleven centimetres while dropping
 * digits beyond the source map's useful precision. Extra ordinates are kept.
 */
export function roundGeoJSONCoordinates(value) {
  if (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number'
  ) {
    return value.map((ordinate, index) =>
      index < 2
        ? Math.round(ordinate * 10 ** COORDINATE_DECIMALS) / 10 ** COORDINATE_DECIMALS
        : ordinate,
    );
  }
  return Array.isArray(value) ? value.map(roundGeoJSONCoordinates) : value;
}
