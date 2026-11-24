/**
 * How a reader of saved input says that the input is wrong.
 *
 * A validator that returns `T | string` forces its caller to write
 * `if (typeof x === 'string') return x;` after every call, and the forwarding ends up being half
 * of what the caller reads. Throwing keeps each validator a single question, and the one function
 * that owns the contract catches: `parseCountermeasures()` and `readScenario()` turn a `ParseError`
 * back into the message their callers expect.
 *
 * The `instanceof` in those catches is the point: only a validator's message is an answer for the
 * user, and a real bug must keep travelling instead of reaching the screen disguised as advice.
 */
export class ParseError extends Error {}

export function fail(message: string): never {
  throw new ParseError(message);
}
