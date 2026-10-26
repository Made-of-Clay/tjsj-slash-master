/*
 * Swipe checks for step 4.
 *
 *   bun scripts/verify-swipe.ts
 *
 * Plain assertions over the swipe contract: the gated ring buffer in
 * src/game/Swipes.ts (copy semantics, ring overflow, per-step drain, stroke
 * gate) plus the Input adapter driven by synthetic pointer events. No test
 * framework, no GPU, no DOM — every import here constructs without a
 * rendering context; bun ships no window/document/PointerEvent, so the
 * canvas target is a minimal EventTarget stand-in (Input only touches
 * addEventListener/getBoundingClientRect/pointer capture).
 *
 * This is the piece `pnpm build` cannot see: a gate that opens on every tap,
 * or a ring that hands the fixed step stale segments.
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

import { Vector3 } from 'three/webgpu';
import { SWIPE } from '../src/config.ts';
import { Input } from '../src/game/Input.ts';
import type { Projector, SwipeSegment } from '../src/game/Input.ts';
import { Swipes } from '../src/game/Swipes.ts';

function seg(x1: number, y1: number, x2: number, y2: number): SwipeSegment {
    return { from: new Vector3(x1, y1, 0), to: new Vector3(x2, y2, 0) };
}

// ===== buffer mechanics (ungated: gateDistance 0) =====
console.log('Buffer mechanics');
{
    const s = new Swipes(0);
    check('empty drain returns 0', s.drain() === 0);

    s.push(seg(0, 0, 1, 1));
    check('push buffers a segment', s.pending === 1, `got=${s.pending}`);

    const seen: number[] = [];
    const count = s.drain((g) => seen.push(g.from.x));
    check('drain returns the count it consumed', count === 1, `got=${count}`);
    check('drain hands the segment to the consumer', seen.length === 1 && seen[0] === 0);
    check('drain leaves nothing behind', s.pending === 0 && s.drain() === 0);

    // Arrival -> consumption pairing: segments pushed between fixed steps
    // wait for the next one and are consumed exactly once (the live-dev
    // observation that closed workstream A).
    const waiting = new Swipes(0);
    for (let i = 0; i < 3; i += 1) waiting.push(seg(i, 0, i, 0));
    check('segments wait for the next fixed step', waiting.pending === 3, `got=${waiting.pending}`);
    check('one drain consumes the whole arrival', waiting.drain() === 3);
    check('consumed segments are never re-delivered', waiting.drain() === 0);
}

// ===== ring: FIFO, overflow, clear =====
console.log('Ring');
{
    const fifo = new Swipes(0, 4);
    for (let i = 0; i < 3; i += 1) fifo.push(seg(i, 0, i, 0));
    const order: number[] = [];
    fifo.drain((g) => order.push(g.from.x));
    check('FIFO order preserved', order.join(',') === '0,1,2', `got=${order.join(',')}`);

    const overflow = new Swipes(0, 3);
    for (let i = 0; i < 5; i += 1) overflow.push(seg(i, 0, i, 0));
    check('pending never exceeds capacity', overflow.pending === 3, `got=${overflow.pending}`);
    const kept: number[] = [];
    overflow.drain((g) => kept.push(g.from.x));
    check(
        'overflow drops the oldest, keeps FIFO',
        kept.join(',') === '2,3,4',
        `got=${kept.join(',')}`,
    );

    const clamp = new Swipes(0, 0);
    clamp.push(seg(5, 0, 5, 0));
    check('capacity 0 clamps to 1 (never crashes)', clamp.drain() === 1);

    const reusable = new Swipes(0);
    reusable.push(seg(1, 0, 1, 0));
    reusable.push(seg(2, 0, 2, 0));
    check(
        'handlerless drain empties the ring (no-debug path)',
        reusable.drain(undefined) === 2 && reusable.pending === 0,
    );
    reusable.push(seg(3, 0, 3, 0));
    reusable.clear();
    check(
        'clear drops everything pending (backlog discard)',
        reusable.pending === 0 && reusable.drain() === 0,
    );
    reusable.push(seg(4, 0, 4, 0));
    let got = -1;
    reusable.drain((g) => {
        got = g.from.x;
    });
    check('ring is reusable after clear', got === 4, `got=${got}`);
}

// ===== copy semantics =====
console.log('Copy semantics');
{
    const s = new Swipes(0);
    const source = seg(1, 2, 3, 4);
    s.push(source);
    source.from.set(99, 99, 99);
    source.to.set(-99, -99, -99);
    let good = false;
    s.drain((g) => {
        good = g.from.x === 1 && g.from.y === 2 && g.to.x === 3 && g.to.y === 4;
    });
    check('buffer owns a copy — mutating the source after push changes nothing', good);
}

// ===== stroke gate (gateDistance 1.0 for round numbers) =====
console.log('Stroke gate');
{
    // Tap / resting drift: counted toward the gate, never buffered.
    const tap = new Swipes(1.0);
    tap.beginStroke();
    tap.push(seg(0, 0, 0.4, 0));
    tap.push(seg(0.4, 0, 0.8, 0));
    check(
        'under-gate travel is dropped (tap)',
        tap.pending === 0 && !tap.live,
        `pending=${tap.pending}`,
    );

    // The crossing segment opens the gate and is buffered whole.
    const crossing = new Swipes(1.0);
    crossing.beginStroke();
    crossing.push(seg(0, 0, 0.4, 0));
    crossing.push(seg(0.4, 0, 1.2, 0));
    const crossingPending = crossing.pending;
    let crossingFrom = -1;
    crossing.drain((g) => {
        crossingFrom = g.from.x;
    });
    check('the crossing segment opens the gate', crossing.live);
    check(
        'crossing segment is buffered whole (from = 0.4)',
        crossingPending === 1 && crossingFrom === 0.4,
        `pending=${crossingPending} from=${crossingFrom}`,
    );

    const exact = new Swipes(1.0);
    exact.beginStroke();
    exact.push(seg(0, 0, 1.0, 0));
    check('exactly at the gate counts as live (>=, not >)', exact.live && exact.pending === 1);

    const flick = new Swipes(1.0);
    flick.beginStroke();
    flick.push(seg(0, 0, 3, 4));
    check('a fast flick passes on the first segment', flick.live && flick.pending === 1);

    const slow = new Swipes(1.0);
    slow.beginStroke();
    slow.push(seg(0, 0, 2, 0));
    slow.push(seg(2, 0, 2.05, 0));
    slow.push(seg(2.05, 0, 2.1, 0));
    check(
        'once live, tiny segments keep flowing (slow drag)',
        slow.pending === 3,
        `got=${slow.pending}`,
    );

    const end = new Swipes(1.0);
    end.beginStroke();
    end.push(seg(0, 0, 2, 0));
    end.endStroke();
    check(
        'stroke end closes the gate, ring survives',
        !end.live && end.pending === 1,
        `pending=${end.pending}`,
    );
    end.push(seg(2, 0, 2.4, 0));
    check('the next stroke gates from zero again', !end.live && end.pending === 1);

    const missed = new Swipes(1.0);
    missed.beginStroke();
    missed.push(seg(0, 0, 2, 0));
    missed.beginStroke(); // a missed endStroke must not leave the gate stuck open
    missed.push(seg(2, 0, 2.4, 0));
    check('beginStroke recovers a missed stroke end', !missed.live && missed.pending === 1);

    const free = new Swipes(0);
    free.beginStroke();
    free.push(seg(0, 0, 0.01, 0));
    check('gateDistance 0 passes everything ungated', free.live && free.pending === 1);
}

// ===== allocation =====
// PERF-BUDGET: push/drain must not allocate per segment. Identity reuse is
// the deterministic proxy — a per-push allocation would surface as unique
// identities far above ring capacity.
console.log('Allocation');
{
    const s = new Swipes(0, 4);
    const instances = new Set<unknown>();
    const vectors = new Set<unknown>();
    for (let i = 0; i < 100; i += 1) {
        s.push(seg(i * 0.1, 0, i * 0.1 + 1, 0));
        s.drain((g) => {
            instances.add(g);
            vectors.add(g.from);
            vectors.add(g.to);
        });
    }
    check(
        'ring reuses segment instances (<= capacity)',
        instances.size <= 4,
        `unique=${instances.size}`,
    );
    check('ring reuses vector slots (<= capacity x2)', vectors.size <= 8, `unique=${vectors.size}`);
}

// ===== config =====
console.log('Config');
{
    check(
        'SWIPE.gateDistance is a positive finite world distance (gating on)',
        Number.isFinite(SWIPE.gateDistance) && SWIPE.gateDistance > 0,
        `gate=${SWIPE.gateDistance}`,
    );
}

// ===== Input adapter via synthetic pointer events =====
// bun has no DOM (no window/document/PointerEvent), so the canvas target is
// a minimal EventTarget stand-in and each event is a plain Event augmented
// with the pointer fields Input reads. Projection is an injected linear
// stand-in for createSwipeProjector: world = NDC * (10, 5).
console.log('Input adapter');
{
    const WIDTH = 800;
    const HEIGHT = 600;

    class FakeTarget extends EventTarget {
        readonly captured = new Set<number>();

        getBoundingClientRect(): DOMRect {
            return {
                x: 0,
                y: 0,
                left: 0,
                top: 0,
                right: WIDTH,
                bottom: HEIGHT,
                width: WIDTH,
                height: HEIGHT,
                toJSON: () => ({}),
            } as DOMRect;
        }

        setPointerCapture(id: number): void {
            this.captured.add(id);
        }

        hasPointerCapture(id: number): boolean {
            return this.captured.has(id);
        }

        releasePointerCapture(id: number): void {
            this.captured.delete(id);
        }
    }

    const project: Projector = (x, y, out) => out.set(x * 10, y * 5, 0);

    function fire(
        target: EventTarget,
        type: string,
        init: {
            clientX: number;
            clientY: number;
            pointerId?: number;
            samples?: Array<{ clientX: number; clientY: number }>;
            noCoalesced?: boolean;
        },
    ): void {
        const event = new Event(type) as Event & {
            pointerId: number;
            clientX: number;
            clientY: number;
            getCoalescedEvents: () => Array<{ clientX: number; clientY: number }>;
        };
        event.pointerId = init.pointerId ?? 1;
        event.clientX = init.clientX;
        event.clientY = init.clientY;
        if (!init.noCoalesced) {
            event.getCoalescedEvents = () => init.samples ?? [];
        }
        target.dispatchEvent(event);
    }

    const target = new FakeTarget();
    const input = new Input(target as unknown as HTMLElement, project);
    const starts: Vector3[] = [];
    const moves: Vector3[] = [];
    let ends = 0;
    const received: Array<{ from: Vector3; to: Vector3 }> = [];
    input.onStrokeStart((w) => starts.push(w.clone()));
    input.onStrokeMove((w) => moves.push(w.clone()));
    input.onStrokeEnd(() => {
        ends += 1;
    });
    input.onSwipe((s) => received.push({ from: s.from.clone(), to: s.to.clone() }));

    // pointerdown (100, 300) on 800x600 -> NDC (-0.75, 0) -> world (-7.5, 0).
    fire(target, 'pointerdown', { clientX: 100, clientY: 300 });
    check(
        'pointerdown projects to world space and starts the stroke',
        starts.length === 1 && starts[0].x === -7.5 && starts[0].y === 0,
        `got=${starts.length} ${starts[0]?.x},${starts[0]?.y}`,
    );
    check('the stroke is captured (pointer capture)', target.captured.has(1));

    // A second finger must not hijack the active stroke.
    fire(target, 'pointerdown', { clientX: 700, clientY: 100, pointerId: 2 });
    check(
        'a second finger cannot hijack the stroke',
        starts.length === 1,
        `starts=${starts.length}`,
    );

    // (100,300) -> (500,300): NDC -0.75 -> 0.25, world -7.5 -> 2.5.
    fire(target, 'pointermove', { clientX: 500, clientY: 300 });
    check('pointermove emits one segment', received.length === 1, `got=${received.length}`);
    check(
        'segment spans start -> current in world space',
        received.length === 1 &&
            received[0].from.x === -7.5 &&
            received[0].to.x === 2.5 &&
            received[0].to.y === 0,
    );

    // 1px at 800px wide = 0.0025 NDC < MIN_SEGMENT_NDC (0.004): filtered.
    fire(target, 'pointermove', { clientX: 501, clientY: 300 });
    check(
        'sub-pixel jitter is filtered',
        received.length === 1 && moves.length === 1,
        `received=${received.length} moves=${moves.length}`,
    );

    fire(target, 'pointermove', { clientX: 509, clientY: 300 });
    check(
        'segments chain (from = previous to)',
        received.length === 2 && received[1].from.equals(received[0].to),
        `got=${received.length}`,
    );

    // A fast flick packs intermediate positions into one coalesced event.
    fire(target, 'pointermove', {
        clientX: 509,
        clientY: 300,
        samples: [
            { clientX: 525, clientY: 300 },
            { clientX: 541, clientY: 300 },
        ],
    });
    check(
        'coalesced samples emit one segment each',
        received.length === 4,
        `got=${received.length}`,
    );

    fire(target, 'pointerup', { clientX: 541, clientY: 300 });
    check(
        'pointerup ends the stroke and releases capture',
        ends === 1 && !target.captured.has(1),
        `ends=${ends}`,
    );
    fire(target, 'pointerup', { clientX: 541, clientY: 300 });
    check('a duplicate pointerup does not double-end', ends === 1, `ends=${ends}`);
    fire(target, 'pointermove', { clientX: 700, clientY: 300 });
    check(
        'moves after the stroke ends are ignored',
        received.length === 4,
        `got=${received.length}`,
    );

    // Older Safari has no Coalesced Events API; the event is still a sample.
    fire(target, 'pointerdown', { clientX: 100, clientY: 300, pointerId: 3 });
    const beforeNoCoalesced = received.length;
    fire(target, 'pointermove', {
        clientX: 500,
        clientY: 300,
        pointerId: 3,
        noCoalesced: true,
    });
    check(
        'pointermove without coalesced events still emits',
        received.length === beforeNoCoalesced + 1,
        `got=${received.length}`,
    );

    // A stroke interrupted by an app switch never gets its pointerup.
    const beforeCancel = ends;
    input.cancelStroke();
    check(
        'cancelStroke ends the stroke and releases capture',
        ends === beforeCancel + 1 && !target.captured.has(3),
        `ends=${ends}`,
    );
    fire(target, 'pointerdown', { clientX: 100, clientY: 100, pointerId: 4 });
    check(
        'a new stroke starts after cancelStroke',
        starts.length === 3 && target.captured.has(4),
        `starts=${starts.length}`,
    );
    fire(target, 'pointerup', { clientX: 100, clientY: 100, pointerId: 4 });

    // End-to-end seam: Input -> Swipes gate -> per-step drain (step 5's input).
    const seamTarget = new FakeTarget();
    const seamInput = new Input(seamTarget as unknown as HTMLElement, project);
    const swipes = new Swipes(1.0);
    seamInput.onSwipe((s) => swipes.push(s));
    seamInput.onStrokeStart(() => swipes.beginStroke());
    seamInput.onStrokeEnd(() => swipes.endStroke());

    fire(seamTarget, 'pointerdown', { clientX: 100, clientY: 300 });
    // Each +16px move = 0.04 NDC = 0.4 world units at x*10 (and clears jitter).
    fire(seamTarget, 'pointermove', { clientX: 116, clientY: 300 });
    fire(seamTarget, 'pointermove', { clientX: 132, clientY: 300 });
    check(
        'short stroke stays under the gate',
        swipes.pending === 0 && !swipes.live,
        `pending=${swipes.pending}`,
    );

    fire(seamTarget, 'pointermove', { clientX: 148, clientY: 300 });
    check(
        'the gate opens mid-stroke',
        swipes.live && swipes.pending === 1,
        `pending=${swipes.pending}`,
    );

    fire(seamTarget, 'pointermove', { clientX: 164, clientY: 300 });
    fire(seamTarget, 'pointerup', { clientX: 164, clientY: 300 });
    check(
        'stroke end keeps buffered segments for the next step',
        swipes.pending === 2 && !swipes.live,
        `pending=${swipes.pending}`,
    );
    check(
        'drain hands the fixed step exactly what arrived',
        swipes.drain() === 2 && swipes.pending === 0,
    );
}

if (failures > 0) {
    throw new Error(`${failures} swipe check(s) failed`);
}

console.log(`\nALL PASS — ${total} checks`);
