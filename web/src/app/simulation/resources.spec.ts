import { describe, expect, it } from 'vitest';

import {
  enaireAerodromesUrl,
  overpassQuery,
  parseEnaireAerodromes,
  parseWaterPoints,
  waterFor,
  waterPointsUrl,
  widen,
  parseOverpass,
  type Extent,
} from './resources';

const extent: Extent = [2.5, 39.6, 2.9, 39.9];

describe('resources', () => {
  it('asks our API for the water points of the domain', () => {
    expect(waterPointsUrl(extent)).toBe(
      '/api/water-points?bbox=2.500000,39.600000,2.900000,39.900000',
    );
  });

  it('asks ENAIRE for aerodromes, not bare heliports or model fields', () => {
    const url = new URL(enaireAerodromesUrl(extent));
    expect(url.searchParams.get('where')).toBe("TYPE_CODE IN ('AD','AH')");
  });

  it('writes the Overpass box south, west, north, east, with aerodromes only on request', () => {
    expect(overpassQuery(extent, false)).toContain('["amenity"="fire_station"](39.6,2.5,39.9,2.9)');
    expect(overpassQuery(extent, false)).not.toContain('aeroway');
    expect(overpassQuery(extent, true)).toContain('["aeroway"="aerodrome"](39.6,2.5,39.9,2.9)');
  });

  it('reads the API water points, with what each source says about aircraft', () => {
    const body = {
      points: [
        {
          source: 'GVA',
          id: 'a',
          name: 'M908',
          lon: -0.51,
          lat: 38.55,
          type: 'Depósito',
          helicopter: true,
          amphibious: false,
        },
        {
          source: 'REDIAM',
          id: 'b',
          name: 'HW2169',
          lon: -7.1,
          lat: 37.6,
          type: 'EMBALSE',
          helicopter: null,
          amphibious: null,
        },
        {
          source: 'ICNF',
          id: 'c',
          name: '',
          lon: -8.4,
          lat: 41.3,
          type: null,
          helicopter: true,
          amphibious: null,
        },
        { source: 'OSM', id: 'd', name: 'x', lon: 0, lat: 0 },
        { source: 'GVA', id: 'e', name: 'x', lon: 'x', lat: 0 },
      ],
    };
    const read = parseWaterPoints(body);
    expect(read.map((r) => r.name)).toEqual(['M908', 'HW2169', "Punt d'aigua"]);
    expect(read[0]).toMatchObject({
      kind: 'water',
      source: 'GVA',
      detail: 'Depósito',
      helicopter: true,
      amphibious: false,
    });
    expect(read.map((r) => waterFor('helicopter', r))).toEqual([true, true, true]);
    // GVA says no; a REDIAM reservoir is open water; an ICNF point of no type is not.
    expect(read.map((r) => waterFor('amphibious', r))).toEqual([false, true, false]);
    expect(() => parseWaterPoints({ error: 'x' })).toThrow();
  });

  it('widens an extent by metres on every side', () => {
    const [w, s, e, n] = widen([0, 40, 1, 41], 30_000);
    expect(41 - n).toBeCloseTo(-30_000 / 111_320, 6);
    expect(40 - s).toBeCloseTo(30_000 / 111_320, 6);
    expect(-w).toBeGreaterThan(30_000 / 111_320);
    expect(e - 1).toBeCloseTo(-w, 9);
  });

  it('names an ENAIRE aerodrome with its ICAO code', () => {
    const body = {
      features: [
        {
          geometry: { type: 'Point', coordinates: [2.73, 39.55 + 0.1] },
          properties: { NAME_TXT: 'PALMA DE MALLORCA', ICAO_TXT: 'LEPA/LESJ' },
        },
        { geometry: { type: 'Point', coordinates: [2.6, 39.7] }, properties: {} },
      ],
    };
    expect(parseEnaireAerodromes(body, extent).map((r) => r.name)).toEqual([
      'PALMA DE MALLORCA (LEPA/LESJ)',
      'Aeròdrom',
    ]);
  });

  it('refuses an answer that is not a feature collection', () => {
    expect(() => parseOverpass({ remark: 'timeout' }, extent, false)).toThrow();
  });

  it('reads OSM stations from nodes and way centres, and aerodromes only as fallback', () => {
    const body = {
      elements: [
        {
          type: 'node',
          lon: 2.65,
          lat: 39.7,
          tags: { amenity: 'fire_station', name: 'Parc de Bombers' },
        },
        { type: 'way', center: { lon: 2.8, lat: 39.8 }, tags: { amenity: 'fire_station' } },
        {
          type: 'way',
          center: { lon: 2.7, lat: 39.65 },
          tags: { aeroway: 'aerodrome', name: 'Son Bonet', icao: 'LESB' },
        },
        { type: 'node', lon: 5, lat: 39.7, tags: { amenity: 'fire_station' } },
      ],
    };
    expect(parseOverpass(body, extent, false)).toEqual([
      { kind: 'station', name: 'Parc de Bombers', point: [2.65, 39.7], source: 'OSM' },
      { kind: 'station', name: 'Parc de bombers', point: [2.8, 39.8], source: 'OSM' },
    ]);
    expect(parseOverpass(body, extent, true).at(-1)).toEqual({
      kind: 'aerodrome',
      name: 'Son Bonet (LESB)',
      point: [2.7, 39.65],
      source: 'OSM',
    });
  });
});
