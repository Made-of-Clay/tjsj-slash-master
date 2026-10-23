import { CylinderGeometry, SphereGeometry } from 'three/webgpu';
import type { ObjectModel } from '../types';

/**
 * Parts centered on origin, fit a `size` box, low-poly.
 * 7A stand-ins; 7B adds the full recipes + authored pumpkin halves.
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
