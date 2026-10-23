import { CylinderGeometry, SphereGeometry } from 'three/webgpu';
import type { ObjectModel } from '../types';

/**
 * Halloween art (step 7).
 *
 * Step 7A seam stand-ins: two-part, two-colour models so the bake + vertex
 * colours + category-emissive path is exercised end to end. Step 7B replaces
 * these with the full recipes (candy, ghost, skull sockets, authored pumpkin
 * halves) without touching anything outside this file.
 *
 * Contract: parts are centered on the origin and fit inside a `size`-ed box;
 * models are low-poly (see docs/PERF-BUDGET.md).
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

export function createSkullModel(): ObjectModel {
    return {
        kind: 'parts',
        size: 1,
        parts: [
            {
                geometry: new SphereGeometry(0.38, 16, 12),
                color: '#e6dcc6',
                scale: [1, 0.9, 1],
            },
            {
                geometry: new CylinderGeometry(0.16, 0.2, 0.18, 8),
                color: '#d6c9ad',
                position: [0, -0.34, 0],
            },
        ],
    };
}
