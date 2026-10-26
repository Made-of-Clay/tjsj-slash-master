/**
 * Step 6 HUD (Decision E): score + timer on the ui-root overlay, plus the
 * game-over card. Takes primitives only — no gameplay imports; `main.ts`
 * wiring feeds it. `sync` writes DOM only when a displayed value changes, so
 * the steady frame does zero DOM work.
 */
export interface Hud {
    /** Push the latest score / seconds-left / cuts this stroke; no-ops when unchanged. */
    sync(score: number, secondsLeft: number, combo: number): void;
    /** Reveal the card with the final score and the stored best. Latches until restart. */
    showGameOver(finalScore: number, best: number, isBest: boolean): void;
    /** Restart fires only from the card; the handler re-arms the round. */
    onRestart(handler: () => void): void;
    /** Mute toggle: fires on tap; the caller persists and re-applies state. */
    onMute(handler: () => void): void;
    /** Reflect the persisted mute state on the control. */
    setMuted(muted: boolean): void;
}

// Combo linger (step 9 feedback): the last count stays legible after the stroke
// ends, then fades — otherwise a good swipe reads as a flicker.
const COMBO_HOLD_MS = 700;
const COMBO_FADE_MS = 300;

export function createHud(root: HTMLElement): Hud {
    // Flow layout (not absolute) so the root's safe-area padding applies.
    const bar = document.createElement('div');
    bar.className = 'hud-bar';
    const scoreEl = document.createElement('div');
    scoreEl.className = 'hud-score';
    const timerEl = document.createElement('div');
    timerEl.className = 'hud-timer';
    bar.append(scoreEl, timerEl);
    root.append(bar);

    // Combo line: hidden until a stroke has at least two cuts (step 9B).
    const comboEl = document.createElement('div');
    comboEl.className = 'hud-combo';
    comboEl.hidden = true;
    root.append(comboEl);

    // Appended before the card so the game-over overlay covers it.
    const mute = document.createElement('button');
    mute.className = 'hud-mute';
    mute.type = 'button';
    root.append(mute);

    // Fixed overlay, so it covers the root's padding and centers regardless.
    const overlay = document.createElement('div');
    overlay.className = 'game-over';
    overlay.hidden = true;
    // A real button: whole card is the tap target, keyboard-reachable for free.
    const card = document.createElement('button');
    card.className = 'game-over-card';
    card.type = 'button';
    const title = document.createElement('span');
    title.className = 'game-over-title';
    title.textContent = "Time's up";
    const final = document.createElement('span');
    final.className = 'game-over-score';
    const bestEl = document.createElement('span');
    bestEl.className = 'game-over-best';
    const prompt = document.createElement('span');
    prompt.className = 'game-over-restart';
    prompt.textContent = 'Tap to restart';
    card.append(title, final, bestEl, prompt);
    overlay.append(card);
    root.append(overlay);

    // NaN primes the first sync to write both widgets.
    let shownScore = Number.NaN;
    let shownSeconds = Number.NaN;
    let shownCombo = -1;
    let holdTimer = 0;
    let fadeTimer = 0;
    let over = false;

    function sync(score: number, secondsLeft: number, combo: number): void {
        if (score !== shownScore) {
            shownScore = score;
            scoreEl.textContent = `Score: ${score}`;
        }
        if (secondsLeft !== shownSeconds) {
            shownSeconds = secondsLeft;
            timerEl.textContent = `Time: ${secondsLeft}`;
        }
        if (combo !== shownCombo) {
            shownCombo = combo;

            if (combo >= 2) {
                // A fresh combo cancels any pending fade, mid-fade included.
                clearTimeout(holdTimer);
                clearTimeout(fadeTimer);
                comboEl.hidden = false;
                comboEl.classList.remove('hud-combo-fade');
                comboEl.textContent = `Combo ×${combo}`;
            } else if (!comboEl.hidden) {
                clearTimeout(holdTimer);
                clearTimeout(fadeTimer);
                holdTimer = window.setTimeout(() => {
                    comboEl.classList.add('hud-combo-fade');
                    fadeTimer = window.setTimeout(() => {
                        comboEl.hidden = true;
                        comboEl.classList.remove('hud-combo-fade');
                        comboEl.textContent = '';
                    }, COMBO_FADE_MS);
                }, COMBO_HOLD_MS);
            }
        }
    }

    function showGameOver(finalScore: number, best: number, isBest: boolean): void {
        if (over) return;

        over = true;
        final.textContent = `Score ${finalScore}`;
        bestEl.textContent = isBest ? `New best! ${best}` : `Best ${best}`;
        overlay.hidden = false;
    }

    function onRestart(handler: () => void): void {
        card.addEventListener('click', () => {
            if (!over) return;

            over = false;
            overlay.hidden = true;
            handler();
        });
    }

    function onMute(handler: () => void): void {
        mute.addEventListener('click', handler);
    }

    function setMuted(muted: boolean): void {
        mute.textContent = muted ? '🔇' : '🔊';
        mute.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
        mute.setAttribute('aria-pressed', muted ? 'true' : 'false');
    }

    setMuted(false);

    return { sync, showGameOver, onRestart, onMute, setMuted };
}
