/**
 * Persistent bits (step 9B): best score + mute. Storage is optional — private
 * mode throws, so the fallback is in-memory and callers never branch on it.
 */
export interface RecordStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

export interface Records {
    readonly best: number;
    readonly muted: boolean;
    /** Stores `score` if it is a new best; returns whether it was. */
    submit(score: number): boolean;
    setMuted(muted: boolean): void;
}

const BEST_KEY = 'slash-master.best';
const MUTED_KEY = 'slash-master.muted';

function openStorage(): RecordStorage | null {
    try {
        const storage = globalThis.localStorage;
        // Probe once: a getter that exists but throws must degrade, not crash.
        storage.setItem('slash-master.probe', '1');
        storage.removeItem('slash-master.probe');
        return storage;
    } catch {
        return null;
    }
}

export function createRecords(storage: RecordStorage | null = openStorage()): Records {
    let best = 0;
    let muted = false;

    if (storage) {
        try {
            const stored = Number.parseInt(storage.getItem(BEST_KEY) ?? '', 10);
            best = Number.isFinite(stored) && stored > 0 ? stored : 0;
            muted = storage.getItem(MUTED_KEY) === '1';
        } catch {
            // Unreadable storage is the same as absent storage.
        }
    }

    function write(key: string, value: string): void {
        try {
            storage?.setItem(key, value);
        } catch {
            // Quota/private-mode failures must never break a round.
        }
    }

    return {
        get best() {
            return best;
        },
        get muted() {
            return muted;
        },
        submit(score: number): boolean {
            if (!(score > best)) return false;

            best = Math.floor(score);
            write(BEST_KEY, String(best));
            return true;
        },
        setMuted(next: boolean): void {
            muted = next;
            write(MUTED_KEY, next ? '1' : '0');
        },
    };
}
