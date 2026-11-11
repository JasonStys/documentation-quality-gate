/**
 * @file Exercise failed-startup drain against the actual retained-operation and profile implementations.
 * @description Held accepted work and changed real ownership files must not be bypassed by explicit exit.
 * @remarks Only the final process-exit observer is inert. Generated source locations: docs/code-map.md.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createOperations, finishFailedStartup } = require('../operation.cjs');
const { openProfile } = require('../profile.cjs');

test('failed startup retains an actual accepted operation and real profile until its same work completes', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'docquality-fatal-drain-'));
  t.after(() => fs.rmSync(root, { recursive: true }));
  const profile = openProfile(path.join(root, 'workspace'));
  const marker = fs.readFileSync(path.join(profile.directory, 'owner.json'));
  const owner = createOperations();
  const order = [];
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const work = owner.run(async () => {
    await gate;
    order.push('actual accepted work completed');
  });
  const end = finishFailedStartup(owner, profile, (code) => {
    assert.equal(fs.existsSync(path.join(profile.directory, 'owner.lock')), false);
    order.push(code);
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(order, []);
  assert.equal(owner.closing, true);
  assert.equal(fs.existsSync(path.join(profile.directory, 'owner.lock')), true);
  await assert.rejects(
    owner.run(() => {}),
    /Finish the active/u,
  );
  release();
  await Promise.all([work, end]);
  assert.deepEqual(order, ['actual accepted work completed', 1]);
  assert.deepEqual(fs.readFileSync(path.join(profile.directory, 'owner.json')), marker);
});

test('failed accepted work still settles before a nonzero startup exit is observed', async () => {
  const owner = createOperations();
  const work = owner.run(() => {
    throw new Error('original accepted failure');
  });
  const original = assert.rejects(work, /original accepted failure/u);
  const codes = [];
  await finishFailedStartup(owner, undefined, (code) => codes.push(code));
  await original;
  assert.deepEqual(codes, [1]);
});

test('an actual replaced profile token remains byte-identical while startup reports failure', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'docquality-fatal-token-'));
  t.after(() => fs.rmSync(root, { recursive: true }));
  const profile = openProfile(path.join(root, 'workspace'));
  const lock = path.join(profile.directory, 'owner.lock');
  fs.writeFileSync(lock, 'foreign changed ownership retained');
  const codes = [];
  await finishFailedStartup(createOperations(), profile, (code) => codes.push(code));
  assert.equal(fs.readFileSync(lock, 'utf8'), 'foreign changed ownership retained');
  assert.deepEqual(codes, [1]);
});

test('a rejected ownership drain never releases a profile or requests process exit', async () => {
  const calls = [];
  await assert.rejects(
    finishFailedStartup(
      {
        finish: async () => {
          throw new Error('drain unproven');
        },
      },
      { close: () => calls.push('close') },
      (code) => calls.push(code),
    ),
    /drain unproven/u,
  );
  assert.deepEqual(calls, []);
});
