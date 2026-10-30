/*
 * Performance checks for step 8.
 *
 *   bun scripts/verify-perf.ts
 *
 * Plain assertions over the instanced view layer and the steady-frame
 * allocation contract. No GPU and no frame timer here: draw calls and frame
 * time are measured on device (Chrome trace + stats.js). What this harness can
 * prove is the part a build cannot see — that the scene graph is theme-sized
 * rather than pool-sized, that slot state lands in the right instance, and
 * that the hot functions never construct anything.
 */

let failures = 0;
let total = 0;
function check(name: string, condition: boolean, detail = ''): void {
    total += 1;
    if (condition) {
        console.log(`  ok    ${name}`);
    } else {
        failures += 1;
        console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
    }
}

import { readFileSync } from 'node:fs';
import {
    DynamicDrawUsage,
    PerspectiveCamera,
    Euler,
    InstancedMesh,
    Matrix4,
    Quaternion,
    Scene,
    Vector3,
} from 'three/webgpu';
import { BLADE, CUT, EFFECTS, POOL_SIZE, SHAKE } from '../src/config.ts';
import type { Theme } from '../src/content/types.ts';
import type { BufferGeometry, Color, Mesh } from 'three/webgpu';
import { christmas } from '../src/content/themes/christmas.ts';
import { halloween } from '../src/content/themes/halloween.ts';
import { createObjectViews, syncViews } from '../src/rendering/ObjectViews.ts';
import { createDebrisViews, syncDebrisViews } from '../src/rendering/DebrisViews.ts';
import { createSparkViews, syncSparkViews } from '../src/rendering/SparkViews.ts';
import { createShake } from '../src/rendering/Shake.ts';
import { bladeTint, createBladeTrail } from '../src/rendering/BladeTrail.ts';
import { preloadModels } from '../src/rendering/ModelAssets.ts';
import { readAssetBytes } from './read-asset.ts';
import { Effects } from '../src/game/Effects.ts';
import type { SpawnedObject } from '../src/game/SpawnedObject.ts';
import type { DebrisPiece } from '../src/game/Debris.ts';

const THEMES: readonly Theme[] = [halloween, christmas];
const EPSILON = 1e-6;
const ONE = new Vector3(1, 1, 1);

function fakeObject(
    defId: string,
    x: number,
    y: number,
    z: number,
    rotationZ: number,
    active = true,
): SpawnedObject {
    return {
        active,
        defId,
        position: new Vector3(x, y, z),
        rotation: new Euler(0, 0, rotationZ),
    } as SpawnedObject;
}

function fakePiece(
    defId: string,
    pieceIndex: number,
    x: number,
    y: number,
    z: number,
    active = true,
): DebrisPiece {
    return {
        active,
        defId,
        pieceIndex,
        position: new Vector3(x, y, z),
        rotation: new Euler(0, 0, 0.25),
    } as DebrisPiece;
}

function composed(x: number, y: number, z: number, rotationZ: number): Matrix4 {
    return new Matrix4().compose(
        new Vector3(x, y, z),
        new Quaternion().setFromEuler(new Euler(0, 0, rotationZ)),
        ONE,
    );
}

function matrixAt(mesh: InstancedMesh, index: number): number[] {
    return Array.from(mesh.instanceMatrix.array.slice(index * 16, index * 16 + 16));
}

function matrixEquals(mesh: InstancedMesh, index: number, expected: Matrix4): boolean {
    const actual = matrixAt(mesh, index);
    return expected.elements.every((value, offset) => Math.abs(actual[offset] - value) < EPSILON);
}

function build(theme: Theme, capacity = POOL_SIZE) {
    const scene = new Scene();
    const views = createObjectViews(scene, capacity, theme.objects, theme.accents);
    const debris = createDebrisViews(scene, CUT.capacity, theme.objects, views.materials);
    return { scene, views, debris };
}

