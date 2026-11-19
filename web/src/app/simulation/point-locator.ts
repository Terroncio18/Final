import { Injectable } from '@angular/core';
import type { FeatureCollection } from 'geojson';
import { MUNICIPALITIES_URL, PROVINCES_URL } from '../map/map.config';
import { boundsOf, contains, type AreaGeometry } from './bounds';
import type { Point } from './point';

/** The three codes the simulator's address is made of (§2.26). */
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

function shapes(collection: FeatureCollection, id: (feature: GeoJSON.Feature) => string): Shape[] {
  return collection.features.map((feature) => {
    const geometry = feature.geometry as unknown as AreaGeometry;
    return { id: id(feature), bounds: boundsOf(geometry), geometry };
  });
}

/** The shape a point falls in: the extent first, four comparisons, then the outline. */
export function shapeAt(list: readonly Shape[], [lon, lat]: Point): string | null {
  for (const shape of list) {
    const [west, south, east, north] = shape.bounds;
    if (lon < west || lon > east || lat < south || lat > north) continue;
    if (contains(shape.geometry, [lon, lat])) return shape.id;
  }
  return null;
}

/**
 * Which region, province and municipality a point is in: what a detection
 * needs to open the simulator, which is addressed by those codes like the form
 * (§11.53). Read from the same files the form reads, the provinces once and
 * each province's municipalities when a point falls in it, and kept.
 */
@Injectable({ providedIn: 'root' })
export class PointLocator {
  private provinces: Promise<Shape[]> | null = null;
  /** Each province's region, as the provinces file says it (NUTS 2). */
  private readonly regions = new Map<string, string>();
  private readonly municipalities = new Map<string, Promise<Shape[]>>();

  public async locate(point: Point): Promise<Place | null> {
    this.provinces ??= read(PROVINCES_URL).then((c) => {
      for (const f of c.features) this.regions.set(String(f.id), String(f.properties?.['region']));
      return shapes(c, (f) => String(f.id));
    });
    const province = shapeAt(await this.provinces, point);
    if (!province) return null;
    let list = this.municipalities.get(province);
    if (!list) {
      list = read(`${MUNICIPALITIES_URL}/${province}.geojson`).then((c) =>
        shapes(c, (f) => String(f.properties?.['id'])),
      );
      this.municipalities.set(province, list);
    }
    const municipality = shapeAt(await list, point);
    const region = this.regions.get(province);
    return municipality && region ? { region, province, municipality } : null;
  }
}

async function read(path: string): Promise<FeatureCollection> {
  // Against the document, not the current URL, as the form's services do.
  const response = await fetch(new URL(path, document.baseURI).href);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return (await response.json()) as FeatureCollection;
}
