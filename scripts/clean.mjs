/**
 * @file Cross-platform build cleaner.
 * @description Removes generated build output without shell-specific commands.
 * @remarks Key declarations are listed in source order; verified locations live in docs/code-map.md.
 */
import { rm } from 'node:fs/promises';

await rm('dist', { force: true, recursive: true });
