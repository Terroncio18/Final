import { Component, computed, input } from '@angular/core';

/**
 * The line icons the simulation screen is drawn with.
 *
 * Twenty-four paths on a 24×24 grid, stroked and not filled, taken from the
 * FireCast prototype this screen is modelled on —they are drawn by hand there,
 * in its own `app.js`, and not a third party's set, so there is no licence to
 * carry and no package to install for twenty-four line drawings.
 *
 * A dictionary and not one component per icon: they are data, they are used
 * once each, and a file per icon would be more ceremony than drawing.
 */
const ICONS = {
  flame: 'M12 3c2 5-5 7-2 11 1-2 3-3 4-6 6 6 4 13-3 13S2 15 6 10c0 3 2 4 3 2-1-4 3-5 3-9Z',
  sliders: 'M4 5h7 M15 5h5 M4 12h2 M10 12h10 M4 19h10 M18 19h2 M11 2v6 M6 9v6 M14 16v6',
  pin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0 M15 10a3 3 0 1 1-6 0 3 3 0 1 1 6 0',
  map: 'm3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Z M9 3v16 M15 5v16',
  chevron: 'm9 5 7 7-7 7',
  droplet: 'M12 3C9 8 5 11 5 15a7 7 0 0 0 14 0c0-4-4-7-7-12Z',
  thermometer: 'M10 14V5a2 2 0 0 1 4 0v9a5 5 0 1 1-4 0 M12 9v9',
  trees: 'm8 3-5 8h3l-4 5h5v5 M8 3l5 8h-3l4 5H7 M16 4l5 8h-3l4 5h-6v4',
  sun: 'M16 12a4 4 0 1 1-8 0 4 4 0 1 1 8 0 M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1 1 M18 18l1 1 M5 19l1-1 M18 6l1-1',
  wind: 'M3 8h12a3 3 0 1 0-3-3 M3 12h16a3 3 0 1 1-3 3 M3 17h6a2 2 0 1 1-2 2',
  ruler: 'm3 16 13-13 5 5-13 13Z M7 12l2 2 M10 9l2 2 M13 6l2 2',
  reset: 'M3 10a9 9 0 1 1 2 9 M3 4v6h6',
  clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M12 7v5l3 2',
  play: 'm8 5 11 7-11 7Z',
  plus: 'M12 5v14 M5 12h14',
  minus: 'M5 12h14',
  crosshair: 'M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0 M12 2v4 M12 18v4 M2 12h4 M18 12h4',
  layers: 'm12 3 10 6-10 6L2 9Z M2 13l10 6 10-6 M2 17l10 6 10-6',
  activity: 'M2 12h5l3-8 4 16 3-8h5',
  warning: 'm12 3 10 18H2Z M12 9v5 M12 17v1',
  house: 'm3 10 9-7 9 7 M5 9v12h14V9 M10 21v-7h4v7',
  info: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M12 11v6 M12 7v1',
  back: 'm11 5-7 7 7 7 M4 12h16',
  expand: 'M4 9V4h5 M20 9V4h-5 M4 15v5h5 M20 15v5h-5',
  // The six below are not the prototype's: drawn here, in the same manner,
  // when the configuration column needed them.
  antenna: 'M5 13a7 7 0 0 1 14 0 M8.5 13a3.5 3.5 0 0 1 7 0 M12 13v8 M9 21h6',
  save: 'M5 3h11l3 3v15H5Z M8 3v6h7V3 M8 21v-7h8v7',
  folder: 'M3 6h6l2 2h10v11H3Z',
  trash: 'M4 7h16 M9 7V4h6v3 M6 7l1 14h10l1-14',
  pause: 'M8 5v14 M16 5v14',
  plane: 'M12 3v17 M3 14l9-4 9 4 M8 21l4-2 4 2',
} as const;

export type IconName = keyof typeof ICONS;

/**
 * One icon, inline.
 *
 * Inline rather than a sprite or a font: the stroke takes `currentColor`, so
 * an icon beside a label is the same colour as the label without anything
 * having to say so, and there is no second request for a file.
 */
@Component({
  selector: 'app-icon',
  template: `<svg viewBox="0 0 24 24" aria-hidden="true"><path [attr.d]="path()" /></svg>`,
  styles: `
    :host {
      display: inline-flex;
      flex-shrink: 0;
    }

    svg {
      width: var(--icon-size, 18px);
      height: var(--icon-size, 18px);
      fill: none;
      stroke: currentColor;
      stroke-width: 1.6;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  `,
})
export class Icon {
  readonly name = input.required<IconName>();

  protected readonly path = computed(() => ICONS[this.name()]);
}
