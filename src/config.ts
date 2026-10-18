/*
 * Every gameplay/rendering tunable lives here. Nothing else should hardcode a
 * magic number that a designer or the perf pass might want to change.
 */

// ===== PERF BUDGET =====
// Targets the plan's 60 FPS floor. See docs/PERF-BUDGET.md.
export const TARGET_FPS = 60;

// Retina phones report 3x; rendering at 3x triples fragment cost for no
// visible gain on a phone-sized canvas.
export const MAX_PIXEL_RATIO = 2;

// Simulation runs on a fixed step, decoupled from the display refresh rate, so
// physics stays deterministic on 60Hz, 120Hz and WebGPU-adopted frame rates.
export const FIXED_STEP = 1 / 60;

// A frame longer than this is treated as a stall (tab switch, GC, thermal
// throttle) and its excess time is discarded instead of replayed.
export const MAX_FRAME_SECONDS = 0.25;

// Backstop for the accumulator. Without it, a stall produces a catch-up
// spiral: the frame takes longer, so the next one owes more work, forever.
export const MAX_SUB_STEPS = 5;

// Exponential smoothing for the FPS readout, so it is readable but still
// reacts within a second or so.
export const FPS_SMOOTHING = 0.1;

// ===== GAMEPLAY =====
// Objects alive at once. Step 3 tunes this against the real spawn rate.
export const POOL_SIZE = 64;

// ===== PHYSICS =====
// Game gravity, not Earth's (step 3A): tuned by eye [You] so launch speeds in
// the 11-14 range produce arcs that peak inside the 2*halfHeight field. Raising
// gravity means raising launch speed too, or everything falls through.
export const GRAVITY = 20;

// ===== PLAYFIELD =====
// The swipe ray is cast onto this depth plane, so a slice happens where the
// fruit is rather than wherever the camera happens to look.
export const GAME_PLANE_DEPTH = 0;

// The playfield fills the screen width (step 2 course correction, [You]): the
// vertical extent is the fixed design dimension and the width is derived from
// the aspect by rendering/Camera.ts. Extra-wide screens get a wider field
// instead of background margin. The camera distance is constant — tied to
// halfHeight — so world scale (fruit size, arc height, fall speed) is identical
// on every device; only the horizontal reach changes.
export const PLAYFIELD = {
    /** Fixed vertical design extent, in world units. Sets the camera world scale. */
    halfHeight: 7,
    /** Vertical center the camera looks straight at. Raise to push the field low. */
    centerY: 0,
    /**
     * World-space guard kept free at each side edge, so an object centred inside
     * the bounds is never partially cut off. Must cover the largest object
     * radius: theme objects are edge-1.0 boxes (radius 0.87) as of step 3C, so
     * this is 1.0. Raise it in lockstep with any theme that grows its objects.
     */
    sideMargin: 1.0,
} as const;

// The launch line: world Y where step 3's objects appear, at the field's bottom
// edge. Derived so it tracks PLAYFIELD.centerY/halfHeight rather than drifting.
export const LAUNCH_LINE_Y = PLAYFIELD.centerY - PLAYFIELD.halfHeight;

// ===== CAMERA =====
// Fixed 2.5D framing, straight-on (step 2 decision A): the play plane is
// view-perpendicular and the camera sits at a constant distance (halfHeight
// through the FOV, plus `margin`), so it never lurches between aspects and the
// fit math stays exact. Distance is set in rendering/Camera.ts, never hardcoded.
export const CAMERA = {
    fov: 60,
    near: 0.1,
    far: 100,
    /** World units added to the fit distance so the arena never touches an edge. */
    margin: 1,
} as const;

// ===== RENDER =====
// Tone mapping + light intensities (step 2 workstream D). Tone mapping changes
// EVERY colour on screen — including the theme background, which is composited
// through the same output transform — so this is set before palette judgement,
// never after.

/** How the renderer compresses HDR light into display range. */
export type ToneMappingMode = 'none' | 'aces' | 'neutral';

export const TONE_MAPPING: ToneMappingMode = 'aces';
export const TONE_MAPPING_EXPOSURE = 1;

// Three-point rig intensities. Tints come from the theme; these are the
// code-side knobs for balancing silhouette readability against the background.
export const LIGHTING = {
    ambient: 0.6,
    key: 2.4,
    fill: 0.8,
    rim: 1.2,
} as const;

// ===== DEBUG =====
// Bounds rectangle and other playfield debug. Vite folds this to `false` in the
// production build, so the debug geometry is dropped from the bundle.
export const DEBUG_PLAYFIELD = import.meta.env.DEV;
