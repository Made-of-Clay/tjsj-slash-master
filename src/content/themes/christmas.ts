import {
    createCandyCaneModel,
    createGiftModel,
    createOrnamentModel,
    createSnowGlobeModel,
} from '../models/christmas';
import type { Theme } from '../types';

/** Christmas theme: data-only swap — palette, lighting, art and spawn rules. */
export const christmas: Theme = {
    id: 'christmas',
    background: {
        top: '#13294b',
        bottom: '#04070f',
        vignette: '#000000',
        vignetteStrength: 0.55,
    },
    lighting: {
        ambient: '#dfe9ff',
        key: '#ffffff',
        fill: '#7fb6ff',
        rim: '#dff1ff',
    },
    accents: {
        target: '#ffcf5a',
        restricted: '#7fd4e8',
    },
    objects: [
        {
            id: 'ornament',
            score: 1,
            category: 'target',
            model: createOrnamentModel(),
        },
        {
            id: 'candyCane',
            score: 1,
            category: 'target',
            model: createCandyCaneModel(),
        },
        {
            id: 'gift',
            score: 1,
            category: 'target',
            model: createGiftModel(),
        },
        {
            id: 'snowGlobe',
            score: -1,
            category: 'restricted',
            model: createSnowGlobeModel(),
        },
    ],
    spawnRules: {
        // Slightly tighter early cadence than Halloween, proving rules travel
        // with the theme data.
        intervalRange: { early: [1.0, 1.8], late: [0.55, 1.0] },
        batchRange: { early: [1, 1], late: [2, 3] },
        speedRange: [0.9, 1.1],
        apexRange: [0.5, 0.8],
        depthRange: [0, 0],
        spinRange: [-3, 3],
        sideLaunchChance: 0.1,
    },
};
