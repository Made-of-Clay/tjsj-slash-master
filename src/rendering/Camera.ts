import { PerspectiveCamera, Plane, Raycaster, Vector2, Vector3 } from 'three/webgpu';
import { CAMERA, GAME_PLANE_DEPTH, PLAY_BOUNDS } from '../config';

/** The world-space arena the camera must keep fully in frame. */
export interface PlayBounds {
    readonly halfWidth: number;
    readonly halfHeight: number;
    readonly centerY: number;
}

/**
 * Distance at which a view-perpendicular plane with these half-extents fills the
 * frustum for `aspect`.
 *
 * Two constraints compete: the height must fit (`dHeight`) and the width must fit
 * (`dWidth`). The larger wins — that is the fit-bounds policy (step 2 decision
 * B): the whole arena is always visible, and extra space at wide aspects becomes
 * background margin.
 */
export function computeFitDistance(
    halfWidth: number,
    halfHeight: number,
    fovDeg: number,
    aspect: number,
): number {
    const tanHalfFov = Math.tan((fovDeg * Math.PI) / 180 / 2);
    const distanceForHeight = halfHeight / tanHalfFov;
    const distanceForWidth = halfWidth / (tanHalfFov * aspect);
    return Math.max(distanceForHeight, distanceForWidth);
}

/**
 * Places the camera straight-on so `bounds` fits the viewport exactly.
 *
 * Called on construction and on every resize: camera distance depends on aspect,
 * so a resize must re-derive it, not just refresh the projection matrix. The
 * play plane stays at `GAME_PLANE_DEPTH`, so the swipe projector is unaffected.
 */
export function applyFraming(camera: PerspectiveCamera, bounds: PlayBounds, aspect: number): void {
    camera.aspect = aspect;
    camera.updateProjectionMatrix();

    const distance =
        computeFitDistance(bounds.halfWidth, bounds.halfHeight, camera.fov, aspect) + CAMERA.margin;

    camera.position.set(0, bounds.centerY, distance);
    camera.lookAt(0, bounds.centerY, 0);
}

/**
 * Fixed camera. No orbit controls: PLAN.md step 2 wants a locked 2.5D frame, and
 * OrbitControls would also capture the canvas pointer that Input owns.
 *
 * Straight-on (decision A) so the fit math is exact; distance is set by
 * applyFraming, not hardcoded.
 */
export function createCamera(aspect: number): PerspectiveCamera {
    const camera = new PerspectiveCamera(CAMERA.fov, aspect, CAMERA.near, CAMERA.far);
    applyFraming(camera, PLAY_BOUNDS, aspect);
    return camera;
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
 * Keeps the drawing buffer and camera aspect matched to the canvas.
 *
 * Driven by resize/orientation events rather than read every frame: reading
 * clientWidth per frame forces a layout flush, and a canvas that hasn't been
 * resized cannot have a new size.
 *
 * Owns its window listeners for the page's lifetime — the game never tears down.
 */
export function createViewportSync(
    renderer: {
        domElement: HTMLCanvasElement;
        getPixelRatio(): number;
        setSize(w: number, h: number, updateStyle?: boolean): void;
    },
    camera: PerspectiveCamera,
    bounds: PlayBounds = PLAY_BOUNDS,
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

        // Distance depends on aspect, so framing is re-derived on every resize,
        // not just the projection matrix.
        applyFraming(camera, bounds, width / height);
    };
}
