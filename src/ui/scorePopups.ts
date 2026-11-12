import { SCORE_POPUP } from '../config';
import { formatPoints } from './format';

/**
 * Cut score popups (step 14): a fixed ring of DOM labels on their own layer.
 * Every spawn starts one transform/opacity animation, so the steady frame does
 * no work and the scene gains no draw. Presentation only — `Score` stays the
 * authority and combo bonuses keep their single home in the HUD bar.
 */
export interface ScorePopupOptions {
    /** Fade only, no upward travel (prefers-reduced-motion). */
    readonly reducedMotion?: boolean;
}

export interface ScorePopups {
    /** Show `points` at the given viewport pixel position. */
    spawn(points: number, screenX: number, screenY: number): void;
    /** Cancel every live label (round restart). */
    clear(): void;
}

interface Slot {
    readonly element: HTMLDivElement;
    animation?: Animation;
}

export function createScorePopups(root: HTMLElement, options: ScorePopupOptions = {}): ScorePopups {
    const layer = document.createElement('div');
    layer.className = 'score-popup-layer';
    layer.setAttribute('aria-hidden', 'true');
    layer.style.setProperty('--score-popup-positive', SCORE_POPUP.positiveColor);
    layer.style.setProperty('--score-popup-negative', SCORE_POPUP.negativeColor);
    // First child: the HUD bar and the cards must paint above the labels.
    root.prepend(layer);

    const slots: Slot[] = [];
    for (let index = 0; index < SCORE_POPUP.capacity; index += 1) {
        const element = document.createElement('div');
        element.className = 'score-popup';
        element.hidden = true;
        layer.append(element);
        slots.push({ element });
    }

    const duration = SCORE_POPUP.duration * 1000;
    const lift = options.reducedMotion ? 0 : SCORE_POPUP.rise;
    const base = 'translate(-50%, -50%)';
    let next = 0;

    function spawn(points: number, screenX: number, screenY: number): void {
        if (points === 0) return;

        const slot = slots[next];
        next = (next + 1) % slots.length;

        // A recycled slot drops its old animation before taking new text.
        slot.animation?.cancel();
        slot.animation = undefined;

        const element = slot.element;
        element.textContent = formatPoints(points);
        element.classList.toggle('score-popup-negative', points < 0);
        // Keep the label on screen: an edge cut would otherwise clip it.
        element.style.left = `${Math.min(Math.max(screenX, SCORE_POPUP.margin), window.innerWidth - SCORE_POPUP.margin)}px`;
        element.style.top = `${Math.min(Math.max(screenY, SCORE_POPUP.margin), window.innerHeight - SCORE_POPUP.margin)}px`;
        element.hidden = false;

        const animation = element.animate(
            [
                { opacity: 1, transform: `${base} translateY(0px)` },
                { opacity: 0, transform: `${base} translateY(${-lift}px)` },
            ],
            { duration, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'forwards' },
        );
        animation.onfinish = () => {
            // A later spawn may already own the slot.
            if (slot.animation !== animation) return;

            slot.animation = undefined;
            element.hidden = true;
            // Drop the fill-forward effect: the slot outlives this cut.
            animation.cancel();
        };
        slot.animation = animation;
    }

    function clear(): void {
        for (let index = 0; index < slots.length; index += 1) {
            const slot = slots[index];
            slot.animation?.cancel();
            slot.animation = undefined;
            slot.element.hidden = true;
        }
        next = 0;
    }

    return { spawn, clear };
}
