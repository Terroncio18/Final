import { inject, Injectable } from '@angular/core';

import { MapService } from '../map/map.service';
import { MunicipalitiesService } from './municipalities.service';

/**
 * How deep into the hierarchy the form has got, one value per route depth.
 *
 * Named after the levels and not after the steps: the last two steps are both
 * standing on a municipality and differ in what they ask the user for, not in
 * what the map draws underneath them.
 */
export type Level = 'region' | 'province' | 'municipality' | 'ignition';

/**
 * The codes a level needs, which are its own ancestors.
 *
 * Only two are ever read: the region, to say whose provinces to draw, and the
 * province, to say whose municipalities to load. A level passes what it needs
 * and nothing more, so the call says which codes the drawing depends on.
 */
interface Of {
  readonly region?: string;
  readonly province?: string;
  readonly municipality?: string;
}

/**
 * The one place that knows which administrative borders belong on screen.
 *
 * §2.22 settled that each level draws only its own, and only its own: while a
 * region is being chosen the map shows regions, and choosing a province inside
 * it replaces them rather than adding to them. Both directions have to hold.
 * The first version left it to each step to remember, which is how returning
 * from the municipalities kept their borders drawn over the province list; and
 * it kept the levels above drawn underneath, which doubled every border a level
 * shares with its parent.
 *
 * Written once here rather than spread over the four steps, because the rule
 * was already written once and the steps were a second, incomplete copy of it:
 * SimulationFlow's exit carried the whole list of layers by hand.
 *
 * What it does not own: the camera, which each step frames on its own extent
 * (§2.8), and the ignition point with its domain, which belong to the last step
 * alone.
 */
@Injectable({ providedIn: 'root' })
export class LevelsService {
  private readonly maps = inject(MapService);
  private readonly municipalities = inject(MunicipalitiesService);

  /**
   * Puts the borders into the state one level needs, whatever was there before.
   *
   * Called on arriving at a step and never on leaving one. A step that asks for
   * what it wants cannot be skipped; a step that tidies up after itself is one
   * more thing the next step depends on, and the order is not ours to pick:
   * the router destroys before it creates, but the browser's back button can
   * land on any level of the hierarchy.
   */
  show(level: Level, of: Of = {}): void {
    // One level of borders at a time, and never two. A region's outline is the
    // outer edge of its provinces and a province's is the outer edge of its
    // municipalities, so a level drawn under the one being chosen repeats every
    // line they share: the same border twice, a shade heavier than the rest and
    // out by whatever the two generalisations disagree on.
    this.maps.setRegionsVisible(level === 'region');

    // Passing no region is also what hides them: an empty code matches no
    // feature, because nothing below the provinces is filtered by region.
    this.maps.showProvincesOf(level === 'province' ? (of.region ?? null) : null);

    // The municipalities are data and not only a filter, so they are released
    // rather than hidden. The service refuses to load the same province twice,
    // and taking the layer off screen without telling it would mean that coming
    // back down to a province already seen drew nothing at all.
    if (level === 'municipality' || level === 'ignition') {
      if (of.province) this.municipalities.load(of.province);
    } else {
      this.municipalities.release();
    }

    // On arriving at a level nothing is being pointed at. The exception is the
    // last step, where the municipality stays outlined because that is no
    // longer a hover: it is the answer the three steps above it gave.
    this.maps.focusRegion(null);
    this.maps.focusProvince(null);
    this.maps.focusMunicipality(level === 'ignition' ? (of.municipality ?? null) : null);
  }

  /**
   * Nothing below the regions, which is what leaving the form needs.
   *
   * Deliberately the same state as the first step: there is no third thing to
   * keep in step with the other two, and that duplication is what the first
   * version paid for in SimulationFlow.
   */
  clear(): void {
    this.show('region');
  }
}
