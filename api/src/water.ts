export const WATER_MARGIN_M = 30000;
const METRES_PER_DEGREE = 111320;

export type WaterBbox = readonly [number, number, number, number];
export type WaterSourceId = "GVA" | "REDIAM" | "ICNF";

export interface WaterSource {
  readonly id: WaterSourceId;
  readonly name: string;
  readonly url: string;
  readonly licence: string;
  readonly count: number;
}

export interface WaterPoint {
  readonly source: WaterSourceId;
  readonly id: string;
  readonly name: string;
  readonly lon: number;
  readonly lat: number;
  readonly type: string | null;
  readonly helicopter: boolean | null;
  readonly amphibious: boolean | null;
}

export interface WaterData {
  readonly preparedAt: string;
  readonly sources: readonly WaterSource[];
  readonly points: readonly WaterPoint[];
}

export interface WaterPointsResponse extends WaterData {
  readonly marginM: number;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Les dades de punts d'aigua no tenen el format esperat.");
  return value as Record<string, unknown>;
}

function text(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  return String(value).trim() || null;
}

function code(value: unknown): string {
  const id = text(value);
  if (!id) throw new Error("Hi ha un punt d'aigua sense codi.");
  return id;
}

function coordinates(value: unknown): [number, number] {
  if (
    !Array.isArray(value) ||
    typeof value[0] !== "number" ||
    typeof value[1] !== "number" ||
    !Number.isFinite(value[0]) ||
    !Number.isFinite(value[1]) ||
    Math.abs(value[0]) > 180 ||
    Math.abs(value[1]) > 90
  )
    throw new Error("Hi ha un punt d'aigua amb coordenades invàlides.");
  return [value[0], value[1]];
}

function features(json: unknown): Record<string, unknown>[] {
  const collection = record(json);
  if (collection.type !== "FeatureCollection" || !Array.isArray(collection.features))
    throw new Error("S'esperava una col·lecció GeoJSON de punts d'aigua.");
  return collection.features.map(record);
}

function pointCoordinates(feature: Record<string, unknown>): [number, number] {
  const geometry = record(feature.geometry);
  if (geometry.type !== "Point")
    throw new Error("La geometria del punt d'aigua no és un punt.");
  return coordinates(geometry.coordinates);
}

function yesNo(value: unknown): boolean | null {
  return value === "Sí" ? true : value === "No" ? false : null;
}

export function readGva(json: unknown): WaterPoint[] {
  return features(json).map((feature) => {
    const p = record(feature.properties);
    const id = code(p.codigo);
    const [lon, lat] = pointCoordinates(feature);
    return {
      source: "GVA",
      id,
      name: text(p.etiqueta) ?? id,
      lon,
      lat,
      type: text(p.tipo),
      helicopter: yesNo(p.helicop),
      amphibious: yesNo(p.anfibios),
    };
  });
}

function xmlText(value: string): string {
  if (value.trim().startsWith("<![CDATA["))
    return value.trim().replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, "$1");
  const entities: Record<string, string> = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
  };
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, entity: string) => {
    if (!entity.startsWith("#")) return entities[entity]!;
    const hex = entity.startsWith("#x");
    return String.fromCodePoint(parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10));
  });
}

function tag(body: string, name: string): string | null {
  const match = body.match(
    new RegExp(`<(?:[\\w.-]+:)?${name}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${name}\\s*>`),
  );
  return match ? text(xmlText(match[1]!)) : null;
}

