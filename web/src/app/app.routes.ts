import { Routes } from '@angular/router';

import { MapView } from './map/map-view';

/**
 * One segment per level of the navigation hierarchy:
 *   /peninsula
 *   /peninsula/catalunya            (to come)
 *   /peninsula/catalunya/sant-celoni (to come)
 *
 * A single `:scope` route rather than three literal ones, on purpose: the router
 * reuses a component when only its parameters change, so moving between scopes
 * updates the camera instead of tearing the map down and building it again.
 */
export const routes: Routes = [
  { path: '', redirectTo: 'peninsula', pathMatch: 'full' },
  { path: ':scope', component: MapView },
  { path: '**', redirectTo: 'peninsula' },
];