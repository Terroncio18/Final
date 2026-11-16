import { inject, Injectable, signal } from '@angular/core';

import { MapService } from './map.service';
import {
  enaireAerodromesUrl,
  inside,
  LOAD_MARGIN_M,
  parseWaterPoints,
  waterPointsUrl,
  widen,
  OVERPASS_URL,
  overpassQuery,
  parseEnaireAerodromes,
  parseOverpass,
  lakesUrl,
  parseLakes,
  type Extent,
  type Lake,
  type Resource,
} from '../simulation/resources';

async function json(response: Promise<Response>): Promise<unknown> {
  const answer = await response;
  if (!answer.ok) throw new Error(`HTTP ${answer.status}`);
  return answer.json();
}

/**
 * Stations, water points and aerodromes of the domain (12.23). Water points
 * come from our API, which serves the official networks prepared offline
 * (§11.45); aerodromes from ENAIRE and stations from Overpass, which answer
 * the browser with CORS.
 *
 * Water points and aerodromes are asked for the domain and 30 km around it:
 * an aircraft may load outside the square. `resources` holds them all; the map
 * draws only those inside, since nothing outside it is shown.
 *
 * Each source fails on its own. A domain with no water points because a
 * source is down is a map that says less, and `failed` names it so the screen
 * can say so; it is not a reason to lose the stations.
 */
@Injectable({ providedIn: 'root' })
export class ResourcesService {
  private readonly maps = inject(MapService);

  readonly resources = signal<readonly Resource[]>([]);
  readonly failed = signal<readonly string[]>([]);
  /** Official lakes and reservoirs of the domain, where an aircraft may load (§11.44). */
  readonly lakes = signal<readonly Lake[]>([]);
  private asked: string | null = null;
  private readonly cache = new Map<string, readonly Resource[]>();

  async load(extent: Extent): Promise<void> {
    const key = extent.map((n) => n.toFixed(5)).join(',');
    this.asked = key;
    this.extent = extent;
    const cached = this.cache.get(key);
    // Lakes travel apart: they are not drawn, only consulted when a load point
    // is chosen, and a failure only means fewer places to load.
    void json(fetch(lakesUrl(extent)))
      .then((body) => {
        if (this.asked === key) this.lakes.set(parseLakes(body));
      })
      .catch(() => {
        if (this.asked === key) this.lakes.set([]);
      });
    if (cached) return this.show(cached, []);

    const failed: string[] = [];
    const around = widen(extent, LOAD_MARGIN_M);
    const settle = async (source: string, read: () => Promise<Resource[]>) => {
      try {
        return await read();
      } catch {
        failed.push(source);
        return [];
      }
    };
    const [water, aerodromes, osm] = await Promise.all([
      settle("punts d'aigua", async () =>
        parseWaterPoints(await json(fetch(waterPointsUrl(extent)))),
      ),
      settle('ENAIRE', async () =>
        parseEnaireAerodromes(await json(fetch(enaireAerodromesUrl(around))), around),
      ),
      settle('OSM', async () =>
        parseOverpass(
          await json(
            fetch(OVERPASS_URL, {
              method: 'POST',
              body: new URLSearchParams({ data: overpassQuery(extent, true) }),
            }),
          ),
          extent,
          true,
        ),
      ),
    ]);
    // OpenStreetMap's aerodromes only where ENAIRE has none: Portugal, or
    // a Spanish domain whose official answer failed.
    const fallback = aerodromes.some((r) => inside(r.point, extent))
      ? osm.filter((r) => r.kind !== 'aerodrome')
      : osm;
    const all = [...water, ...aerodromes, ...fallback];
    if (!failed.length) this.cache.set(key, all);
    if (this.asked === key) this.show(all, failed);
  }

  /** The extent last asked for: what the map draws of `resources`. */
  private extent: Extent | null = null;

  release(): void {
    this.asked = null;
    this.lakes.set([]);
    this.show([], []);
  }

  /**
   * Whether the marks are drawn. Hiding them does not unload them: they are
   * still where an aircraft may load (§11.44).
   */
  readonly visible = signal(true);

  setVisible(on: boolean): void {
    this.visible.set(on);
    this.draw();
  }

  private show(resources: readonly Resource[], failed: readonly string[]): void {
    this.resources.set(resources);
    this.failed.set(failed);
    this.draw();
  }

  private draw(): void {
    const extent = this.extent;
    this.maps.setResources(
      extent && this.visible() ? this.resources().filter((r) => inside(r.point, extent)) : [],
    );
  }
}
