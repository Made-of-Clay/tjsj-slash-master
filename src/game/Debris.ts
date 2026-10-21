import { Euler, Vector3 } from 'three/webgpu';
import { CUT, GRAVITY } from '../config';
import type { ObjectCategory } from '../content/types';
import type { SpawnedObject } from './SpawnedObject';

/** Bounding radius of each of an object's two pieces, by piece index. */
export type PieceRadii = readonly [number, number];

/**
 * One sliced piece (step 5B). Presentation state only: pieces are never
 * re-sliced, scored, or counted against the object pool — they live in this
 * ring and vanish below the launch line or at `CUT.life`.
 */
export interface DebrisPiece {
    position: Vector3;
    velocity: Vector3;
    rotation: Euler;
    angularVelocity: Vector3;
    /** View dispatch: which def's piece geometry pair to draw. */
    defId: string;
    category: ObjectCategory;
    /** View dispatch: index within the def's piece pair (0 or 1). */
    pieceIndex: number;
    /** Bounding radius, for the below-launch-line despawn margin. */
    radius: number;
    /** Seconds since spawn; force-despawns at `CUT.life`. */
    age: number;
    active: boolean;
}

/**
 * Sliced-piece ring (step 5B, Decision A/H). Presentation, not gameplay:
 * pieces can never be re-sliced or scored, and they never compete with the
 * spawner for object-pool slots. Capped ring, drop-oldest on overflow,
 * ballistic integration mirroring Physics, despawn below the launch line or
 * at `CUT.life`.
 *
 * Pure gameplay module: no DOM, no scene graph — views bind in
 * `rendering/DebrisViews.ts`, so `verify-cut` can run it under bun.
 */
export class Debris {
    /** Construction-order view of every slot; views key visibility off `active`. */
    readonly pieces: readonly DebrisPiece[];
    /** Next slot to overwrite on spawn — ring order is spawn order. */
    #write = 0;
    #radii: (defId: string) => PieceRadii;
    #rand: () => number;

    /**
     * @param capacity ring size, in pieces
     * @param radii per-def piece bounding radii, by piece index (boot-built
     *   from the theme defs: authored pieces from their own size, the default
     *   clone scaled — see `createDebrisViews`)
     * @param rand injectable RNG (Decision 3F); production gets Math.random
     */
    constructor(capacity: number, radii: (defId: string) => PieceRadii, rand?: () => number) {
        const size = Math.max(1, Math.floor(capacity));
        this.#radii = radii;
        this.#rand = rand ?? Math.random;
        this.pieces = Array.from({ length: size }, (): DebrisPiece => ({
            position: new Vector3(),
            velocity: new Vector3(),
            rotation: new Euler(),
            angularVelocity: new Vector3(),
            defId: '',
            category: 'target',
            pieceIndex: 0,
            radius: 0,
            age: 0,
            active: false,
        }));
    }

    /** Live pieces right now — harness convenience. */
    get activeCount(): number {
        let count = 0;
        for (let index = 0; index < this.pieces.length; index += 1) {
            if (this.pieces[index].active) count += 1;
        }
        return count;
    }

    /**
     * Splits `parent` into its two pieces (Decision C): offset ± along the
     * slice normal at spawn, velocity = parent's × `CUT.inherit` + ±normal ×
     * `CUT.separation`, opposed tumble around the view axis. One wobble draw
     * is shared by the pair, so two objects cut by the same stroke don't look
     * stamped from one mould (Decision 3F).
     *
     * Call order with the Slicer matters: this runs before `pool.release`
     * zeroes the parent, and it copies everything it needs.
     */
    spawn(parent: SpawnedObject, nx: number, ny: number): void {
        const radii = this.#radii(parent.defId);
        const wobble = 0.9 + 0.2 * this.#rand();
        this.#writePiece(parent, nx, ny, 0, radii[0], wobble);
        this.#writePiece(parent, nx, ny, 1, radii[1], wobble);
    }

    #writePiece(
        parent: SpawnedObject,
        nx: number,
        ny: number,
        index: number,
        radius: number,
        wobble: number,
    ): void {
        const piece = this.pieces[this.#write];
        const sign = index === 0 ? 1 : -1;
        const offset = sign * parent.radius * CUT.offset;
        const separation = sign * CUT.separation * wobble;

        piece.position.set(
            parent.position.x + nx * offset,
            parent.position.y + ny * offset,
            parent.position.z,
        );
        piece.velocity.set(
            parent.velocity.x * CUT.inherit + nx * separation,
            parent.velocity.y * CUT.inherit + ny * separation,
            parent.velocity.z * CUT.inherit,
        );
        piece.rotation.copy(parent.rotation);
        piece.angularVelocity.set(
            parent.angularVelocity.x * 0.5,
            parent.angularVelocity.y * 0.5,
            sign * CUT.spin * wobble,
        );
        piece.defId = parent.defId;
        piece.category = parent.category;
        piece.pieceIndex = index;
        piece.radius = radius;
        piece.age = 0;
        piece.active = true;

        this.#write = (this.#write + 1) % this.pieces.length;
    }

    /**
     * One fixed step for every live piece: ballistic integration in place
     * (same order as Physics), then despawn — below the launch line by the
     * piece's radius, or past `CUT.life` wherever it is. No velocity guard on
     * the floor check: pieces spawn in-field and falling is their only
     * long-term trend; `CUT.life` catches any straggler.
     */
    step(dt: number, bottomY: number): void {
        const life = CUT.life;
        for (let index = 0; index < this.pieces.length; index += 1) {
            const piece = this.pieces[index];
            if (!piece.active) continue;

            piece.position.x += piece.velocity.x * dt;
            piece.position.y += piece.velocity.y * dt;
            piece.position.z += piece.velocity.z * dt;
            piece.velocity.y -= GRAVITY * dt;

            piece.rotation.x += piece.angularVelocity.x * dt;
            piece.rotation.y += piece.angularVelocity.y * dt;
            piece.rotation.z += piece.angularVelocity.z * dt;

            piece.age += dt;
            if (piece.age > life || piece.position.y < bottomY - piece.radius) {
                piece.active = false;
            }
        }
    }

    /** Deactivates every piece (round restart — step 6 calls this). */
    clear(): void {
        for (let index = 0; index < this.pieces.length; index += 1) {
            this.pieces[index].active = false;
        }
    }
}
