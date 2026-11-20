import { signal } from '@angular/core';
import type { SpreadResult } from '../simulation/fire-spread';

// One run of the spread model at a time. Each start takes a token, and only the run holding the
// current token may report progress, publish its result or report its failure: a run that is
// overtaken while it computes has nothing left to say.
export class FireRun {
  public readonly result = signal<SpreadResult | null>(null);
  public readonly computing = signal(false);
  public readonly progress = signal(0);
  public readonly error = signal<string | null>(null);
  /** The result on screen is older than the plan or the winds it is being compared with. */
  public readonly stale = signal(false);

  private token = 0;

  // Continuing keeps the result on screen until the new one replaces it; starting over clears it.
  public begin(continuing: boolean): number {
    const mine = (this.token += 1);
    if (!continuing) this.result.set(null);
    this.progress.set(0);
    this.computing.set(true);
    this.error.set(null);
    this.stale.set(false);
    return mine;
  }

  public owns(token: number): boolean {
    return token === this.token;
  }

  public report(token: number, share: number): void {
    if (this.owns(token)) this.progress.set(share);
  }

  public publish(token: number, result: SpreadResult, continuing: boolean): void {
    if (!this.owns(token)) return;
    this.computing.set(false);
    this.result.set(result);
    this.stale.set(continuing);
  }

  public fail(token: number, message: string): void {
    if (this.owns(token)) this.error.set(message);
  }

  public settle(token: number): void {
    if (this.owns(token)) this.computing.set(false);
  }

  // Leave the screen without a result: whatever is computing has been superseded.
  public discard(): void {
    this.token += 1;
    this.computing.set(false);
    this.result.set(null);
    this.error.set(null);
    this.stale.set(false);
  }

  // Supersede the run in flight without touching what is already on screen.
  public abandon(): void {
    this.token += 1;
  }
}
