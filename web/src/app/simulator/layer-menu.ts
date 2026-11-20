import { Component, model } from '@angular/core';

/**
 * The map's layers, switched on and off from the map's toolbar.
 *
 * Each switch is the parent's own signal, through a two-way input: the
 * console reads them elsewhere too —relief for the 3D and flat buttons,
 * forecasts for the legend—, so they stay there. Whether the menu is open is
 * also the parent's, which shows it or not.
 */
@Component({
  selector: 'app-layer-menu',
  templateUrl: './layer-menu.html',
  styleUrl: './layer-menu.css',
})
export class LayerMenu {
  public readonly relief = model.required<boolean>();
  public readonly contours = model.required<boolean>();
  public readonly labels = model.required<boolean>();
  public readonly slopes = model.required<boolean>();
  public readonly forecasts = model.required<boolean>();
}
