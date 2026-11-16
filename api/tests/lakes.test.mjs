import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import Fastify from "fastify";
import { readStandingWater } from "../dist/lakes.js";
import { registerLakesRoutes } from "../dist/lakes-routes.js";
import { expandBbox, WATER_MARGIN_M } from "../dist/water.js";

const fixture = await readFile(new URL("./fixtures/standing-water.gml", import.meta.url), "utf8");
const square = [[0, 40], [4, 40], [4, 44], [0, 44], [0, 40]];
const hole = [[1, 41], [3, 41], [3, 43], [1, 43], [1, 41]];
const requestUrl = "/api/lakes?bbox=-1.2,39.6,-1,39.8";

function boundary(ring, kind) {
  return `<gml:${kind}><gml:LinearRing><gml:posList>${ring.map(([x, y]) => `${y} ${x}`).join(" ")}</gml:posList></gml:LinearRing></gml:${kind}>`;
}

function polygon(rings = [square]) {
  return `<gml:Polygon>${rings.map((ring, i) => boundary(ring, i ? "interior" : "exterior")).join("")}</gml:Polygon>`;
}

function feature(geometry = polygon(), name = null, id = "lake") {
  return `<wfs:member><hy-p:StandingWater gml:id="${id}">
    ${name === null ? '<hy-p:geographicalName xsi:nil="true"/>' : `<hy-p:geographicalName><gn:GeographicalName><gn:spelling><gn:text>${name}</gn:text></gn:spelling></gn:GeographicalName></hy-p:geographicalName>`}
    <hy-p:geometry>${geometry}</hy-p:geometry></hy-p:StandingWater></wfs:member>`;
}

function collection(features, matched = features.length) {
  return `<wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs/2.0"
    xmlns:hy-p="http://inspire.ec.europa.eu/schemas/hy-p/4.0" xmlns:gml="http://www.opengis.net/gml/3.2"
    xmlns:gn="http://inspire.ec.europa.eu/schemas/gn/4.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    numberMatched="${matched}" numberReturned="${features.length}">${features.join("")}</wfs:FeatureCollection>`;
}

// Winding number provides an independent check of the parser's ray-casting implementation.
function inside([x, y], ring) {
  let winding = 0;
  for (let i = 1; i < ring.length; i++) {
    const [ax, ay] = ring[i - 1], [bx, by] = ring[i];
    const cross = (bx - ax) * (y - ay) - (x - ax) * (by - ay);
    if (cross === 0 && x >= Math.min(ax, bx) && x <= Math.max(ax, bx) &&
      y >= Math.min(ay, by) && y <= Math.max(ay, by)) return null;
    if (ay <= y && by > y && cross > 0) winding++;
    if (ay > y && by <= y && cross < 0) winding--;
  }
  return winding !== 0;
}

function assertInterior(lake) {
  assert.ok(lake.point.every(Number.isFinite));
  assert.ok(inside(lake.point, lake.rings[0]), `${lake.name}: outside exterior`);
  for (const ring of lake.rings.slice(1)) assert.equal(inside(lake.point, ring), false, `${lake.name}: inside or on hole`);
}

function route(t, fetchImpl) {
  const app = Fastify();
  registerLakesRoutes(app, { fetchImpl });
  t.after(() => app.close());
  return app;
}

test("real IGN GML yields 13 lakes, Spanish names, longitude first and interior load points", () => {
  const lakes = readStandingWater(fixture);
  assert.equal(lakes.length, 13);
  assert.ok(lakes.some((lake) => lake.name === "Embalse de Benagéber"));
  assert.ok(lakes.some((lake) => lake.name === "Balsa del Navazo"));
  assert.equal(lakes[0].name, null);
  assert.deepEqual(lakes[0].rings[0][0], [-1.183098, 39.724740]);
  for (const lake of lakes) {
    assertInterior(lake);
    for (const ring of lake.rings) for (const [lon, lat] of ring) {
      assert.ok(lon > -1.3 && lon < -1);
      assert.ok(lat > 39.6 && lat < 39.9);
    }
  }
});

test("uses the centroid when inside, and a scanline midpoint when the centroid is in a hole", () => {
  assert.deepEqual(readStandingWater(collection([feature()]))[0].point, [2, 42]);
  for (const rings of [[square, hole], [square.toReversed(), hole], [square, hole.toReversed()]]) {
    const lake = readStandingWater(collection([feature(polygon(rings))]))[0];
    assertInterior(lake);
    assert.deepEqual(lake.rings, rings);
    assert.deepEqual(lake.point, [0.5, 42]);
  }
});