// ===== construction =====
console.log('Construction');
for (const theme of THEMES) {
    // Boot order: assets resolve before any view caches a geometry.
    await preloadModels(
        theme.objects.flatMap((def) => [def.model, ...(def.pieces ?? [])]),
        readAssetBytes,
    );
    const { scene, views, debris } = build(theme);

    check(
        `[${theme.id}] one instanced mesh per def`,
        views.instanced.size === theme.objects.length,
        `${views.instanced.size} != ${theme.objects.length}`,
    );
    check(
        `[${theme.id}] scene graph is defs (objects) + 2 × defs (debris)`,
        scene.children.length === theme.objects.length * 3,
        `children=${scene.children.length}`,
    );
    check(
        `[${theme.id}] every scene child is instanced (no per-slot meshes)`,
        scene.children.every((child) => (child as InstancedMesh).isInstancedMesh === true),
    );

    let materialsMatch = true;
    let capacitiesMatch = true;
    let dynamic = true;
    let uncullable = true;
    let startsHidden = true;

    for (const def of theme.objects) {
        const mesh = views.instanced.get(def.id);
        if (!mesh) {
            materialsMatch = false;
            continue;
        }

        materialsMatch &&= mesh.material === views.materials[def.category];
        capacitiesMatch &&= mesh.instanceMatrix.count === POOL_SIZE;
        dynamic &&= mesh.instanceMatrix.usage === DynamicDrawUsage;
        uncullable &&= mesh.frustumCulled === false;
        startsHidden &&= mesh.count === 0;

        const pair = debris.instanced.get(def.id);
        if (!pair) {
            materialsMatch = false;
            continue;
        }
        for (const pieceMesh of pair) {
            materialsMatch &&= pieceMesh.material === views.materials[def.category];
            capacitiesMatch &&= pieceMesh.instanceMatrix.count === CUT.capacity;
            dynamic &&= pieceMesh.instanceMatrix.usage === DynamicDrawUsage;
            uncullable &&= pieceMesh.frustumCulled === false;
            startsHidden &&= pieceMesh.count === 0;
        }
    }

    check(`[${theme.id}] meshes use the shared category materials`, materialsMatch);
    check(`[${theme.id}] instance capacities match the pool and ring budgets`, capacitiesMatch);
    check(`[${theme.id}] instance buffers are dynamic`, dynamic);
    check(`[${theme.id}] frustum culling is off (instances span the field)`, uncullable);
    check(`[${theme.id}] nothing draws before the first sync`, startsHidden);
    check(
        `[${theme.id}] debris shares the object layer's materials object`,
        debris.materials === views.materials,
    );

    // POOL_SIZE is a rendering detail: shrinking capacity must not change the
    // scene graph, only the instance buffers.
    const smaller = build(theme, 2);
    check(
        `[${theme.id}] scene graph is independent of POOL_SIZE`,
        smaller.scene.children.length === scene.children.length,
        `${smaller.scene.children.length} != ${scene.children.length}`,
    );
    check(
        `[${theme.id}] capacity is the requested instance count`,
        smaller.views.meshes.every((mesh) => mesh.instanceMatrix.count === 2),
    );
}

// ===== sync contract =====
console.log('Sync contract');
for (const theme of THEMES) {
    const { views } = build(theme);
    const [first, second] = theme.objects;

    const a = fakeObject(first.id, 0.1, 0.2, 0.3, 0.5);
    const b = fakeObject(second.id, -0.4, 0.6, 0.0, -0.25);
    const aAgain = fakeObject(first.id, 0.7, -0.8, 0.9, 1.0);
    const inactive = fakeObject(first.id, 9, 9, 9, 0, false);
    const unknown = fakeObject('nope', 1, 1, 1, 0);

    syncViews(views, [a, b, aAgain, inactive, unknown]);

    const firstMesh = views.instanced.get(first.id)!;
    const secondMesh = views.instanced.get(second.id)!;

    check(
        `[${theme.id}] active slots group per def`,
        firstMesh.count === 2 && secondMesh.count === 1,
        `${firstMesh.count}, ${secondMesh.count}`,
    );
    check(
        `[${theme.id}] inactive and unknown defs contribute nothing`,
        views.meshes
            .filter((mesh) => mesh !== firstMesh && mesh !== secondMesh)
            .every((mesh) => mesh.count === 0),
    );
    check(
        `[${theme.id}] instance 0 carries the composed transform`,
        matrixEquals(firstMesh, 0, composed(0.1, 0.2, 0.3, 0.5)),
        matrixAt(firstMesh, 0)
            .map((value) => value.toFixed(3))
            .join(','),
    );
    check(
        `[${theme.id}] the second instance of a def lands in instance 1`,
        matrixEquals(firstMesh, 1, composed(0.7, -0.8, 0.9, 1.0)),
    );
    check(
        `[${theme.id}] the other def gets its own instance 0`,
        matrixEquals(secondMesh, 0, composed(-0.4, 0.6, 0, -0.25)),
    );

    const versionWithData = firstMesh.instanceMatrix.version;
    syncViews(views, []);
    check(
        `[${theme.id}] an empty sync resets every count`,
        views.meshes.every((mesh) => mesh.count === 0),
    );
    const versionAfterReset = firstMesh.instanceMatrix.version;
    check(
        `[${theme.id}] an empty sync uploads nothing`,
        versionAfterReset === versionWithData,
        `${versionAfterReset} != ${versionWithData}`,
    );

    // Need a fresh view set to re-check the version bump on a data sync.
    const fresh = build(theme);
    const before = fresh.views.instanced.get(first.id)!.instanceMatrix.version;
    syncViews(fresh.views, [a]);
    const after = fresh.views.instanced.get(first.id)!.instanceMatrix.version;
    check(
        `[${theme.id}] a data sync flags one upload per drawn def`,
        after === before + 1,
        `${after} != ${before + 1}`,
    );

    const capped = build(theme, 2);
    syncViews(capped.views, [
        fakeObject(first.id, 1, 1, 0, 0),
        fakeObject(first.id, 2, 2, 0, 0),
        fakeObject(first.id, 3, 3, 0, 0),
    ]);
    check(
        `[${theme.id}] count is capped at capacity, not overflowed`,
        capped.views.instanced.get(first.id)!.count === 2,
    );
}

