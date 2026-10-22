import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Long sim play-through tests can exceed the 5 s default on slow CI runners.
  test: { include: ['tests/**/*.test.ts'], testTimeout: 30000 },
});
