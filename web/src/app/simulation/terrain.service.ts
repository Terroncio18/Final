import { Injectable, signal } from '@angular/core';

import { formatPoint, type Point } from './point';
import { readTerrain, type Terrain } from './terrain';

/**
 * The elevation under the current domain.
 *
 * Kept out of the component because the read is slow —a few dozen tiles and a
 * million samples— and because a point that has moved on must not be overwritten
 * by an answer that arrives late. Each read carries a token; only the newest
 * one is allowed to publish.
 */
@Injectable({ providedIn: 'root' })
export class TerrainService {
  readonly terrain = signal<Terrain | null>(null);
  readonly reading = signal(false);
  readonly failed = signal(false);

  private token = 0;
  private last: string | null = null;

  read(point: Point): void {
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
      .catch((error: unknown) => {
        console.error('[terrain]', error);
        if (mine !== this.token) return;
        this.failed.set(true);
        this.reading.set(false);
      });
  }

  /** Forgets everything, so leaving and coming back reads again. */
  clear(): void {
    this.token += 1;
    this.last = null;
    this.terrain.set(null);
    this.reading.set(false);
    this.failed.set(false);
  }
}
