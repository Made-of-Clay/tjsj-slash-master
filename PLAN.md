## Fruit Ninja–style 3D Game Plan

**Core architecture:** separate **gameplay**, **rendering**, and **content/theme data** so Halloween → Christmas → anything else requires mostly swapping data/assets.

### 1. Project foundation

* Vite + TypeScript
* Three.js + TSL
* pnpm
* Oxlint + Oxfmt
* PWA
* Mobile + desktop input
* Establish performance budget:

  * Target 60 FPS
  * Minimize allocations during gameplay
  * Object pooling
  * Avoid unnecessary post-processing

**Structure**

```text
src/
  game/
    Game.ts
    GameLoop.ts
    Input.ts
    Spawner.ts
    Physics.ts
    Collision.ts
    Score.ts
  rendering/
    Scene.ts
    Camera.ts
    Materials.ts
  content/
    themes/
      halloween.ts
      christmas.ts
    objects/
  ui/
  main.ts
```

### 2. MVP playfield

* Fixed 3D camera
* Orthographic or modest perspective camera
* Background
* Lighting/material setup
* Play area bounds
* Responsive viewport

### 3. Object launching

Start with **cubes**.

Each spawned object gets:

```ts
{
  position,
  velocity,
  rotation,
  angularVelocity,
  type,
  active
}
```

Simple ballistic physics:

```text
position += velocity * dt
velocity.y += gravity * dt
rotation += angularVelocity * dt
```

Spawn trajectories:

* Mostly bottom → upward/forward
* Random horizontal position
* Random launch velocity
* Random depth/distance
* Variable arc
* Occasional side launches

No physics engine initially.

### 4. Swipe system

Desktop:

* `pointerdown`
* `pointermove`
* `pointerup`

Mobile:

* Same Pointer Events API

Represent swipe as a short-lived 3D/world-space line segment.

```text
previousPointer → currentPointer
             ↓
        slice segment
```

### 5. Cutting

MVP collision:

* Test swipe segment against object's bounding sphere/box.
* If intersecting:

  * Mark object sliced
  * Award points
  * Spawn simple sliced visual
  * Remove/recycle original

Don't implement physically accurate mesh slicing yet.

### 6. Game rules

* 30-second round
* Objects:

  * `fruit` → +1
  * `restricted` → -1
* Missed fruit initially has no consequence.
* Score displayed continuously.
* Timer displayed.
* Game-over screen:

  * Final score
  * Restart

### 7. Content/theme abstraction

Gameplay should know nothing about pumpkins, apples, snowmen, etc.

```ts
interface GameObjectDefinition {
  id: string
  score: number
  category: 'target' | 'restricted'
  model: ObjectModel
}
```

Theme:

```ts
interface Theme {
  background: ...
  objects: GameObjectDefinition[]
  spawnRules: ...
}
```

Halloween could eventually contain:

```text
pumpkin       +1
candy         +1
ghost         +1
skull         -1
```

Christmas:

```text
ornament      +1
candyCane     +1
gift          +1
snowGlobe     -1
```

### 8. Performance pass

After MVP works:

* `InstancedMesh` where appropriate
* Object pools
* Reuse vectors/quaternions/arrays
* Avoid per-frame garbage
* Frustum culling
* Low-poly models
* Texture atlases where useful
* TSL materials instead of expensive shader complexity
* Device pixel-ratio cap
* Pause rendering when tab/backgrounded
* Measure with Chrome Performance + FPS meter

### 9. Polish

Then add:

* Better slicing animation
* Juice/explosion particles
* Screen shake
* Combo scoring
* Sound
* Haptics
* Better trajectories
* Increasing difficulty
* Special objects
* Start/pause screens
* High score
* Installable PWA

### 10. Content pipeline

Eventually make adding a theme essentially:

```ts
setTheme(halloween)
```

or:

```ts
setTheme(christmas)
```

with **zero changes to gameplay code**.

---

## MVP milestone

**The first playable version should contain only:**

> 3D background → cubes launch → cubes arc toward/through camera → pointer/finger swipe → cube gets hit → `+1` → restricted cube gives `-1` → 30-second timer → final score → restart.

I'd build **Steps 1–3 first**, then get a playable physics loop running before touching slicing, UI polish, or TSL effects.

