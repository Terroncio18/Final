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
 * The protocol is registered when this module is first imported, like the
 * worker URL in map.service.ts: it has to exist before a style that mentions
 * `contour://` is handed to MapLibre.
 */
const source = new mlcontour.DemSource({
  url: DEM_TILES,
  encoding: 'terrarium',
  maxzoom: DEM_MAX_ZOOM,
  // Off the UI thread: tracing a tile is a loop over a quarter of a million
  // samples, and it runs again for every tile the camera uncovers.
  worker: true,
});

source.setupMaplibre({ addProtocol });

/**
 * The URL the style asks for, with the spacing written into it.
 *
 * `[minor, major]` metres per zoom, and a zoom with no entry takes the one
 * below. A hundred metres is the equidistance of a 1:25.000 sheet and it is
 * what reads well once the camera is inside the domain; over the whole 30,7 km
 * of it the same hundred metres is a hairball, so the far view doubles it.
 * Closer in than the domain, fifty.
 */
export const CONTOUR_TILES = source.contourProtocolUrl({
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
