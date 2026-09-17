/**
 * @file Repository-scale benchmark.
 * @description Measures complete deterministic scans over 100, 1,000, and 10,000 generated pages.
 * @remarks Key declarations are listed in source order; verified locations live in docs/code-map.md.
 */
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { scanRepository } from '../src/scanner.js';

interface BenchmarkResult {
  readonly pages: number;
  readonly elapsedMs: number;
  readonly pagesPerSecond: number;
  readonly diagnostics: number;
}

const sizes = [100, 1_000, 10_000] as const;
const results: BenchmarkResult[] = [];

/** Writes generated fixtures in bounded batches to avoid exhausting file handles. */
async function writeFixtures(root: string, count: number): Promise<void> {
  const docs = path.join(root, 'docs');
  await mkdir(docs, { recursive: true });
  for (let start = 0; start < count; start += 100) {
    const end = Math.min(start + 100, count);
    await Promise.all(
      Array.from({ length: end - start }, (_, offset) => {
        const index = start + offset;
        const source = `---\ntitle: Topic ${index}\nid: topic-${index}\nversion: 1.0.0\n---\n# Topic ${index}\n\n## Procedure\n\nRun the bounded check.\n\n\`\`\`json\n{"topic":${index}}\n\`\`\`\n`;
        return writeFile(
          path.join(docs, `topic-${String(index).padStart(5, '0')}.md`),
          source,
          'utf8',
        );
      }),
    );
  }
}

for (const pages of sizes) {
  const root = await mkdtemp(path.join(tmpdir(), 'doc-quality-benchmark-'));
  try {
    await writeFile(
      path.join(root, '.docquality.json'),
      `${JSON.stringify({ include: ['docs/**/*.md'], exclude: [], requiredMetadata: ['title', 'id', 'version'] })}\n`,
      'utf8',
    );
    await writeFixtures(root, pages);
    const started = performance.now();
    const result = await scanRepository({ rootDirectory: root });
    const elapsedMs = performance.now() - started;
    results.push({
      pages,
      elapsedMs: Number(elapsedMs.toFixed(3)),
      pagesPerSecond: Number(((pages / elapsedMs) * 1_000).toFixed(1)),
      diagnostics: result.diagnostics.length,
    });
  } finally {
    await rm(root, { force: true, recursive: true });
  }
}

await mkdir('artifacts', { recursive: true });
await writeFile(
  'artifacts/benchmark.json',
  `${JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)}\n`,
  'utf8',
);
process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
