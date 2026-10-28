# Tunables

Every number a designer would touch, in one place. A tuning task needs this file only — no step doc, no history.

- Source of truth is `src/config.ts` (code knobs) and `src/content/themes/*.ts` (theme knobs). This table mirrors them; update both in the same change.
- After changing a value: `pnpm verify` (contracts/ratios), then judge by eye or on device. Feel is not assertable.
- Units are world units and seconds unless noted. `u` = world unit.
- **[You]** owns the values; **[I]** only scaffolds them.

## Frame + loop

| Key                 | Value  | Notes                                       |
| ------------------- | ------ | ------------------------------------------- |
| `TARGET_FPS`        | 60     | Floor, not a cap.                           |
| `MAX_PIXEL_RATIO`   | 2      | Phones report 3×; 3× triples fragment cost. |
| `FIXED_STEP`        | 1/60 s | Sim step, decoupled from refresh.           |
| `MAX_FRAME_SECONDS` | 0.25   | Longer frames are stalls; excess discarded. |
| `MAX_SUB_STEPS`     | 5      | Catch-up-spiral backstop.                   |
| `FPS_SMOOTHING`     | 0.1    | Readout smoothing.                          |

## Playfield + camera

| Key                     | Value     | Notes                                                    |
| ----------------------- | --------- | -------------------------------------------------------- |
| `PLAYFIELD.halfHeight`  | 7         | Sets world scale; width follows the aspect.              |
| `PLAYFIELD.centerY`     | 0         | Raise to push the field low.                             |
| `PLAYFIELD.sideMargin`  | 1.0       | Must cover the largest model radius (≤ 0.996); verified. |
| `GAME_PLANE_DEPTH`      | 0         | Swipe ray lands where the fruit is.                      |
| `LAUNCH_LINE_Y`         | derived   | `centerY − halfHeight`; tracks the field, never edited.  |
| `CAMERA.fov`            | 60        | Perspective, straight-on.                                |
| `CAMERA.margin`         | 1         | Padding on the fit distance.                             |
| `CAMERA.near` / `.far`  | 0.1 / 100 | Clip range.                                              |
| `TONE_MAPPING`          | aces      | Changes every colour; decide before palette work.        |
| `TONE_MAPPING_EXPOSURE` | 1         |                                                          |
| `LIGHTING.ambient`      | 0.6       | Intensities only; tints come from the theme.             |
| `LIGHTING.key`          | 2.4       |                                                          |
| `LIGHTING.fill`         | 0.8       |                                                          |
| `LIGHTING.rim`          | 1.2       |                                                          |

## Spawn + physics

| Key                     | Value   | Notes                                                  |
| ----------------------- | ------- | ------------------------------------------------------ |
| `POOL_SIZE`             | 64      | Live objects; pool never grows.                        |
| `GRAVITY`               | 20 u/s² | Game gravity. Raise it and raise launch speed with it. |
| `SPAWN.depthDrift`      | 0       | Pinned off (z drift broke slicing, 2026-10-21).        |
| `SPAWN.sideTargetInset` | 0.5     | Side launch aim, as a fraction of the far half.        |
| `ROUND.duration`        | 30 s    | Round length.                                          |

Theme `spawnRules` (both themes; a theme owns these):

| Key                          | Halloween           | Christmas            |
| ---------------------------- | ------------------- | -------------------- |
| `intervalRange` early → late | 1.2–2.0 → 0.6–1.1 s | 1.0–1.8 → 0.55–1.0 s |
| `batchRange` early → late    | 1 → 2–3             | 1 → 2–3              |
| `speedRange`                 | 0.9–1.1             | 0.9–1.1              |
| `apexRange`                  | 0.5–0.8             | 0.5–0.8              |
| `depthRange`                 | 0–0                 | 0–0                  |
| `spinRange`                  | ±3 rad/s            | ±3 rad/s             |
| `sideLaunchChance`           | 0.1                 | 0.1                  |

## Swipe + cut

| Key                  | Value   | Notes                                            |
| -------------------- | ------- | ------------------------------------------------ |
| `SWIPE.gateDistance` | 0.5 u   | Travel from stroke origin before segments count. |
| `CUT.pad`            | 0.1 u   | Forgiveness added to the bounding radius.        |
| `CUT.pieceScale`     | 0.55    | Default clone pieces vs parent.                  |
| `CUT.inherit`        | 0.6     | Fraction of parent velocity a piece keeps.       |
| `CUT.separation`     | 2.0     | Split speed along the normal.                    |
| `CUT.offset`         | 0.4     | Spawn offset along ±normal, × parent radius.     |
| `CUT.spin`           | 4 rad/s | Tumble, opposed per piece.                       |
| `CUT.life`           | 1.5 s   | Piece lifetime.                                  |
| `CUT.capacity`       | 64      | Debris ring size.                                |

## Score + juice

| Key                         | Value     | Notes                                                     |
| --------------------------- | --------- | --------------------------------------------------------- |
| `COMBO.step`                | 2         | Bank per cut past the first; a 4-cut chain pays 6 × step. |
| `COMBO.window`              | 0.6 s     | Time a chain stays open.                                  |
| `EFFECTS.capacity`          | 128       | Spark slots; oldest recycled.                             |
| `EFFECTS.perCut`            | 7         | Sparks per cut.                                           |
| `EFFECTS.life`              | 0.45 s    | Per-spark jitter applied.                                 |
| `EFFECTS.speed`             | 3.2       | Burst along the slice normal.                             |
| `EFFECTS.spread`            | 0.9       | Sideways scatter, × speed.                                |
| `EFFECTS.size`              | 0.09 u    | Shard radius.                                             |
| `EFFECTS.gravity`           | 5         | Downward pull on sparks.                                  |
| `EFFECTS.damping`           | 1.6 /s    | Velocity damping.                                         |
| `SHAKE.cutTrauma`           | 0.22      | Per target cut.                                           |
| `SHAKE.hitTrauma`           | 0.6       | Per restricted cut.                                       |
| `SHAKE.hazardTrauma`        | 1         | Per hazard cut: full kick.                                |
| `SHAKE.decay`               | 2.4 /s    | Trauma lost per second.                                   |
| `SHAKE.amplitude`           | 0.22 u    | Peak translation.                                         |
| `SHAKE.roll`                | 0.012 rad | Peak roll.                                                |
| `OBJECT_MATERIAL.roughness` | 0.55      | Per category.                                             |
| `OBJECT_MATERIAL.metalness` | 0.05      |                                                           |
| `targetEmissive`            | 0.06      | Category accents.                                         |
| `restrictedEmissive`        | 0.25      | Stronger so danger reads.                                 |
| `hazardEmissive`            | 0.5       | Strongest.                                                |

Theme scores + weights:

| Theme     | Targets                        | Restricted     | Hazard (weight)  |
| --------- | ------------------------------ | -------------- | ---------------- |
| Halloween | pumpkin, candy `+1`            | skull `−1`     | bomb `−3` (0.15) |
| Christmas | ornament, candyCane, gift `+1` | snowGlobe `−1` | coal `−2` (0.15) |

## Draw budget

`≤ 17` while swiping: 12 instanced (defs × 3) + 3 spark meshes + background + blade trail. See [`PERF-BUDGET.md`](PERF-BUDGET.md) for the memory and frame rows.

## Debug flags

`DEBUG_PLAYFIELD`, `DEBUG_SPAWN`, `DEBUG_SWIPE`, `DEBUG_CUT`, `DEBUG_PERF` are `import.meta.env.DEV` — folded out of production.
