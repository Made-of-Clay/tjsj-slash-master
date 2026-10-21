/**
 * Step 6 HUD (Decision E): score + timer on the ui-root overlay, plus the
 * game-over card. Takes primitives only — no gameplay imports; `main.ts`
 * wiring feeds it. `sync` writes DOM only when a displayed value changes, so
 * the steady frame does zero DOM work.
 */
export interface Hud {
    /** Push the latest score / seconds-left; no-ops when unchanged. */
    sync(score: number, secondsLeft: number): void;
    /** Reveal the card with the final score. Latches until restart. */
    showGameOver(finalScore: number): void;
    /** Restart fires only from the card; the handler re-arms the round. */
    onRestart(handler: () => void): void;
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
    const prompt = document.createElement('span');
    prompt.className = 'game-over-restart';
    prompt.textContent = 'Tap to restart';
    card.append(title, final, prompt);
    overlay.append(card);
    root.append(overlay);

    // NaN primes the first sync to write both widgets.
    let shownScore = Number.NaN;
    let shownSeconds = Number.NaN;
    let over = false;

    function sync(score: number, secondsLeft: number): void {
        if (score !== shownScore) {
            shownScore = score;
            scoreEl.textContent = `Score: ${score}`;
        }
        if (secondsLeft !== shownSeconds) {
            shownSeconds = secondsLeft;
            timerEl.textContent = `Time: ${secondsLeft}`;
        }
    }

    function showGameOver(finalScore: number): void {
        if (over) return;

        over = true;
        final.textContent = `Score ${finalScore}`;
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

    return { sync, showGameOver, onRestart };
}
