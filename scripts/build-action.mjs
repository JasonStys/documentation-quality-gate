/**
 * @file GitHub Action bundle builder.
 * @description Bundles the Node 24 Action entry point into the committed dist/index.cjs artifact.
 * @remarks Key declarations are listed in source order; verified locations live in docs/code-map.md.
 */
import { build } from 'esbuild';
import path from 'node:path';
import { createRequire } from 'node:module';

const requireForBuild = createRequire(import.meta.url);

await build({
  entryPoints: [path.resolve('src/action.ts')],
  outfile: path.resolve('dist/index.cjs'),
  bundle: true,
  platform: 'node',
  // @actions/core currently includes CommonJS dependencies that use dynamic require.
  // A .cjs bundle keeps those dependencies compatible even though this package's CLI is ESM.
  format: 'cjs',
  target: 'node24',
  sourcemap: true,
  legalComments: 'none',
  // The ESM entry uses import.meta/createRequire; select its static CJS entry
  // so esbuild can include every dependency in the standalone Action bundle.
  alias: { tinyglobby: requireForBuild.resolve('tinyglobby') },
});
