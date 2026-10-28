// Bun supplies these at runtime; the project ships no @types/node.
declare module 'node:fs' {
    export function readFileSync(path: string, encoding: 'utf8'): string;
    /** No encoding: raw bytes, for binary assets the harnesses parse. */
    export function readFileSync(path: string): Uint8Array;
    export function readdirSync(path: string): string[];
    export function statSync(path: string): { isDirectory(): boolean };
}
