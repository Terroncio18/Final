import { Routes } from '@angular/router';

import { MapShell } from './map/map-shell';
import { MapView } from './map/map-view';
import { ProvinceStep } from './simulation/province-step';
import { RegionStep } from './simulation/region-step';
import { SimulationFlow } from './simulation/simulation-flow';

/**
 * One segment per level of the hierarchy, and the map above all of them.
 *
 *   /peninsula              overview, framed on the peninsula and the Balearics
 *   /canaries               overview, framed on the Canaries
 *   /simulacio              pick a region        (NUTS 2)
 *   /simulacio/ES51         pick a province or island (NUTS 3)
 *   /simulacio/ES51/ES511   pick a municipality  (LAU, to come)
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
 */
export const routes: Routes = [
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
        ],
      },
      { path: ':scope', component: MapView },
      { path: '**', redirectTo: 'peninsula' },
    ],
  },
];
