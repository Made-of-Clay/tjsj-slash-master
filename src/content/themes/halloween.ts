import { createPumpkinModel, createSkullModel } from '../models/halloween';
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
    // Step 7: procedural parts models. Size 1.0 → bounding radius 0.87, which
    // PLAYFIELD.sideMargin (1.0) covers, so edge spawns never clip. 7A ships
    // two-part seam stand-ins; 7B replaces the builders with the full recipes.
    objects: [
        {
            id: 'pumpkin',
            score: 1,
            category: 'target',
            model: createPumpkinModel(),
        },
        {
            id: 'skull',
            score: -1,
            category: 'restricted',
            model: createSkullModel(),
        },
    ],
    spawnRules: {
        // Ramp: [You] 2026-10-18. Cadence tightens and batches grow across
        // the round (see RampRange course correction in types.ts).
        intervalRange: { early: [1.2, 2.0], late: [0.6, 1.1] },
        batchRange: { early: [1, 1], late: [2, 3] },
        speedRange: [0.9, 1.1],
        apexRange: [0.5, 0.8],
        // Pinned to the play plane: a z offset shrinks the blade's reach and
        // parallax-shifts the object (chopping-bug fix 2026-10-21).
        depthRange: [0, 0],
        spinRange: [-3, 3],
        sideLaunchChance: 0.1,
    },
};
