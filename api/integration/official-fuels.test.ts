import { test, expect } from "vitest";
import Fastify from "fastify";
import { writeFile, mkdir } from "node:fs/promises";
import { registerFuelRoutes } from "../src/fuel-routes.js";
import { decodeFuels } from "../../web/src/app/simulation/fuel-data";
import { domainAround, GRID } from "../../web/src/app/simulation/domain";
import { spread } from "../../web/src/app/simulation/fire-spread";
import { FUEL_MODELS, fuelBed } from "../../web/src/app/simulation/rothermel";

test("official archives → API → map decoder → fire engine, at the actual 1024-cell domain size", async () => {
  const app = Fastify();
  registerFuelRoutes(app);
  const records = [];
  const locations: [string, [number, number], string | null][] = [
    ["Asturias (Somiedo)", [-6.25, 43.1], "CETEMAS"],
    ["Tenerife", [-16.45, 28.36], "Tenerife"],
    ["Gran Canaria", [-15.6, 27.96], "Gran Canaria"],
    ["La Palma", [-17.85, 28.71], "La Palma"],
    ["La Gomera", [-17.24, 28.12], "La Gomera"],
    ["El Hierro", [-18, 27.73], "El Hierro"],
    ["Valencia (Serra)", [-0.5, 39.68], "PATFOR"],
    ["Navarra (Irati)", [-1.1, 42.98], "SITNA"],
    ["Mallorca (Sóller)", [2.72, 39.75], "IDEIB"],
    ["Madrid (control)", [-3.7, 40.42], null],
    ["Portugal (control)", [-8.25, 39.62], null],
    ["Lanzarote (control)", [-13.6, 29.02], null],
  ];
  try {
    for (const [label, centre, expectedSource] of locations) {
      const bounds = domainAround(centre);
      const start = performance.now();
      const url = `/api/fuels?bbox=${bounds.join(",")}&size=${GRID}`;
      const answer = await app.inject(url);
      expect(answer.statusCode, label).toBe(200);
      const grid = decodeFuels(answer.json(), bounds, GRID);
      expect(grid.unknownCells, `${label}: ${grid.warnings.join("; ")}`).toBe(
        0,
      );
      expect(grid.officialCells + grid.estimatedCells).toBe(GRID * GRID);
      if (expectedSource) {
        expect(grid.officialCells, label).toBeGreaterThan(0);
        expect(
          grid.sources.some((source) => source.label.includes(expectedSource)),
          label,
        ).toBe(true);
      } else expect(grid.officialCells, label).toBe(0);
      const elapsedMs = Math.round(performance.now() - start);
      const cacheStart = performance.now();
      expect((await app.inject(url)).json().runs).toEqual(answer.json().runs);
      const cacheMs = Math.round(performance.now() - cacheStart);
      const beds = Object.fromEntries(
        Object.entries(FUEL_MODELS).map(([id, model]) => [
          id,
          {
            bed: fuelBed(model, {
              dead1: 0.08,
              dead10: 0.08,
              dead100: 0.08,
              live: 1,
            }),
            midflame: 0,
          },
        ]),
      );
      const ignition = grid.models.findIndex(
        (model, i) =>
          model > 0 &&
          model < 14 &&
          (!expectedSource || grid.quality[i] === 1) &&
          i > (GRID * GRID) / 3,
      );
      expect(ignition, label).toBeGreaterThanOrEqual(0);
      const fire = await spread({
        elevation: new Float32Array(GRID * GRID).fill(100),
        fuels: grid.models,
        fuelBeds: beds,
        bed: beds[grid.models[ignition]!]!.bed,
        midflame: 0,
        towardsDeg: 0,
        ignitions: [ignition],
        horizon: 30,
      });
      expect(fire.arrival[ignition]).toBe(0);
      for (let i = 0; i < grid.models.length; i++) {
        if (grid.models[i] === 0 && Number.isFinite(fire.arrival[i]))
          throw new Error(`${label}: non-burnable cell reached`);
      }
      const record = {
        label,
        centre,
        bounds,
        size: GRID,
        officialCells: grid.officialCells,
        estimatedCells: grid.estimatedCells,
        unknownCells: grid.unknownCells,
        officialPercent: +((100 * grid.officialCells) / (GRID * GRID)).toFixed(
          2,
        ),
        elapsedMs,
        cacheMs,
        sources: grid.sources,
        warnings: grid.warnings,
      };
      records.push(record);
      console.log(
        JSON.stringify({
          label,
          officialPercent: record.officialPercent,
          unknown: grid.unknownCells,
          elapsedMs,
          cacheMs,
        }),
      );
    }
    await mkdir("data/fuels", { recursive: true });
    await writeFile(
      "data/fuels/verification.json",
      JSON.stringify({ checkedAt: new Date().toISOString(), records }, null, 2),
    );
  } finally {
    await app.close();
  }
});
