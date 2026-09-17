/**
 * @file Test filesystem helpers.
 * @description Creates isolated repositories for deterministic unit and integration tests.
 * @remarks Key declarations are listed in source order; verified locations live in docs/code-map.md.
 */
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

export interface TemporaryRepository {
  readonly root: string;
  readonly write: (relativePath: string, content: string) => Promise<void>;
  readonly cleanup: () => Promise<void>;
}

/** Creates a disposable repository and safe relative-path writer. */
export async function createTemporaryRepository(): Promise<TemporaryRepository> {
  const root = await mkdtemp(path.join(tmpdir(), 'documentation-quality-gate-'));
  return {
    root,
    async write(relativePath: string, content: string): Promise<void> {
      const destination = path.resolve(root, relativePath);
      if (!destination.startsWith(`${root}${path.sep}`)) {
        throw new Error('Test path escaped temporary repository.');
      }
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, content, 'utf8');
    },
    async cleanup(): Promise<void> {
      await rm(root, { force: true, recursive: true });
    },
  };
}
