/**
 * Procedural audio (step 9C). No assets, no loader: every voice is synthesised
 * from oscillators and noise, so the payload grows by code only.
 *
 * The context can only start inside a user gesture (iOS), so `unlock()` is
 * called from the pointerdown path. Everything before that is silent by
 * design — never an error the game has to handle.
 */

export type Voice = 'swoosh' | 'pop' | 'boom' | 'combo' | 'over' | 'ui';

export interface Synth {
    /** `intensity` sharpens the voice (combo size); 0 = default. */
    play(voice: Voice, intensity: number): void;
}

export type SynthFactory = (context: AudioContext) => Synth;

export interface AudioEngine {
    /** Call from inside a user gesture; repeated calls are no-ops. */
    unlock(): void;
    /** Silent until unlocked, while muted, or where WebAudio is unavailable. */
    play(voice: Voice, intensity?: number): void;
    setMuted(muted: boolean): void;
    readonly unlocked: boolean;
    readonly muted: boolean;
    /** Last voice requested, muted or not (debug/harness). */
    readonly last: Voice | null;
}

function defaultContext(): AudioContext {
    const scope = globalThis as unknown as {
        AudioContext?: typeof AudioContext;
        webkitAudioContext?: typeof AudioContext;
    };
    const Ctor = scope.AudioContext ?? scope.webkitAudioContext;
    if (!Ctor) throw new Error('WebAudio unavailable');
    return new Ctor();
}

export function createAudio(
    factory: SynthFactory = createSynth,
    openContext: () => AudioContext = defaultContext,
): AudioEngine {
    let context: AudioContext | undefined;
    let synth: Synth | undefined;
    let failed = false;
    let muted = false;
    let last: Voice | null = null;

    function unlock(): void {
        if (synth || failed) return;

        try {
            context = openContext();
            synth = factory(context);
            // Autoplay policies can hand back a suspended context even now.
            if (context.state === 'suspended') void context.resume();
        } catch {
            // No WebAudio, or a constructor that throws in this browser: stay
            // silent for the session instead of retrying per gesture.
            failed = true;
        }
    }

    return {
        unlock,
        play(voice: Voice, intensity = 0): void {
            last = voice;
            if (!synth || muted) return;

            synth.play(voice, intensity);
        },
        setMuted(next: boolean): void {
            muted = next;
        },
        get unlocked() {
            return synth !== undefined;
        },
        get muted() {
            return muted;
        },
        get last() {
            return last;
        },
    };
}

/** Sets a short exponential envelope; `peak` is the loudest gain reached. */
function envelope(
    gain: GainNode,
    start: number,
    attack: number,
    peak: number,
    decay: number,
): void {
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + decay);
}

function createSynth(context: AudioContext): Synth {
    const master = context.createGain();
    master.gain.value = 0.5;
    master.connect(context.destination);

    let noise: AudioBuffer | undefined;
    let lastPop = -1;

    function noiseBuffer(): AudioBuffer {
        if (noise) return noise;

        const frames = Math.floor(context.sampleRate * 0.4);
        noise = context.createBuffer(1, frames, context.sampleRate);
        const data = noise.getChannelData(0);
        for (let index = 0; index < frames; index += 1) {
            data[index] = Math.random() * 2 - 1;
        }
        return noise;
    }

    function blip(
        type: OscillatorType,
        startHz: number,
        endHz: number,
        duration: number,
        peak: number,
    ): void {
        const now = context.currentTime;
        const osc = context.createOscillator();
        const gain = context.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(startHz, now);
        osc.frequency.exponentialRampToValueAtTime(Math.max(endHz, 20), now + duration);
        envelope(gain, now, 0.01, peak, duration);
        osc.connect(gain).connect(master);
        osc.start(now);
        osc.stop(now + duration + 0.02);
    }

    function burst(
        filterHz: number,
        duration: number,
        peak: number,
        type: BiquadFilterType = 'bandpass',
    ): void {
        const now = context.currentTime;
        const source = context.createBufferSource();
        const filter = context.createBiquadFilter();
        const gain = context.createGain();
        source.buffer = noiseBuffer();
        filter.type = type;
        filter.frequency.setValueAtTime(filterHz, now);
        filter.frequency.exponentialRampToValueAtTime(
            Math.max(filterHz * 0.35, 80),
            now + duration,
        );
        filter.Q.value = 0.8;
        envelope(gain, now, 0.01, peak, duration);
        source.connect(filter).connect(gain).connect(master);
        source.start(now);
        source.stop(now + duration + 0.02);
    }

    return {
        play(voice: Voice, intensity: number): void {
            switch (voice) {
                case 'pop': {
                    // One swipe can cut several in a step; cap the stack.
                    const now = context.currentTime;
                    if (now - lastPop < 0.04) return;
                    lastPop = now;
                    blip('sine', 620, 980, 0.14, 0.28);
                    burst(2400, 0.05, 0.12);
                    break;
                }
                case 'boom':
                    blip('sine', 150, 38, 0.45, 0.5);
                    burst(320, 0.4, 0.35, 'lowpass');
                    break;
                case 'swoosh':
                    burst(1000, 0.18, 0.18);
                    break;
                case 'combo': {
                    const base = 520 + Math.max(intensity, 2) * 45;
                    blip('triangle', base, base, 0.1, 0.2);
                    blip('triangle', base * 1.5, base * 1.5, 0.16, 0.18);
                    break;
                }
                case 'over':
                    blip('sine', 440, 196, 0.6, 0.28);
                    break;
                case 'ui':
                    blip('square', 320, 300, 0.05, 0.1);
                    break;
            }
        },
    };
}
