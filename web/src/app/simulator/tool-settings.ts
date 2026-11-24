import { Component, computed, model, output } from '@angular/core';
import {
  AIRCRAFT,
  CREW_DEFAULTS,
  CREW_LIMITS,
  crewKind,
  liquidCapacity,
  liquidKind,
  type CountermeasureKind,
  type CrewKind,
} from '../simulation/countermeasures';
import {
  catalogEntry,
  defaultSettings,
  WIDTH_LIMITS,
  type ToolSettings,
} from './countermeasure-plan';
import { Icon } from './icon';

export interface ToolConfig {
  kind: CountermeasureKind;
  discard: boolean;
  settings: ToolSettings;
  error: string | null;
}

// A missing production source means the rate is an editable placeholder.
const CREW_CITATIONS: Partial<Record<CrewKind, { cite: string; url: string }>> = {
  'defense-line': {
    cite: 'NWCG 2021',
    url: 'https://www.frames.gov/documents/behaveplus/publications/NWCG_2021_FireLineProductionRates.pdf',
  },
  'water-line': {
    cite: 'NWCG 2021',
    url: 'https://www.frames.gov/documents/behaveplus/publications/NWCG_2021_FireLineProductionRates.pdf',
  },
};

function crewView(kind: CrewKind) {
  const defaults = CREW_DEFAULTS[kind];
  const citation = defaults.placeholder ? undefined : CREW_CITATIONS[kind];
  return {
    unit: defaults.unit,
    min: CREW_LIMITS[defaults.unit].min,
    max: CREW_LIMITS[defaults.unit].max,
    cite: citation?.cite ?? '',
    url: citation?.url ?? '',
  };
}

@Component({
  selector: 'app-tool-settings',
  imports: [Icon],
  templateUrl: './tool-settings.html',
  styleUrl: './tool-settings.css',
})
export class ToolSettingsModal {
  public readonly config = model.required<ToolConfig | null>();
  public readonly apply = output();

  protected readonly widthLimits = WIDTH_LIMITS;

  protected readonly configView = computed(() => {
    const config = this.config();
    if (!config) return null;
    const entry = catalogEntry(config.kind);
    const aircraft =
      config.kind in AIRCRAFT ? AIRCRAFT[config.kind as keyof typeof AIRCRAFT] : null;
    return {
      ...config,
      label: entry.label,
      colour: entry.color,
      widthLabel: entry.geometry === 'point' ? 'Diàmetre' : 'Amplada',
      liquid: liquidKind(config.kind),
      removal: config.kind === 'clearing',
      crew: crewKind(config.kind) ? crewView(config.kind) : null,
      capacity: liquidCapacity(config.kind),
      aircraft,
    };
  });

  // Percentage fields store fractions rather than the displayed percent.
  protected setSetting(field: keyof ToolSettings, event: Event): void {
    const input = event.target as HTMLInputElement;
    const typed = input.value.trim() === '' ? Number.NaN : Number(input.value.replace(',', '.'));
    const value = field === 'fuelRemaining' ? typed / 100 : typed;
    this.config.update((config) =>
      config ? { ...config, settings: { ...config.settings, [field]: value }, error: null } : null,
    );
  }

  protected shown(value: number | undefined, percent = false): number | '' {
    if (value === undefined || Number.isNaN(value)) return '';
    return percent ? Math.round(value * 100) : value;
  }

  protected resetSettings(): void {
    this.config.update((config) =>
      config ? { ...config, settings: defaultSettings(config.kind), error: null } : null,
    );
  }

  protected cancelSettings(): void {
    this.config.set(null);
  }
}
