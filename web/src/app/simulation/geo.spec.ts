import { describe, expect, it } from 'vitest';
import { degreesFor, metresFor, M_PER_DEGREE, offsetBy } from './geo';

// The expected numbers are computed apart, not with the functions under test: a wrong constant, a
// missing cos(latitude) or a swapped axis has to show here.
describe('metres and degrees', () => {
  it('shrinks longitude by the cosine of the latitude and leaves latitude alone', () => {
    expect(M_PER_DEGREE).toBe(111_320);

    const domain = degreesFor(15360, 39);
    expect(domain.dLat).toBeCloseTo(0.13798059647862018, 12);
    expect(domain.dLon).toBeCloseTo(0.1775478524265096, 12);
    expect(domain.dLon).toBeGreaterThan(domain.dLat);

    // On the equator the cosine is 1 and the two spans meet.
    const equator = degreesFor(1000, 0);
    expect(equator.dLat).toBeCloseTo(0.008983111749910169, 12);
    expect(equator.dLon).toBeCloseTo(equator.dLat, 15);

    // And north of the equator a degree of longitude is shorter, never longer.
    expect(degreesFor(1000, 60).dLon).toBeCloseTo(2 * equator.dLon, 9);
  });

  it('returns the metres that the degrees came from', () => {
    const back = metresFor(0.01, 0.01, 39.6);
    expect(back.east).toBeCloseTo(857.7353418580085, 9);
    expect(back.north).toBeCloseTo(1113.2, 9);

    // The round trip closes: degrees to metres and back at the same latitude.
    const { dLat, dLon } = degreesFor(5000, 41);
    const metres = metresFor(dLon, dLat, 41);
    expect(metres.east).toBeCloseTo(5000, 6);
    expect(metres.north).toBeCloseTo(5000, 6);
  });

  it('moves a point east and north by metres', () => {
    expect(offsetBy([2.7, 39.6], 250, -120)).toEqual([2.7029146519654708, 39.59892202659001]);
    expect(offsetBy([2.7, 39.6], 0, 0)).toEqual([2.7, 39.6]);
  });
});
