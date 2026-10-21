import type { Vector3 } from 'three/webgpu';

/**
 * Swipe-versus-object hit test (step 5, Decision F): 3D sphere-vs-segment.
 *
 * Pure scalar math — the closest point on the segment to the sphere center,
 * then a squared-distance compare. No vectors built, no scratch state. The
 * test is genuinely 3D (Decision 3B): a swipe segment lives on the play plane
 * (z = 0) while object centers sit in the ±1 depth band, so the depth offset
 * counts against the radius instead of being projected away.
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
