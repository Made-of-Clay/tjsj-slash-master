import type { BufferGeometry } from 'three/webgpu';

/**
 * `target` = cut it, `restricted` = costs points, `hazard` = costs more points
 * and hits harder (step 9B). Gameplay reads the category; rendering picks the
 * accent from it.
 */
export type ObjectCategory = 'target' | 'restricted' | 'hazard';

/** One model piece in local space; baked into the def's single geometry at boot. */
export interface ModelPart {
    geometry: BufferGeometry;
    /** sRGB hex, e.g. `#e8722c`. */
    color: string;
    position?: readonly [number, number, number];
    /** Euler XYZ, radians. */
    rotation?: readonly [number, number, number];
    /** Keep positive: negative scale flips winding. */
    scale?: readonly [number, number, number];
}

/**
 * How an object is drawn. Gameplay reads only `size`.
 * `size` = max extent; model centered on origin and fits a `size` box.
 * `asset` = GLB fetched once at boot by `rendering/ModelAssets`; a sync bake
 * throws. `parts` bake in place.
 */
export type ObjectModel =
    | { kind: 'parts'; parts: readonly ModelPart[]; size: number }
    | { kind: 'asset'; url: string; size: number };

/** Content-side object description; gameplay never reads `model`. */
export interface GameObjectDefinition {
    id: string;
    /** Display name for the card legend; content owns copy. */
    name: string;
    score: number;
    category: ObjectCategory;
    model: ObjectModel;
    /**
     * Authored slice pieces at final size; absent entries fall back to a
     * `CUT.pieceScale` clone. Extras are ignored (two pieces per cut).
     */
    pieces?: readonly ObjectModel[];
    /** Relative spawn chance; default 1. Lower = rarer (hazards are rare). */
    weight?: number;
}

/** `[min, max]` pair, sampled uniformly. */
export type SpawnRange = readonly [number, number];

/** Range that ramps with round progress: `early` at 0, `late` at 1. */
export interface RampRange {
    early: SpawnRange;
    late: SpawnRange;
}

/** How the Spawner launches. Gameplay reads this; palette never reaches it. */
export interface SpawnRules {
    /** Seconds between spawn events. Shorter late = busier late. */
    intervalRange: RampRange;
    /** Objects per spawn event. */
    batchRange: RampRange;
    /** Jitter multiplier on the apex-derived launch speed (1 = exact aim). */
    speedRange: SpawnRange;
    /** Apex height as a fraction of full field height above the launch line. */
    apexRange: SpawnRange;
    /** z band; keep [0, 0] — z offsets shrink blade reach and parallax-shift objects. */
    depthRange: SpawnRange;
    /** Angular velocity per axis, rad/s. */
    spinRange: SpawnRange;
    /** 0..1 chance a spawn comes from a side edge instead of the launch line. */
    sideLaunchChance: number;
}

/** Vertical background gradient (via `screenUV`), consumed by rendering only. */
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

/** Non-background colours the theme owns. */
export interface ThemePalette {
    /**
     * Blade trail tint, sRGB hex. Rendering normalises it to full brightness
     * before mixing toward white, so this is a hue, not a final colour.
     */
    blade: string;
}

/** Light colour tints; intensities live in `config.ts`. */
export interface ThemeLighting {
    ambient: string;
    key: string;
    fill: string;
    rim: string;
}

/** Category emissive tints; base colour comes from model vertex colours. */
export interface ThemeAccents {
    target: string;
    restricted: string;
    hazard: string;
}

/** A named set of objects, palette and spawn rules. */
export interface Theme {
    id: string;
    background: ThemeGradient;
    palette: ThemePalette;
    lighting: ThemeLighting;
    accents: ThemeAccents;
    objects: GameObjectDefinition[];
    spawnRules: SpawnRules;
}
