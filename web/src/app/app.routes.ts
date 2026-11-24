import { Routes } from '@angular/router';
import { MapShell } from './map/map-shell';
import { MapView } from './map/map-view';
import { CentreStep } from './simulation/centre-step';
import { MunicipalityStep } from './simulation/municipality-step';
import { ProvinceStep } from './simulation/province-step';
import { RegionStep } from './simulation/region-step';
import { SimulationFlow } from './simulation/simulation-flow';

/* Keep MapShell mounted across form steps so the map and WebGL context survive navigation. The simulator owns a separate lazy-loaded map. Declare literal routes before :scope, which would otherwise consume them. */
export const routes: Routes = [
  {
    path: 'simulador/:region/:province/:municipality/:point',
    loadComponent: () => import('./simulator/simulator-view').then((m) => m.SimulatorView),
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
          { path: ':region/:province/:municipality', component: CentreStep },
          { path: ':region/:province/:municipality/:point', component: CentreStep },
        ],
      },
      { path: ':scope', component: MapView },
      { path: '**', redirectTo: 'peninsula' },
    ],
  },
];
