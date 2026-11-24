import { describe, expect, it } from 'vitest';
import { Latest } from './latest';

describe('Latest', () => {
  it('lets only the newest token publish', () => {
    const latest = new Latest();
    const first = latest.begin();
    expect(latest.owns(first)).toBe(true);

    const second = latest.begin();
    expect(latest.owns(second)).toBe(true);
    expect(latest.owns(first)).toBe(false);
  });

  it('leaves nobody owning the token after it is abandoned', () => {
    const latest = new Latest();
    const mine = latest.begin();
    latest.abandon();
    expect(latest.owns(mine)).toBe(false);
    // And a start after abandoning owns it again.
    expect(latest.owns(latest.begin())).toBe(true);
  });

  it('does not own a token it never gave', () => {
    const latest = new Latest();
    expect(latest.owns(0)).toBe(false);
    expect(latest.owns(7)).toBe(false);
    latest.begin();
    expect(latest.owns(0)).toBe(false);
  });
});