// ===== debris sync =====
console.log('Debris sync');
for (const theme of THEMES) {
    const { debris } = build(theme);
    const def = theme.objects[0];

    syncDebrisViews(debris, [
        fakePiece(def.id, 0, 0.1, 0.2, 0),
        fakePiece(def.id, 1, -0.3, 0.4, 0),
        fakePiece(def.id, 0, 1, 1, 0, false),
        fakePiece('nope', 0, 2, 2, 0),
    ]);

    const pair = debris.instanced.get(def.id)!;
    check(
        `[${theme.id}] pieces route by def and piece index`,
        pair[0].count === 1 && pair[1].count === 1,
        `${pair[0].count}, ${pair[1].count}`,
    );
    check(
        `[${theme.id}] each piece mesh gets its own transform`,
        matrixEquals(pair[0], 0, composed(0.1, 0.2, 0, 0.25)) &&
            matrixEquals(pair[1], 0, composed(-0.3, 0.4, 0, 0.25)),
    );
    check(
        `[${theme.id}] other defs and inactive pieces are not drawn`,
        debris.meshes
            .filter((mesh) => mesh !== pair[0] && mesh !== pair[1])
            .every((mesh) => mesh.count === 0),
    );

    syncDebrisViews(debris, []);
    check(
        `[${theme.id}] an empty debris sync resets every count`,
        debris.meshes.every((mesh) => mesh.count === 0),
    );
}

// ===== cut sparks =====
console.log('Cut sparks');

function seed(values: readonly number[]): () => number {
    let index = 0;
    return () => {
        const value = values[index % values.length];
        index += 1;
        return value;
    };
}

for (const theme of THEMES) {
    const scene = new Scene();
    const views = createSparkViews(scene, EFFECTS.capacity, theme.accents);
    const categories = Object.keys(theme.accents).length;

    check(
        `[${theme.id}] one spark mesh per category`,
        views.meshes.length === categories && scene.children.length === categories,
        `${views.meshes.length} meshes, ${scene.children.length} children`,
    );
    check(
        `[${theme.id}] spark meshes are capacity-sized, dynamic and unculled`,
        views.meshes.every(
            (mesh) =>
                mesh.instanceMatrix.count === EFFECTS.capacity &&
                mesh.instanceMatrix.usage === DynamicDrawUsage &&
                mesh.frustumCulled === false &&
                mesh.count === 0,
        ),
    );

    const effects = new Effects(64, seed([0.5, 0.25, 0.75]));
    const target = views.instanced.get('target')!;
    const restricted = views.instanced.get('restricted')!;

    effects.burst(0, 0, 0.5, 1, 0, 'target');
    syncSparkViews(views, effects.sparks);
    check(
        `[${theme.id}] a burst draws only its category`,
        target.count === EFFECTS.perCut && restricted.count === 0,
        `${target.count}, ${restricted.count}`,
    );

    const position = target.geometry.getAttribute('position');
    let maxRadius = 0;
    for (let index = 0; index < position.count; index += 1) {
        maxRadius = Math.max(
            maxRadius,
            Math.hypot(position.getX(index), position.getY(index), position.getZ(index)),
        );
    }
    check(
        `[${theme.id}] spark geometry is a unit shard (instance scale = world size)`,
        Math.abs(maxRadius - 1) < 1e-6,
        `radius=${maxRadius}`,
    );

    const first = effects.sparks[0];
    const scaleAtSpawn = matrixAt(target, 0)[0];
    check(
        `[${theme.id}] spark instance 0 carries position and spawn scale`,
        Math.abs(matrixAt(target, 0)[12] - first.position.x) < EPSILON &&
            Math.abs(matrixAt(target, 0)[13] - first.position.y) < EPSILON &&
            Math.abs(scaleAtSpawn - first.size) < EPSILON,
        `${matrixAt(target, 0)[12]}, ${matrixAt(target, 0)[13]}, ${scaleAtSpawn}`,
    );

    effects.step(EFFECTS.life * 0.5);
    syncSparkViews(views, effects.sparks);
    check(
        `[${theme.id}] sparks shrink over their life`,
        Math.abs(matrixAt(target, 0)[0] - scaleAtSpawn) > 1e-4 && target.count === EFFECTS.perCut,
    );

    effects.step(EFFECTS.life);
    syncSparkViews(views, effects.sparks);
    check(
        `[${theme.id}] sparks despawn at life and draw nothing`,
        views.meshes.every((mesh) => mesh.count === 0),
    );

    const tiny = new Effects(3, seed([0.5]));
    tiny.burst(0, 0, 0.5, 1, 0, 'restricted');
    check(
        `[${theme.id}] the spark ring drops oldest on overflow`,
        tiny.sparks.filter((spark) => spark.active).length === 3,
    );
}

