import {
    BoxGeometry,
    ConeGeometry,
    CylinderGeometry,
    IcosahedronGeometry,
    SphereGeometry,
    TorusGeometry,
} from 'three/webgpu';
import type { ObjectModel } from '../types';

/**
 * Parts centered on origin, fit a `size` box, low-poly.
 * Each def's radius must stay within `PLAYFIELD.sideMargin`.
 */

export function createOrnamentModel(): ObjectModel {
    return {
        kind: 'parts',
        size: 1.1,
        parts: [
            {
                geometry: new SphereGeometry(0.36, 16, 12),
                color: '#c8203c',
                position: [0, -0.08, 0],
            },
            {
                geometry: new CylinderGeometry(0.1, 0.1, 0.1, 8),
                color: '#d9b04a',
                position: [0, 0.3, 0],
            },
            {
                geometry: new TorusGeometry(0.05, 0.018, 6, 10),
                color: '#e8cf7a',
                position: [0, 0.34, 0],
            },
        ],
    };
}

export function createCandyCaneModel(): ObjectModel {
    return {
        kind: 'parts',
        size: 1.1,
        parts: [
            {
                geometry: new CylinderGeometry(0.07, 0.07, 0.72, 8),
                color: '#f2efe6',
                position: [-0.16, -0.12, 0],
            },
            {
                geometry: new TorusGeometry(0.16, 0.07, 6, 12, Math.PI),
                color: '#cf2436',
                position: [0, 0.24, 0],
            },
        ],
    };
}

export function createGiftModel(): ObjectModel {
    return {
        kind: 'parts',
        size: 1,
        parts: [
            {
                geometry: new BoxGeometry(0.66, 0.56, 0.5),
                color: '#2e7a58',
                position: [0, -0.07, 0],
            },
            {
                geometry: new BoxGeometry(0.12, 0.58, 0.52),
                color: '#e0bd5a',
                position: [0, -0.07, 0],
            },
            {
                geometry: new BoxGeometry(0.68, 0.12, 0.52),
                color: '#e0bd5a',
                position: [0, -0.07, 0],
            },
            {
                geometry: new SphereGeometry(0.09, 6, 4),
                color: '#e0bd5a',
                position: [-0.1, 0.26, 0],
            },
            {
                geometry: new SphereGeometry(0.09, 6, 4),
                color: '#e0bd5a',
                position: [0.1, 0.26, 0],
            },
        ],
    };
}

export function createSnowGlobeModel(): ObjectModel {
    return {
        kind: 'parts',
        size: 1.1,
        parts: [
            { geometry: new SphereGeometry(0.4, 16, 12), color: '#cfe9f4', position: [0, 0.04, 0] },
            {
                geometry: new CylinderGeometry(0.34, 0.4, 0.2, 12),
                color: '#6d4a33',
                position: [0, -0.4, 0],
            },
            { geometry: new ConeGeometry(0.16, 0.4, 8), color: '#2e8f5a' },
        ],
    };
}

/** Hazard (9B): a lump of coal — the Christmas answer to a bomb. */
export function createCoalModel(): ObjectModel {
    return {
        kind: 'parts',
        size: 1,
        parts: [
            {
                geometry: new IcosahedronGeometry(0.38, 0),
                color: '#262a31',
                scale: [1.05, 0.9, 0.9],
            },
            {
                geometry: new IcosahedronGeometry(0.2, 0),
                color: '#343943',
                position: [0.2, 0.16, 0.05],
                rotation: [0.3, 0.4, 0],
            },
            {
                geometry: new BoxGeometry(0.26, 0.08, 0.06),
                color: '#b03a3a',
                position: [-0.06, 0.3, 0.18],
                rotation: [0, 0, 0.35],
            },
        ],
    };
}
