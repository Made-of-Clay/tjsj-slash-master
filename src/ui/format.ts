/** Signed points with the typographic minus — shared by the legend and popups. */
export function formatPoints(points: number): string {
    if (points === 0) return '0';
    return points > 0 ? `+${points}` : `-${Math.abs(points)}`;
}
