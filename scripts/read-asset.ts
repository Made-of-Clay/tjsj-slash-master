import { readFileSync } from 'node:fs';

/**
 * Harnesses run under bun, whose `fetch` does not read `file:` URLs, so the
 * theme's asset bytes come straight off disk — the same bytes the browser gets.
 */
export function readAssetBytes(url: string): ArrayBuffer {
    const path = decodeURIComponent(new URL(url).pathname);
    const file = readFileSync(path);
    return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
}
