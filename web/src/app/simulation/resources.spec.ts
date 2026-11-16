import { describe, expect, it } from 'vitest';

import {
  enaireAerodromesUrl,
  icnfWaterUrl,
  overpassQuery,
  parseEnaireAerodromes,
  parseIcnfWater,
  parseOverpass,
  type Extent,
} from './resources';

const extent: Extent = [2.5, 39.6, 2.9, 39.9];

describe('resources', () => {
  it('asks ICNF only for the classes aircraft can use, inside the domain', () => {
    const url = new URL(icnfWaterUrl(extent));
    expect(url.searchParams.get('where')).toBe("Classe IN ('Aéreo','Misto')");
    expect(url.searchParams.get('geometry')).toBe('2.5,39.6,2.9,39.9');
    expect(url.searchParams.get('f')).toBe('geojson');
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

  it('reads ICNF water points, drops what is outside and what has no point', () => {
    const body = {
      type: 'FeatureCollection',
      features: [
        {
          geometry: { type: 'Point', coordinates: [2.7, 39.7] },
          properties: { Nome: ' Barragem ' },
        },
        { geometry: { type: 'Point', coordinates: [2.7, 39.7] }, properties: { Nome: null } },
        { geometry: { type: 'Point', coordinates: [3.5, 39.7] }, properties: { Nome: 'Fora' } },
        { geometry: null, properties: { Nome: 'Sense punt' } },
        { geometry: { type: 'Point', coordinates: ['x', 39.7] }, properties: {} },
      ],
    };
    expect(parseIcnfWater(body, extent)).toEqual([
      { kind: 'water', name: 'Barragem', point: [2.7, 39.7], source: 'ICNF' },
      { kind: 'water', name: "Punt d'aigua", point: [2.7, 39.7], source: 'ICNF' },
    ]);
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
    expect(() => parseIcnfWater({ error: { code: 400 } }, extent)).toThrow();
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
