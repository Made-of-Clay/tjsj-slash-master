import type { Theme } from '../types';

/**
 * Halloween theme (plan A split).
 *
 * Swapping only this theme data repaints the background and relights the scene
 * with zero code change. Gameplay must never import it: rendering-only.
 */
export const halloween: Theme = {
    id: 'halloween',
    background: {
        top: '#0e2730',
        bottom: '#03080b',
        vignette: '#000000',
        vignetteStrength: 0.6,
    },
    lighting: {
        ambient: '#ffffff',
        key: '#fff4e0',
        fill: '#8fb4ff',
        rim: '#ffffff',
    },
    accents: {
        target: '#ff7a45',
        restricted: '#22c1c3',
    },
    objects: [],
    spawnRules: {},
};
