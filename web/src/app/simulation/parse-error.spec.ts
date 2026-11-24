import { describe, expect, it } from 'vitest';
import { fail, ParseError } from './parse-error';

describe('fail', () => {
  it('throws a ParseError that carries the message', () => {
    expect(() => fail('La franja necessita dos punts diferents.')).toThrow(ParseError);
    try {
      fail('La franja necessita dos punts diferents.');
      expect.unreachable();
    } catch (error) {
      expect((error as ParseError).message).toBe('La franja necessita dos punts diferents.');
    }
  });

  it('is told apart from any other error, which is what the catchers depend on', () => {
    expect(new TypeError('no és una resposta per a l’usuari')).not.toBeInstanceOf(ParseError);
    expect(new ParseError('sí que ho és')).toBeInstanceOf(Error);
  });
});
