import { defineConfig } from 'vitest/config';

// Opt-in: uses prepared official data and the real WorldCover endpoint.
export default defineConfig({
  test: { include: ['integration/**/*.test.ts'], testTimeout: 120_000 },
});
