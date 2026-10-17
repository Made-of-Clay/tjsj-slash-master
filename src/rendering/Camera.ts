import { PerspectiveCamera, Plane, Raycaster, Vector2, Vector3 } from 'three/webgpu';
import { CAMERA, GAME_PLANE_DEPTH, PLAYFIELD } from '../config';

/** The world-space playfield rectangle, on the play plane. */
export interface PlayBounds {
    readonly halfWidth: number;
    readonly halfHeight: number;
    readonly centerY: number;
}

/** The device-independent description of the playfield. */
export interface PlayFieldSpec {
    readonly halfHeight: number;
    readonly centerY: number;
    readonly sideMargin: number;
}

/** Live playfield: current bounds plus the reframe that recomputes them. */
export interface PlayField {
    /** Current bounds. Reframing writes in place, so held references stay valid. */
    readonly bounds: PlayBounds;
    /** Recompute the bounds for `aspect`, reframe `camera`, return the bounds. */
    reframe(aspect: number): PlayBounds;
}

function tanHalfFov(fovDeg: number): number {
    return Math.tan((fovDeg * Math.PI) / 180 / 2);
}

/**
 * Playfield bounds for `aspect` (full-width policy, step 2 course correction).
 *
 * The vertical extent is fixed by `spec.halfHeight`; the horizontal extent is
 * whatever the viewport shows at the play plane, less `spec.sideMargin` at each
 * edge so an object centred inside is never partially cut off. Wide screens get
 * a wider field instead of background margin.
 */
export function computePlayBounds(spec: PlayFieldSpec, fovDeg: number, aspect: number): PlayBounds {
    const halfViewHeight = viewDistance(spec, fovDeg) * tanHalfFov(fovDeg);
    const halfViewWidth = halfViewHeight * aspect;
    const halfWidth = Math.max(halfViewWidth - spec.sideMargin, 0);

    return { halfWidth, halfHeight: spec.halfHeight, centerY: spec.centerY };
}

/** Camera distance: the fixed half-height through the FOV, plus the edge margin. */
function viewDistance(spec: PlayFieldSpec, fovDeg: number): number {
    return spec.halfHeight / tanHalfFov(fovDeg) + CAMERA.margin;
}

/**
 * Places the camera straight-on at its constant distance and returns the bounds
 * the viewport exposes for `aspect`.
 *
 * The distance does not depend on aspect — the height is always the binding
 * dimension — so a resize only changes the projection aspect and the derived
 * width, never the camera distance.
 */
function frameCamera(camera: PerspectiveCamera, spec: PlayFieldSpec, aspect: number): PlayBounds {
    camera.aspect = aspect;
    camera.updateProjectionMatrix();

    const distance = viewDistance(spec, camera.fov);
    camera.position.set(0, spec.centerY, distance);
    camera.lookAt(0, spec.centerY, 0);

    return computePlayBounds(spec, camera.fov, aspect);
}

/**
 * Fixed camera. No orbit controls: PLAN.md step 2 wants a locked 2.5D frame, and
 * OrbitControls would also capture the canvas pointer that Input owns.
 *
 * Straight-on (decision A) so the fit math is exact; distance is set by
 * `frameCamera`, not hardcoded.
 */
export function createCamera(aspect: number, spec: PlayFieldSpec = PLAYFIELD): PerspectiveCamera {
    const camera = new PerspectiveCamera(CAMERA.fov, aspect, CAMERA.near, CAMERA.far);
    frameCamera(camera, spec, aspect);
    return camera;
}

/**
 * Live playfield for the app. Owns the one mutable `bounds` object so gameplay
 * systems (spawner, collision) can hold a reference that stays current across
 * resizes.
 */
export function createPlayField(
    camera: PerspectiveCamera,
    spec: PlayFieldSpec = PLAYFIELD,
): PlayField {
    const bounds: { halfWidth: number; halfHeight: number; centerY: number } = {
        halfWidth: 0,
        halfHeight: spec.halfHeight,
        centerY: spec.centerY,
    };

    function reframe(aspect: number): PlayBounds {
        bounds.halfWidth = frameCamera(camera, spec, aspect).halfWidth;
        return bounds;
    }

    reframe(camera.aspect);
    return { bounds, reframe };
}

/**
 * Projects NDC onto the gameplay plane, for `Input` to turn a screen stroke
 * into a world-space segment.
 *
 * Returns a function rather than exposing the raycaster, so the caller's
 * handler cannot accidentally read or mutate shared scratch state.
 */
export function createSwipeProjector(
    camera: PerspectiveCamera,
    depth: number = GAME_PLANE_DEPTH,
): (ndcX: number, ndcY: number, out: Vector3) => void {
    // Allocated once per projector, not per segment.
    const ndc = new Vector2();
    const raycaster = new Raycaster();
    const plane = new Plane(new Vector3(0, 0, 1), -depth);

    return (ndcX, ndcY, out) => {
        ndc.set(ndcX, ndcY);
        raycaster.setFromCamera(ndc, camera);

        if (!raycaster.ray.intersectPlane(plane, out)) {
            // Ray is parallel to the plane (camera pointing straight up/down).
            out.set(ndcX, ndcY, depth);
        }
    };
}

/**
 * Keeps the drawing buffer, camera aspect and playfield bounds matched to the
 * canvas.
 *
 * Driven by resize/orientation events rather than read every frame: reading
 * clientWidth per frame forces a layout flush, and a canvas that hasn't been
 * resized cannot have a new size.
 *
 * `onReframe` fires after every reframe (with the new bounds), so callers can
 * redraw anything derived from bounds — e.g. the debug rect.
 *
 * Owns its window listeners for the page's lifetime — the game never tears down.
 */
export function createViewportSync(
    renderer: {
        domElement: HTMLCanvasElement;
        getPixelRatio(): number;
        setSize(w: number, h: number, updateStyle?: boolean): void;
    },
    playfield: PlayField,
    onReframe?: (bounds: PlayBounds) => void,
): () => void {
    let dirty = true;

    const markDirty = (): void => {
        dirty = true;
    };

    window.addEventListener('resize', markDirty);
    // Fires when the mobile URL bar collapses; `resize` alone misses it.
    window.visualViewport?.addEventListener('resize', markDirty);
    window.addEventListener('orientationchange', markDirty);

    return () => {
        if (!dirty) return;
        dirty = false;

        const canvas = renderer.domElement;
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        if (width === 0 || height === 0) return;

        const pixelRatio = renderer.getPixelRatio();
        const outOfDate =
            Math.abs(canvas.width - width * pixelRatio) > 0.5 ||
            Math.abs(canvas.height - height * pixelRatio) > 0.5;

        if (outOfDate) {
            renderer.setSize(width, height, false);
        }

        // The derived width and the projection aspect both depend on the canvas
        // aspect, so the whole field is re-derived on every resize.
        onReframe?.(playfield.reframe(width / height));
    };
}
