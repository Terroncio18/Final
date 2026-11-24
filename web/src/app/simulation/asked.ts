/**
 * «Do not ask for what has already been asked.» Holds the key of the read in flight — a province,
 * a centre, or just `true` when there is only one thing to read — and answers whether a new
 * request is the same one.
 *
 * Regla 8 of `docs/estil.md` calls this deduplication and keeps it apart from the other two: it
 * does not cancel anything and it is not a token. Seven services wrote it by hand, each with its
 * own field name and its own comment.
 *
 * `forget()` is the half that is easy to leave out: without it a failed read stays «already
 * asked» for ever and the screen has no way back, which is what §11.75 had to fix one service at
 * a time.
 */
export class Asked<K = true> {
  private asked: K | null = null;

  /** True when the caller should read; false when this very key is already being read. */
  public take(key: K): boolean {
    if (this.asked === key) return false;
    this.asked = key;
    return true;
  }

  /** Whether this key is still the one being asked about: a late answer uses it before publishing. */
  public holds(key: K): boolean {
    return this.asked === key;
  }

  /** Forget a failed read so it can be asked again — only if it is still the one asked. */
  public forget(key: K): void {
    if (this.asked === key) this.asked = null;
  }

  /** Forget whatever was asked, whichever it was. */
  public reset(): void {
    this.asked = null;
  }
}
