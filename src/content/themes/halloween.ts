import {
    createBombModel,
    createCandyModel,
    createPumpkinHalves,
    createPumpkinModel,
    createSkullModel,
} from '../models/halloween';
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
        hazard: '#ff3b30',
    },
    // Step 7 procedural art: sizes ≤ 1.15 → radius ≤ 0.996, inside
    // PLAYFIELD.sideMargin, so edge spawns never clip. Pumpkin is the one def
    // with authored slice halves; the rest fall back to scaled clones.
    objects: [
        {
            id: 'pumpkin',
            score: 1,
            category: 'target',
            model: createPumpkinModel(),
            pieces: createPumpkinHalves(),
        },
        {
            id: 'candy',
            score: 1,
            category: 'target',
            model: createCandyModel(),
        },
        {
            id: 'skull',
            score: -1,
            category: 'restricted',
            model: createSkullModel(),
        },
        {
            id: 'bomb',
            score: -3,
            category: 'hazard',
            weight: 0.15,
            model: createBombModel(),
        },
    ],
    spawnRules: {
        // Cadence tightens and batches grow across the round.
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
