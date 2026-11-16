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
 * - **water points**: our own API (§11.45), which serves the official
 *   networks prepared offline —GVA in the Valencian Community, REDIAM in
 *   Andalusia, ICNF in Portugal— in the domain and 30 km around it. The rest
 *   of Spain publishes none openly;
 * - **aerodromes**: ENAIRE's aeronautical database (the AIP's aerodromes and
 *   heliport-aerodromes) in Spain; OpenStreetMap `aeroway=aerodrome` only where
 *   ENAIRE has none in the domain, which is Portugal;
 * - **fire stations**: OpenStreetMap `amenity=fire_station`. No national
 *   official layer was found in either country.
 */
export type ResourceKind = 'station' | 'water' | 'aerodrome';
export type ResourceSource = 'GVA' | 'REDIAM' | 'ICNF' | 'ENAIRE' | 'OSM';

export interface Resource {
  readonly kind: ResourceKind;
  readonly name: string;
  readonly point: Point;
  readonly source: ResourceSource;
  /** The source's type of water point (reservoir, lake, pond…), where it says. */
  readonly detail?: string;
  /** Whether a helicopter / a scooper can load here; null where the source does not say. */
  readonly helicopter?: boolean | null;
  readonly amphibious?: boolean | null;
}

/**
 * A lake or reservoir as an official polygon (§11.44, §11.46): where an
 * aircraft may load water that is not the sea. Outer ring first, then holes,
 * in [lon, lat]; `point` is inside it, to list it as a load place.
 */
export interface Lake {
  readonly name: string | null;
  readonly point: Point;
  readonly rings: readonly (readonly Point[])[];
}

/**
 * Types that are open water large enough to be more than a tank, for the
 * sources that do not say whether a scooper can load (ICNF, REDIAM): the
 * reservoirs, lakes, the ocean and estuaries. GVA says it itself. No minimum
 * size is checked: none was found published (12.26).
 */
export const OPEN_WATER = new Set([
  'Albufeira de barragem',
  'Albufeira de açude',
  'Lago',
  'Oceano',
  'Estuário',
  'EMBALSE',
]);

/**
 * Whether an aircraft can load at a water point: what the source says, and
 * where it says nothing, a helicopter can (every source lists points for
 * aerial or mixed use) and a scooper only on open water.
 */
export function waterFor(aircraft: 'helicopter' | 'amphibious', r: Resource): boolean {
  if (r.kind !== 'water') return false;
  if (aircraft === 'helicopter') return r.helicopter !== false;
  return r.amphibious === true || (r.amphibious == null && OPEN_WATER.has(r.detail ?? ''));
}

/** How far around the domain loading places are looked for (§11.45). */
export const LOAD_MARGIN_M = 30_000;

/** An extent grown by some metres on every side. */
export function widen(extent: Extent, metres: number): Extent {
  const [w, s, e, n] = extent;
  const lat = metres / 111_320;
  const lon = metres / (111_320 * Math.cos((((s + n) / 2) * Math.PI) / 180));
  return [w - lon, s - lat, e + lon, n + lat];
}

/** `[west, south, east, north]`, degrees. */
export type Extent = readonly [number, number, number, number];

/** Water points from the official networks, served by our API (§11.45). */
export const WATER_POINTS_URL = '/api/water-points';
export const ENAIRE_AERODROMES_URL =
  'https://servais.enaire.es/insignia/rest/services/INSIGNIA_SRV/Aero_SRV_VIGOR_V2/FeatureServer/3/query';
/**
 * Stations (and the aerodrome fallback) from OpenStreetMap, through our API:
 * Overpass refuses requests a browser makes (§11.47).
 */
export const OSM_URL = '/api/osm';
/** Standing water of the IGN's hydrography, served by our API (§11.46). */
export const LAKES_URL = '/api/lakes';

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

/** The domain; the API adds the 30 km itself. */
export function waterPointsUrl(extent: Extent): string {
  return `${WATER_POINTS_URL}?bbox=${extent.map((n) => n.toFixed(6)).join(',')}`;
}

/** The domain; the API adds the 30 km itself. */
export function lakesUrl(extent: Extent): string {
  return `${LAKES_URL}?bbox=${extent.map((n) => n.toFixed(6)).join(',')}`;
}

const ring = (value: unknown): Point[] | null =>
  Array.isArray(value) &&
  value.length >= 4 &&
  value.every((p) => Array.isArray(p) && finite(p[0]) && finite(p[1]))
    ? value.map((p) => [p[0], p[1]] as Point)
    : null;

/** The API's lakes; a lake without a valid ring or point is skipped. */
export function parseLakes(body: unknown): Lake[] {
  const lakes = (body as { lakes?: unknown })?.lakes;
  if (!Array.isArray(lakes)) throw new Error('Resposta sense llacs.');
  const result: Lake[] = [];
  for (const lake of lakes) {
    const point = lake?.point;
    if (!Array.isArray(point) || !finite(point[0]) || !finite(point[1])) continue;
    if (!Array.isArray(lake.rings) || !lake.rings.length) continue;
    const rings = lake.rings.map(ring);
    if (!rings.every((r: Point[] | null) => r)) continue;
    result.push({ name: text(lake.name) || null, point: [point[0], point[1]], rings });
  }
  return result;
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

/** The domain's stations and aerodromes from OpenStreetMap, by our API. */
export function osmUrl(extent: Extent): string {
  return `${OSM_URL}?bbox=${extent.map((n) => n.toFixed(6)).join(',')}`;
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

const flag = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null);
const SOURCES = new Set<ResourceSource>(['GVA', 'REDIAM', 'ICNF']);

/** The API's answer (contract in COORDINACIO_NIT/contracte-punts-aigua.md). */
export function parseWaterPoints(body: unknown): Resource[] {
  const points = (body as { points?: unknown })?.points;
  if (!Array.isArray(points)) throw new Error('Resposta sense punts.');
  const result: Resource[] = [];
  for (const p of points) {
    if (!p || !finite(p.lon) || !finite(p.lat) || !SOURCES.has(p.source)) continue;
    result.push({
      kind: 'water',
      name: text(p.name) || "Punt d'aigua",
      point: [p.lon, p.lat],
      source: p.source,
      ...(text(p.type) ? { detail: text(p.type) } : {}),
      helicopter: flag(p.helicopter),
      amphibious: flag(p.amphibious),
    });
  }
  return result;
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
