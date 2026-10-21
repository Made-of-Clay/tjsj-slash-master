import type { Vector3 } from 'three/webgpu';

/**
 * Swipe-versus-object hit test (step 5, Decision F): 3D sphere-vs-segment.
 *
 * Pure scalar math — the closest point on the segment to the sphere center,
 * then a squared-distance compare. No vectors built, no scratch state. The
 * test is 3D (Decision 3B): any object z offset counts against the radius.
 * Theme data pins objects to z = 0 (chopping-bug fix 2026-10-21); restoring
 * a band means per-plane reprojection, not just data.
 *
 * `pad` widens the sphere (cut forgiveness). The Slicer passes `CUT.pad`; it
 * is a parameter here so the harness can vary it and this stays config-free.
 */
export function segmentSphere(
    from: Vector3,
    to: Vector3,
    center: Vector3,
    radius: number,
    pad: number,
): boolean {
    const abx = to.x - from.x;
    const aby = to.y - from.y;
    const abz = to.z - from.z;
    const acx = center.x - from.x;
    const acy = center.y - from.y;
    const acz = center.z - from.z;

    const abLengthSq = abx * abx + aby * aby + abz * abz;
    // Projection of the center onto the segment, clamped into it: a center
    // "before" `from` or "past" `to` tests against that endpoint. A
    // zero-length segment degenerates to a point test (t = 0).
    const t =
        abLengthSq === 0
            ? 0
            : Math.min(Math.max((abx * acx + aby * acy + abz * acz) / abLengthSq, 0), 1);

    const dx = acx - abx * t;
    const dy = acy - aby * t;
    const dz = acz - abz * t;
    const hitRadius = radius + pad;

    return dx * dx + dy * dy + dz * dz <= hitRadius * hitRadius;
}
