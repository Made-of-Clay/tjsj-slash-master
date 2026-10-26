# Step 9 — Polish

Plan for [PLAN.md](../PLAN.md) §9. Extends it, doesn't replace it.

- Scope: the feel layer — slice feedback, combo scoring, hazards, sound,
  haptics, start/pause screens, high score. Rules and content structure stay
  as steps 3–8 left them; this step adds juice, not systems.
- Target: a round that feels finished — every cut answers with sparks, a
  shake, a sound and (on supported devices) a buzz; multi-cut swipes pay a
  combo; a hazard punishes a careless swipe; the round starts on purpose and
  can be paused; the best score survives a reload.
- Not in step 9: runtime theme swap / `setTheme` (step 10), texture atlases /
  glTF, audio files or any new dependency, multiplayer/sharing, analytics.

Owner tags: **[I]** assistant, **[You]** user, **[Pair]** scaffold-then-decide.
Workstreams run **sequentially A → B → C → D**; sessions: A | B | C | D.

> **Status.** Not started. A–D land in order; each session ends with the full
> chain (foundation → … → perf → polish → build) and a commit.

## What step 9 is really about

1. **Feel is state, not post-processing.** Sparks, shake, combo and sounds all
   hang off the cut event the Slicer already emits. No new sim loop, no new
   frame work beyond one instanced sync and a camera offset.
2. **Polish must not undo step 8.** Every new per-frame path follows the
   zero-allocation rule; the draw ceiling rises by the spark meshes only
   (≤ 16 while swiping) and the allocation guard grows to cover them.
3. **Hazards are content, not a special case in the cut path.** A third
   category + a per-def spawn weight is enough; the Slicer keeps cutting
   whatever it is told is cuttable.
4. **Audio is synthesised.** No files, no loader, no payload growth; the
   AudioContext unlocks on the first gesture because iOS demands it.
5. **Flow state is explicit.** A round starts on a tap and can be paused;
   the hidden-tab pause in `GameLoop` remains the authority underneath.

## Decisions (step 9, locked 2026-10-25, [You])

| #   | Decision     | Choice                                                                                                                                                                                                                | Rationale                                                                                                                                                 |
| --- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | Sparks       | Pure ring in `game/Effects.ts`; one `InstancedMesh` **per category** in `rendering/SparkViews.ts`, shared low-poly shard geometry, `EFFECTS.capacity` slots, zero-alloc sync.                                         | Matches the step-8 per-def/per-category pattern. Per-instance colour is unproven on `WebGPURenderer`; a mesh per category is one draw and already proven. |
| B   | Shake        | Scalar trauma per camera (`rendering/Shake.ts`), quadratic falloff, sine phases, decay in `fixedUpdate`, offset applied in `render` after `syncViewport`. Base pose captured at boot.                                 | Presentation-only, deterministic, harness-testable; never writes into camera state.                                                                       |
| C   | Combo        | **Per-stroke** additive bonus: the k-th cut of a stroke (k ≥ 2) adds `COMBO.step × (k − 1)`. Stroke identity from `Swipes.stroke`; `Score` stays add-only.                                                            | Reads off the drain with no new clock, no end-of-stroke resolution, no allocation; a 4-cut swipe pays 6 × step.                                           |
| D   | Hazard       | New `hazard` category: cutting it pays `def.score` (negative) plus max shake and a boom. It does **not** end the round.                                                                                               | Game over stays "time's up" (step 6 decision), so the card's meaning doesn't fork.                                                                        |
| E   | Spawn weight | `GameObjectDefinition.weight` (default 1); the Spawner builds prefix sums at construction and picks by weight.                                                                                                        | Hazards need rarity; this is the smallest change that gives content control without reopening spawn ranges.                                               |
| F   | Records      | `ui/records.ts`: guarded `localStorage` (`slash-master.best`, `slash-master.muted`), in-memory fallback when storage throws (private mode). Written only when beaten.                                                 | Survives reload, never breaks boot; testable with an injected storage stub.                                                                               |
| G   | Audio        | Procedural `AudioEngine` (`audio/Audio.ts`): one `AudioContext` unlocked on first `pointerdown`, synth voices `swoosh/pop/boom/combo/over/ui`, master gain, mute persisted.                                           | Zero payload, zero deps, no autoplay-policy surprises past the first gesture.                                                                             |
| H   | Haptics      | `ui/haptics.ts`: `navigator.vibrate` pulses on cut / hazard / round end, silent no-op elsewhere; follows the mute toggle.                                                                                             | Android gets tactile feedback; iOS silently ignores it.                                                                                                   |
| I   | Flow         | Boot shows a start overlay (tap to start) that gates the round clock and spawner; restart returns straight to play. Explicit pause button + resume overlay; `GameLoop`'s hidden-tab pause stays authoritative.        | No mid-round restart surprise, no timer running behind a card.                                                                                            |
| J   | Verification | `scripts/verify-polish.ts` + `pnpm verify:polish`: effects ring, combo math, hazard rule + weighting, records, shake decay, audio/haptics state machines, gating. Plus updates to `verify-content` and `verify-perf`. | Same harness discipline as steps 3–8; feel stays by-eye, state stays asserted.                                                                            |
| K   | Draw budget  | ≤ 17 while swiping: 12 instanced + 3 spark meshes + background + blade trail.                                                                                                                                         | One new mesh per category; PERF-BUDGET row updated.                                                                                                       |
| L   | Dependencies | None. Payload delta code-only, target ≤ ~2.5 kB gzip app chunk; no audio/image assets.                                                                                                                                | Guard rails unchanged from steps 7–8.                                                                                                                     |

