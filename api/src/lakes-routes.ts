import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { readStandingWaterPage, type Lake } from "./lakes.js";
import { WATER_MARGIN_M, expandBbox, validateBbox, type WaterBbox } from "./water.js";

const SOURCE = {
  name: "© Instituto Geográfico Nacional",
  url: "https://servicios.idee.es/wfs-inspire/hidrografia",
  licence: "CC BY 4.0",
} as const;
const TTL_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 500;
const MAX_FEATURES = 5000;

export function registerLakesRoutes(
  app: FastifyInstance,
  options: { fetchImpl?: typeof fetch } = {},
): void {
  const fetchImpl = options.fetchImpl ?? fetch;
  const cache = new Map<string, { expiresAt: number; data: Promise<Lake[]> }>();

  async function fetchLakes(bbox: WaterBbox): Promise<Lake[]> {
    const [w, s, e, n] = expandBbox(bbox, WATER_MARGIN_M);
    // One deadline covers the entire pagination, including reading each response body.
    const signal = AbortSignal.timeout(30000);
    const lakes: Lake[] = [];
    const pages = new Set<string>();
    let startIndex = 0;
    while (startIndex < MAX_FEATURES) {
      const url = new URL(SOURCE.url);
      url.search = new URLSearchParams({
        service: "WFS", version: "2.0.0", request: "GetFeature", typenames: "hy-p:StandingWater",
        srsName: "urn:ogc:def:crs:EPSG::4326",
        bbox: `${s},${w},${n},${e},urn:ogc:def:crs:EPSG::4326`,
        count: String(Math.min(PAGE_SIZE, MAX_FEATURES - startIndex)), startIndex: String(startIndex),
      }).toString();
      const response = await fetchImpl(url, { signal });
      if (!response.ok) throw new Error(`IDEE ha retornat HTTP ${response.status}.`);
      const page = readStandingWaterPage(await response.text());
      if (page.numberReturned > Math.min(PAGE_SIZE, MAX_FEATURES - startIndex))
        throw new Error("IDEE ha retornat massa llacs en una pàgina.");
      if (!page.numberReturned) {
        if (page.numberMatched !== null && startIndex < page.numberMatched)
          throw new Error("La resposta de llacs d'IDEE és incompleta.");
        break;
      }
      const signature = createHash("sha256").update(page.signature).digest("hex");
      if (pages.has(signature)) throw new Error("IDEE repeteix una pàgina de llacs.");
      pages.add(signature);
      lakes.push(...page.lakes);
      // Count source features, since invalid geometries and MultiSurfaces change the number of lakes.
      startIndex += page.numberReturned;
      if (page.numberMatched !== null && startIndex >= page.numberMatched) break;
    }
    return lakes;
  }

  async function dataset(bbox: WaterBbox): Promise<Lake[]> {
    const key = bbox.map((value) => value.toFixed(3)).join(",");
    let entry = cache.get(key);
    if (entry && entry.expiresAt <= Date.now()) {
      cache.delete(key);
      entry = undefined;
    }
    if (!entry) {
      entry = { expiresAt: Infinity, data: fetchLakes(bbox) };
      cache.set(key, entry);
      if (cache.size > 20) cache.delete(cache.keys().next().value!);
    } else {
      cache.delete(key);
      cache.set(key, entry);
    }
    try {
      // Share in-flight requests and start the 24 hours only once the full dataset is available.
      const lakes = await entry.data;
      if (entry.expiresAt === Infinity) entry.expiresAt = Date.now() + TTL_MS;
      return lakes;
    } catch (error) {
      if (cache.get(key) === entry) cache.delete(key);
      throw error;
    }
  }

  app.get<{ Querystring: { bbox?: string } }>("/api/lakes", async (request, reply) => {
    let bbox;
    try {
      bbox = validateBbox(request.query.bbox);
    } catch (error) {
      return reply.status(400).send({ error: (error as Error).message });
    }
    try {
      const lakes = await dataset(bbox);
      return reply.header("cache-control", "public, max-age=86400").send({
        source: SOURCE, marginM: WATER_MARGIN_M, lakes,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(502).send({ error: "No s'han pogut obtenir els llacs i embassaments d'IDEE." });
    }
  });
}
