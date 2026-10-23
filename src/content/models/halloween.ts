import {
    BoxGeometry,
    CircleGeometry,
    ConeGeometry,
    CylinderGeometry,
    SphereGeometry,
} from 'three/webgpu';
import type { ObjectModel } from '../types';

/**
 * Parts centered on origin, fit a `size` box, low-poly.
 * Each def's radius must stay within `PLAYFIELD.sideMargin`.
 */

export function createPumpkinModel(): ObjectModel {
    return {
        kind: 'parts',
        size: 1,
        parts: [
            {
                geometry: new SphereGeometry(0.5, 16, 12),
                color: '#e8722c',
                scale: [1, 0.85, 1],
            },
            {
                geometry: new CylinderGeometry(0.04, 0.06, 0.14, 6),
                color: '#5c7c35',
                position: [0, 0.42, 0],
            },
        ],
    };
}

/** Authored slice halves: one shell per side of z=0, each with a flesh cap. */
export function createPumpkinHalves(): readonly ObjectModel[] {
    return [pumpkinHalf(0, Math.PI), pumpkinHalf(Math.PI, 0)];
}

function pumpkinHalf(phiStart: number, capYaw: number): ObjectModel {
    return {
        kind: 'parts',
        size: 1,
        parts: [
            {
                geometry: new SphereGeometry(0.5, 16, 12, phiStart, Math.PI),
                color: '#e8722c',
                scale: [1, 0.85, 1],
            },
            {
                geometry: new CircleGeometry(0.5, 16),
                color: '#c9642a',
                scale: [1, 0.85, 1],
                rotation: [0, capYaw, 0],
            },
        ],
    };
}

export function createCandyModel(): ObjectModel {
    return {
        kind: 'parts',
        size: 1.15,
        parts: [
            {
                geometry: new CylinderGeometry(0.25, 0.25, 0.5, 12),
                color: '#ffbf3f',
                rotation: [0, 0, Math.PI / 2],
            },
            {
                geometry: new ConeGeometry(0.225, 0.34, 8),
                color: '#f7f0d8',
                position: [0.4, 0, 0],
                rotation: [0, 0, -Math.PI / 2],
            },
            {
                geometry: new ConeGeometry(0.225, 0.34, 8),
                color: '#f7f0d8',
                position: [-0.4, 0, 0],
                rotation: [0, 0, Math.PI / 2],
            },
        ],
    };
}

export function createSkullModel(): ObjectModel {
    return {
        kind: 'parts',
        size: 1,
        parts: [
            {
                geometry: new SphereGeometry(0.38, 16, 10),
                color: '#e6dcc6',
                scale: [1, 0.9, 1],
            },
            {
                geometry: new BoxGeometry(0.3, 0.18, 0.24),
                color: '#d9cfba',
                position: [0, -0.34, 0],
            },
            {
                geometry: new SphereGeometry(0.09, 6, 4),
                color: '#101820',
                position: [-0.14, 0.02, 0.32],
            },
            {
                geometry: new SphereGeometry(0.09, 6, 4),
                color: '#101820',
                position: [0.14, 0.02, 0.32],
            },
        ],
    };
}
