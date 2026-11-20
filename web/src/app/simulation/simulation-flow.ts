import { Component, inject, type OnDestroy, type OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MapService } from '../map/map.service';
import { LevelsService } from './levels.service';

// Own form-wide map state for every exit path, including browser Back; individual steps need not
// restore hotspots.
@Component({
  selector: 'app-simulation-flow',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class SimulationFlow implements OnInit, OnDestroy {
  private readonly maps = inject(MapService);
  private readonly levels = inject(LevelsService);

  public ngOnInit(): void {
    this.maps.setHotspotsVisible(false);
  }

  public ngOnDestroy(): void {
    this.maps.setHotspotsVisible(true);
    this.levels.clear();
    this.maps.setPicking(false);
  }
}
