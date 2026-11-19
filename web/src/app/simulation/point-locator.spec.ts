import { describe, expect, it } from 'vitest';
import { shapeAt } from './point-locator';

const square = (x: number, y: number): [number, number][][] => [
  [
    [x, y],
    [x + 1, y],
    [x + 1, y + 1],
    [x, y + 1],
    [x, y],
  ],
];

describe('point locator', () => {
  const shapes = [
    {
      id: 'A',
      bounds: [0, 0, 1, 1] as const,
      geometry: { type: 'Polygon', coordinates: square(0, 0) },
    },
    {
      id: 'B',
      bounds: [1, 0, 2, 1] as const,
      geometry: { type: 'Polygon', coordinates: square(1, 0) },
    },
  ] as never;

  it('finds the shape a point falls in, and nothing outside them all', () => {
    expect(shapeAt(shapes, [0.5, 0.5])).toBe('A');
    expect(shapeAt(shapes, [1.5, 0.2])).toBe('B');
    expect(shapeAt(shapes, [3, 3])).toBeNull();
  });
});
