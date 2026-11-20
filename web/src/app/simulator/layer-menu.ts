import { Component, model } from '@angular/core';

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
