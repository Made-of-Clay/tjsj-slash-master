/*
 * Foundation checks for step 1.
 *
 *   bun scripts/verify-foundation.ts
 *
 * No test framework on purpose — these are plain assertions over the pure
 * logic in src/game and src/rendering, which need no WebGL and no DOM beyond
 * the stubs below. Run them after touching GameLoop, Input, Pool or Camera.
 *
 * Covers what `pnpm build` cannot: build, lint and formatting all pass while
 * a loop that runs zero steps or a projector that lands off-plane.
 */

let failures = 0;
function check(name: string, condition: boolean, detail = ''): void {
    if (condition) {
        console.log(`  ok    ${name}`);
    } else {
        failures += 1;
        console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
    }
}

// ===== minimal DOM stub =====
type Listener = (event: unknown) => void;

const documentListeners = new Map<string, Set<Listener>>();
let documentHidden = false;

const stubDocument = {
    get hidden(): boolean {
        return documentHidden;
    },
    addEventListener(type: string, listener: Listener): void {
        if (!documentListeners.has(type)) documentListeners.set(type, new Set());
        documentListeners.get(type)?.add(listener);
    },
    removeEventListener(type: string, listener: Listener): void {
        documentListeners.get(type)?.delete(listener);
    },
    createElement(): Record<string, unknown> {
        return { appendChild() {} };
    },
    body: { appendChild() {} },
};

const stubWindow = { addEventListener() {}, removeEventListener() {} };

function setGlobal(name: string, value: unknown): void {
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
}

function setDocumentHidden(hidden: boolean): void {
    documentHidden = hidden;
    for (const listener of documentListeners.get('visibilitychange') ?? []) {
        listener({});
    }
}

setGlobal('document', stubDocument);
setGlobal('window', stubWindow);

// Static imports, not dynamic: a computed specifier such as `${src}game/...`
// comes back as `any`, which would quietly disable type checking in here.
// Safe to import eagerly too — no src/ module touches document or window at
// module scope; they attach listeners from constructors only.
import { Vector3 } from 'three/webgpu';
import { GAME_PLANE_DEPTH } from '../src/config.ts';
import { GameLoop } from '../src/game/GameLoop.ts';
import { Input } from '../src/game/Input.ts';
import { Pool } from '../src/game/Pool.ts';
import { createCamera, createSwipeProjector } from '../src/rendering/Camera.ts';

// ===== GameLoop =====
console.log('GameLoop');
{
    let updates = 0;
    let renders = 0;
    let lastAlpha = -1;
    let simulatedSeconds = 0;

    const loop = new GameLoop({
        fixedUpdate: (dt: number) => {
            updates += 1;
            simulatedSeconds += dt;
        },
        render: (alpha: number) => {
            renders += 1;
            lastAlpha = alpha;
        },
    });

    loop.start();

    check('step defaults to 1/60', Math.abs(loop.step - 1 / 60) < 1e-9);
    check('maxSubSteps defaults to 5', loop.maxSubSteps === 5);
    check('fps starts at 0', loop.fps === 0);

    let timestamp = 0;
    loop.tick(timestamp);
    check('first tick renders without stepping', renders === 1 && updates === 0);

    for (let frame = 1; frame <= 9; frame += 1) {
        timestamp += 1000 / 60;
        loop.tick(timestamp);
    }

    // Timestamps here are synthesised by repeated float addition, so the total
    // lands near 9 steps. The invariant is simulated-time accuracy, not a
    // specific step count.
    check(
        '9 frames of 1/60 produce 8 or 9 steps',
        updates === 8 || updates === 9,
        `got ${updates}`,
    );
    check(
        'simulated time within one step of wall time',
        Math.abs(simulatedSeconds - 9 / 60) <= loop.step,
        `got ${simulatedSeconds}`,
    );
    check('render runs every frame', renders === 10, `got ${renders}`);
    check('alpha stays in [0,1)', lastAlpha >= 0 && lastAlpha < 1, `got ${lastAlpha}`);
    check('fps reads approximately 60', Math.abs(loop.fps - 60) < 1, `got ${loop.fps.toFixed(2)}`);

    const beforeStall = updates;
    loop.tick(timestamp + 100_000);
    check(
        'a 100s stall is clamped to maxSubSteps',
        updates - beforeStall === loop.maxSubSteps,
        `got ${updates - beforeStall}`,
    );

    const beforeHidden = updates;
    setDocumentHidden(true);
    check('pauses while hidden', loop.paused && loop.running && !loop.active);
    loop.tick(timestamp + 200_000);
    check('tick is a no-op while paused', updates === beforeHidden);

    setDocumentHidden(false);
    check('resumes when visible', !loop.paused && loop.active);
    loop.tick(timestamp + 300_000);
    check(
        'no catch-up burst after resuming',
        updates - beforeHidden <= 1,
        `got ${updates - beforeHidden}`,
    );

    // Regression: the auto-pause must not unregister the listener that resumes it.
    loop.stop();
    loop.start();
    setDocumentHidden(true);
    setDocumentHidden(false);
    check('a pause cycle still leaves the loop active', loop.active, `active=${loop.active}`);

    loop.stop();
    check('stop() clears running', !loop.running && !loop.active);
    loop.stop();
    check('stop() is idempotent', !loop.running);
    loop.dispose();
    check(
        'dispose() removes the visibility listener',
        (documentListeners.get('visibilitychange')?.size ?? 0) === 0,
    );
}

