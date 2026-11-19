import { defineConfig } from 'vitest/config';

// The tests read `src/`, the TypeScript, and not `dist/`: the coverage of the
// compiled JavaScript does not say which line of ours is untested, and Sonar,
// which reads the repository, cannot place it either.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // Every file counts, so one without a single test is a zero and not an
      // absence. `server.ts` only wires the routes together and is read, not run.
      include: ['src/**/*.ts'],
      reporter: ['text', 'html', 'lcovonly'],
      reportsDirectory: 'coverage',
    },
  },
});
