import { PerspectiveCamera, Plane, Raycaster, Vector2, Vector3 } from 'three/webgpu';
import {
    CAMERA_FAR,
    CAMERA_FOV,
    CAMERA_NEAR,
    CAMERA_POSITION,
    CAMERA_TARGET,
    GAME_PLANE_DEPTH,
} from '../config';

/**
 * Fixed camera. No orbit controls: PLAN.md step 2 wants a locked 2.5D frame,
 * and OrbitControls would also capture the canvas pointer that Input owns.
 */
export function createCamera(aspect: number): PerspectiveCamera {
    const camera = new PerspectiveCamera(CAMERA_FOV, aspect, CAMERA_NEAR, CAMERA_FAR);
    camera.position.set(...CAMERA_POSITION);
    camera.lookAt(...CAMERA_TARGET);
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

        const aspect = width / height;
        if (camera.aspect !== aspect) {
            camera.aspect = aspect;
            camera.updateProjectionMatrix();
        }
    };
}
