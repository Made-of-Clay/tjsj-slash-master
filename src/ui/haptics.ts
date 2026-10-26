/**
 * Haptics (step 9C): fixed vibration patterns, silently absent on devices
 * without `navigator.vibrate` (iOS Safari). Callers gate on mute; this module
 * never reads game state.
 */
export type Pulse = 'cut' | 'hazard' | 'over';

export interface Haptics {
    pulse(kind: Pulse): void;
    /** False when the platform has no vibration motor exposed. */
    readonly enabled: boolean;
}

const PATTERNS: Record<Pulse, number | number[]> = {
    cut: 12,
    hazard: [24, 40, 60],
    over: [60, 60, 120],
};

type Vibrate = (pattern: number | number[]) => boolean;

function defaultVibrate(): Vibrate | undefined {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
        return undefined;
    }
    return (pattern) => navigator.vibrate(pattern);
}

export function createHaptics(vibrate: Vibrate | undefined = defaultVibrate()): Haptics {
    return {
        pulse(kind: Pulse): void {
            vibrate?.(PATTERNS[kind]);
        },
        get enabled() {
            return vibrate !== undefined;
        },
    };
}