## Files touched

```
src/game/Effects.ts               spark ring (pure sim)                            [I]
src/game/Combo.ts                 per-stroke combo accumulator                    [I]
src/rendering/SparkViews.ts       per-category InstancedMesh + sync                [I]
src/rendering/Shake.ts            trauma → camera offset                          [I]
src/audio/Audio.ts                procedural WebAudio engine                      [I]
src/ui/haptics.ts                 vibration pulses                                 [I]
src/ui/records.ts                 guarded localStorage                            [I]
src/ui/hud.ts                     combo widget, best score, start/pause overlays   [I]
src/game/Input.ts                 stroke counter for combo identity                [I]
src/game/Spawner.ts               per-def weight pick                              [I]
src/game/Slicer.ts                returns per-cut detail (category) to callers      [I]
src/content/types.ts              `hazard` category + `weight`                      [I]
src/content/models/*.ts           one hazard model per theme                       [I]
src/content/themes/*.ts           hazard def + weights                             [I]
src/rendering/Materials.ts        hazard material                                  [I]
src/config.ts                     EFFECTS / COMBO / RECORDS keys                   [I] scaffold, [You] numbers
src/main.ts                       wiring: sparks, shake, combo, audio, flow        [I]
scripts/verify-polish.ts          new harness                                      [I]
scripts/verify-perf.ts            spark views + allocation guard                   [I]
scripts/verify-content.ts         hazard/weight contract                           [I]
package.json                      verify:polish                                    [I]
docs/PLAN-STEP-9-polish.md        this file                                        [I]
AGENTS.md / CHANGELOG.md / README.md / docs/PERF-BUDGET.md                            [I]
```

`src/game/Physics.ts`, `Round.ts`, `Pool.ts`, `Swipes.ts` (beyond the stroke
counter), `Debris.ts` and the step 1–8 verifiers stay untouched. Gameplay must
still never import `content/themes`, `content/models` or `rendering/`.

---

## Workstream A — Cut juice (session 1)

**Skill:** make a cut visible in one frame without allocating one byte.

### Work

- [I] `config.ts`: `EFFECTS = { capacity: 128, perCut: 7, life: 0.45, speed: 3.2, spread: 0.9, size: 0.06, drag: 0.92, shakeDecay: 2.4, shakeAmplitude: 0.22, shakeRotate: 0.012 }`.
  Numbers are `[Pair]` — scaffold now, [You] tunes by eye.
- [I] `game/Effects.ts`: `Spark` (position, velocity, age, life, size, category,
  active) + `Effects` ring with `burst(x, y, radius, nx, ny, category)` and
  `step(dt)` (integrate, drag, gravity-light, despawn at `life`). Drop-oldest
  on overflow. No DOM, no scene graph; injectable `rand`.
- [I] `rendering/SparkViews.ts`: one `InstancedMesh` per category (shared
  `TetrahedronGeometry(EFFECTS.size)`, `MeshBasicMaterial` tinted per
  category accent), `EFFECTS.capacity` capacity, `DynamicDrawUsage`,
  `frustumCulled = false`, `count = 0`, allocation-free sync that shrinks
  each spark over its life.
- [I] `rendering/Shake.ts`: `add(trauma)`, `step(dt)`, `apply()` — quadratic
  falloff, sine phases advanced in `step`, base camera pose captured at
  creation.
- [I] `main.ts`: the piece sink also calls `effects.burst(...)` and
  `shake.add(...)` (subtle for target, heavy for restricted until B adds
  hazards); render order becomes `syncViewport → shake.apply → views → render`.
  `restart()` clears sparks and shake.
