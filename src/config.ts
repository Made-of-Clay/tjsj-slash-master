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

// ===== PLAYFIELD =====
// The swipe ray is cast onto this depth plane, so a slice happens where the
// fruit is rather than wherever the camera happens to look.
export const GAME_PLANE_DEPTH = 0;

// World-space arena, centred on the origin. Tall and portrait-first (step 2
// decision D): the binding fit dimension stays width in portrait and height in
// landscape, so the camera distance barely moves between orientations.
export const PLAY_BOUNDS = {
    halfWidth: 3.5,
    halfHeight: 7,
    /** Vertical center the camera looks straight at. Raise to push the arena low. */
    centerY: 0,
} as const;

// ===== CAMERA =====
// Fixed 2.5D framing, straight-on (step 2 decision A): the play plane is
// view-perpendicular, which keeps the fit math exact. Distance is derived from
// PLAY_BOUNDS + aspect by applyFraming in rendering/Camera.ts, never hardcoded.
export const CAMERA = {
    fov: 60,
    near: 0.1,
    far: 100,
    /** World units added to the fit distance so the arena never touches an edge. */
    margin: 1,
} as const;

// ===== DEBUG =====
// Bounds rectangle and other playfield debug. Vite folds this to `false` in the
// production build, so the debug geometry is dropped from the bundle.
export const DEBUG_PLAYFIELD = import.meta.env.DEV;
