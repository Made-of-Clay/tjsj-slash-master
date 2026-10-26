/**
 * Overlay mount point for the HUD — safe-area padded, pointer-events off so
 * swipes reach the canvas. `ui/hud.ts` mounts every widget and card on it.
 */
export function createUiRoot(): HTMLDivElement {
    const root = document.createElement('div');
    root.className = 'ui-root';
    document.body.appendChild(root);

    return root;
}