- [I] Keep the cut path allocation-free: the sink reads the parent before
  `pool.release` zeroes it (step 5E contract).

### Success signal

A cut throws a spark burst along the slice normal, restricted cuts look
heavier, and a busy swipe shakes the frame without moving the playfield. Spawn
and cut behaviour unchanged; `verify:perf` still green with the spark meshes
added to the scene-graph and allocation checks.

### Notes

- Sparks inherit a fraction of the parent velocity plus a burst along the
  slice normal — same shape as the debris spawn, so the two read as one event.
- Shake is an offset, never a state mutation: `syncViewport` re-frames the
  camera from scratch, so `apply()` must always start from the captured base.
- The game-over freeze freezes shake decay with everything else; that is fine
  (a frozen frame should look frozen).
- Do not add per-spark rotation state; scale decay and position are enough at
  this size, and it keeps the view sync trivial.

---

## Workstream B — Scoring depth (session 2)

**Prerequisite:** A merged.

**Skill:** reward the swipe that hits three things, and punish the one that
hits the wrong thing.

### Work

- [I] `game/Combo.ts`: tracks `stroke` + `count`; `register(stroke, score)`
  adds `COMBO.step × (count − 1)` for each cut past the first in a stroke and
  returns the bonus paid (0 when it is the first cut).
- [I] `Input`/`Swipes`: monotonic stroke counter (`Swipes.stroke`); `main.ts`
  feeds `combo.register(...)` from the cut path and `hud.sync` displays it.
- [I] `ui/hud.ts`: combo widget on the root slot `root.ts` already reserves —
  visible from the second cut of a stroke, hidden when the stroke ends; DOM
  writes only on change (step 6E pattern).
- [I] `content/types.ts`: `ObjectCategory` gains `hazard`;
  `GameObjectDefinition.weight?: number`. `content/themes/*`: one hazard def
  each (`bomb` with fuse for Halloween, `coal` for Christmas), `score` negative,
  low `weight`.
- [I] `content/models/*`: procedural hazard models, inside the size band;
  `rendering/Materials.ts`: third category material (dark, emissive fuse/red).
- [I] `Spawner`: weighted pick via boot-time prefix sums; default weight 1
  keeps existing themes' distributions identical when no weights are set.
- [I] `Slicer`: expose the cut's category to the sink/caller so main can pick
  the shake/sound/haptic response without a second lookup.
- [I] `ui/records.ts` + `hud`: best score on the game-over card; written only
  when the round beats it.

### Success signal

Two cuts in one swipe visibly pay a bonus; a 4-cut swipe pays noticeably more
than four separate strokes. Hazards appear rarely, cost points, and never end
the round. Best score survives a reload. `verify-content` learned the third
category; `verify-rules`/`verify-cut` unchanged in meaning.

### Notes

- Combo is additive, not multiplicative: multipliers invite score inflation
  and make the HUD lie about the per-cut value.
- The stroke counter must come from `Swipes`, not from pointer events, or a
  stroke that is gated out still breaks a combo.
- Hazard weight is content; do not hardcode a bomb frequency in `Spawner`.
- Keeping hazards out of the round-ending business preserves the step-6 card.

---

## Workstream C — Sound + haptics (session 3)

**Prerequisite:** A (cut events), B (hazard/combo events).

**Skill:** give every event a voice without shipping a single asset.

### Work

- [I] `audio/Audio.ts`: lazy `AudioContext` created on the first `pointerdown`
  (`resume()` if suspended), master `GainNode`, `play(voice)` switch over
  synth recipes — swoosh (band-passed noise), pop (sine blip + noise click),
  boom (low sine drop + noise), combo (two-note chime, pitch by combo size),
  over (descending third), ui (short click). No per-call allocation of nodes
  beyond the voice graph; nodes are disposable by design.
- [I] Mute toggle in the HUD bar (persisted via `records.ts`); mute also
  silences haptics.
- [I] `ui/haptics.ts`: `pulse('cut' | 'hazard' | 'over')` with fixed patterns;
  guarded `navigator.vibrate` presence check.
- [I] `main.ts`: wire cut/hazard/combo/round-end/start-pause/restart to voices
  and pulses; one `unlock()` on the first stroke.
- [I] Harness: the engine exposes plain state (`unlocked`, `muted`,
  `lastVoice`) without touching `AudioContext` under bun — a stub factory keeps
  it testable.

### Success signal

