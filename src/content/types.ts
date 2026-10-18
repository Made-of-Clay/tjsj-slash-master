import type { BufferGeometry } from 'three/webgpu';

export type ObjectCategory = 'target' | 'restricted';

/**
 * How an object is drawn. A union so step 3's primitives and step 9's real
 * geometry share one field on GameObjectDefinition.
 *
 * `size` is the world-space extent: cube edge length, sphere diameter. It
 * sizes the view geometry and derives the bounding radius at launch.
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
 * Scene-look palette: the vertical background gradient. Consumed by
 * `rendering/Materials.ts`'s `createBackgroundNode` (via `screenUV`), never by
 * gameplay.
 */
export interface ThemeGradient {
    /** Colour at the top of the screen. */
    top: string;
    /** Colour at the bottom of the screen. */
    bottom: string;
    /** Colour the screen corners fade toward. */
    vignette: string;
    /** 0 = no vignette, 1 = corners fully `vignette`. */
    vignetteStrength: number;
}

/**
 * Theme lighting tints. Intensities remain code-side (tuned in workstream D).
 */
export interface ThemeLighting {
    ambient: string;
    key: string;
    fill: string;
    rim: string;
}

/** Object accent colours, read by object materials in step 3. Gameplay ignores them. */
export interface ThemeAccents {
    target: string;
    restricted: string;
}

/**
 * A named set of objects and spawn rules. Theme data arrives in step 7; only
 * the shape is settled here, so nothing in the codebase depends on a theme
 * file existing yet.
 */
export interface Theme {
    id: string;
    /** Vertical gradient background (via `screenUV`). */
    background: ThemeGradient;
    /** Light colour tints. Intensities tuned in workstream D. */
    lighting: ThemeLighting;
    /** Object accent colours. */
    accents: ThemeAccents;
    objects: GameObjectDefinition[];
    spawnRules: SpawnRules;
}
