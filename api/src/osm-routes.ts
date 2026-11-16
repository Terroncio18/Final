import type { FastifyInstance } from "fastify";
import { validateBbox, type WaterBbox } from "./water.js";

export const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
/**
 * Overpass now refuses anonymous clients: curl's default agent gets 406 and a
 * browser's request hangs (checked 16/11/2026), and a page cannot set its own
 * User-Agent. So the stations go through here, under a generic client name —
 * nothing in it identifies a person.
 */
export const OVERPASS_AGENT = "IgnisLab/0.1 (wildfire simulator)";
const TTL_MS = 24 * 60 * 60 * 1000;

/** Stations always; aerodromes too, the fallback where ENAIRE has none (§11.41). */
export function overpassQuery([w, s, e, n]: WaterBbox): string {
  const box = `(${s},${w},${n},${e})`;
  return (
    `[out:json][timeout:25];(nwr["amenity"="fire_station"]${box};` +
    `nwr["aeroway"="aerodrome"]${box};);out center tags;`
  );
}

interface OsmElement {
  readonly type: string;
  readonly lon?: number;
  readonly lat?: number;
  readonly center?: { readonly lon: number; readonly lat: number };
  readonly tags: Record<string, string>;
}

/** Only what the screen reads: position and the four tags it uses. */
export function slimElements(body: unknown): OsmElement[] {
  const elements = (body as { elements?: unknown })?.elements;
  if (!Array.isArray(elements)) throw new Error("Overpass no ha retornat elements.");
  const keep = ["amenity", "aeroway", "name", "icao"];
  return elements.map((element) => {
    const tags: Record<string, string> = {};
    for (const key of keep)
      if (typeof element?.tags?.[key] === "string") tags[key] = element.tags[key];
    return {
      type: String(element?.type),
      ...(typeof element?.lon === "number" ? { lon: element.lon, lat: element.lat } : {}),
      ...(element?.center ? { center: { lon: element.center.lon, lat: element.center.lat } } : {}),
      tags,
    };
  });
}

/**
 * GET /api/osm?bbox=w,s,e,n: fire stations and aerodromes from OpenStreetMap,
 * not official and said so on screen (§11.41). Kept a day per domain: the
 * public service limits its rate, and stations do not move overnight.
 */
export function registerOsmRoutes(
  app: FastifyInstance,
  options: { fetchImpl?: typeof fetch; retryMs?: number } = {},
): void {
  const fetchImpl = options.fetchImpl ?? fetch;
  const retryMs = options.retryMs ?? 3000;
  const cache = new Map<string, { expiresAt: number; data: Promise<OsmElement[]> }>();

  async function fetchOsm(bbox: WaterBbox): Promise<OsmElement[]> {
    const ask = () =>
      fetchImpl(OVERPASS_URL, {
        method: "POST",
        headers: { "user-agent": OVERPASS_AGENT, accept: "application/json" },
        body: new URLSearchParams({ data: overpassQuery(bbox) }),
        signal: AbortSignal.timeout(40000),
      });
    let response = await ask();
    // Too many requests or a busy server: once more, after a pause. A second
    // refusal is the answer.
    if (response.status === 429 || response.status >= 500) {
      await new Promise((done) => setTimeout(done, retryMs));
      response = await ask();
    }
    if (!response.ok) throw new Error(`Overpass ha retornat HTTP ${response.status}.`);
    return slimElements(await response.json());
  }

  async function dataset(bbox: WaterBbox): Promise<OsmElement[]> {
    const key = bbox.map((value) => value.toFixed(3)).join(",");
    let entry = cache.get(key);
    if (entry && entry.expiresAt <= Date.now()) {
      cache.delete(key);
      entry = undefined;
    }
    if (!entry) {
      entry = { expiresAt: Infinity, data: fetchOsm(bbox) };
      cache.set(key, entry);
      if (cache.size > 20) cache.delete(cache.keys().next().value!);
    }
    try {
      const elements = await entry.data;
      if (entry.expiresAt === Infinity) entry.expiresAt = Date.now() + TTL_MS;
      return elements;
    } catch (error) {
      if (cache.get(key) === entry) cache.delete(key);
      throw error;
    }
  }

  app.get<{ Querystring: { bbox?: string } }>("/api/osm", async (request, reply) => {
    let bbox;
    try {
      bbox = validateBbox(request.query.bbox);
    } catch (error) {
      return reply.status(400).send({ error: (error as Error).message });
    }
    try {
      const elements = await dataset(bbox);
      return reply.header("cache-control", "public, max-age=86400").send({ elements });
    } catch (error) {
      request.log.error(error);
      return reply.status(502).send({ error: "OpenStreetMap no ha respost." });
    }
  });
}
