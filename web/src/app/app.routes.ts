import { Routes } from '@angular/router';

import { MapShell } from './map/map-shell';
import { MapView } from './map/map-view';
import { IgnitionStep } from './simulation/ignition-step';
import { MunicipalityStep } from './simulation/municipality-step';
import { ProvinceStep } from './simulation/province-step';
import { RegionStep } from './simulation/region-step';
import { SimulationFlow } from './simulation/simulation-flow';
import { SimulatorView } from './simulator/simulator-view';

/**
 * One segment per level of the hierarchy, and the map above all of them.
 *
 *   /peninsula              overview, framed on the peninsula and the Balearics
 *   /canaries               overview, framed on the Canaries
 *   /simulacio              pick a region        (NUTS 2)
 *   /simulacio/ES51         pick a province or island (NUTS 3)
 *   /simulacio/ES51/ES511   pick a municipality  (LAU, to come)
 *   /simulador/ES53/ES532/ES_07061/@2.72,39.78   the simulation itself
 *
 * A parameter matches one segment, so `:region` and `:region/:province` are
 * told apart by how many there are.
 *
 * MapShell carries an empty path, so it matches every URL under it and the
 * router never destroys it: the MapLibre instance and its WebGL context survive
 * every step. Each child only draws its panel over the map.
 *
 * Codes and not names: the code is the key the data joins on, it is stable, and
 * it takes no position on what the Portuguese levels ought to be called (§3.4).
 *
 * The steps are siblings rather than nested, because each one is a different
 * panel and not a panel inside another. `simulacio` is declared before `:scope`
 * because a parameter matches any single segment, that word included.
 *
 * The simulator hangs outside MapShell and not under it. It is a screen and not
 * a panel over the overview's map: it wants the whole window, no top bar and no
 * detections, and it opens in a tab of its own, where there is no warm map to
 * inherit anyway. It is declared first for the same reason `simulacio` is: left
 * below, `:scope` would swallow the word.
 */
export const routes: Routes = [
  {
    path: 'simulador/:region/:province/:municipality/:point',
    component: SimulatorView,
  },
  {
    path: '',
    component: MapShell,
    children: [
      { path: '', redirectTo: 'peninsula', pathMatch: 'full' },
      {
        path: 'simulacio',
        component: SimulationFlow,
        children: [
          { path: '', component: RegionStep },
          { path: ':region', component: ProvinceStep },
          { path: ':region/:province', component: MunicipalityStep },
          { path: ':region/:province/:municipality', component: IgnitionStep },
          { path: ':region/:province/:municipality/:point', component: IgnitionStep },
        ],
      },
      { path: ':scope', component: MapView },
      { path: '**', redirectTo: 'peninsula' },
    ],
  },
];
