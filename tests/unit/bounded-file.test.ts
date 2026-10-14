/**
 * @file Bounded descriptor-reader regressions.
 * @description Simulates growth, oversize files and failures independently of filesystem timing.
 * @remarks Key declarations are in source order; verified locations live in docs/code-map.md.
 */
import { open } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readBoundedDocument } from '../../src/scanner.js';

vi.mock('node:fs/promises', async (original) => {
  const actual = await original<Record<string, unknown>>();
  return { ...actual, open: vi.fn() };
});

afterEach(() => vi.resetAllMocks());

describe('bounded descriptor reading', () => {
  it('caps actual reads when a file grows beyond its initial descriptor stat', async () => {
    const close = vi.fn(async () => undefined);
    let consumed = 0;
    const handle = {
      stat: async () => ({ size: 1, isFile: () => true }),
      read: async (_buffer: Buffer, _offset: number, length: number) => {
        consumed += length;
        return { bytesRead: length };
      },
      close,
    };
    vi.mocked(open).mockResolvedValue(handle as unknown as FileHandle);
    await expect(readBoundedDocument('synthetic.md')).rejects.toThrow(/input limit/);
    expect(consumed).toBe(5 * 1024 * 1024 + 1);
    expect(close).toHaveBeenCalledOnce();
  });

  it('rejects known oversize inputs without reading and always closes', async () => {
    const read = vi.fn();
    const close = vi.fn(async () => undefined);
    const handle = {
      stat: async () => ({ size: 5 * 1024 * 1024 + 1, isFile: () => true }),
      read,
      close,
    };
    vi.mocked(open).mockResolvedValue(handle as unknown as FileHandle);
    await expect(readBoundedDocument('synthetic.md')).rejects.toThrow(/input limit/);
    expect(read).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
  });

  it('closes a descriptor when metadata access fails', async () => {
    const close = vi.fn(async () => undefined);
    const handle = {
      stat: async () => {
        throw new Error('synthetic failure');
      },
      close,
    };
    vi.mocked(open).mockResolvedValue(handle as unknown as FileHandle);
    await expect(readBoundedDocument('synthetic.md')).rejects.toThrow(
      'synthetic failure',
    );
    expect(close).toHaveBeenCalledOnce();
  });
});
