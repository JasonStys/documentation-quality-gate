/**
 * @file Integration-test configuration.
 * @description Isolates CLI, filesystem, and local HTTP boundary tests.
 * @remarks Key declarations are listed in source order; verified locations live in docs/code-map.md.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.ts'],
    testTimeout: 20_000,
  },
});
