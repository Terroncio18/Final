import { Injectable } from '@angular/core';
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { MUNICIPALITIES_URL, PROVINCES_URL } from '../map/map.config';
import { boundsOf, contains, type AreaGeometry } from './bounds';
import type { Point } from './point';
import { readJson } from './read-json';

export interface Place {
  readonly region: string;
  readonly province: string;
  readonly municipality: string;
}

interface Shape {
  readonly id: string;
  readonly bounds: readonly [number, number, number, number];
  readonly geometry: AreaGeometry;
}

type AreaCollection = FeatureCollection<Polygon | MultiPolygon>;

function shapes(
  collection: AreaCollection,
  id: (feature: Feature<Polygon | MultiPolygon>) => string,
): Shape[] {
  return collection.features.map((feature) => {
    const geometry = feature.geometry;
    return { id: id(feature), bounds: boundsOf(geometry), geometry };
  });
}

export function shapeAt(list: readonly Shape[], [lon, lat]: Point): string | null {
  for (const shape of list) {
    const [west, south, east, north] = shape.bounds;
    if (lon < west || lon > east || lat < south || lat > north) continue;
    if (contains(shape.geometry, [lon, lat])) return shape.id;
  }
  return null;
}

// Reuse the form’s province and municipality files. Cache each province’s geometry after the first
// point query.
@Injectable({ providedIn: 'root' })
export class PointLocator {
  private provinces: Promise<Shape[]> | null = null;

  private readonly regions = new Map<string, string>();
  private readonly municipalities = new Map<string, Promise<Shape[]>>();

  public async locate(point: Point): Promise<Place | null> {
    const province = shapeAt(await this.readProvinces(), point);
    if (!province) return null;
    const municipality = shapeAt(await this.readMunicipalities(province), point);
    const region = this.regions.get(province);
    return municipality && region ? { region, province, municipality } : null;
  }

  private readProvinces(): Promise<Shape[]> {
    if (this.provinces) return this.provinces;
    const pending: Promise<Shape[]> = readJson<AreaCollection>(PROVINCES_URL)
      .then((collection) => {
        const list = shapes(collection, (feature) => String(feature.id));
        this.regions.clear();
        for (const feature of collection.features) {
          this.regions.set(String(feature.id), String(feature.properties?.['region']));
        }
        return list;
      })
      .catch((error) => {
        if (this.provinces === pending) this.provinces = null;
        throw error;
      });
    this.provinces = pending;
    return pending;
  }

  private readMunicipalities(province: string): Promise<Shape[]> {
    const held = this.municipalities.get(province);
    if (held) return held;
    const pending: Promise<Shape[]> = readJson<AreaCollection>(
      `${MUNICIPALITIES_URL}/${province}.geojson`,
    )
      .then((collection) => shapes(collection, (feature) => String(feature.properties?.['id'])))
      .catch((error) => {
        if (this.municipalities.get(province) === pending) this.municipalities.delete(province);
        throw error;
      });
    this.municipalities.set(province, pending);
    return pending;
  }
}
