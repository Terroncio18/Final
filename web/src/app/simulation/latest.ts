/**
 * «This answer is no longer the one I want.» One run at a time: each start takes a token, and only
 * the holder of the current one may publish. A reply that was overtaken while it travelled has
 * nothing left to say.
 *
 * Regla 8 of `docs/estil.md` asks for this to have a name instead of living as a repeated
 * `if (mine !== this.token) return` in every service. It does **not** cancel anything: when the
 * work is a `fetch`, an `AbortController` cancels the request itself and saves the quota, and this
 * is for the work that cannot be cancelled — a computation, a deferred import, a reply already in
 * flight. `simulator/fire-run.ts` is the same idea with the signals of a run bundled in.
 */
export class Latest {
  private token = 0;

  /** Take the newest token, superseding whatever was in flight. */
  public begin(): number {
    return (this.token += 1);
  }

  /**
   * The tokens handed out start at 1, so a 0 belongs to nobody: it can only come from a caller
   * that never asked. Saying no to it keeps a class whose whole job is this answer from being
   * right by luck.
   */
  public owns(token: number): boolean {
    return token !== 0 && token === this.token;
  }

  /** Supersede what is in flight without starting anything: nobody owns the token now. */
  public abandon(): void {
    this.token += 1;
  }
}
