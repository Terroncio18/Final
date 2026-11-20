import { Component, input, model, output } from '@angular/core';
import { Icon } from './icon';

/** What the last save or load came to, for the line under the buttons. */
export interface ScenarioNote {
  text: string;
  failed: boolean;
  /** Loaded from an older file: offers to save it again as a current one. */
  outdated?: boolean;
}

/**
 * The «Escenaris» block of the configuration column (§11.26).
 *
 * Only what is shown. A scenario is everything the console holds —the
 * address, the weather, the plan, the spotting—, so writing one and reading
 * one back are the console's; this block shows what would be kept, takes the
 * name, and hands over the press of a button and the file chosen.
 */
@Component({
  selector: 'app-scenario-panel',
  imports: [Icon],
  templateUrl: './scenario-panel.html',
  styleUrls: ['./config-section.css', './scenario-panel.css'],
})
export class ScenarioPanel {
  /** The name the file will be saved under; empty, the console makes one up. */
  public readonly name = model.required<string>();
  /** What saving now would keep, in a line. */
  public readonly summary = input.required<string>();
  public readonly note = input.required<ScenarioNote | null>();

  public readonly saveScenario = output();
  /** The file input's change, as it comes: the console reads the file. */
  public readonly loadScenario = output<Event>();

  protected setName(event: Event): void {
    this.name.set((event.target as HTMLInputElement).value);
  }
}
