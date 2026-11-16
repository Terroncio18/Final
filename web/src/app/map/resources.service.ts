import { inject, Injectable, signal } from '@angular/core';

import { MapService } from './map.service';
import {
  enaireAerodromesUrl,
  icnfWaterUrl,
  OVERPASS_URL,
  overpassQuery,
  parseEnaireAerodromes,
  parseIcnfWater,
  parseOverpass,
  ideibLakesUrl,
  parseLakes,
  type Extent,
  type Lake,
  type Resource,
  type ResourceSource,
} from '../simulation/resources';

async function json(response: Promise<Response>): Promise<unknown> {
  const answer = await response;
  if (!answer.ok) throw new Error(`HTTP ${answer.status}`);
  return answer.json();
}

/**
 * Stations, water points and aerodromes of the domain (12.23), straight from
 * each source in the browser: ICNF and ENAIRE answer with CORS, and so does
 * Overpass, so no route of our own is needed.
 *
 * Each source fails on its own. A domain with no water points because ICNF is
 * down is a map that says less, and `failed` names the source so the screen
 * can say so; it is not a reason to lose the stations.
 */
@Injectable({ providedIn: 'root' })
export class ResourcesService {
  private readonly maps = inject(MapService);

  readonly resources = signal<readonly Resource[]>([]);
  readonly failed = signal<readonly ResourceSource[]>([]);
  /** Official lakes and reservoirs of the domain, where an aircraft may load (§11.44). */
  readonly lakes = signal<readonly Lake[]>([]);
  private asked: string | null = null;
  private readonly cache = new Map<string, readonly Resource[]>();

  async load(extent: Extent): Promise<void> {
    const key = extent.map((n) => n.toFixed(5)).join(',');
    this.asked = key;
    const cached = this.cache.get(key);
    // Lakes travel apart: they are not drawn, only consulted when a load point
    // is chosen, and a failure only means fewer places to load.
    void json(fetch(ideibLakesUrl(extent)))
      .then((body) => {
        if (this.asked === key) this.lakes.set(parseLakes(body));
      })
      .catch(() => {
        if (this.asked === key) this.lakes.set([]);
      });
    if (cached) return this.show(cached, []);

    const failed: ResourceSource[] = [];
    const settle = async (source: ResourceSource, read: () => Promise<Resource[]>) => {
      try {
        return await read();
      } catch {
        failed.push(source);
        return [];
      }
    };
    const [water, aerodromes, osm] = await Promise.all([
      settle('ICNF', async () => parseIcnfWater(await json(fetch(icnfWaterUrl(extent))), extent)),
      settle('ENAIRE', async () =>
        parseEnaireAerodromes(await json(fetch(enaireAerodromesUrl(extent))), extent),
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
    const fallback = aerodromes.length ? osm.filter((r) => r.kind !== 'aerodrome') : osm;
    const all = [...water, ...aerodromes, ...fallback];
    if (!failed.length) this.cache.set(key, all);
    if (this.asked === key) this.show(all, failed);
  }

  release(): void {
    this.asked = null;
    this.lakes.set([]);
    this.show([], []);
  }

  private show(resources: readonly Resource[], failed: readonly ResourceSource[]): void {
    this.resources.set(resources);
    this.failed.set(failed);
    this.maps.setResources(resources);
  }
}
