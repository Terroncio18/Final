import { Injectable, signal } from '@angular/core';
import { formatPoint, type Point } from './point';
import { readTerrain, type Terrain } from './terrain';

// Only the newest domain read may publish; slow terrain requests can finish after the centre
// moves.
@Injectable({ providedIn: 'root' })
export class TerrainService {
  public readonly terrain = signal<Terrain | null>(null);
  public readonly reading = signal(false);
  public readonly failed = signal(false);

  private token = 0;
  private last: string | null = null;

  public read(point: Point): void {
    const key = formatPoint(point);
    if (key === this.last) return;
    this.last = key;

    const mine = (this.token += 1);
    this.terrain.set(null);
    this.failed.set(false);
    this.reading.set(true);

    readTerrain(point)
      .then((terrain) => {
        if (mine !== this.token) return;
        this.terrain.set(terrain);
        this.reading.set(false);
      })
      .catch((error: Error) => {
        if (mine !== this.token) return;
        console.error('[terrain]', error);
        // Forget the failed read: asking for this same centre again must be able to bring it.
        if (this.last === key) this.last = null;
        this.failed.set(true);
        this.reading.set(false);
      });
  }

  public clear(): void {
    this.token += 1;
    this.last = null;
    this.terrain.set(null);
    this.reading.set(false);
    this.failed.set(false);
  }
}