test("concave lakes and vertex-aligned scanlines still yield strictly interior points", () => {
  const concave = [[0, 40], [4, 40], [4, 44], [3, 44], [3, 41], [1, 41], [1, 44], [0, 44], [0, 40]];
  const lake = readStandingWater(collection([feature(polygon([concave]))]))[0];
  assertInterior(lake);
  const island = [[1, 42], [2, 41], [3, 42], [2, 43], [1, 42]];
  assertInterior(readStandingWater(collection([feature(polygon([square, island]))]))[0]);
});

test("MultiSurface keeps disconnected exteriors separate and preserves member holes and names", () => {
  const other = square.map(([x, y]) => [x + 10, y]);
  const geometry = `<gml:MultiSurface><gml:surfaceMember>${polygon([square, hole])}</gml:surfaceMember>
    <gml:surfaceMember>${polygon([other])}</gml:surfaceMember></gml:MultiSurface>`;
  const lakes = readStandingWater(collection([feature(geometry, "Estany &amp; bassa &#233;")]));
  assert.equal(lakes.length, 2);
  assert.deepEqual(lakes.map((lake) => lake.name), ["Estany & bassa é", "Estany & bassa é"]);
  assert.deepEqual(lakes.map((lake) => lake.rings.length), [2, 1]);
  lakes.forEach(assertInterior);
  assert.equal(readStandingWater(collection([feature(polygon(), "<![CDATA[Bassa & llac]]>")]))[0].name, "Bassa & llac");
});

test("drops missing, unclosed, degenerate or invalid rings without turning holes into exteriors", () => {
  const invalid = [[], square.slice(0, -1), [[0, 40], [1, 40], [2, 40], [0, 40]],
    [[0, 40], [181, 40], [4, 44], [0, 40]], [[0, 40], [NaN, 41], [4, 44], [0, 40]]];
  for (const ring of invalid) {
    assert.deepEqual(readStandingWater(collection([feature(polygon([ring]))])), []);
    assert.deepEqual(readStandingWater(collection([feature(polygon([square, ring]))])), []);
  }
  assert.deepEqual(readStandingWater(collection([feature(""), feature(`<gml:Polygon>${boundary(hole, "interior")}</gml:Polygon>`)])), []);
  assert.deepEqual(readStandingWater(collection([])), []);
  assert.deepEqual(readStandingWater('<wfs:FeatureCollection numberMatched="0" numberReturned="0"/>'), []);
});

test("rejects upstream exception pages, truncated XML and inconsistent counts", () => {
  for (const xml of ["<html>unavailable</html>", '<ows:ExceptionReport/>', fixture.replace("</gml:Polygon>", ""),
    fixture.replace("</wfs:FeatureCollection>", ""), fixture.replace('numberReturned="13"', 'numberReturned="12"')])
    assert.throws(() => readStandingWater(xml));
});

test("HTTP paginates by source feature count, expands lat/lon bbox and shares rounded cache hits", async (t) => {
  const calls = [];
  const rows = Array.from({ length: 501 }, (_, i) => feature(i === 0 ? "" : polygon(), null, `lake-${i}`));
  const app = route(t, async (input, options) => {
    const url = new URL(input);
    calls.push(url);
    assert.ok(options.signal instanceof AbortSignal);
    assert.equal(options.signal.aborted, false);
    assert.equal(url.origin + url.pathname, "https://servicios.idee.es/wfs-inspire/hidrografia");
    assert.equal(url.searchParams.get("service"), "WFS");
    assert.equal(url.searchParams.get("version"), "2.0.0");
    assert.equal(url.searchParams.get("request"), "GetFeature");
    assert.equal(url.searchParams.get("typenames"), "hy-p:StandingWater");
    assert.equal(url.searchParams.get("srsName"), "urn:ogc:def:crs:EPSG::4326");
    assert.equal(url.searchParams.get("count"), "500");
    const [w, s, e, n] = expandBbox([-1.2, 39.6, -1, 39.8], WATER_MARGIN_M);
    assert.equal(url.searchParams.get("bbox"), `${s},${w},${n},${e},urn:ogc:def:crs:EPSG::4326`);
    const start = Number(url.searchParams.get("startIndex"));
    return new Response(collection(rows.slice(start, start + 500), rows.length));
  });
  const responses = await Promise.all([app.inject(requestUrl), app.inject(requestUrl)]);
  for (const response of responses) {
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["cache-control"], "public, max-age=86400");
    assert.equal(response.json().marginM, 30000);
    assert.deepEqual(response.json().source, {
      name: "© Instituto Geográfico Nacional", url: "https://servicios.idee.es/wfs-inspire/hidrografia", licence: "CC BY 4.0",
    });
    assert.equal(response.json().lakes.length, 500);
  }
  assert.deepEqual(calls.map((url) => url.searchParams.get("startIndex")), ["0", "500"]);
  assert.equal((await app.inject("/api/lakes?bbox=-1.2001,39.6001,-1.0001,39.8001")).statusCode, 200);
  assert.equal(calls.length, 2);
});