// ===== shake =====
console.log('Screen shake');
{
    const camera = new PerspectiveCamera();
    const base = camera.position.clone();
    const shake = createShake(camera);

    shake.add(2);
    check('trauma clamps at 1', shake.trauma === 1, `${shake.trauma}`);

    shake.step(0.1);
    check('trauma decays', Math.abs(shake.trauma - (1 - SHAKE.decay * 0.1)) < EPSILON);

    shake.apply();
    const moved = camera.position.distanceTo(base);
    check(
        'apply offsets the camera, within the amplitude bound',
        moved > 0 && moved <= SHAKE.amplitude * Math.sqrt(2) + EPSILON,
        `${moved}`,
    );
    check('apply rolls the camera', Math.abs(camera.rotation.z) <= SHAKE.roll);

    shake.step(10);
    shake.apply();
    check(
        'decay returns to the captured base pose',
        shake.trauma === 0 && camera.position.distanceTo(base) < EPSILON && camera.rotation.z === 0,
    );

    shake.add(0.5);
    shake.reset();
    check('reset drops trauma and restores the base pose', shake.trauma === 0);
}

// ===== blade trail =====
console.log('Blade trail');

/** Half-height of the drawn ribbon, in world units. */
function ribbonHalfHeight(geometry: BufferGeometry): number {
    const position = geometry.getAttribute('position');
    const array = position.array as Float32Array;
    const samples = geometry.drawRange.count / 12 + 1;
    let max = 0;
    for (let index = 1; index < samples * 9; index += 3) {
        max = Math.max(max, Math.abs(array[index]));
    }
    return max;
}

