/**
 * @file Package verification script.
 * @description Ensures the action bundle, CLI, schemas, and metadata required by consumers exist.
 * @remarks Key declarations are listed in source order; verified locations live in docs/code-map.md.
 */
import { access, readFile } from 'node:fs/promises';

const required = [
  'action.yml',
  'dist/index.js',
  'dist/lib/cli.js',
  'dist/lib/scanner.js',
  'schemas/config.schema.json',
];
await Promise.all(required.map((file) => access(file)));
const actionBundle = await readFile('dist/index.js', 'utf8');
if (!actionBundle.includes('Documentation quality policy failed')) {
  throw new Error('Action bundle does not contain the expected entry point.');
}
