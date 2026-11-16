type Point = [number, number];

export interface Lake {
  name: string | null;
  point: Point;
  rings: Point[][];
}

function elements(xml: string, name: string): { attributes: string; body: string }[] {
  return [...xml.matchAll(new RegExp(
    `<(?:[\\w.-]+:)?${name}\\b([^>]*?)(?:\\/>|>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${name}\\s*>)`, "g",
  ))].map((match) => ({ attributes: match[1]!, body: match[2] ?? "" }));
}

function attribute(attributes: string, name: string): string | undefined {
  return attributes.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(["'])(.*?)\\1`))?.[2];
}

function xmlText(value: string): string {
  const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>|&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/g,
    (_, cdata: string | undefined, entity: string) => {
      if (cdata !== undefined) return cdata;
      if (!entity.startsWith("#")) return entities[entity]!;
      const hex = entity.startsWith("#x");
      const code = parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      if (code > 0x10ffff) throw new Error("El GML dels llacs conté un caràcter invàlid.");
      return String.fromCodePoint(code);
    }).trim();
}

function ringMass(ring: Point[]): { area: number; centre: Point } {
  // Translate before multiplying to retain precision for small ponds in WGS84.
  const [ox, oy] = ring[0]!;
  let twiceArea = 0, x = 0, y = 0;
  for (let i = 1; i < ring.length; i++) {
    const a = ring[i - 1]!, b = ring[i]!;
    const ax = a[0] - ox, ay = a[1] - oy, bx = b[0] - ox, by = b[1] - oy;
    const cross = ax * by - bx * ay;
    twiceArea += cross;
    x += (ax + bx) * cross;
    y += (ay + by) * cross;
  }
  return { area: Math.abs(twiceArea / 2), centre: [ox + x / (3 * twiceArea), oy + y / (3 * twiceArea)] };
}

function readRing(xml: string): Point[] | null {
  const linear = elements(xml, "LinearRing");
  if (linear.length !== 1) return null;
  const lists = elements(linear[0]!.body, "posList");
  if (lists.length !== 1 || !lists[0]!.body.trim()) return null;
  const dimension = attribute(lists[0]!.attributes, "srsDimension");
  if (dimension !== undefined && dimension !== "2") return null;
  const values = lists[0]!.body.trim().split(/\s+/).map(Number);
  if (values.length < 8 || values.length % 2 || values.some((v) => !Number.isFinite(v))) return null;
  const ring: Point[] = [];
  for (let i = 0; i < values.length; i += 2) {
    const lat = values[i]!, lon = values[i + 1]!;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    ring.push([lon, lat]);
  }
  const first = ring[0]!, last = ring.at(-1)!;
  if (first[0] !== last[0] || first[1] !== last[1] || ringMass(ring).area === 0) return null;
  return ring;
}

function ringLocation([x, y]: Point, ring: Point[]): "inside" | "outside" | "boundary" {
  let inside = false;
  for (let i = 1; i < ring.length; i++) {
    const [ax, ay] = ring[i - 1]!, [bx, by] = ring[i]!;
    if ((x - ax) * (by - ay) === (y - ay) * (bx - ax) &&
      x >= Math.min(ax, bx) && x <= Math.max(ax, bx) &&
      y >= Math.min(ay, by) && y <= Math.max(ay, by)) return "boundary";
    if ((ay > y) !== (by > y) && x < ax + (y - ay) * (bx - ax) / (by - ay)) inside = !inside;
  }
  return inside ? "inside" : "outside";
}

function isInside(point: Point, rings: Point[][]): boolean {
  return ringLocation(point, rings[0]!) === "inside" &&
    rings.slice(1).every((ring) => ringLocation(point, ring) === "outside");
}

function interiorPoint(rings: Point[][]): Point | null {
  const masses = rings.map(ringMass);
  let area = 0, x = 0, y = 0;
  for (let i = 0; i < masses.length; i++) {
    const mass = masses[i]!, weight = mass.area * (i === 0 ? 1 : -1);
    area += weight;
    x += mass.centre[0] * weight;
    y += mass.centre[1] * weight;
  }
  const centroid: Point = [x / area, y / area];
  if (area > 0 && isInside(centroid, rings)) return centroid;

  function scanline(lat: number): Point | null {
    const crossings: number[] = [];
    for (const ring of rings) for (let i = 1; i < ring.length; i++) {
      const a = ring[i - 1]!, b = ring[i]!;
      if ((a[1] > lat) !== (b[1] > lat))
        crossings.push(a[0] + (lat - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
    }
    crossings.sort((a, b) => a - b);
    let best: Point | null = null, width = 0;
    for (let i = 1; i < crossings.length; i++) {
      const left = crossings[i - 1]!, right = crossings[i]!;
      const point: Point = [(left + right) / 2, lat];
      if (right - left > width && isInside(point, rings)) {
        width = right - left;
        best = point;
      }
    }
    return best;
  }

  const candidate = Number.isFinite(centroid[1]) ? scanline(centroid[1]) : null;
  if (candidate) return candidate;
  // Between vertex latitudes the topology is constant, avoiding horizontal edges and pinched vertices.
  const latitudes = [...new Set(rings.flatMap((ring) => ring.map((p) => p[1])))].sort((a, b) => a - b);
  for (let i = 1; i < latitudes.length; i++) {
    const point = scanline((latitudes[i - 1]! + latitudes[i]!) / 2);
    if (point) return point;
  }
  return null;
}

export function readStandingWaterPage(gml: string): {
  lakes: Lake[]; numberMatched: number | null; numberReturned: number; signature: string;
} {
  // Reject truncated XML and exception pages instead of caching them as an empty lake catalogue.
  const stack: string[] = [];
  const xml = gml.replace(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>/g, "");
  for (const match of xml.matchAll(/<(\/?)([\w.:-]+)\b[^>]*?(\/?)>/g)) {
    if (match[1]) {
      if (stack.pop() !== match[2]) throw new Error("El GML dels llacs és incomplet.");
    } else if (!match[3]) stack.push(match[2]!);
  }
  const collections = elements(gml, "FeatureCollection");
  if (stack.length || collections.length !== 1 || /<(?:[\w.-]+:)?(?:ExceptionReport|ServiceException)\b/.test(xml))
    throw new Error("IDEE no ha retornat el GML de llacs esperat.");
  const collection = collections[0]!;
  const features = elements(collection.body, "StandingWater");
  const matched = attribute(collection.attributes, "numberMatched");
  const returned = attribute(collection.attributes, "numberReturned");
  if ((matched !== undefined && matched !== "unknown" && !/^\d+$/.test(matched)) ||
    (returned !== undefined && (!/^\d+$/.test(returned) || Number(returned) !== features.length)))
    throw new Error("El recompte de llacs d'IDEE no és vàlid.");
  const numberMatched = matched === undefined || matched === "unknown" ? null : Number(matched);
  if (numberMatched !== null && (!Number.isSafeInteger(numberMatched) || numberMatched < features.length))
    throw new Error("El recompte de llacs d'IDEE no és vàlid.");
  const lakes: Lake[] = [];
  for (const feature of features) {
    const geographicalName = elements(feature.body, "geographicalName")[0]?.body ?? "";
    const name = xmlText(elements(geographicalName, "text")[0]?.body ?? "") || null;
    for (const geometry of elements(feature.body, "geometry")) {
      // Lake has one exterior, so disconnected MultiSurface members become separate load places.
      for (const polygon of elements(geometry.body, "Polygon")) {
        const exteriors = elements(polygon.body, "exterior");
        if (exteriors.length !== 1) continue;
        const boundaries = [exteriors[0]!, ...elements(polygon.body, "interior")];
        const parsed = boundaries.map((boundary) => readRing(boundary.body));
        // Losing an invalid hole could place an aircraft on an island; discard that polygon instead.
        if (parsed.some((ring) => ring === null)) continue;
        const rings = parsed as Point[][];
        const point = interiorPoint(rings);
        if (point) lakes.push({ name, point, rings });
      }
    }
  }
  return { lakes, numberMatched, numberReturned: features.length,
    signature: features.map((feature) => feature.attributes + feature.body).join("") };
}

export function readStandingWater(gml: string): Lake[] {
  return readStandingWaterPage(gml).lakes;
}