{
    const scene = new Scene();
    const trail = createBladeTrail(scene, { tint: '#0e2730' });
    const mesh = scene.children[0] as Mesh;
    const geometry = mesh.geometry as BufferGeometry;

    check('the trail is one mesh', scene.children.length === 1);
    check('the ribbon is indexed', geometry.index !== null);

    trail.update(0);
    trail.start(new Vector3(0, 0, 0));
    trail.add(new Vector3(1, 0, 0));
    trail.add(new Vector3(2, 0, 0));
    trail.update(0);

    check(
        'three samples draw two segments',
        geometry.drawRange.count === 24,
        `${geometry.drawRange.count}`,
    );
    check('the trail is visible mid-stroke', mesh.visible);

    const flat = ribbonHalfHeight(geometry);
    trail.flash();
    trail.update(0);
    const flashed = ribbonHalfHeight(geometry);
    check('a cut flash widens the ribbon', flashed > flat, `${flat} -> ${flashed}`);

    trail.update(500);
    check('a held stroke ages its tail out', !mesh.visible);

    trail.add(new Vector3(3, 0, 0));
    trail.add(new Vector3(4, 0, 0));
    trail.update(500);
    check('a stroke resumes after the tail aged out', mesh.visible);

    trail.end();
    trail.update(520);
    check('a release keeps the ribbon while it fades', mesh.visible);
    trail.update(570);
    trail.update(620);
    trail.update(670);
    check('a release fades the ribbon out', !mesh.visible);

    const stillScene = new Scene();
    const still = createBladeTrail(stillScene, { tint: '#0e2730', reducedMotion: true });
    const stillMesh = stillScene.children[0] as Mesh;
    const stillGeometry = stillMesh.geometry as BufferGeometry;

    still.update(0);
    still.start(new Vector3(0, 0, 0));
    still.add(new Vector3(1, 0, 0));
    still.add(new Vector3(2, 0, 0));
    still.update(0);
    const stillFlat = ribbonHalfHeight(stillGeometry);
    still.flash();
    still.update(0);
    check('reduced motion skips the cut flash', ribbonHalfHeight(stillGeometry) === stillFlat);

    still.end();
    still.update(20);
    check('reduced motion snaps off instead of fading', !stillMesh.visible);

    check('fade is a config knob', BLADE.fadeSeconds >= 0);

    // 2026-10-30 bug: `palette.top` is near-black, so a straight lerp to white
    // left chroma 0.009 — the knob moved the colour but no hue survived.
    const hue = bladeTint('#0e2730', 0);
    const light = bladeTint('#0e2730', BLADE.tintWhiteMix);
    const white = bladeTint('#0e2730', 1);
    const chroma = (c: Color): number => Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b);

    check('the tint keeps the theme hue at mix 0', chroma(hue) > 0.5, `${chroma(hue)}`);
    check(
        'tintWhiteMix lightens without erasing the hue',
        chroma(light) > 0.15 && light.r > hue.r,
        `chroma ${chroma(light)}`,
    );
    check('mix 1 is white', chroma(white) === 0 && white.r === 1);

    const colors = geometry.getAttribute('color');
    const edgeChroma =
        Math.max(colors.getX(6), colors.getY(6), colors.getZ(6)) -
        Math.min(colors.getX(6), colors.getY(6), colors.getZ(6));
    check('the tinted edge reaches the ribbon', edgeChroma > 0.05, `${edgeChroma}`);
}

// ===== allocation guard =====
console.log('Allocation guard');

const ALLOCATIONS: ReadonlyArray<readonly [RegExp, string]> = [
    [/\bnew\s/, 'new'],
    [/\.clone\(/, '.clone('],
    [/\.map\(/, '.map('],
    [/\.filter\(/, '.filter('],
    [/\.slice\(/, '.slice('],
    [/\.concat\(/, '.concat('],
    [/Array\.from/, 'Array.from'],
    [/Object\.assign/, 'Object.assign'],
    [/\{\s*\.\.\./, 'object spread'],
];

function functionBody(source: string, signature: string): string | undefined {
    const start = source.indexOf(signature);
    if (start === -1) return undefined;

    const open = source.indexOf('{', start);
    if (open === -1) return undefined;

    let depth = 0;
    for (let index = open; index < source.length; index += 1) {
        if (source[index] === '{') depth += 1;
        if (source[index] === '}') {
            depth -= 1;
            if (depth === 0) return source.slice(open + 1, index);
        }
    }
    return undefined;
}

const SRC = decodeURIComponent(new URL('../src/', import.meta.url).pathname);
const GUARDED: ReadonlyArray<readonly [string, string]> = [
    ['rendering/ObjectViews.ts', 'export function syncViews'],
    ['rendering/DebrisViews.ts', 'export function syncDebrisViews'],
    ['game/Physics.ts', 'step(pool'],
    ['game/Slicer.ts', 'cut(pool'],
    ['game/Input.ts', '#emit(event'],
    ['rendering/BladeTrail.ts', 'function add(world'],
    ['rendering/BladeTrail.ts', 'function writeGeometry()'],
    ['rendering/BladeTrail.ts', 'function update(nowMs'],
    ['game/Effects.ts', 'step(dt'],
    ['rendering/SparkViews.ts', 'export function syncSparkViews'],
    ['rendering/Shake.ts', 'function apply()'],
];

for (const [file, signature] of GUARDED) {
    const source = readFileSync(`${SRC}${file}`, 'utf8');
    const body = functionBody(source, signature);

    if (body === undefined) {
        check(`${file} ${signature} found`, false, 'function body not found');
        continue;
    }

    const hits = ALLOCATIONS.filter(([pattern]) => pattern.test(body)).map(([, name]) => name);
    check(`${file} ${signature} allocates nothing`, hits.length === 0, hits.join(', '));
}

if (failures > 0) {
    throw new Error(`${failures} perf check(s) failed`);
}
console.log(`ALL PASS — ${total} checks`);
