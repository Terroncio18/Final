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
      include: [
        'src/main.ts',
        'src/app/simulation/{agents,bounds,countermeasures,domain,fire-display,fire-distances,fire-emitters,fire-spread,fire-surface,fuel-data,fuel-treatments,fuel.service,point,point-locator,rothermel,scenario,slope-classes,spotting,terrain,terrain.service,wind}.ts',
        'src/app/map/{agents-3d,fire-particles}.ts',
      ],
      exclude: ['**/*.spec.ts'],
      reporter: ['text', 'html', 'lcovonly', 'json'],
      reportsDirectory: 'coverage/model',
    },
  },
});
