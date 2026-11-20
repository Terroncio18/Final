import { Component, input, model, output } from '@angular/core';
import { Icon } from './icon';

export interface ScenarioNote {
  text: string;
  failed: boolean;

  outdated?: boolean;
}

@Component({
  selector: 'app-scenario-panel',
  imports: [Icon],
  templateUrl: './scenario-panel.html',
  styleUrls: ['./config-section.css', './scenario-panel.css'],
})
export class ScenarioPanel {
  public readonly name = model.required<string>();

  public readonly summary = input.required<string>();
  public readonly note = input.required<ScenarioNote | null>();

  public readonly saveScenario = output();

  public readonly loadScenario = output<Event>();

  protected setName(event: Event): void {
    this.name.set((event.target as HTMLInputElement).value);
  }
}
