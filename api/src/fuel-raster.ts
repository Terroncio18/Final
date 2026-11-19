import { fromFile } from "geotiff";
import proj4 from "proj4";
import {
  tileBounds,
  tileKeys,
  TILE_SIZE,
  UNKNOWN,
  type Bounds,
} from "./fuel-grid.js";

/** Only classified, north-up, single-band NFFL rasters. Never rendered WMS RGB. */
export async function prepareFuelRaster(
  input: string,
  save: (key: string, values: Uint8Array) => void | Promise<void>,
  crs?: string,
  excludedValues: readonly number[] = [],
) {
  if (!excludedValues.every(Number.isFinite))
    throw new Error("Invalid excluded raster codes.");
  for (const zone of [28, 29, 30, 31]) {
    proj4.defs(
      `EPSG:326${zone}`,
      `+proj=utm +zone=${zone} +datum=WGS84 +units=m +no_defs`,
    );
    proj4.defs(
      `EPSG:258${zone}`,
      `+proj=utm +zone=${zone} +ellps=GRS80 +units=m +no_defs`,
    );
  }
  const tiff = await fromFile(input);
  try {
    const image = await tiff.getImage();
    const keys = image.getGeoKeys();
    const code = keys?.ProjectedCSTypeGeoKey ?? keys?.GeographicTypeGeoKey;
    if (!crs && (!code || code === 32767))
      throw new Error("Raster needs a known CRS or --crs.");
    const projection = proj4("EPSG:4326", crs ?? `EPSG:${code}`);
    const [ox, oy] = image.getOrigin();
    const [rx, ry] = image.getResolution();
    if (
      image.getSamplesPerPixel() !== 1 ||
      image.fileDirectory.getValue("ModelTransformation") ||
      ![ox, oy, rx, ry].every(Number.isFinite) ||
      rx! <= 0 ||
      ry! >= 0 ||
      keys?.GTRasterTypeGeoKey !== 1
    ) {
      throw new Error(
        "Expected a north-up, pixel-area, single-band categorical GeoTIFF.",
      );
    }
    const width = image.getWidth(),
      height = image.getHeight();
    if (width * height > 100_000_000)
      throw new Error("Raster too large; split it before importing.");
    const raw = await image.readRasters({ samples: [0], interleave: true });
    const noData = image.getGDALNoData();
    const values = new Uint8Array(width * height).fill(UNKNOWN);
    let assigned = 0,
      missing = 0;
    for (let i = 0; i < values.length; i++) {
      const value = Number(raw[i]);
      // Source 0 means 'sin modelo', not a fire barrier. NoData is checked first.
      if (
        value === noData ||
        excludedValues.includes(value) ||
        (Number.isNaN(value) && Number.isNaN(noData)) ||
        value === 0
      ) {
        missing++;
      } else if (Number.isInteger(value) && value >= 1 && value <= 13) {
        values[i] = value;
        assigned++;
      } else {
        throw new Error(
          `Unsupported NFFL raster code ${value}; verify the source classification.`,
        );
      }
    }
    const [w, s, e, n] = image.getBoundingBox();
    // Densify all edges: a projected rectangle does not have straight geographic edges.
    const edge: number[][] = [];
    for (let i = 0; i <= 64; i++) {
      const x = w! + ((e! - w!) * i) / 64,
        y = s! + ((n! - s!) * i) / 64;
      for (const p of [
        [x, s!],
        [x, n!],
        [w!, y],
        [e!, y],
      ])
        edge.push(projection.inverse(p));
    }
    const bounds: Bounds = [
      Math.min(...edge.map((p) => p[0]!)),
      Math.min(...edge.map((p) => p[1]!)),
      Math.max(...edge.map((p) => p[0]!)),
      Math.max(...edge.map((p) => p[1]!)),
    ];
    if (
      !bounds.every(Number.isFinite) ||
      bounds[0] < -32 ||
      bounds[1] < 27 ||
      bounds[2] > 5 ||
      bounds[3] > 44.5
    )
      throw new Error("Raster outside Spain/Portugal: verify CRS.");
    const tiles: string[] = [];
    for (const [tx, ty] of tileKeys(bounds)) {
      const [tw, ts, te, tn] = tileBounds(tx, ty);
      const tile = new Uint8Array(TILE_SIZE * TILE_SIZE).fill(UNKNOWN);
      let used = false;
      for (let row = 0; row < TILE_SIZE; row++) {
        const lat = tn - ((row + 0.5) * (tn - ts)) / TILE_SIZE;
        for (let col = 0; col < TILE_SIZE; col++) {
          const lon = tw + ((col + 0.5) * (te - tw)) / TILE_SIZE;
          const [x, y] = projection.forward([lon, lat]);
          const px = Math.floor((x! - ox!) / rx!),
            py = Math.floor((y! - oy!) / ry!);
          if (px < 0 || py < 0 || px >= width || py >= height) continue;
          const model = values[py * width + px]!;
          if (model === UNKNOWN) continue;
          tile[row * TILE_SIZE + col] = model;
          used = true;
        }
      }
      if (used) {
        const key = `${tx}_${ty}`;
        await save(key, tile);
        tiles.push(key);
      }
    }
    return {
      assigned,
      missing,
      tiles,
      sourceCrs: crs ?? `EPSG:${code}`,
      sourceResolution: [rx, Math.abs(ry!)],
      sampling: "native class at transformed pixel centre; nearest neighbour",
    };
  } finally {
    await tiff.close();
  }
}
