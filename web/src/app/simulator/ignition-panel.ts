import { Component, input, model, output } from '@angular/core';
import type { SpreadResult } from '../simulation/fire-spread';
import type { CountermeasurePlan } from './countermeasure-plan';
import { Icon } from './icon';

/** An ignition, with what the grid says of the ground it was put on. */
export interface StartRow {
  index: number;
  label: string;
  coordinates: string;
  ground: string | null;
}

/** A spot fire the embers have lit, as the row of buttons names it. */
export interface SpotRow {
  cell: number;
  label: string;
  time: string;
  distance: number;
}

/**
 * The «Eines d'ignició» and «Focus secundaris per brases» blocks of the
 * configuration column: where the fire starts, and whether it can start again
 * further on.
 *
 * The ignitions are the address's (§2.26) and the spotting is an input of the
 * model, so both are the console's: the tool in the hand and the spotting
 * settings come in as two-way inputs, and taking an ignition off or going to
 * a spot fire goes back out as an event.
 */
@Component({
  selector: 'app-ignition-panel',
  imports: [Icon],
  templateUrl: './ignition-panel.html',
  styleUrls: ['./config-section.css', './ignition-panel.css'],
})
export class IgnitionPanel {
  /** The tool in the hand: the map reacts to it, and so does the plan. */
  public readonly tool = model.required<'ignition' | null>();
  public readonly spottingEnabled = model.required<boolean>();
  public readonly spottingSeed = model.required<number>();

  public readonly plan = input.required<CountermeasurePlan>();
  public readonly startRows = input.required<readonly StartRow[]>();
  public readonly result = input.required<SpreadResult | null>();
  public readonly computing = input.required<boolean>();
  /** How many spot fires there are up to the cursor. */
  public readonly spotCount = input.required<number>();
  /** The latest of them, as buttons. */
  public readonly spotRows = input.required<readonly SpotRow[]>();
  public readonly elapsed = input.required<string>();

  public readonly removeStart = output<number>();
  public readonly clearStarts = output();
  public readonly focusSpot = output<number>();

  /** The same button turns a tool off, which is what makes it a toggle. */
  protected toggleTool(name: 'ignition'): void {
    // One tool at a time: a countermeasure half drawn is put down first.
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
