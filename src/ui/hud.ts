/**
 * HUD (steps 6 + 9): score, timer and combo on the ui-root overlay, the
 * start/pause/game-over cards, and the mute + pause controls. Takes primitives
 * only — no gameplay imports; `main.ts` wiring feeds it. `sync` writes DOM only
 * when a displayed value changes, so the steady frame does zero DOM work.
 */
export interface Hud {
    /** Push the latest score / seconds-left / cuts this stroke; no-ops when unchanged. */
    sync(score: number, secondsLeft: number, combo: number): void;
    /** Reveal the card with the final score and the stored best. Latches until restart. */
    showGameOver(finalScore: number, best: number, isBest: boolean): void;
    showStart(): void;
    showPaused(): void;
    /** The pause control only means something while a round runs. */
    setPlaying(playing: boolean): void;
    onStart(handler: () => void): void;
    onResume(handler: () => void): void;
    onPause(handler: () => void): void;
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

interface Overlay {
    readonly root: HTMLElement;
    readonly card: HTMLButtonElement;
    readonly note: HTMLElement;
}

function createOverlay(
    host: HTMLElement,
    className: string,
    titleText: string,
    noteText: string,
): Overlay {
    const root = document.createElement('div');
    root.className = `overlay ${className}`;
    root.hidden = true;

    // A real button: the whole card is the tap target and keyboard-reachable.
    const card = document.createElement('button');
    card.className = 'overlay-card';
    card.type = 'button';

    const title = document.createElement('span');
    title.className = 'overlay-title';
    title.textContent = titleText;

    const note = document.createElement('span');
    note.className = 'overlay-note';
    note.textContent = noteText;

    card.append(title, note);
    root.append(card);
    host.append(root);
    return { root, card, note };
}

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

    const start = createOverlay(root, 'overlay-start', 'Slash Master', 'Tap to start');
    const paused = createOverlay(root, 'overlay-pause', 'Paused', 'Tap to resume');
    const overCard = createOverlay(root, 'overlay-game-over', "Time's up", 'Tap to restart');

    const finalEl = document.createElement('span');
    finalEl.className = 'overlay-score';
    const bestEl = document.createElement('span');
    bestEl.className = 'overlay-best';
    overCard.card.insertBefore(bestEl, overCard.note);
    overCard.card.insertBefore(finalEl, bestEl);

    // Appended after the cards so both controls stay tappable on every screen.
    const mute = document.createElement('button');
    mute.className = 'hud-mute';
    mute.type = 'button';
    root.append(mute);

    const pause = document.createElement('button');
    pause.className = 'hud-pause';
    pause.type = 'button';
    pause.textContent = '❚❚';
    pause.setAttribute('aria-label', 'Pause');
    pause.hidden = true;
    root.append(pause);

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
        finalEl.textContent = `Score ${finalScore}`;
        bestEl.textContent = isBest ? `New best! ${best}` : `Best ${best}`;
        overCard.root.hidden = false;
    }

    function showStart(): void {
        start.root.hidden = false;
    }

    function showPaused(): void {
        paused.root.hidden = false;
    }

    function setPlaying(playing: boolean): void {
        pause.hidden = !playing;
    }

    function onStart(handler: () => void): void {
        start.card.addEventListener('click', () => {
            if (start.root.hidden) return;

            start.root.hidden = true;
            handler();
        });
    }

    function onResume(handler: () => void): void {
        paused.card.addEventListener('click', () => {
            if (paused.root.hidden) return;

            paused.root.hidden = true;
            handler();
        });
    }

    function onPause(handler: () => void): void {
        pause.addEventListener('click', handler);
    }

    function onRestart(handler: () => void): void {
        overCard.card.addEventListener('click', () => {
            if (!over) return;

            over = false;
            overCard.root.hidden = true;
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

    return {
        sync,
        showGameOver,
        showStart,
        showPaused,
        setPlaying,
        onStart,
        onResume,
        onPause,
        onRestart,
        onMute,
        setMuted,
    };
}
