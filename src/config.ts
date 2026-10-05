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

// ===== RENDERING =====
// The swipe ray is cast onto this depth plane, so a slice happens where the
// fruit is rather than wherever the camera happens to look.
export const GAME_PLANE_DEPTH = 0;

export const CAMERA_FOV = 60;
export const CAMERA_NEAR = 0.1;
export const CAMERA_FAR = 100;

// Fixed 2.5D framing. Step 2 owns the playfield bounds; this only has to put a
// sensible object in frame.
export const CAMERA_POSITION: readonly [number, number, number] = [0, 1.6, 11];
export const CAMERA_TARGET: readonly [number, number, number] = [0, 1.2, 0];
