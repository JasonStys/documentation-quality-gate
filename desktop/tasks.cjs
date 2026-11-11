/**
 * @file One-shot original scanner worker ownership; snapshots are removed only after actual thread exit.
 * @remarks Functions, parameters, state variables and exact declaration locations: generated docs/code-map.md (pnpm code-map).
 */
'use strict';
const { Worker } = require('node:worker_threads');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

async function runTask(workerPath, operation, project, reviewSha256) {
  const directory = await mkdtemp(join(tmpdir(), 'docquality-owned-'));
  try {
    return await new Promise((resolve, reject) => {
      let response, failure;
      const worker = new Worker(workerPath, {
        workerData: {
          operation,
          project,
          snapshot: join(directory, 'corpus'),
          ...(reviewSha256 ? { reviewSha256 } : {}),
        },
      });
      worker.on('message', (value) => {
        if (response) failure = true;
        else response = value;
      });
      worker.on('error', () => {
        failure = true;
      });
      worker.on('exit', (code) => {
        if (code !== 0 || failure || !response || response.success !== true)
          reject(
            new Error(
              'The actual offline review was not completed. Check input, current review and policy, then analyze again.',
            ),
          );
        else resolve(response.value);
      });
    });
  } finally {
    await rm(directory, { recursive: true });
  }
}
module.exports = { runTask };
