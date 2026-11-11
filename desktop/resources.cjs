/**
 * @file Verify fixed native source payloads before loading any bundled module or serving renderer bytes.
 * @remarks Functions, parameters, state variables and exact declaration locations: generated docs/code-map.md (pnpm code-map).
 */
'use strict';
const { createHash } = require('node:crypto');
const { join } = require('node:path');
const { readRegular, readUtf8 } = require('./files.cjs');
const OWNER = [
  'files.cjs',
  'profile.cjs',
  'state.cjs',
  'operation.cjs',
  'tasks.cjs',
  'resources.cjs',
  'main.mjs',
  'preload.cjs',
];
const PAYLOAD = [
  'index.html',
  'app.js',
  'style.css',
  'api.cjs',
  'worker.cjs',
  'BUNDLED-NOTICES.txt',
];
const CSP =
  "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-src 'none'; form-action 'none'";
function verifiedResources(root, ownerRoot) {
  const metadata = JSON.parse(readUtf8(join(root, 'SOURCE.json'), 512 * 1024));
  if (
    !metadata ||
    Object.keys(metadata).sort().join('|') !==
      'files|owner|product|schema|source|sourceDirty|version' ||
    metadata.schema !== 1 ||
    metadata.product !== 'documentation-quality-gate' ||
    metadata.version !== '1.1.1' ||
    !/^[a-f0-9]{40}$/.test(metadata.source) ||
    typeof metadata.sourceDirty !== 'boolean' ||
    !metadata.files ||
    Object.keys(metadata.files).sort().join('|') !== [...PAYLOAD].sort().join('|') ||
    !metadata.owner ||
    Object.keys(metadata.owner).sort().join('|') !== [...OWNER].sort().join('|')
  )
    throw new Error('Packaged documentation workbench identity is invalid.');
  const data = new Map();
  let total = 0;
  for (const [names, base] of [
    [metadata.files, root],
    [metadata.owner, ownerRoot],
  ])
    for (const [name, expected] of Object.entries(names)) {
      if (typeof expected !== 'string' || !/^[a-f0-9]{64}$/.test(expected))
        throw new Error('Invalid packaged hash.');
      const bytes = readRegular(join(base, name), 16 * 1024 * 1024);
      total += bytes.length;
      if (
        total > 32 * 1024 * 1024 ||
        createHash('sha256').update(bytes).digest('hex') !== expected
      )
        throw new Error('Packaged bytes differ or exceed their bound.');
      if (base === root && ['index.html', 'app.js', 'style.css'].includes(name))
        data.set('/' + name, bytes);
    }
  return { metadata, data };
}
function responseFor(request, data) {
  const url = new URL(request.url);
  const name = url.pathname === '/' ? '/index.html' : url.pathname;
  const bytes = data.get(name);
  if (
    url.protocol !== 'docquality:' ||
    url.hostname !== 'workbench' ||
    url.port ||
    url.username ||
    url.password ||
    !['GET', 'HEAD'].includes(request.method) ||
    !bytes
  )
    return new Response('Not found', { status: 404 });
  return new Response(request.method === 'HEAD' ? null : bytes, {
    headers: {
      'content-type': name.endsWith('.html')
        ? 'text/html; charset=utf-8'
        : name.endsWith('.css')
          ? 'text/css'
          : 'text/javascript',
      'content-security-policy': CSP,
      'x-content-type-options': 'nosniff',
      'cache-control': 'no-store',
    },
  });
}
module.exports = { verifiedResources, responseFor, OWNER, PAYLOAD };
