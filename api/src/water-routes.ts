import { readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { FastifyInstance } from "fastify";
import {
  WATER_MARGIN_M,
  expandBbox,
  pointsWithin,
  validateBbox,
  type WaterData,
  type WaterPointsResponse,
} from "./water.js";

export function registerWaterRoutes(
  app: FastifyInstance,
  options: { dataDir?: string } = {},
): void {
  const path = join(resolve(options.dataDir ?? process.env.WATER_DATA_DIR ?? "data/water"), "points.json");
  let cached: { mtimeMs: number; size: number; data: Promise<WaterData> } | undefined;

  async function dataset(): Promise<WaterData> {
    const { mtimeMs, size } = await stat(path);
    if (!cached || cached.mtimeMs !== mtimeMs || cached.size !== size) {
      // Share the read between simultaneous requests, including the first after an atomic replacement.
      const data = readFile(path, "utf8").then((raw) => {
        const parsed = JSON.parse(raw) as WaterData;
        if (!parsed || typeof parsed.preparedAt !== "string" ||
          !Number.isFinite(Date.parse(parsed.preparedAt)) ||
          !Array.isArray(parsed.sources) || !Array.isArray(parsed.points))
          throw new Error("El fitxer de punts d'aigua no té el format esperat.");
        return parsed;
      });
      cached = { mtimeMs, size, data };
    }
    const current = cached;
    try {
      return await current.data;
    } catch (error) {
      if (cached === current) cached = undefined;
      throw error;
    }
  }

  app.get<{ Querystring: { bbox?: string } }>(
    "/api/water-points",
    async (request, reply) => {
      let bbox;
      try {
        bbox = validateBbox(request.query.bbox);
      } catch (error) {
        return reply.status(400).send({ error: (error as Error).message });
      }
      try {
        const data = await dataset();
        const result: WaterPointsResponse = {
          preparedAt: data.preparedAt,
          marginM: WATER_MARGIN_M,
          sources: data.sources,
          points: pointsWithin(data.points, expandBbox(bbox, WATER_MARGIN_M)),
        };
        return reply.header("cache-control", "public, max-age=3600").send(result);
      } catch (error) {
        request.log.error(error);
        return reply.status(503).send({ error: "Els punts d'aigua no estan preparats." });
      }
    },
  );
}