Cuts, hazards, combos, round end and UI respond audibly; a phone buzzes on
cut/hazard; mute persists across reloads and silences both; no console autoplay
warnings after the first gesture; payload unchanged (no assets).

### Notes

- iOS requires the unlock inside the gesture handler itself — not in a
  `setTimeout`/promise continuation.
- Keep one context for the page lifetime; suspending on hidden tabs is the
  browser's job.
- Voices must be cheap enough to fire several times per swipe; cap concurrent
  pops (`EFFECTS`-style cooldown) instead of stacking gain.

---

## Workstream D — Flow + close-out (session 4)

**Prerequisite:** A + B + C merged.

**Skill:** the round starts and stops on purpose; then prove step 9 didn't
cost step 8 anything.

### Work

- [I] Start overlay at boot (title + tap to start): gates `round.step`, the
  spawner and the HUD timer until started; `restart()` goes straight back to
  play, no second start screen.
- [I] Pause button in the HUD bar + resume overlay. `GameLoop`'s hidden-tab
  pause stays authoritative; pausing the round does not stop the render loop
  (the pause card still draws).
- [I] `scripts/verify-polish.ts` + `pnpm verify:polish`: spark ring
  (burst/step/despawn/overflow), combo math (per-stroke reset, k-th cut
  bonus, no bonus on first cut), hazard rule (negative score, no round end),
  weighted spawn distribution over a seeded RNG, records (set/read/beaten-only
  write, storage-throw fallback), shake (clamp, decay to zero, apply returns to
  base pose), audio/haptics state machines (locked → unlocked, mute), flow
  gating (round frozen before start, paused holds).
- [I] `verify-perf`: add spark views (capacity, dynamic usage, counts,
  scene-graph delta) + allocation guard over `Effects.step`, spark sync and
  `Shake.apply`; budget row 16.
- [I] `verify-content`: `hazard` category contract (negative score, model size,
  material) and `weight` sanity (positive, hazards low).
- [I] Close-out: AGENTS state/decisions/commands, CHANGELOG A–D + payload,
  README verify list, PERF-BUDGET draw row + spark memory + measurement note.
- [I] Full chain + `npx vite build`; confirm no decoder/audio assets; precache
  delta in CHANGELOG.

### Success signal

`pnpm verify:polish` green and meaningful (negative-tested); full chain green;
draw calls ≤ 16 while swiping; app chunk delta ≤ ~2.5 kB gzip; a full round
(starts on tap, cuts with sparks/shake/sound, combo pays, hazard costs, best
score persists, pause works) by hand on both themes.

### Notes

- The start gate must be state on the round/flow, not a stopped loop — the
  renderer's animation loop owns drawing from boot.
- Pause writing to `document.hidden`-style state would fight `GameLoop`;
  keep the two pause reasons independent and let `active` be their AND.
- Record writes are the one place a round may touch storage; never per frame.

## Locked decisions carried in

- Step 3A no interpolation; step 4C drain-first; step 5E cut-before-release;
  step 6D HUD writes only on change; step 6G restart re-arms everything.
- Step 7D/H: gameplay never imports themes/models; procedural models only.
- Step 8: instancing per def, `count` as draw count, `frustumCulled = false`,
  zero steady-frame allocation, harness guard.
- PERF-BUDGET: no shadow maps, no textures, pixel-ratio cap, hidden-tab pause.

## Explicitly NOT in step 9

- `setTheme` / runtime theme swap / dispose-on-switch (step 10).
- Texture atlases, glTF, draco, audio files, any new dependency.
- Leaderboards, accounts, sharing, analytics.
- LOD, occlusion, partial instance uploads, post-processing passes.
- Multiplayer or alternate game modes.

## Risks / gotchas

- **iOS audio unlock** is the one platform rule that silently fails: unlock
  inside the gesture, and treat a missing/locked context as "no sound", never
  as an error path in the cut code.
- **`navigator.vibrate` is absent on iOS Safari** — haptics must be a no-op,
  not a feature test in the UI.
- **localStorage throws in private mode**; the fallback is in-memory, and the
  mute/best UI must not care which one it got.
- **Shake vs reframe ordering**: apply after `syncViewport` every render, from
  the captured base pose; an accumulating offset would drift the playfield.
- **Spark draw growth**: one mesh per category is deliberate; keep the budget
  row honest and re-measure on device in D.
- **Combo across strokes**: the stroke counter lives in `Swipes` so gated-out
  taps never break a combo; pointer-event timing must not leak into scoring.
- **Start gate vs hidden-tab pause**: two independent reasons to not simulate;
  `GameLoop.active` stays their AND, and the start screen must still render.
