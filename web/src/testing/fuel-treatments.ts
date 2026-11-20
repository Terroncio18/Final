import { vi } from 'vitest';
import { FuelTreatments } from '../app/simulation/fuel-treatments';
import { fuelBed, FUEL_MODELS, type FuelBed } from '../app/simulation/rothermel';

type Treatment = NonNullable<ReturnType<FuelTreatments['at']>>;

export function fuelTreatments(
  patch: Partial<Omit<Treatment, 'bed'>> & { bed?: Partial<FuelBed> } = {},
) {
  const moistures = { dead1: 0.08, dead10: 0.08, dead100: 0.08, live: 1 };
  const state: Treatment = {
    moisture1h: moistures.dead1,
    remaining: 1,
    until: Infinity,
    ...patch,
    bed: { ...fuelBed(FUEL_MODELS[1], moistures), ...patch.bed },
  };
  return Object.assign(new FuelTreatments([0, 0], [], moistures), {
    at: vi.fn<FuelTreatments['at']>(() => state),
  });
}
