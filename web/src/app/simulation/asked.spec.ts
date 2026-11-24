import { describe, expect, it } from 'vitest';
import { Asked } from './asked';

describe('Asked', () => {
  it('reads a key once and refuses the same one again', () => {
    const asked = new Asked<string>();
    expect(asked.take('ES531')).toBe(true);
    expect(asked.take('ES531')).toBe(false);
    expect(asked.holds('ES531')).toBe(true);

    // Another key supersedes it, and the old one is no longer held.
    expect(asked.take('ES532')).toBe(true);
    expect(asked.holds('ES531')).toBe(false);
  });

  it('forgets a failed key so it can be asked anew', () => {
    const asked = new Asked<string>();
    asked.take('ES531');
    asked.forget('ES531');
    expect(asked.holds('ES531')).toBe(false);
    expect(asked.take('ES531')).toBe(true);
  });

  it('ignores a late failure of a key that is no longer the one asked', () => {
    const asked = new Asked<string>();
    asked.take('old');
    asked.take('new');
    // The old read fails after the new one started: forgetting it must not free the new one.
    asked.forget('old');
    expect(asked.holds('new')).toBe(true);
    expect(asked.take('new')).toBe(false);
  });

  it('works for the single-thing case, where the key is just true', () => {
    const asked = new Asked();
    expect(asked.take(true)).toBe(true);
    expect(asked.take(true)).toBe(false);
    asked.forget(true);
    expect(asked.take(true)).toBe(true);
    asked.reset();
    expect(asked.take(true)).toBe(true);
  });
});
