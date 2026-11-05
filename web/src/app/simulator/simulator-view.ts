import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { Chrome } from '../chrome';
import { MapService } from '../map/map.service';
import { CELL_M, domainAround, domainRing, GRID, SIDE_M } from '../simulation/domain';
import { MunicipalitiesService } from '../simulation/municipalities.service';
import { parsePoint } from '../simulation/point';

/**
 * The simulation screen: the domain, in relief, from wherever you look at it.
 *
 * A screen of its own and not a fifth step of the form. The form asks «where»
 * and wants a map that is easy to point at —flat, north up, the whole
 * municipality at once (§2.8). This one answers «what would happen here», and
 * for that the ground is the subject: the fire runs up a slope and stops at a
 * ridge, and neither of those is visible from directly above.
 *
 * It takes the same four segments as the last step of the form, so the link in
 * the address bar is the same simulation in both screens (§2.26), and it opens
 * in a tab of its own: going back to the form must not mean losing the point
 * that was chosen.
 *
 * The model does not exist yet. What is here is the ground it will run on, and
 * the screen says so rather than drawing a fire it cannot compute.
 */
@Component({
  selector: 'app-simulator-view',
  imports: [RouterLink],
  templateUrl: './simulator-view.html',
  styleUrl: './simulator-view.css',
})
export class SimulatorView {
  private readonly maps = inject(MapService);
  private readonly municipalities = inject(MunicipalitiesService);

  /** The element MapLibre takes over. This screen owns its map (§2.20). */
  private readonly container = viewChild.required<ElementRef<HTMLDivElement>>('container');

  readonly region = input.required<string>();
  readonly province = input.required<string>();
  readonly municipality = input.required<string>();
  readonly point = input.required<string>();

  protected readonly ready = this.maps.ready;

  /** Nothing when the segment does not parse, the same rule as the form's. */
  protected readonly ignition = computed(() => parsePoint(this.point()));

  protected readonly chosen = computed(() => this.municipalities.find(this.municipality()));

  /** Latitude first for reading, longitude first for the URL: see point.ts. */
  protected readonly coordinates = computed(() => {
    const point = this.ignition();
    return point ? point[1].toFixed(5) + ', ' + point[0].toFixed(5) : '';
  });

  /** What the square is, in the three numbers that define it (§2.27). */
  protected readonly domain = {
    km: new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 1 }).format(SIDE_M / 1000),
    grid: GRID,
    cell: CELL_M,
  };

  /** Back to the step this screen was opened from, with the point intact. */
  protected readonly back = computed(() => [
    '/simulacio',
    this.region(),
    this.province(),
    this.municipality(),
    this.point(),
  ]);

  constructor() {
    const chrome = inject(Chrome);
    chrome.visible.set(false);

    // After the first render, which is when the element exists, and only in the
    // browser. The same reasoning as MapShell's, and the reason this screen can
    // be a sibling of it rather than a child: the map belongs to whoever is
    // showing it, and in a tab of its own there is no map to inherit.
    afterNextRender(() => this.maps.create(this.container().nativeElement));

    effect(() => {
      // What this screen is not: the portada, or a step of the form. Said here
      // and not through LevelsService, which answers for the levels of the
      // form and would turn the relief off along with everything else.
      this.maps.setHotspotsVisible(false);
      this.maps.setRegionsVisible(false);
      this.maps.showProvincesOf(null);

      // The municipality is context and not a boundary of the simulation
      // (§2.25): the fire will cross it. Reading the list is what makes this
      // run again when the province's file lands, because until then there is
      // no layer to put the outline on.
      this.municipalities.load(this.province());
      const arrived = this.municipalities.municipalities().length > 0;
      this.maps.focusMunicipality(arrived ? this.municipality() : null);

      const point = this.ignition();
      if (!point) return;

      this.maps.setIgnition(point);
      this.maps.setDomain(domainRing(point));
      this.maps.setTerrain3D(true);
      this.maps.setOrbit(true);
      this.maps.goToBounds(domainAround(point), true);
    });

    inject(DestroyRef).onDestroy(() => {
      chrome.visible.set(true);
      this.maps.destroy();
    });
  }
}
