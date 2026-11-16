import type { Point } from './point';

/**
 * Where suppression comes from (12.23): fire stations, water points registered
 * for aircraft, and aerodromes. Not decoration: a station says where a crew
 * leaves from, a water point how long a helicopter takes between passes, an
 * aerodrome where a retardant plane reloads.
 *
 * Each source is the official one where an official one exists and answers
 * from the browser, and OpenStreetMap otherwise, said as such:
 *
 * - **water points**: ICNF, the national network of Portugal, filtered to the
 *   classes aircraft can use (`Aéreo`, `Misto`). Spain publishes them per
 *   autonomous community and none was found open (§14);
 * - **aerodromes**: ENAIRE's aeronautical database (the AIP's aerodromes and
 *   heliport-aerodromes) in Spain; OpenStreetMap `aeroway=aerodrome` only where
 *   ENAIRE has none in the domain, which is Portugal;
 * - **fire stations**: OpenStreetMap `amenity=fire_station`. No national
 *   official layer was found in either country.
 */
export type ResourceKind = 'station' | 'water' | 'aerodrome';
export type ResourceSource = 'ICNF' | 'ENAIRE' | 'OSM';

export interface Resource {
  readonly kind: ResourceKind;
  readonly name: string;
  readonly point: Point;
  readonly source: ResourceSource;
  /** ICNF's type of water point (reservoir, lake, ocean…), where it says. */
  readonly detail?: string;
}

/**
 * A lake or reservoir as an official polygon (§11.44): where an aircraft may
 * load water that is not the sea. Outer rings and holes, in [lon, lat].
 */
export interface Lake {
  readonly name: string;
  readonly rings: readonly (readonly Point[])[];
}

/**
 * ICNF types that are open water large enough to be more than a tank: the
 * ones a scooper could use. The rest (tanks, wells, pools…) are for the
 * helicopter's bucket only. No minimum size is checked: none was found
 * published (12.26).
 */
export const OPEN_WATER = new Set([
  'Albufeira de barragem',
  'Albufeira de açude',
  'Lago',
  'Oceano',
  'Estuário',
]);

/** `[west, south, east, north]`, degrees. */
export type Extent = readonly [number, number, number, number];

export const ICNF_WATER_URL =
  'https://sigservices.icnf.pt/server/rest/services/BDG/Pontos_agua/MapServer/0/query';
export const ENAIRE_AERODROMES_URL =
  'https://servais.enaire.es/insignia/rest/services/INSIGNIA_SRV/Aero_SRV_VIGOR_V2/FeatureServer/3/query';
export const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
/** IDEIB, surface water bodies of the Balearic hydrological plan, lakes category (2022). */
export const IDEIB_LAKES_URL =
  'https://ideib.caib.es/geoserveis/rest/services/public/GOIB_Masses_Aigua_IB/MapServer/5/query';

/** ArcGIS REST asks for the envelope as `west,south,east,north` in WGS84. */
function arcgisQuery(base: string, extent: Extent, where: string, fields: string): string {
  const params = new URLSearchParams({
    where,
    outFields: fields,
    geometry: extent.join(','),
    geometryType: 'esriGeometryEnvelope',
    inSR: '4326',
    outSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    returnGeometry: 'true',
    f: 'geojson',
  });
  return `${base}?${params}`;
}

/** Water points aircraft can load from: the `Aéreo` and `Misto` classes. */
export function icnfWaterUrl(extent: Extent): string {
  return arcgisQuery(
    ICNF_WATER_URL,
    extent,
    "Classe IN ('Aéreo','Misto')",
    'Nome,Classe,Tipo,Operacionalidade',
  );
}

/** Lakes and reservoirs of the Balearic Islands; elsewhere the answer is empty. */
export function ideibLakesUrl(extent: Extent): string {
  return arcgisQuery(IDEIB_LAKES_URL, extent, '1=1', 'NOM');
}

const ring = (value: unknown): Point[] | null =>
  Array.isArray(value) &&
  value.length >= 4 &&
  value.every((p) => Array.isArray(p) && finite(p[0]) && finite(p[1]))
    ? value.map((p) => [p[0], p[1]] as Point)
    : null;

/** Polygons and multipolygons; anything else is skipped. */
export function parseLakes(body: unknown): Lake[] {
  const features = (body as { features?: unknown })?.features;
  if (!Array.isArray(features)) throw new Error('Resposta sense entitats.');
  const lakes: Lake[] = [];
  for (const feature of features) {
    const geometry = feature?.geometry;
    const polygons: unknown[] =
      geometry?.type === 'Polygon'
        ? [geometry.coordinates]
        : geometry?.type === 'MultiPolygon'
          ? geometry.coordinates
          : [];
    const name = text(feature?.properties?.['NOM']) || 'Llac';
    for (const polygon of polygons) {
      if (!Array.isArray(polygon)) continue;
      const rings = polygon.map(ring);
      if (rings.length && rings.every((r) => r)) lakes.push({ name, rings: rings as Point[][] });
    }
  }
  return lakes;
}