export function readRediamGml(gml: string): WaterPoint[] {
  // MapServer has a fixed GML envelope; reject exception pages instead of publishing an empty source.
  if (
    !/<(?:[\w.-]+:)?msGMLOutput\b[^>]*(?:\/>|>[\s\S]*<\/(?:[\w.-]+:)?msGMLOutput\s*>)/.test(gml) ||
    /<(?:[\w.-]+:)?(?:ServiceException|ExceptionReport)\b/.test(gml)
  )
    throw new Error("REDIAM no ha retornat el GML de punts d'aigua esperat.");
  const points = new Map<string, WaterPoint>();
  const matches = [...gml.matchAll(
    /<(?:[\w.-]+:)?puntos_agua_feature\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?puntos_agua_feature\s*>/g,
  )];
  if (matches.length !== [...gml.matchAll(/<(?:[\w.-]+:)?puntos_agua_feature\b/g)].length)
    throw new Error("El GML de REDIAM és incomplet.");
  for (const match of matches) {
    const body = match[1]!;
    const id = code(tag(body, "CODIGO"));
    const raw = tag(body, "coordinates")?.split(/\s+/)[0]?.split(",");
    const [lon, lat] = coordinates(
      raw?.map((part) => part.trim() ? Number(part) : NaN),
    );
    // Adjacent GetFeatureInfo tiles overlap, so a source code identifies one point.
    if (!points.has(id)) points.set(id, {
      source: "REDIAM", id, name: id, lon, lat,
      type: tag(body, "TIPO"), helicopter: null, amphibious: null,
    });
  }
  return [...points.values()];
}

const ICNF_EXCLUDED = new Set([
  "Ruptura", "Falta de água", "Em planeamento", "Em proposta",
]);

export function readIcnf(json: unknown): WaterPoint[] {
  const points: WaterPoint[] = [];
  for (const feature of features(json)) {
    const p = record(feature.properties);
    if (
      (p.Classe !== "Aéreo" && p.Classe !== "Misto") ||
      ICNF_EXCLUDED.has(String(p.Operacionalidade))
    ) continue;
    // ICNF repeats a Codigo for different points (73 codes, 93 points in
    // November 2026), so the service's own ID keys the point and the code
    // stays its name.
    const codigo = code(p.Codigo);
    const id = p.ID !== undefined && p.ID !== null ? code(p.ID) : codigo;
    const [lon, lat] = pointCoordinates(feature);
    points.push({
      source: "ICNF", id, name: text(p.Nome) ?? codigo, lon, lat,
      type: text(p.Tipo), helicopter: true, amphibious: null,
    });
  }
  return points;
}

export function validateBbox(value: unknown): WaterBbox {
  if (typeof value !== "string" || !value.trim())
    throw new Error("Cal indicar bbox=west,south,east,north.");
  const parts = value.split(",");
  if (parts.length !== 4 || parts.some((p) => !p.trim() || !Number.isFinite(Number(p))))
    throw new Error("El bbox ha de contenir quatre coordenades finites.");
  const [w, s, e, n] = parts.map(Number) as [number, number, number, number];
  if (Math.abs(w) > 180 || Math.abs(e) > 180 || Math.abs(s) > 90 || Math.abs(n) > 90)
    throw new Error("Les coordenades del bbox són fora del rang WGS84.");
  if (w >= e || s >= n)
    throw new Error("El bbox ha de complir west < east i south < north.");
  if (e - w > 2 || n - s > 2)
    throw new Error("Cada costat del bbox ha de ser de 2° com a màxim.");
  return [w, s, e, n];
}

export function expandBbox(bbox: WaterBbox, marginM: number): WaterBbox {
  if (!Number.isFinite(marginM) || marginM < 0)
    throw new Error("El marge ha de ser una distància finita no negativa.");
  const [w, s, e, n] = bbox;
  const dy = marginM / METRES_PER_DEGREE;
  const dx = dy / Math.cos((((s + n) / 2) * Math.PI) / 180);
  // Keep unwrapped longitudes so filtering can include points across the date line.
  return [w - dx, Math.max(-90, s - dy), e + dx, Math.min(90, n + dy)];
}

export function pointsWithin(points: readonly WaterPoint[], bbox: WaterBbox): WaterPoint[] {
  const [w, s, e, n] = bbox;
  return points.filter(({ lon, lat }) =>
    lat >= s && lat <= n &&
    [lon, lon - 360, lon + 360].some((x) => x >= w && x <= e),
  );
}
