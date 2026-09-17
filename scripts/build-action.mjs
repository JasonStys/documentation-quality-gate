/**
 * @file GitHub Action bundle builder.
 * @description Bundles the Node 24 Action entry point into the committed dist/index.js artifact.
 * @remarks Key declarations are listed in source order; verified locations live in docs/code-map.md.
 */
import { build } from 'esbuild';
import path from 'node:path';

await build({
  entryPoints: [path.resolve('src/action.ts')],
  outfile: path.resolve('dist/index.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  sourcemap: true,
  legalComments: 'none',
});
