import type { FirmsSource, HotspotCollection } from './firms.js';

export interface CachedHotspots {
  readonly body: HotspotCollection;
  readonly sources: readonly FirmsSource[];
  readonly missing: readonly string[];
  readonly fetchedAt: number;
}

export class HotspotCache {
  private readonly stored = new Map<string, CachedHotspots>();

  public constructor(private readonly limit: number) {
    if (!Number.isInteger(limit) || limit < 1) throw new RangeError('Cache limit must be positive');
  }

  public get(key: string): CachedHotspots | undefined {
    const entry = this.stored.get(key);
    if (entry) {
      this.stored.delete(key);
      this.stored.set(key, entry);
    }
    return entry;
  }

  public set(key: string, entry: CachedHotspots): void {
    this.stored.delete(key);
    this.stored.set(key, entry);
    while (this.stored.size > this.limit) {
      const oldest = this.stored.keys().next().value;
      if (oldest === undefined) break;
      this.stored.delete(oldest);
    }
  }

  public entries(): IterableIterator<[string, CachedHotspots]> {
    return this.stored.entries();
  }
}
