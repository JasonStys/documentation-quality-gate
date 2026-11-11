/**
 * @file Observe real pinned Electron startup failure status with the unchanged main/profile implementation.
 * @description Only the native error-dialog display is substituted; no app lifecycle, profile, resource or ownership API is mocked.
 * @remarks Fresh synthetic profiles only. A timed-out child is a failed observation, never a successful close.
 * @remarks Functions, parameters and variables: generated docs/code-map.md (pnpm code-map).
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const { openProfile } = require('../profile.cjs');
const { ancestors, readRegular, newFile } = require('../files.cjs');
const root = path.resolve(import.meta.dirname, '../..');
const output = path.resolve(process.argv[2] ?? '');
if (
  process.argv.length !== 3 ||
  !output.startsWith(path.join(root, '.runtime') + path.sep)
)
  throw new Error('Choose a fresh own-project synthetic .runtime output.');
ancestors(path.dirname(output));
fs.mkdirSync(output);
newFile(path.join(output, 'synthetic.marker'), 'docquality-real-electron-status-v1\n');
const executable = path.join(root, 'desktop/node_modules/electron/dist/electron.exe');
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const executableHash = digest(readRegular(executable, 512 * 1024 * 1024));
const main = pathToFileURL(path.join(root, 'desktop/main.mjs')).href;
const mainHash = digest(readRegular(path.join(root, 'desktop/main.mjs'), 1024 * 1024));
const environment = Object.fromEntries(
  Object.entries(process.env).filter(
    ([key, value]) =>
      ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'COMSPEC', 'PATHEXT'].includes(key) &&
      typeof value === 'string',
  ),
);
function optionalRead(file, maximum) {
  try {
    return readRegular(file, maximum);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}
const cases = [];
for (const mode of [
  'exit-code-quit',
  'normal-quit',
  'explicit-exit',
  'foreign-lock',
  'missing-resources',
]) {
  const directory = path.join(output, mode);
  fs.mkdirSync(directory);
  const appRoot = path.join(directory, 'application');
  fs.mkdirSync(appRoot);
  const profile = path.join(directory, 'profile');
  const owner = openProfile(profile);
  owner.close();
  const marker = readRegular(path.join(profile, 'owner.json'), 4096);
  const corpus = Buffer.from('{"synthetic":"retained current-corpus byte sentinel"}\n');
  newFile(path.join(profile, 'project.json'), corpus);
  const token = 'foreign retained ownership evidence';
  if (mode === 'foreign-lock') newFile(path.join(profile, 'owner.lock'), token);
  const childEnvironment = { ...environment };
  for (const key of ['APPDATA', 'LOCALAPPDATA', 'HOME', 'USERPROFILE', 'TEMP', 'TMP']) {
    const folder = path.join(directory, key.toLowerCase());
    fs.mkdirSync(folder);
    childEnvironment[key] = folder;
  }
  childEnvironment.DOCQUALITY_NATIVE_RESOURCES = path.join(
    directory,
    'missing-owned-resources',
  );
  const childProof = path.join(directory, 'child.json');
  newFile(
    path.join(appRoot, 'package.json'),
    JSON.stringify({
      name: 'docquality-synthetic-startup-status',
      version: '0.0.0',
      type: 'module',
      main: 'entry.mjs',
    }),
  );
  // Lifecycle methods are actual Electron APIs. Only error-box display is redirected to a fixed receipt.
  const entry = `
import {app, dialog, BrowserWindow} from 'electron';
import fs from 'node:fs';
app.commandLine.appendSwitch('disable-background-networking');
app.setPath('userData', ${JSON.stringify(path.join(directory, 'initial-browser'))});
const record = (extra) => fs.writeFileSync(${JSON.stringify(childProof)}, JSON.stringify({electron:process.versions.electron,node:process.versions.node,windows:app.isReady()?BrowserWindow.getAllWindows().length:0,...extra})+'\\n', {flag:'wx'});
${
  ['foreign-lock', 'missing-resources'].includes(mode)
    ? `dialog.showErrorBox = (title) => record({kind:'actual-main-error',title});\nawait import(${JSON.stringify(main)});`
    : `app.whenReady().then(() => {\nrecord({kind:${JSON.stringify(mode)}});\n${mode === 'explicit-exit' ? 'app.exit(1);' : `${mode === 'exit-code-quit' ? 'process.exitCode=1;' : ''}\napp.quit();`}\n});`
}
`;
  newFile(path.join(appRoot, 'entry.mjs'), entry);
  const result = spawnSync(executable, [appRoot, '--profile', profile], {
    cwd: root,
    env: childEnvironment,
    encoding: 'utf8',
    timeout: 15000,
    maxBuffer: 65536,
    windowsHide: true,
  });
  const expected = ['explicit-exit', 'foreign-lock', 'missing-resources'].includes(mode)
    ? 1
    : 0;
  const childBytes = optionalRead(childProof, 16384);
  const observation = {
    mode,
    expectedExit: expected,
    actualExit: result.status,
    signal: result.signal,
    timeoutOrStartError: result.error?.code ?? null,
    diagnostics: (result.stderr ?? '').slice(0, 4000),
    child: childBytes ? JSON.parse(childBytes.toString('utf8')) : null,
    markerPreserved: readRegular(path.join(profile, 'owner.json'), 4096).equals(marker),
    corpusPreserved: readRegular(path.join(profile, 'project.json'), 4096).equals(corpus),
  };
  observation.lock =
    optionalRead(path.join(profile, 'owner.lock'), 4096)?.toString('utf8') ?? null;
  observation.passed =
    !result.error &&
    result.signal === null &&
    result.status === expected &&
    observation.child?.electron === '44.11.1' &&
    observation.child.windows === 0 &&
    observation.markerPreserved &&
    observation.corpusPreserved &&
    observation.lock === (mode === 'foreign-lock' ? token : null);
  cases.push(observation);
}
const passed =
  cases.every((item) => item.passed) &&
  digest(readRegular(executable, 512 * 1024 * 1024)) === executableHash;
newFile(
  path.join(output, 'proof.json'),
  JSON.stringify(
    {
      schema: 1,
      passed,
      mainSha256: mainHash,
      runtimeSha256: executableHash,
      cases,
      scope:
        'Actual pinned Electron API and real source main/profile startup only; no worker or application window is created by these cases. Separate full compiled consumer proves ordinary graphical work and shutdown.',
    },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify({
    passed,
    cases: cases.map(({ mode, actualExit, expectedExit, passed }) => ({
      mode,
      actualExit,
      expectedExit,
      passed,
    })),
  }),
);
if (!passed) process.exitCode = 1;
