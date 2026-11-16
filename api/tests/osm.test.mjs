import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { OVERPASS_AGENT, overpassQuery, registerOsmRoutes, slimElements } from "../dist/osm-routes.js";

const BBOX = "2.55,39.62,2.87,39.9";
const answer = {
  elements: [
    { type: "way", center: { lon: 2.7, lat: 39.78 }, tags: { amenity: "fire_station", name: "Parc", building: "yes" } },
    { type: "node", lon: 2.73, lat: 39.55, tags: { aeroway: "aerodrome", icao: "LEPA", other: "x" } },
  ],
};

test("asks Overpass south, west, north, east, for stations and aerodromes", () => {
  const q = overpassQuery([2.55, 39.62, 2.87, 39.9]);
  assert.match(q, /\["amenity"="fire_station"\]\(39\.62,2\.55,39\.9,2\.87\)/);
  assert.match(q, /\["aeroway"="aerodrome"\]/);
});

test("keeps only position and the tags the screen reads", () => {
  assert.deepEqual(slimElements(answer)[0], {
    type: "way", center: { lon: 2.7, lat: 39.78 }, tags: { amenity: "fire_station", name: "Parc" },
  });
  assert.deepEqual(slimElements(answer)[1].tags, { aeroway: "aerodrome", icao: "LEPA" });
  assert.throws(() => slimElements({ remark: "timeout" }));
});

test("the route names its client, caches a day and reports failures", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push(init);
    return new Response(JSON.stringify(answer), { status: 200 });
  };
  const app = Fastify();
  registerOsmRoutes(app, { fetchImpl });
  const first = await app.inject({ url: `/api/osm?bbox=${BBOX}` });
  assert.equal(first.statusCode, 200);
  assert.equal(first.json().elements.length, 2);
  assert.equal(calls[0].headers["user-agent"], OVERPASS_AGENT);
  await app.inject({ url: `/api/osm?bbox=${BBOX}` });
  assert.equal(calls.length, 1);
  assert.equal((await app.inject({ url: "/api/osm?bbox=x" })).statusCode, 400);

  const failing = Fastify();
  registerOsmRoutes(failing, { fetchImpl: async () => new Response("", { status: 406 }) });
  const failed = await failing.inject({ url: `/api/osm?bbox=${BBOX}` });
  assert.equal(failed.statusCode, 502);
});

test("a busy Overpass is asked once more, and only once", async () => {
  const statuses = [429, 200];
  let calls = 0;
  const app = Fastify();
  registerOsmRoutes(app, {
    retryMs: 0,
    fetchImpl: async () => {
      const status = statuses[calls++];
      return new Response(status === 200 ? JSON.stringify(answer) : "", { status });
    },
  });
  assert.equal((await app.inject({ url: `/api/osm?bbox=${BBOX}` })).statusCode, 200);
  assert.equal(calls, 2);
  let again = 0;
  const busy = Fastify();
  registerOsmRoutes(busy, { retryMs: 0, fetchImpl: async () => (again++, new Response("", { status: 504 })) });
  assert.equal((await busy.inject({ url: `/api/osm?bbox=${BBOX}` })).statusCode, 502);
  assert.equal(again, 2);
});
