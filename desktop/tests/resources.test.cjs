/**
 * @file Bind actual fixed payload bytes and refuse expanded protocol or source inventories.
 * @remarks Functions, parameters, state variables and exact declaration locations: generated docs/code-map.md (pnpm code-map).
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { OWNER, PAYLOAD, verifiedResources, responseFor } = require('../resources.cjs');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'docquality-resources-'));
  t.after(() => fs.rmSync(root, { recursive: true }));
  const payload = path.join(root, 'payload'),
    owner = path.join(root, 'owner');
  fs.mkdirSync(payload);
  fs.mkdirSync(owner);
  const write = (base, names) =>
    Object.fromEntries(
      names.map((name) => {
        const text = 'inert synthetic ' + name;
        fs.writeFileSync(path.join(base, name), text);
        return [name, createHash('sha256').update(text).digest('hex')];
      }),
    );
  const metadata = {
    schema: 1,
    product: 'documentation-quality-gate',
    version: '1.1.0',
    source: 'a'.repeat(40),
    sourceDirty: false,
    files: write(payload, PAYLOAD),
    owner: write(owner, OWNER),
  };
  const save = () =>
    fs.writeFileSync(path.join(payload, 'SOURCE.json'), JSON.stringify(metadata));
  save();
  return { payload, owner, metadata, save };
}
test('only the exact three renderer resources are served, never the Node engine or private paths', async (t) => {
  const value = fixture(t),
    verified = verifiedResources(value.payload, value.owner);
  assert.equal(verified.metadata.version, '1.1.0');
  const own = responseFor(new Request('docquality://workbench/'), verified.data);
  assert.equal(own.status, 200);
  assert.match(await own.text(), /inert/);
  assert.match(own.headers.get('content-security-policy'), /connect-src 'none'/);
  assert.equal(
    await responseFor(
      new Request('docquality://workbench/', { method: 'HEAD' }),
      verified.data,
    ).text(),
    '',
  );
  for (const url of [
    'docquality://workbench/worker.cjs',
    'docquality://workbench/api.cjs',
    'docquality://workbench/project.json',
    'https://outside.invalid/index.html',
    'docquality://other/index.html',
  ])
    assert.equal(responseFor(new Request(url), verified.data).status, 404);
  assert.equal(
    responseFor(new Request('docquality://workbench/', { method: 'POST' }), verified.data)
      .status,
    404,
  );
});
test('changed real owner bytes fail before any module execution', (t) => {
  const value = fixture(t);
  fs.appendFileSync(path.join(value.owner, 'tasks.cjs'), 'changed');
  assert.throws(() => verifiedResources(value.payload, value.owner));
});
test('unknown resource paths, missing Node worker and wrong source/version identity all fail closed', (t) => {
  const value = fixture(t);
  value.metadata.files['../private.txt'] = 'a'.repeat(64);
  value.save();
  assert.throws(() => verifiedResources(value.payload, value.owner));
  delete value.metadata.files['../private.txt'];
  delete value.metadata.files['worker.cjs'];
  value.save();
  assert.throws(() => verifiedResources(value.payload, value.owner));
  value.metadata.files['worker.cjs'] = createHash('sha256')
    .update('inert synthetic worker.cjs')
    .digest('hex');
  for (const [key, invalid] of [
    ['version', '1.0.0'],
    ['source', 'not-a-source'],
    ['sourceDirty', 'false'],
    ['product', 'other'],
  ]) {
    const previous = value.metadata[key];
    value.metadata[key] = invalid;
    value.save();
    assert.throws(() => verifiedResources(value.payload, value.owner));
    value.metadata[key] = previous;
  }
});
