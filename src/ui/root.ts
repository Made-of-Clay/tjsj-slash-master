/**
 * Overlay mount point for the HUD.
 *
 * Step 1 creates the layer and nothing else: score, combo and timer are step
 * 6. Pads with the safe-area vars so step 6's widgets are not written twice.
 */
export function createUiRoot(): HTMLDivElement {
    const root = document.createElement('div');
    root.className = 'ui-root';
    document.body.appendChild(root);

    return root;
}
