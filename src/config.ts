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

// ===== ROUND =====
// Step 6: the round clock (game/Round.ts). The spawn ramp tightens across
// this window; [You] tunes the number.
export const ROUND = {
    /** Round length in seconds (PLAN §6: 30). */
    duration: 30,
} as const;

// ===== PHYSICS =====
// Game gravity, not Earth's (step 3A): tuned by eye [You] so launch speeds in
// the 11-14 range produce arcs that peak inside the 2*halfHeight field. Raising
// gravity means raising launch speed too, or everything falls through.
export const GRAVITY = 20;

// ===== SPAWN =====
// Spawner knobs that are code-side, not theme data (theme owns SpawnRules).
export const SPAWN = {
    /**
     * Peak |vz| on a launch, world units/s. Off: z offsets shrink the blade's
     * reach and parallax-shift objects (chopping-bug fix 2026-10-21).
     */
    depthDrift: 0,
    /**
     * Where a side launch aims, as a fraction of the inset bounds measured from
     * the *opposite* edge. 0.5 sends it to the middle of the far half: far
     * enough to cross the field, never far enough to exit before the apex.
     */
    sideTargetInset: 0.5,
} as const;

// ===== SWIPE =====
// Stroke gating (step 4B). Input emits a segment per pointermove; a stroke
// must travel `gateDistance` world units (on the play plane) before its
// segments count, so taps and resting-finger drift never slice. Once open,
// the gate stays open until the stroke ends — a slow deliberate drag keeps
// cutting. Sub-pixel jitter is already filtered upstream (Input's
// MIN_SEGMENT_NDC); this is the coarser second line, tuned by eye [You].
export const SWIPE = {
    /** Stroke travel before segments count, world units on the play plane. */
    gateDistance: 0.5,
} as const;

// ===== CUT =====
// Cutting (step 5). `pad` widens each object's bounding sphere for the hit
// test — forgiveness on the swipe path, since a zero-thickness segment
// against a bounding sphere is stricter than a moving finger ever feels. The
// piece knobs shape the two halves a cut leaves behind (step 5B).
export const CUT = {
    /** World units added to an object's bounding radius for hit tests. */
    pad: 0.1,
    /** Piece geometry scale vs the parent model (default pieces are clones). */
    pieceScale: 0.55,
    /** Fraction of the parent's velocity a piece keeps. */
    inherit: 0.6,
    /** Separation speed along the slice normal, world units/s (± per piece). */
    separation: 2.0,
    /** Spawn offset along ±normal, as a fraction of the parent radius. */
    offset: 0.4,
    /** Tumble speed around the view axis (rad/s); the pair spins opposed. */
    spin: 4,
    /** Seconds before a piece despawns wherever it is. */
    life: 1.5,
    /** Piece ring capacity — the debris budget (PERF-BUDGET table). */
    capacity: 64,
} as const;

// ===== OBJECTS =====
// Shared per-category material: base colour from model vertex colours; theme
// accent is emissive (restricted stronger, so danger reads).
export const OBJECT_MATERIAL = {
    roughness: 0.55,
    metalness: 0.05,
    /** Category accent emissive. */
    targetEmissive: 0.06,
    restrictedEmissive: 0.25,
} as const;

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
     * Guards each side edge so objects never clip; must cover the largest
     * model radius (step 7: ≤ 0.996). `verify-content` enforces it.
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

// Dev-only: log the first time the spawner is starved by a full pool. The pool
// never grows, so this is a skip, not an error — but silence would hide a
// game feel bug (too many objects wanted at once).
export const DEBUG_SPAWN = import.meta.env.DEV;

// Dev-only: log each swipe segment as the fixed step consumes it — the exact
// input step 5's collision will see.
export const DEBUG_SWIPE = import.meta.env.DEV;

// Dev-only: log each cut the Slicer makes (defId + score delta) — the
// feedback loop step 6's score display will visualize.
export const DEBUG_CUT = import.meta.env.DEV;
