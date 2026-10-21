/**
 * Overlay mount point for the HUD — safe-area padded, pointer-events off so
 * swipes reach the canvas. `ui/hud.ts` (step 6) mounts the score/timer/game-over
 * widgets on it; combo widgets are step 9.
 */
export function createUiRoot(): HTMLDivElement {
    const root = document.createElement('div');
    root.className = 'ui-root';
    document.body.appendChild(root);

    return root;
}
