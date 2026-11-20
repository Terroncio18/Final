import { addProtocol } from 'maplibre-gl';
import mlcontour from 'maplibre-contour';
import { DEM_MAX_ZOOM, DEM_TILES } from './map.config';

type DemSource = InstanceType<typeof mlcontour.DemSource>;

let source: DemSource | null = null;

function demSource(): DemSource {
  if (source) return source;

  // The source starts a worker, so create it only when the map first needs contours.
  source = new mlcontour.DemSource({
    url: DEM_TILES,
    encoding: 'terrarium',
    maxzoom: DEM_MAX_ZOOM,
    worker: true,
  });

  source.setupMaplibre({ addProtocol });
  return source;
}

export function contourTiles(): string {
  return demSource().contourProtocolUrl({
    // Wider intervals at low zoom keep the full landscape from turning into a dense mesh.
    thresholds: {
      10: [200, 1000],
      12: [100, 500],
      14: [50, 250],
    },
    elevationKey: 'ele',
    levelKey: 'level',
    contourLayer: 'contours',
    overzoom: 1,
  });
}
