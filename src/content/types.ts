import type { BufferGeometry } from 'three/webgpu';

export type ObjectCategory = 'target' | 'restricted';

/**
 * How an object is drawn. A union so step 3's primitives and step 9's real
 * geometry share one field on GameObjectDefinition.
 */
export type ObjectModel =
    | { kind: 'primitive'; geometry: 'box' | 'sphere'; size: number }
    | { kind: 'geometry'; geometry: BufferGeometry; size: number };

/**
 * Content-side description of an object. Gameplay reads id/score/category and
 * never inspects `model`, so swapping the art cannot change the rules.
 */
export interface GameObjectDefinition {
    id: string;
    score: number;
    category: ObjectCategory;
    model: ObjectModel;
}

/** Step 3 fills this in: intervals, launch speed range, arc variance, depth range. */
export interface SpawnRules {
    // populated in step 3
}

/**
 * A named set of objects and spawn rules. Theme data arrives in step 7; only
 * the shape is settled here, so nothing in the codebase depends on a theme
 * file existing yet.
 */
export interface Theme {
    id: string;
    /** Shape owned by step 2, which has not decided it yet. */
    background: unknown;
    objects: GameObjectDefinition[];
    spawnRules: SpawnRules;
}
