import { addProtocol } from 'maplibre-gl';
import mlcontour from 'maplibre-contour';

import { DEM_MAX_ZOOM, DEM_TILES } from './map.config';

/**
 * Contour lines, drawn from the elevation tiles the map already loads.
 *
 * No new data and no new provider: `maplibre-contour` registers a protocol
 * that takes the same Terrarium tiles the hillshade and the terrain read
 * (§2.6, §2.28), traces the isolines in a worker and hands MapLibre a vector
 * tile. What the style asks for is a URL; what answers is this.
 *
 * Why they are here at all: a photograph of a mountain says where the rock is
 * and nothing about how steep it is, and steepness is the thing this screen
 * exists to show. A contour map is the oldest answer to that question and
 * still the one a reader does not have to be taught.
 *
 * The protocol is registered the first time the tiles are asked for, which is
 * while the style is being built and therefore before MapLibre is handed a
 * style that mentions `contour://` —which is the ordering that matters.
 *
 * On first call and not on import, because building the source starts a
 * worker: a module that does that merely by being imported drags a browser
 * into every place that mentions it, the test runner included.
 */
/** The package exports a value, not a namespace, so its type is taken here. */
type DemSource = InstanceType<typeof mlcontour.DemSource>;

let source: DemSource | null = null;

function demSource(): DemSource {
  if (source) return source;

  source = new mlcontour.DemSource({
    url: DEM_TILES,
    encoding: 'terrarium',
    maxzoom: DEM_MAX_ZOOM,
    // Off the UI thread: tracing a tile is a loop over a quarter of a million
    // samples, and it runs again for every tile the camera uncovers.
    worker: true,
  });

  source.setupMaplibre({ addProtocol });
  return source;
}

/**
 * The URL the style asks for, with the spacing written into it.
 *
 * `[minor, major]` metres per zoom, and a zoom with no entry takes the one
 * below. A hundred metres is the equidistance of a 1:25.000 sheet and it is
 * what reads well once the camera is inside the domain; over the whole 30,7 km
 * of it the same hundred metres is a hairball, so the far view doubles it.
 * Closer in than the domain, fifty.
 */
export function contourTiles(): string {
  return demSource().contourProtocolUrl({
    thresholds: {
      10: [200, 1000],
      12: [100, 500],
      14: [50, 250],
    },
    // What the style's filters and labels read.
    elevationKey: 'ele',
    levelKey: 'level',
    contourLayer: 'contours',
    // One zoom of overzoom: fewer neighbouring tiles to wait for, and smoother
    // lines than tracing the 256 px tile on its own.
    overzoom: 1,
  });
}
