/**
 * @file Execute the real main module against real owned profile files while injecting only Electron startup refusal.
 * @description Verify exact own-lock release, changed-token preservation and pre-acquisition refusal without launching Chromium.
 * @remarks This fault-controlled API boundary is not a claim that the operating system returned false during a live GUI run.
 * @remarks Functions, parameters and variables: generated docs/code-map.md (pnpm code-map).
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawnSync } = require('node:child_process');
const { openProfile } = require('../profile.cjs');

/** Replace only the Electron host API; main, ownership admission, real descriptors and token checks execute unchanged. */
const hostModule = `
import fs from 'node:fs';
import path from 'node:path';
const fixture = globalThis.startupFixture;
export const app = {
  isPackaged: false,
  commandLine: { appendSwitch() {} },
  setName() {},
  on() {},
  getAppPath() { return fixture.resources; },
  setPath(name, value) {
    fixture.calls.push(name);
    if (fixture.mode === 'set-path-error') throw new Error('injected setPath refusal');
    fixture.browser = value;
  },
  requestSingleInstanceLock() {
    fixture.calls.push('instance-refused');
    fixture.acquiredToken = fs.readFileSync(path.join(fixture.profile, 'owner.lock'), 'utf8');
    if (fixture.mode === 'changed-token') fs.writeFileSync(path.join(fixture.profile, 'owner.lock'), 'foreign retained token');
    return false;
  },
  whenReady() { throw new Error('Chromium readiness must never be reached'); },
  quit() { fixture.calls.push('quit'); }
};
export const dialog = { showErrorBox(title, message) { fixture.errors.push({title, message}); } };
export const protocol = { registerSchemesAsPrivileged() {} };
export const BrowserWindow = class {};
export const Menu = {};
export const ipcMain = {};
export const session = {};
`;

/** Run a fresh child so a failed startup cannot leak hooks, environment changes or nonzero exit status into other tests. */
function refusedStartup(t, mode) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'docquality-startup-refusal-'));
  t.after(() => fs.rmSync(root, { recursive: true }));
  const profile = path.join(root, 'workspace');
  const owner = openProfile(profile);
  owner.close();
  const marker = fs.readFileSync(path.join(profile, 'owner.json'));
  const corpus = Buffer.from(
    '{"synthetic":"existing saved corpus preserved byte for byte"}\n',
  );
  fs.writeFileSync(path.join(profile, 'project.json'), corpus);
  if (mode === 'preexisting-lock')
    fs.writeFileSync(path.join(profile, 'owner.lock'), 'preexisting retained token');
  const resources = path.join(root, 'application-resources');
  fs.mkdirSync(resources);
  const proof = path.join(root, 'child-proof.json');
  const main = pathToFileURL(require.resolve('../main.mjs')).href;
  const childCode = `
import fs from 'node:fs';
import { registerHooks } from 'node:module';
globalThis.startupFixture = ${JSON.stringify({ mode, profile, resources, calls: [], errors: [] })};
process.resourcesPath = ${JSON.stringify(resources)};
process.argv.push('--profile', ${JSON.stringify(profile)});
const host = ${JSON.stringify(hostModule)};
registerHooks({
  resolve(specifier, context, nextResolve) {
    return specifier === 'electron' ? {url:'fault-controlled:electron', shortCircuit:true} : nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    return url === 'fault-controlled:electron' ? {format:'module', source:host, shortCircuit:true} : nextLoad(url, context);
  }
});
await import(${JSON.stringify(main)});
fs.writeFileSync(${JSON.stringify(proof)}, JSON.stringify(globalThis.startupFixture));
`;
  const result = spawnSync(
    process.execPath,
    ['--input-type=module', '--eval', childCode],
    {
      encoding: 'utf8',
      timeout: 15000,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    },
  );
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1, result.stderr);
  assert.equal(
    result.stderr,
    '',
    'Startup refusal must not become an unhandled ownership exception.',
  );
  const observed = JSON.parse(fs.readFileSync(proof, 'utf8'));
  assert.equal(observed.errors.length, 1);
  assert.equal(observed.calls.at(-1), 'quit');
  assert.deepEqual(fs.readFileSync(path.join(profile, 'owner.json')), marker);
  assert.deepEqual(fs.readFileSync(path.join(profile, 'project.json')), corpus);
  return { profile, observed };
}

test('real main releases its acquired profile lock after the instance API refuses startup', (t) => {
  const { profile, observed } = refusedStartup(t, 'instance-refused');
  assert.match(observed.acquiredToken, /^[a-f0-9]{64}$/u);
  assert.equal(fs.existsSync(path.join(profile, 'owner.lock')), false);
  const reopened = openProfile(profile);
  reopened.close();
});

test('real main releases its acquired profile after setPath throws, without reaching instance or readiness', (t) => {
  const { profile, observed } = refusedStartup(t, 'set-path-error');
  assert.deepEqual(observed.calls, ['userData', 'quit']);
  assert.equal(fs.existsSync(path.join(profile, 'owner.lock')), false);
});

test('a token replaced after acquisition is retained while refusal still exits normally with status one', (t) => {
  const { profile } = refusedStartup(t, 'changed-token');
  assert.equal(
    fs.readFileSync(path.join(profile, 'owner.lock'), 'utf8'),
    'foreign retained token',
  );
});

test('a preexisting owner lock is preserved because the refused main never acquires it', (t) => {
  const { profile, observed } = refusedStartup(t, 'preexisting-lock');
  assert.deepEqual(observed.calls, ['quit']);
  assert.equal(
    fs.readFileSync(path.join(profile, 'owner.lock'), 'utf8'),
    'preexisting retained token',
  );
});
