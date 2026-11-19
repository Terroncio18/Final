import { defineConfig } from 'vitest/config';

// Only the direct `vitest run` reads this file: the model's tests. The Angular
// builder keeps its own settings in angular.json and does not load it, because
// its `runnerConfig` option is false unless it is asked for.
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      // Every model file counts, so one that no test touches is a zero and not
      // an absence.
      include: ['src/app/simulation/**/*.ts'],
      exclude: ['**/*.spec.ts'],
      reporter: ['text', 'html', 'lcovonly'],
      reportsDirectory: 'coverage/model',
    },
  },
});
