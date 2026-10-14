/**
 * @file Package verification script.
 * @description Ensures the action bundle, CLI, schemas, and metadata required by consumers exist.
 * @remarks Key declarations are listed in source order; verified locations live in docs/code-map.md.
 */
import { access, readFile } from 'node:fs/promises';
import { copyFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import process from 'node:process';
import console from 'node:console';

const required = [
  'action.yml',
  'dist/index.cjs',
  'dist/lib/cli.js',
  'dist/lib/scanner.js',
  'schemas/config.schema.json',
];
await Promise.all(required.map((file) => access(file)));
const actionBundle = await readFile('dist/index.cjs', 'utf8');
if (!actionBundle.includes('Documentation quality policy failed')) {
  throw new Error('Action bundle does not contain the expected entry point.');
}

/** Runs the bundled consumer with no installed dependencies, for pass and fail fixtures. */
async function verifyStandaloneAction() {
  const root = await mkdtemp(path.join(tmpdir(), 'docquality-bundle-'));
  const run = promisify(execFile);
  try {
    await copyFile('dist/index.cjs', path.join(root, 'action.cjs'));
    await writeFile(
      path.join(root, '.docquality.json'),
      JSON.stringify({ include: ['guide.md'] }),
    );
    await writeFile(path.join(root, 'guide.md'), '---\ntitle: Smoke\n---\n# Smoke\n');
    await writeFile(path.join(root, 'summary.txt'), '');
    await writeFile(path.join(root, 'outputs.txt'), '');
    const options = {
      cwd: root,
      timeout: 20_000,
      env: {
        ...process.env,
        GITHUB_WORKSPACE: root,
        INPUT_CONFIG: '.docquality.json',
        INPUT_PATHS: '.',
        'INPUT_OUTPUT-DIRECTORY': 'reports',
        GITHUB_STEP_SUMMARY: path.join(root, 'summary.txt'),
        GITHUB_OUTPUT: path.join(root, 'outputs.txt'),
      },
    };
    await run(process.execPath, [path.join(root, 'action.cjs')], options);
    const result = JSON.parse(
      await readFile(path.join(root, 'reports/documentation-quality.json'), 'utf8'),
    );
    if (result.summary.errors !== 0 || result.summary.files !== 1)
      throw new Error('Standalone Action pass fixture failed.');
    await access(path.join(root, 'reports/documentation-quality.sarif'));
    await access(path.join(root, 'reports/documentation-quality.html'));
    await writeFile(
      path.join(root, 'guide.md'),
      '---\ntitle: [unterminated\n---\n# Smoke\n',
    );
    let failed = false;
    try {
      await run(process.execPath, [path.join(root, 'action.cjs')], options);
    } catch (error) {
      if (error.code !== 1) throw error;
      failed = true;
    }
    if (!failed)
      throw new Error('Standalone Action failed to enforce its failure policy.');
    const failedResult = JSON.parse(
      await readFile(path.join(root, 'reports/documentation-quality.json'), 'utf8'),
    );
    if (failedResult.summary.errors < 1)
      throw new Error('Standalone Action failed without reporting the bad document.');
    console.log(
      'Standalone bundle: pass/fail fixtures, JSON, SARIF and HTML verified without node_modules.',
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

await verifyStandaloneAction();
