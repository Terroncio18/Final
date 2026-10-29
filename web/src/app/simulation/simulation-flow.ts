import { Component, DestroyRef, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { MapService } from '../map/map.service';

/**
 * The form, as something with a lifetime of its own.
 *
 * It draws nothing: it exists so that «a simulation is being set up» is a state
 * somebody owns. The detections go off here and come back when it is destroyed,
 * which covers every way out —a step, the close button, the browser's back—
 * without each step having to remember.
 *
 * Off while choosing because the map is answering a different question: during
 * the form it shows administrative boundaries and the user is picking a
 * territory, not reading where it is burning. The marks would be an invitation
 * to click something the form cannot answer.
 */
@Component({
  selector: 'app-simulation-flow',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class SimulationFlow {
  constructor() {
    const maps = inject(MapService);

    maps.setHotspotsVisible(false);
    inject(DestroyRef).onDestroy(() => {
      maps.setHotspotsVisible(true);
      maps.focusRegion(null);
      maps.focusProvince(null);
      maps.showProvincesOf(null);
      maps.focusMunicipality(null);
      maps.setMunicipalities(null);
      maps.setPicking(false);
      maps.setIgnition(null);
    });
  }
}
