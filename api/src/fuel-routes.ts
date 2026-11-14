import type { FastifyInstance } from "fastify";
import { validateGrid } from "./fuel-grid.js";
import { fuelGrid } from "./fuels.js";

export function registerFuelRoutes(app: FastifyInstance): void {
  app.get<{ Querystring: { bbox?: string; size?: string } }>(
    "/api/fuels",
    async (request, reply) => {
      let grid;
      try {
        grid = validateGrid(request.query.bbox, request.query.size);
      } catch (error) {
        return reply.status(400).send({ error: (error as Error).message });
      }
      try {
        const result = await fuelGrid(grid.bounds, grid.size);
        reply.header(
          "cache-control",
          result.warnings.length || result.unknownCells
            ? "no-store"
            : "public, max-age=3600",
        );
        return result;
      } catch (error) {
        request.log.error(error);
        if ((error as Error).message === "FUEL_BUSY")
          return reply
            .header("retry-after", "15")
            .status(503)
            .send({ error: "Preparant altres dominis. Torna-ho a provar." });
        return reply
          .status(502)
          .send({ error: "No es pot llegir la cartografia de combustible." });
      }
    },
  );
}
