import { Component, input, model, output } from '@angular/core';
import type { SpreadResult } from '../simulation/fire-spread';
import type { CountermeasurePlan } from './countermeasure-plan';
import { Icon } from './icon';

export interface StartRow {
  index: number;
  label: string;
  coordinates: string;
  ground: string | null;
}

export interface SpotRow {
  cell: number;
  label: string;
  time: string;
  distance: number;
}

@Component({
  selector: 'app-ignition-panel',
  imports: [Icon],
  templateUrl: './ignition-panel.html',
  styleUrls: ['./config-section.css', './ignition-panel.css'],
})
export class IgnitionPanel {
  public readonly tool = model.required<'ignition' | null>();
  public readonly spottingEnabled = model.required<boolean>();
  public readonly spottingSeed = model.required<number>();

  public readonly plan = input.required<CountermeasurePlan>();
  public readonly startRows = input.required<readonly StartRow[]>();
  public readonly result = input.required<SpreadResult | null>();
  public readonly computing = input.required<boolean>();

  public readonly spotCount = input.required<number>();
  public readonly spotRows = input.required<readonly SpotRow[]>();
  public readonly elapsed = input.required<string>();

  public readonly removeStart = output<number>();
  public readonly clearStarts = output();
  public readonly focusSpot = output<number>();

  protected toggleTool(name: 'ignition'): void {
    // Only one tool may be active; discard an unfinished countermeasure before taking the ignition
    // tool.
    this.plan().cancel();
    this.tool.update((current) => (current === name ? null : name));
  }

  protected setSpottingSeed(event: Event): void {
    const input = event.target as HTMLInputElement,
      value = Number(input.value);
    if (
      !this.result() &&
      !this.computing() &&
      Number.isInteger(value) &&
      value >= 0 &&
      value <= 4294967295
    )
      this.spottingSeed.set(value);
    input.value = String(this.spottingSeed());
  }
}
