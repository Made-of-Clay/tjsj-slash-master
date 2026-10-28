/*
 * Doc-structure checks.
 *
 *   bun scripts/verify-docs.ts
 *
 * The plan is only cheap if it stays tiered: PLAN.md an index, one step doc per
 * task, state separate, decisions citable by ID. These assertions keep the
 * structure from silently turning back into prose. Budgets are lines + words;
 * raise one only with a reason, never to fit a paste.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';

let failures = 0;
let total = 0;
function check(name: string, condition: boolean, detail = ''): void {
    total += 1;
    if (condition) {
        console.log(`  ok    ${name}`);
    } else {
        failures += 1;
        console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
    }
}

type Budget = { file: string; lines: number; words: number };

const BUDGETS: Budget[] = [
    { file: 'PLAN.md', lines: 80, words: 650 },
    { file: 'AGENTS.md', lines: 90, words: 550 },
    { file: 'STATE.md', lines: 30, words: 200 },
    { file: 'docs/DECISIONS.md', lines: 160, words: 1500 },
    { file: 'docs/TUNABLES.md', lines: 140, words: 1100 },
];

const HEADER_FIELDS = [
    '**Scope**',
    '**Contracts**',
    '**Files**',
    '**Acceptance**',
    '**Not doing**',
    '**Decisions**',
];

function read(path: string): string {
    return readFileSync(path, 'utf8');
}

function exists(path: string): boolean {
    try {
        statSync(path);
        return true;
    } catch {
        return false;
    }
}

const words = (text: string): number => text.split(/\s+/).filter(Boolean).length;

// ===== budgets =====
console.log('Budgets');
for (const budget of BUDGETS) {
    const text = read(budget.file);
    const lines = text.split('\n').length;
    const count = words(text);
    check(
        `${budget.file} within budget`,
        lines <= budget.lines && count <= budget.words,
        `${lines}/${budget.lines} lines, ${count}/${budget.words} words (~${Math.round(count * 1.33)} tokens)`,
    );
}

// ===== index + links =====
console.log('\nIndex');
const plan = read('PLAN.md');
const linked = [...plan.matchAll(/\]\(([^)#]+)(?:#[^)]*)?\)/g)].map((m) => m[1]);
check('PLAN.md has a router', plan.includes('## Router'));
check('PLAN.md has a reading-by-task-class table', plan.includes('## Reading by task class'));
for (const link of linked) {
    check(`link resolves: ${link}`, exists(link));
}

const stepDocs = readdirSync('docs')
    .filter((name) => /^PLAN-STEP-\d+.*\.md$/.test(name))
    .sort((a, b) => Number(a.split('-')[2]) - Number(b.split('-')[2]));
check('twelve step docs exist', stepDocs.length === 12, `${stepDocs.length} found`);
for (const doc of stepDocs) {
    check(`router covers docs/${doc}`, plan.includes(`docs/${doc}`));
}

// ===== step-doc headers =====
console.log('\nStep headers');
for (const doc of stepDocs) {
    const path = `docs/${doc}`;
    const head = read(path).split('\n').slice(0, 20).join('\n');
    const missing = HEADER_FIELDS.filter((field) => !head.includes(field));
    check(
        `${path} has the six-field header`,
        missing.length === 0,
        `missing ${missing.join(', ')}`,
    );
}

// ===== state =====
console.log('\nState');
const state = read('STATE.md');
check('STATE.md records an update date', /^Updated: \d{4}-\d{2}-\d{2}/m.test(state));
check('STATE.md names what is next', state.includes('**Next'));

// ===== decisions =====
console.log('\nDecisions');
const decisions = read('docs/DECISIONS.md');
for (let step = 1; step <= 12; step += 1) {
    check(`decisions cover step ${step}`, decisions.includes(`## Step ${step} `));
}
const byId = new Set([...decisions.matchAll(/^\| (\d{1,2}[A-Z]) /gm)].map((m) => m[1]));
const cited = new Set(
    [...plan.matchAll(/\b(\d{1,2}[A-Z])–(\d{1,2}[A-Z])\b/g)].flatMap((m) => [m[1], m[2]]),
);
const unknown = [...cited].filter((id) => !byId.has(id));
check('every ID range in PLAN.md exists in DECISIONS.md', unknown.length === 0, unknown.join(', '));

// ===== tunables =====
console.log('\nTunables');
const tunables = read('docs/TUNABLES.md');
const config = read('src/config.ts');
const exports = [...config.matchAll(/export const ([A-Z][A-Z0-9_]+)/g)].map((m) => m[1]);
const undocumented = exports.filter(
    (name) => !tunables.includes(name) && !name.startsWith('DEBUG'),
);
check(
    'every non-debug config export appears in TUNABLES.md',
    undocumented.length === 0,
    undocumented.join(', '),
);

if (failures > 0) {
    throw new Error(`${failures} docs check(s) failed`);
}
console.log(`\nALL PASS — ${total} checks`);
