/**
 * @file Retain accepted native work, including real worker exit and the actual save-dialog completion.
 * @remarks Functions, parameters, state variables and exact declaration locations: generated docs/code-map.md (pnpm code-map).
 */
'use strict';
function createOperations() {
  const pending = new Set();
  let closing = false;
  return {
    get busy() {
      return pending.size > 0;
    },
    get closing() {
      return closing;
    },
    async run(work) {
      if (closing || pending.size)
        throw new Error('Finish the active local operation first.');
      const task = Promise.resolve().then(work);
      pending.add(task);
      try {
        return await task;
      } finally {
        pending.delete(task);
      }
    },
    async finish() {
      closing = true;
      await Promise.allSettled([...pending]);
    },
  };
}
/** Failed startup alone may explicitly exit nonzero, after the same actual retained-work drain. */
async function finishFailedStartup(owner, profile, exit) {
  await owner.finish();
  try {
    profile?.close();
  } catch {
    // An already-foreign or changed lock stays intact. Startup still reports failure.
  }
  exit(1);
}
module.exports = { createOperations, finishFailedStartup };