test("HTTP fixture response is cached and bad bbox never fetches", async (t) => {
  let calls = 0;
  const app = route(t, async () => { calls++; return new Response(fixture); });
  for (const suffix of ["", "?bbox=", "?bbox=NaN,39,0,40", "?bbox=0,40,-1,41", "?bbox=0,39,3,40", "?bbox=0,39,1,40&bbox=0,39,1,40"]) {
    const response = await app.inject(`/api/lakes${suffix}`);
    assert.equal(response.statusCode, 400);
    assert.match(response.json().error, /bbox/);
  }
  assert.equal(calls, 0);
  for (let i = 0; i < 2; i++) {
    const response = await app.inject(requestUrl);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json().lakes, readStandingWater(fixture));
  }
  assert.equal(calls, 1);
});

test("HTTP maps upstream HTTP, network, timeout and invalid XML failures to Catalan 502 and retries", async (t) => {
  let fail;
  let calls = 0;
  const app = route(t, async () => { calls++; return fail ? fail() : new Response(fixture); });
  for (const failure of [
    () => new Response("unavailable", { status: 503 }),
    () => { throw new Error("network failed"); },
    () => { throw new DOMException("timed out", "TimeoutError"); },
    () => new Response("<ows:ExceptionReport/>"),
    () => new Response(fixture.slice(0, -40)),
  ]) {
    fail = failure;
    const response = await app.inject(requestUrl);
    assert.equal(response.statusCode, 502);
    assert.deepEqual(response.json(), { error: "No s'han pogut obtenir els llacs i embassaments d'IDEE." });
    assert.equal(response.headers["cache-control"], undefined);
  }
  fail = null;
  assert.equal((await app.inject(requestUrl)).statusCode, 200);
  assert.equal(calls, 6);
});

test("pagination handles capped pages and unknown totals, rejects early empties and repeated pages", async (t) => {
  for (const matched of [2, "unknown"]) {
    const offsets = [];
    const app = route(t, async (input) => {
      const offset = Number(new URL(input).searchParams.get("startIndex"));
      offsets.push(offset);
      return new Response(collection(offset < 2 ? [feature(polygon(), null, `id-${offset}`)] : [], matched));
    });
    assert.equal((await app.inject(requestUrl)).json().lakes.length, 2);
    assert.deepEqual(offsets, matched === 2 ? [0, 1] : [0, 1, 2]);
  }
  for (const rows of [[], [feature()]]) {
    const app = route(t, async () => new Response(collection(rows, 2)));
    assert.equal((await app.inject(requestUrl)).statusCode, 502);
  }
});

test("pagination stops after 5000 source features even when more match", async (t) => {
  let calls = 0;
  const app = route(t, async (input) => {
    calls++;
    const offset = Number(new URL(input).searchParams.get("startIndex"));
    return new Response(collection(Array.from({ length: 500 }, (_, i) => feature(polygon(), null, `lake-${offset + i}`)), 6000));
  });
  const response = await app.inject(requestUrl);
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().lakes.length, 5000);
  assert.equal(calls, 10);
});

test("cache expires after 24 hours and retains at most 20 recently used bboxes", async (t) => {
  let now = Date.now(), calls = 0;
  t.mock.method(Date, "now", () => now);
  const app = route(t, async () => { calls++; return new Response(collection([])); });
  await app.inject(requestUrl);
  now += 86400000 - 1;
  await app.inject(requestUrl);
  assert.equal(calls, 1);
  now++;
  await app.inject(requestUrl);
  assert.equal(calls, 2);
  for (let i = 0; i < 20; i++)
    assert.equal((await app.inject(`/api/lakes?bbox=${i},39,${i + 0.1},39.1`)).statusCode, 200);
  assert.equal(calls, 22);
  await app.inject(requestUrl);
  assert.equal(calls, 23);
});