/** Even-odd rule over every ring, so holes (islands) are not water. */
export function inLake(point: Point, lakes: readonly Lake[]): boolean {
  return lakes.some((lake) => {
    let inside = false;
    for (const r of lake.rings)
      for (let i = 0, j = r.length - 1; i < r.length; j = i++)
        if (
          r[i][1] > point[1] !== r[j][1] > point[1] &&
          point[0] < ((r[j][0] - r[i][0]) * (point[1] - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]
        )
          inside = !inside;
    return inside;
  });
}

/** Aerodromes and aerodromes with heliport; not bare heliports, model fields or balloon sites. */
export function enaireAerodromesUrl(extent: Extent): string {
  return arcgisQuery(
    ENAIRE_AERODROMES_URL,
    extent,
    "TYPE_CODE IN ('AD','AH')",
    'NAME_TXT,ICAO_TXT,TYPE_CODE',
  );
}

/** Overpass QL for stations and, as fallback, aerodromes. `out center` gives ways a point. */
export function overpassQuery(extent: Extent, aerodromes: boolean): string {
  const [w, s, e, n] = extent;
  const box = `(${s},${w},${n},${e})`;
  return (
    `[out:json][timeout:25];(nwr["amenity"="fire_station"]${box};` +
    (aerodromes ? `nwr["aeroway"="aerodrome"]${box};` : '') +
    `);out center tags;`
  );
}

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

export function inside(point: Point, extent: Extent): boolean {
  const [w, s, e, n] = extent;
  return point[0] >= w && point[0] <= e && point[1] >= s && point[1] <= n;
}

/** The points of a GeoJSON answer, read defensively: it is someone else's data. */
function geojsonPoints(body: unknown): { point: Point; properties: Record<string, unknown> }[] {
  const features = (body as { features?: unknown })?.features;
  if (!Array.isArray(features)) throw new Error('Resposta sense entitats.');
  const result: { point: Point; properties: Record<string, unknown> }[] = [];
  for (const feature of features) {
    const coordinates = feature?.geometry?.type === 'Point' ? feature.geometry.coordinates : null;
    if (!Array.isArray(coordinates) || !finite(coordinates[0]) || !finite(coordinates[1])) continue;
    result.push({
      point: [coordinates[0], coordinates[1]],
      properties: (feature.properties ?? {}) as Record<string, unknown>,
    });
  }
  return result;
}

export function parseIcnfWater(body: unknown, extent: Extent): Resource[] {
  return geojsonPoints(body)
    .filter(({ point }) => inside(point, extent))
    .map(({ point, properties }) => ({
      kind: 'water' as const,
      name: text(properties['Nome']) || "Punt d'aigua",
      point,
      source: 'ICNF' as const,
      ...(text(properties['Tipo']) ? { detail: text(properties['Tipo']) } : {}),
    }));
}

export function parseEnaireAerodromes(body: unknown, extent: Extent): Resource[] {
  return geojsonPoints(body)
    .filter(({ point }) => inside(point, extent))
    .map(({ point, properties }) => {
      const name = text(properties['NAME_TXT']),
        icao = text(properties['ICAO_TXT']);
      return {
        kind: 'aerodrome' as const,
        name: [name || 'Aeròdrom', icao && `(${icao})`].filter(Boolean).join(' '),
        point,
        source: 'ENAIRE' as const,
      };
    });
}

/** Stations always; aerodromes only when asked, as the fallback where ENAIRE has none. */
export function parseOverpass(body: unknown, extent: Extent, aerodromes: boolean): Resource[] {
  const elements = (body as { elements?: unknown })?.elements;
  if (!Array.isArray(elements)) throw new Error('Resposta sense elements.');
  const result: Resource[] = [];
  for (const element of elements) {
    const lon = element?.lon ?? element?.center?.lon,
      lat = element?.lat ?? element?.center?.lat;
    if (!finite(lon) || !finite(lat)) continue;
    const point: Point = [lon, lat];
    if (!inside(point, extent)) continue;
    const tags = (element.tags ?? {}) as Record<string, unknown>;
    if (tags['amenity'] === 'fire_station')
      result.push({
        kind: 'station',
        name: text(tags['name']) || 'Parc de bombers',
        point,
        source: 'OSM',
      });
    else if (aerodromes && tags['aeroway'] === 'aerodrome') {
      const icao = text(tags['icao']);
      result.push({
        kind: 'aerodrome',
        name: [text(tags['name']) || 'Aeròdrom', icao && `(${icao})`].filter(Boolean).join(' '),
        point,
        source: 'OSM',
      });
    }
  }
  return result;
}
