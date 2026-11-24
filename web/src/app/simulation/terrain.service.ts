import { Injectable, signal } from '@angular/core';
import { formatPoint, type Point } from './point';
import { readTerrain, type Terrain } from './terrain';
import { Latest } from './latest';
import { Asked } from './asked';

// Only the newest domain read may publish; slow terrain requests can finish after the centre
// moves.
@Injectable({ providedIn: 'root' })
export class TerrainService {
  public readonly terrain = signal<Terrain | null>(null);
  public readonly reading = signal(false);
  public readonly failed = signal(false);

  private readonly latest = new Latest();
  private readonly asked = new Asked<string>();

  public read(point: Point): void {
    const key = formatPoint(point);
    if (!this.asked.take(key)) return;

    const mine = this.latest.begin();
    this.terrain.set(null);
    this.failed.set(false);
    this.reading.set(true);

    readTerrain(point)
      .then((terrain) => {
        if (!this.latest.owns(mine)) return;
        this.terrain.set(terrain);
        this.reading.set(false);
      })
      .catch((error: Error) => {
        if (!this.latest.owns(mine)) return;
        console.error('[terrain]', error);
        // Forget the failed read: asking for this same centre again must be able to bring it.
        this.asked.forget(key);
        this.failed.set(true);
        this.reading.set(false);
      });
  }

  public clear(): void {
    this.latest.abandon();
    this.asked.reset();
    this.terrain.set(null);
    this.reading.set(false);
    this.failed.set(false);
  }
}
