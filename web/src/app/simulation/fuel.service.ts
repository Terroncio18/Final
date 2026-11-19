import { Injectable, signal } from '@angular/core';
import { domainAround, GRID } from './domain';
import { decodeFuels, type FuelGrid } from './fuel-data';
import type { Point } from './point';

@Injectable({ providedIn: 'root' })
export class FuelService {
  public readonly grid = signal<FuelGrid | null>(null);
  public readonly reading = signal(false);
  public readonly error = signal<string | null>(null);
  private controller?: AbortController;
  private key = '';

  public async read(point: Point, retry = false): Promise<void> {
    const bounds = domainAround(point),
      key = bounds.join(',');
    if (key === this.key && !retry) return;
    this.clear();
    this.key = key;
    const controller = (this.controller = new AbortController());
    this.reading.set(true);
    const timeout = setTimeout(() => controller.abort(), 150_000);
    try {
      const response = await fetch(`/api/fuels?bbox=${encodeURIComponent(key)}&size=${GRID}`, {
        signal: controller.signal,
        // Revalidate after a deployment; a cached response may use an older schema.
        cache: retry ? 'reload' : 'no-cache',
      });
      if (!response.ok)
        throw new Error(
          response.status === 503
            ? 'El servei està ocupat. Torna-ho a provar.'
            : 'No s’han pogut carregar els combustibles.',
        );
      const grid = decodeFuels(await response.json(), bounds, GRID);
      if (this.controller === controller) this.grid.set(grid);
    } catch (error) {
      if (this.controller === controller)
        this.error.set(
          controller.signal.aborted
            ? 'La càrrega ha trigat massa. Torna-ho a provar.'
            : error instanceof Error
              ? error.message
              : 'Error carregant combustibles.',
        );
    } finally {
      clearTimeout(timeout);
      if (this.controller === controller) this.reading.set(false);
    }
  }

  public clear(): void {
    this.controller?.abort();
    this.controller = undefined;
    this.key = '';
    this.grid.set(null);
    this.error.set(null);
    this.reading.set(false);
  }
}