// ===== Pool =====
console.log('Pool');
{
    let constructed = 0;
    let resets = 0;
    const pool = new Pool<{ id: number }>(
        3,
        () => ({ id: constructed++ }),
        () => {
            resets += 1;
        },
    );

    check('preallocates everything in the constructor', constructed === 3, `made ${constructed}`);
    check('starts empty', pool.inUse === 0 && pool.available === 3);

    const first = pool.acquire()!;
    const second = pool.acquire()!;
    check('acquire returns distinct items', first !== second);
    check('tracks inUse', pool.inUse === 2 && pool.available === 1);

    pool.release(first);
    check('release calls reset exactly once', resets === 1);
    pool.release(first);
    check(
        'double release is a no-op',
        pool.inUse === 1 && pool.available === 2,
        `inUse=${pool.inUse}`,
    );

    const third = pool.acquire()!;
    check('released slot is reused', pool.available === 1 && pool.inUse === 2);
    const fourth = pool.acquire()!;
    check(
        'exhaustion returns undefined',
        pool.acquire() === undefined && fourth !== first && fourth !== second && fourth !== third,
    );
    check('never grows past capacity', pool.size === 3 && pool.available === 0);

    const visited: number[] = [];
    pool.each((item) => visited.push(item.id));
    check(
        'each() visits only in-use items',
        visited.length === 3 && pool.inUse === 3,
        `saw ${visited.length}`,
    );

    const constructedBeforeChurn = constructed;
    for (let i = 0; i < 10_000; i += 1) {
        const item = pool.acquire();
        if (item) pool.release(item);
    }
    check(
        '10k acquire/release cycles allocate nothing new',
        constructed === constructedBeforeChurn,
        `made ${constructed}`,
    );

    pool.release({ id: 999 });
    check('releasing a foreign item is a no-op', pool.inUse === 3, `inUse ${pool.inUse}`);
}

