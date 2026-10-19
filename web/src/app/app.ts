import { Component } from '@angular/core';

import { MapView } from './map/map-view';

@Component({
  imports: [MapView],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {}