import { CircleGeometry, ConeGeometry, CylinderGeometry, SphereGeometry } from 'three/webgpu';
import type { ObjectModel } from '../types';

/**
 * Parts centered on origin, fit a `size` box, low-poly.
 * Each def's radius must stay within `PLAYFIELD.sideMargin`.
 */

/**
 * Authored GLBs (`src/content/models/<model>/`), normalised to `size` at boot.
 * Both face +Z, so they need no rotation to face the camera.
 */
const PUMPKIN_URL = new URL('./pumpkin/pumpkin.glb', import.meta.url).href;
const SKULL_URL = new URL('./skull/skull.glb', import.meta.url).href;

export function createPumpkinModel(): ObjectModel {
    return { kind: 'asset', url: PUMPKIN_URL, size: 1 };
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

/** Authored GLB (`src/content/models/skull/`), normalised to `size` at boot. */
export function createSkullModel(): ObjectModel {
    return { kind: 'asset', url: SKULL_URL, size: 1 };
}

/** Hazard (9B): dark shell, stubby fuse and a lit tip — reads as "do not cut". */
export function createBombModel(): ObjectModel {
    return {
        kind: 'parts',
        size: 1,
        parts: [
            { geometry: new SphereGeometry(0.36, 16, 12), color: '#22232a' },
            {
                geometry: new CylinderGeometry(0.09, 0.11, 0.05, 8),
                color: '#3a3c46',
                position: [0, 0.37, 0],
            },
            {
                geometry: new CylinderGeometry(0.022, 0.03, 0.14, 6),
                color: '#c8b06a',
                position: [0.2, 0.38, 0],
                rotation: [0, 0, -Math.PI / 2],
            },
            {
                geometry: new SphereGeometry(0.03, 8, 6),
                color: '#ff7a45',
                position: [0.29, 0.39, 0],
            },
        ],
    };
}