// ===== Input =====
console.log('Input');
{
    const rect = { left: 0, top: 0, width: 800, height: 400 };
    const captured = new Set<number>();
    const listeners = new Map<string, Set<Listener>>();

    const target = {
        getBoundingClientRect: () => rect,
        setPointerCapture: (id: number) => captured.add(id),
        releasePointerCapture: (id: number) => captured.delete(id),
        hasPointerCapture: (id: number) => captured.has(id),
        addEventListener(type: string, listener: Listener): void {
            if (!listeners.has(type)) listeners.set(type, new Set());
            listeners.get(type)?.add(listener);
        },
        removeEventListener(type: string, listener: Listener): void {
            listeners.get(type)?.delete(listener);
        },
    };

    // Identity projector: NDC passes through unchanged so assertions are exact.
    const input = new Input(target as never, (x, y, vector) => vector.set(x, y, 0));

    const received: Array<[number, number, number, number]> = [];
    input.onSwipe(({ from, to }) => {
        received.push([from.x, from.y, to.x, to.y]);
    });

    const event = (
        pointerId: number,
        clientX: number,
        clientY: number,
        coalesced: unknown[] = [],
    ) =>
        ({
            pointerId,
            clientX,
            clientY,
            getCoalescedEvents: () => coalesced,
        }) as never;

    const fire = (type: string, pointerEvent: unknown): void => {
        for (const listener of listeners.get(type) ?? []) {
            listener(pointerEvent);
        }
    };

    // An 800x400 rect puts client (400,200) at NDC centre (0,0).
    fire('pointerdown', event(1, 400, 200));
    check('captures the pointer on down', captured.has(1));

    fire('pointermove', event(1, 0, 0));
    check(
        'centre -> top-left maps to NDC (0,0) -> (-1,1)',
        JSON.stringify(received.at(-1)) === '[0,0,-1,1]',
        JSON.stringify(received.at(-1)),
    );

    fire('pointerdown', event(2, 700, 100));
    const beforeSecondPointer = received.length;
    fire('pointermove', event(2, 100, 300));
    check('a second pointer cannot hijack the stroke', received.length === beforeSecondPointer);

    const beforeCoalesced = received.length;
    fire(
        'pointermove',
        event(1, 0, 0, [event(1, 100, 100), event(1, 200, 100), event(1, 300, 100)]),
    );
    check(
        'coalesced events yield one segment each',
        received.length - beforeCoalesced === 3,
        `got ${received.length - beforeCoalesced}`,
    );
    check(
        'coalesced segments chain end to end',
        received
            .slice(beforeCoalesced)
            .every(
                (segment, i, all) =>
                    i === 0 || (segment[0] === all[i - 1][2] && segment[1] === all[i - 1][3]),
            ),
        JSON.stringify(received.slice(beforeCoalesced)),
    );

    const beforeJitter = received.length;
    fire('pointermove', event(1, 300.2, 100));
    check('sub-pixel jitter emits no segment', received.length === beforeJitter);

    const beforeForeignUp = received.length;
    fire('pointerup', event(2, 100, 300));
    check('up from a non-active pointer is ignored', received.length === beforeForeignUp);
    check('the active pointer survives it', captured.has(1));

    fire('pointerup', event(1, 300, 100));
    check('releases capture on up', !captured.has(1));

    const beforeNewStroke = received.length;
    fire('pointerdown', event(3, 799, 399));
    fire('pointermove', event(3, 0, 0));
    check('a new stroke emits', received.length === beforeNewStroke + 1);
    check(
        'it does not chain from the previous stroke',
        (received.at(-1)?.[0] ?? 0) > 0.9,
        JSON.stringify(received.at(-1)),
    );

    rect.width = 0;
    const beforeDegenerate = received.length;
    fire('pointermove', event(3, 100, 100));
    check('a zero-size rect emits nothing', received.length === beforeDegenerate);
    rect.width = 800;

    input.dispose();
    const beforeDispose = received.length;
    fire('pointerdown', event(5, 0, 0));
    fire('pointermove', event(5, 400, 400));
    check('dispose() detaches listeners', received.length === beforeDispose);
}

// ===== swipe projector =====
console.log('Swipe projector');
{
    const camera = createCamera(16 / 9);
    const project = createSwipeProjector(camera);
    const out = new Vector3();

    project(0, 0, out);
    check(
        'screen centre maps to the playfield origin',
        out.x.toFixed(3) === '0.000' && out.y.toFixed(3) === '1.600',
        `got ${out.x.toFixed(3)},${out.y.toFixed(3)}`,
    );
    check('screen centre lands on the play plane', out.z === GAME_PLANE_DEPTH, `z=${out.z}`);

    project(0, 1, out);
    const topY = out.y;
    project(1, 0, out);
    const rightX = out.x;
    project(-1, 0, out);
    const leftX = out.x;

    check('NDC +y maps above centre', topY > 1.6, `y=${topY.toFixed(3)}`);
    check('NDC +x maps to world +x', rightX > 0, `x=${rightX.toFixed(3)}`);
    check(
        'NDC -x mirrors +x',
        leftX < 0 && Math.abs(leftX + rightX) < 1e-6,
        `x=${leftX.toFixed(3)}`,
    );

    let everyPointOnPlane = true;
    for (const [ndcX, ndcY] of [
        [0.5, 0.5],
        [-0.7, -0.3],
        [0.9, 0.1],
        [-1, 1],
        [1, -1],
    ] as const) {
        project(ndcX, ndcY, out);
        if (out.z !== GAME_PLANE_DEPTH) {
            everyPointOnPlane = false;
        }
    }
    check('every tested NDC lands on the play plane', everyPointOnPlane);

    const from = new Vector3();
    const to = new Vector3();
    project(-0.9, -0.4, from);
    project(0.9, 0.4, to);
    check('a swipe segment is planar', from.z === to.z, `${from.z} vs ${to.z}`);
    check(
        'a swipe segment spans the screen',
        from.x < 0 && to.x > 0 && from.y < to.y,
        `${from.x.toFixed(2)} -> ${to.x.toFixed(2)}`,
    );

    out.set(999, 999, 999);
    project(0, 0, out);
    check('the out vector is always written', out.x !== 999);
}

if (failures > 0) {
    throw new Error(`${failures} foundation check(s) failed`);
}

console.log('\nALL PASS');
