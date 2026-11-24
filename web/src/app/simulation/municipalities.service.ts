import { inject, Injectable, signal } from '@angular/core';
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { MUNICIPALITIES_URL } from '../map/map.config';
import { MapService } from '../map/map.service';
import { boundsOf, contains, type AreaGeometry } from './bounds';
import type { Municipality } from './municipality';
import type { Point } from './point';
import { readJson } from './read-json';

type MunicipalityFeature = Feature<
  Polygon | MultiPolygon,
  {
    readonly id: string;
    readonly name: string;
    readonly province: string;
  }
>;

function toMunicipality(feature: MunicipalityFeature): Municipality {
  const { id, name, province } = feature.properties;
  return { id, name: name.trim(), province, bounds: boundsOf(feature.geometry) };
}

// Load and cache one province at a time; the complete municipality geometry is about 13 MB.
@Injectable({ providedIn: 'root' })
export class MunicipalitiesService {
  private readonly maps = inject(MapService);

  public readonly municipalities = signal<readonly Municipality[]>([]);
  public readonly failed = signal(false);

  private readonly cache = new Map<string, readonly Municipality[]>();
  private readonly sources = new Map<string, FeatureCollection>();

  // Keep outlines as well as bounds: coastal bounding boxes can include sea.
  private readonly shapes = new Map<string, AreaGeometry>();
  private asked: string | null = null;

  public load(province: string): void {
    if (this.asked === province) return;
    this.asked = province;
    this.failed.set(false);

    const held = this.cache.get(province);
    if (held) {
      this.show(province, held);
      return;
    }

    this.municipalities.set([]);

    readJson<FeatureCollection<Polygon | MultiPolygon, MunicipalityFeature['properties']>>(
      `${MUNICIPALITIES_URL}/${province}.geojson`,
    )
      .then((collection) => {
        const features = collection.features;
        const list = features.map(toMunicipality);
        for (const feature of features) this.shapes.set(feature.properties.id, feature.geometry);
        this.cache.set(province, list);
        this.sources.set(province, collection);
        // Ignore a late response after the user switches provinces.
        if (this.asked === province) this.show(province, list);
      })
      .catch((error: Error) => {
        console.error('[municipalities]', error);
        if (this.asked !== province) return;
        this.failed.set(true);
        // Forget the failed province so choosing it again reads it anew, and not only after
        // visiting another one.
        this.asked = null;
      });
  }

  public release(): void {
    this.asked = null;
    this.municipalities.set([]);
    this.maps.setMunicipalities(null);
  }

  public find(id: string): Municipality | undefined {
    return this.municipalities().find((municipality) => municipality.id === id);
  }

  // Search only the loaded province. Test bounds before ray casting to avoid scanning every
  // outline.
  public at(point: Point): Municipality | null {
    const [lon, lat] = point;

    for (const municipality of this.municipalities()) {
      const [west, south, east, north] = municipality.bounds;
      if (lon < west || lon > east || lat < south || lat > north) continue;

      const shape = this.shapes.get(municipality.id);
      if (shape && contains(shape, point)) return municipality;
    }

    return null;
  }

  private show(province: string, list: readonly Municipality[]): void {
    this.municipalities.set(list);
    const source = this.sources.get(province);
    if (source) this.maps.setMunicipalities(source);
  }
}
