/*
 * Polish checks for step 9.
 *
 *   bun scripts/verify-polish.ts
 *
 * Plain assertions over the feel systems' state machines: audio unlocking and
 * muting, haptic patterns, and the guarded record store. No WebAudio, no DOM,
 * no vibration motor — the synth and storage are injected, so what is asserted
 * is policy, not platform. Sound/haptics by ear stay [You]'s.
 */

let failures = 0;
let total = 0;
function check(name: string, condition: boolean, detail = ''): void {
    total += 1;
    if (condition) {
        console.log(`  ok    ${name}`);
    } else {
        failures += 1;
        console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
    }
}

import { createAudio } from '../src/audio/Audio.ts';
import type { SynthFactory, Voice } from '../src/audio/Audio.ts';
import { createHaptics } from '../src/ui/haptics.ts';
import { createRecords } from '../src/ui/records.ts';
import type { RecordStorage } from '../src/ui/records.ts';

// ===== audio =====
console.log('Audio');

function audioStub(): { calls: number; context: () => AudioContext } {
    const stub = {
        calls: 0,
        context: () => {
            stub.calls += 1;
            return {
                state: 'running',
                resume: () => Promise.resolve(),
            } as unknown as AudioContext;
        },
    };
    return stub;
}

{
    const played: Array<[Voice, number]> = [];
    const factory: SynthFactory = (context) => {
        void context;
        return {
            play(voice, intensity) {
                played.push([voice, intensity]);
            },
        };
    };

    const stub = audioStub();
    const audio = createAudio(factory, stub.context);

    audio.play('pop');
    check('nothing plays before unlock', played.length === 0);
    check('the requested voice is still recorded', audio.last === 'pop');
    check('unlocked is false before unlock', audio.unlocked === false);

    audio.unlock();
    check('unlock creates one context', stub.calls === 1 && audio.unlocked);
    audio.unlock();
    check('unlock is idempotent', stub.calls === 1);

    audio.play('pop');
    check('an unlocked engine reaches the synth', played.length === 1);

    audio.play('combo', 4);
    check(
        'intensity is threaded through',
        played.length === 2 && played[1][0] === 'combo' && played[1][1] === 4,
    );

    audio.setMuted(true);
    check('muting is reported', audio.muted === true);
    audio.play('boom');
    check('muted play is silent', played.length === 2);
    check('muted play still records the voice', audio.last === 'boom');

    audio.setMuted(false);
    audio.play('over');
    check('unmuting resumes playback', played.length === 3 && played[2][0] === 'over');
}

{
    let made = 0;
    const audio = createAudio(
        () => {
            made += 1;
            throw new Error('no context');
        },
        () => {
            throw new Error('no webaudio');
        },
    );

    audio.unlock();
    check('a throwing context leaves the engine silent', audio.unlocked === false);
    audio.unlock();
    check('a failed unlock is not retried', made === 0);
    check('play stays a no-op after failure', (audio.play('pop'), audio.last === 'pop'));
}

// ===== haptics =====
console.log('Haptics');
{
    const patterns: Array<number | number[]> = [];
    const haptics = createHaptics((pattern) => {
        patterns.push(pattern);
        return true;
    });

    check('haptics report enabled with a vibrate hook', haptics.enabled);
    haptics.pulse('cut');
    haptics.pulse('hazard');
    haptics.pulse('over');
    check('each pulse has its own pattern', patterns.length === 3);
    check('cut is a short single pulse', patterns[0] === 12);
    check(
        'hazard and over are patterned',
        Array.isArray(patterns[1]) && Array.isArray(patterns[2]),
    );

    const absent = createHaptics(undefined);
    check('absent vibrate is reported', absent.enabled === false);
    check('absent vibrate does not throw', (absent.pulse('cut'), true));
}

// ===== records =====
console.log('Records');

function memoryStorage(initial: Record<string, string> = {}): RecordStorage {
    const data = new Map(Object.entries(initial));
    return {
        getItem: (key) => data.get(key) ?? null,
        setItem: (key, value) => {
            data.set(key, value);
        },
        removeItem: (key) => {
            data.delete(key);
        },
    };
}

{
    const storage = memoryStorage();
    const records = createRecords(storage);

    check('a fresh store starts at zero', records.best === 0);
    check('sound starts on', records.muted === false);
    check('a zero score is not a record', records.submit(0) === false);
    check('a real score is a record', records.submit(12) === true);
    check('the best updates', records.best === 12);
    check('a lower score is not a record', records.submit(5) === false);
    check('a new high updates again', records.submit(20) === true && records.best === 20);

    const reloaded = createRecords(storage);
    check('the best survives a reload', reloaded.best === 20);

    records.setMuted(true);
    check('mute persists', createRecords(storage).muted === true);
}

{
    const storage = memoryStorage({ 'slash-master.best': 'nonsense' });
    check('garbage storage reads as zero', createRecords(storage).best === 0);
}

{
    const angry: RecordStorage = {
        getItem: () => {
            throw new Error('denied');
        },
        setItem: () => {
            throw new Error('denied');
        },
        removeItem: () => {
            throw new Error('denied');
        },
    };
    const records = createRecords(angry);
    check('unreadable storage still boots at zero', records.best === 0);
    check('unwritable storage still keeps the score in memory', records.submit(9) === true);
    check('the in-memory best is readable', records.best === 9);
    check('mute still applies in memory', (records.setMuted(true), records.muted === true));

    const absent = createRecords(null);
    check('null storage is an in-memory store', absent.best === 0 && absent.submit(3));
}

if (failures > 0) {
    throw new Error(`${failures} polish check(s) failed`);
}

console.log(`\nALL PASS — ${total} checks`);
