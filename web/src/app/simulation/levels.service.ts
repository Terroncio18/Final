import { inject, Injectable } from '@angular/core';
import { MapService } from '../map/map.service';
import { PlacesService } from '../map/places.service';
import { MunicipalitiesService } from './municipalities.service';

// The last two form steps share the municipality level and differ only in the question asked.
type Level = 'region' | 'province' | 'municipality' | 'ignition';

interface Of {
  readonly region?: string;
  readonly province?: string;
  readonly municipality?: string;
}

// Each form level draws only its own administrative borders, avoiding doubled shared boundaries.
@Injectable({ providedIn: 'root' })
export class LevelsService {
  private readonly maps = inject(MapService);
  private readonly municipalities = inject(MunicipalitiesService);
  private readonly places = inject(PlacesService);

  // Set the complete layer state on entry: Back can land at any level, so correctness cannot
  // depend on the previous step’s cleanup.
  public show(level: Level, of: Of = {}): void {
    this.maps.setRegionsVisible(level === 'region');

    // An empty region code matches no province feature.
    this.maps.showProvincesOf(level === 'province' ? (of.region ?? null) : null);

    // Clear municipality service state as well as the layer; otherwise its cache may refuse to
    // reload a province when returning.
    if (level === 'municipality' || level === 'ignition') {
      if (of.province) this.municipalities.load(of.province);
    } else {
      this.municipalities.release();
    }

    // At the ignition step, the municipality highlight is a selection rather than a hover.
    this.maps.focusRegion(null);
    this.maps.focusProvince(null);
    this.maps.focusMunicipality(level === 'ignition' ? (of.municipality ?? null) : null);

    // Clear old ignition/domain state on higher levels; the ignition step sets its own state
    // immediately after show().
    if (level !== 'ignition') {
      this.maps.setIgnition(null);
      this.maps.setDomain(null);
    }

    this.maps.setTerrain3D(false);
    this.maps.setOrbit(false);

    // Reset the place-name service together with its layer, otherwise returning can leave the map
    // empty.
    this.places.release();
    this.maps.setContours(false);
  }

  public clear(): void {
    this.show('region');
  }
}
