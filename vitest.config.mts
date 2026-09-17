/**
 * @file Unit-test configuration.
 * @description Enforces repository coverage thresholds for deterministic core logic.
 * @remarks Key declarations are listed in source order; verified locations live in docs/code-map.md.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      exclude: ['src/action.ts', 'src/cli.ts'],
      include: ['src/**/*.ts'],
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      thresholds: {
        branches: 75,
        functions: 85,
        lines: 88,
        statements: 88,
      },
    },
    include: ['tests/**/*.test.ts'],
    testTimeout: 10_000,
  },
});
