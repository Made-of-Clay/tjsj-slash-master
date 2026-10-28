/*
 * Content/theme checks for step 7.
 *
 *   bun scripts/verify-content.ts
 *
 * Plain assertions over the theme registry, per-theme data contracts, the
 * boot-time bake, spawn-fit bounds, and the import graph that keeps gameplay
 * theme-blind. No test framework, no GPU, no DOM.
 *
 * This is the piece `vite build` cannot see: a theme that swaps art but quietly
 * changes the rules, an authored piece that drifted out of its box, or a
 * gameplay module that imported a theme.
 */

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

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { BoxGeometry, Vector3 } from 'three/webgpu';
import type { BufferGeometry } from 'three/webgpu';
import { OBJECT_MATERIAL, PLAYFIELD } from '../src/config.ts';
import type { GameObjectDefinition, ObjectModel, Theme } from '../src/content/types.ts';
import {
    DEFAULT_THEME_ID,
    getTheme,
    resolveDefaultThemeId,
    resolveThemeId,
    THEMES,
} from '../src/content/themes/index.ts';
import type { ThemeId } from '../src/content/themes/index.ts';
import { boxBoundingRadius } from '../src/game/SpawnedObject.ts';
import { bakeModel } from '../src/rendering/Model.ts';
import { renderObjectIconPixels } from '../src/ui/objectIcons.ts';

const HEX = /^#[0-9a-f]{6}$/i;
const SLUG = /^[a-z][a-zA-Z0-9]*$/;
const THEME_IDS = Object.keys(THEMES) as ThemeId[];

function rangesSane(ranges: readonly (readonly [number, number])[]): boolean {
    return ranges.every(([min, max]) => Number.isFinite(min) && Number.isFinite(max) && min <= max);
}

function themeRadius(theme: Theme): number {
    return Math.max(...theme.objects.map((def) => boxBoundingRadius(def.model.size)));
}

function importPaths(path: string): string[] {
    const source = readFileSync(path, 'utf8');
    return [...source.matchAll(/from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]/g)].map(
        (match) => match[1] ?? match[2],
    );
}

function sourceFiles(dir: string): string[] {
    const files: string[] = [];
    for (const entry of readdirSync(dir)) {
        const path = `${dir}${entry}`;
        if (statSync(path).isDirectory()) {
            files.push(...sourceFiles(`${path}/`));
        } else if (path.endsWith('.ts')) {
            files.push(path);
        }
    }
    return files;
}

// ===== registry =====
console.log('Registry');
{
    check(
        'registry holds the two planned themes',
        THEME_IDS.length === 2 &&
            THEME_IDS.includes('halloween') &&
            THEME_IDS.includes('christmas'),
        THEME_IDS.join(', '),
    );
    check('themes are distinct objects', THEMES.halloween !== THEMES.christmas);
    check(
        'each registry key matches its theme id',
        THEME_IDS.every((id) => THEMES[id].id === id),
    );
    check('the default id is a registry key', THEME_IDS.includes(DEFAULT_THEME_ID));
    for (const id of THEME_IDS) {
        check(`getTheme('${id}') returns the registry entry`, getTheme(id) === THEMES[id]);
    }
    check("resolveThemeId('christmas') is exact", resolveThemeId('christmas') === 'christmas');
    for (const value of [null, undefined, '', 'nope', 'Christmas']) {
        check(
            `unknown theme ${JSON.stringify(value) ?? 'undefined'} falls back to default`,
            resolveThemeId(value) === DEFAULT_THEME_ID,
        );
    }
}

// ===== theme contract =====
console.log('Theme contract');
for (const id of THEME_IDS) {
    const theme = THEMES[id];
    const tag = theme.id;
    const defs = theme.objects;

    check(
        `[${tag}] object ids are unique`,
        new Set(defs.map((def) => def.id)).size === defs.length,
    );
    check(
        `[${tag}] names are non-empty and unique`,
        defs.every((def) => def.name.trim().length > 0) &&
            new Set(defs.map((def) => def.name)).size === defs.length,
    );
    check(
        `[${tag}] has at least one target and one restricted`,
        defs.some((def) => def.category === 'target') &&
            defs.some((def) => def.category === 'restricted'),
    );
    check(
        `[${tag}] target scores are positive`,
        defs.filter((def) => def.category === 'target').every((def) => def.score > 0),
    );
    check(
        `[${tag}] restricted scores are negative`,
        defs.filter((def) => def.category === 'restricted').every((def) => def.score < 0),
    );
    check(
        `[${tag}] has a hazard`,
        defs.some((def) => def.category === 'hazard'),
    );
    check(
        `[${tag}] hazard scores are negative`,
        defs.filter((def) => def.category === 'hazard').every((def) => def.score < 0),
    );
    check(
        `[${tag}] declared weights are positive`,
        defs.every((def) => (def.weight ?? 1) > 0),
    );
    check(
        `[${tag}] hazards are rarer than the default weight`,
        defs.filter((def) => def.category === 'hazard').every((def) => (def.weight ?? 1) < 1),
    );
    check(
        `[${tag}] model sizes are positive`,
        defs.every((def) => def.model.size > 0),
    );
    check(
        `[${tag}] authored pieces are at most two, with positive size`,
        defs.every(
            (def) =>
                (def.pieces?.length ?? 0) <= 2 &&
                (def.pieces ?? []).every((piece) => piece.size > 0),
        ),
    );
    check(
        `[${tag}] background colours are hex`,
        [theme.background.top, theme.background.bottom, theme.background.vignette].every((value) =>
            HEX.test(value),
        ),
    );
    check(
        `[${tag}] lighting colours are hex`,
        Object.values(theme.lighting).every((value) => HEX.test(value)),
    );
    check(
        `[${tag}] accent colours are hex`,
        Object.values(theme.accents).every((value) => HEX.test(value)),
    );

    const rules = theme.spawnRules;
    check(
        `[${tag}] intervalRange is positive and ordered`,
        rangesSane([rules.intervalRange.early, rules.intervalRange.late]) &&
            rules.intervalRange.early[0] > 0 &&
            rules.intervalRange.late[0] > 0,
    );
    check(
        `[${tag}] batchRange is ordered with batches of at least one`,
        rangesSane([rules.batchRange.early, rules.batchRange.late]) &&
            rules.batchRange.early[0] >= 1 &&
            rules.batchRange.late[0] >= 1,
    );
    check(
        `[${tag}] speedRange and apexRange are positive and ordered`,
        rangesSane([rules.speedRange, rules.apexRange]) &&
            rules.speedRange[0] > 0 &&
            rules.apexRange[0] > 0,
    );
    check(
        `[${tag}] depthRange is pinned to the play plane`,
        rules.depthRange[0] === 0 && rules.depthRange[1] === 0,
    );
    check(`[${tag}] spinRange is finite and ordered`, rangesSane([rules.spinRange]));
    check(
        `[${tag}] sideLaunchChance is a probability`,
        Number.isFinite(rules.sideLaunchChance) &&
            rules.sideLaunchChance >= 0 &&
            rules.sideLaunchChance <= 1,
    );
}

// ===== bake =====
console.log('Bake');
const allDefs: Array<{ themeId: ThemeId; def: GameObjectDefinition }> = THEME_IDS.flatMap(
    (themeId) => THEMES[themeId].objects.map((def) => ({ themeId, def })),
);

function bake(model: ObjectModel): BufferGeometry | undefined {
    try {
        return bakeModel(model);
    } catch {
        return undefined;
    }
}

for (const { themeId, def } of allDefs) {
    const tag = `${themeId}/${def.id}`;
    const geometry = bake(def.model);
    check(`[${tag}] bakes`, geometry !== undefined);
    if (!geometry) continue;

    check(
        `[${tag}] has position, normal and colour`,
        ['position', 'normal', 'color'].every((name) => geometry.getAttribute(name) !== undefined),
    );
    check(
        `[${tag}] drops uv, uv1 and tangent`,
        ['uv', 'uv1', 'tangent'].every((name) => geometry.getAttribute(name) === undefined),
    );
    check(
        `[${tag}] colour count matches the vertex count`,
        geometry.getAttribute('color').count === geometry.getAttribute('position').count,
    );
    check(
        `[${tag}] indices are whole triangles`,
        geometry.index === null || geometry.index.count % 3 === 0,
    );

    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    const half = def.model.size / 2 + 1e-3;
    check(
        `[${tag}] baked box fits def size`,
        box.min.x >= -half &&
            box.min.y >= -half &&
            box.min.z >= -half &&
            box.max.x <= half &&
            box.max.y <= half &&
            box.max.z <= half,
        `size=${def.model.size} min=${box.min.toArray()} max=${box.max.toArray()}`,
    );

    const center = box.getCenter(new Vector3());
    check(
        `[${tag}] baked box is centred on the origin`,
        Math.abs(center.x) <= 0.05 && Math.abs(center.y) <= 0.05 && Math.abs(center.z) <= 0.05,
        `centre=${center.toArray().map((value) => value.toFixed(3))}`,
    );

    const icon = renderObjectIconPixels(def.model, 32);
    let opaque = 0;
    for (let offset = 3; offset < icon.length; offset += 4) {
        if (icon[offset] !== 0) opaque += 1;
    }
    check(`[${tag}] legend icon renders visible pixels`, opaque > 20, `${opaque} px`);
}

for (const { themeId, def } of allDefs) {
    for (const [index, piece] of (def.pieces ?? []).entries()) {
        const tag = `${themeId}/${def.id} piece ${index}`;
        const geometry = bake(piece);
        check(`[${tag}] bakes`, geometry !== undefined);
        if (!geometry) continue;

        geometry.computeBoundingBox();
        const box = geometry.boundingBox!;
        const half = piece.size / 2 + 1e-3;
        check(
            `[${tag}] fits its own size`,
            box.min.x >= -half &&
                box.min.y >= -half &&
                box.min.z >= -half &&
                box.max.x <= half &&
                box.max.y <= half &&
                box.max.z <= half,
            `size=${piece.size} min=${box.min.toArray()} max=${box.max.toArray()}`,
        );
        check(
            `[${tag}] radius derives from its own size`,
            Number.isFinite(boxBoundingRadius(piece.size)) && boxBoundingRadius(piece.size) > 0,
        );
    }
}

{
    let assetMessage = '';
    try {
        bakeModel({ kind: 'asset', url: '/missing.glb', size: 1 });
    } catch (error) {
        assetMessage = (error as Error).message;
    }
    check(
        'asset models throw at the documented loader seam',
        assetMessage.includes('loader seam'),
        assetMessage,
    );

    const template = new BoxGeometry(1, 1, 1);
    const shifted = bakeModel({
        kind: 'parts',
        size: 4,
        parts: [{ geometry: template, color: '#ffffff', position: [1, 0, 0] }],
    });
    shifted.computeBoundingBox();
    template.computeBoundingBox();
    check(
        'bake applies transforms to a clone',
        Math.abs(shifted.boundingBox!.min.x - 0.5) < 1e-6,
        `min.x=${shifted.boundingBox!.min.x}`,
    );
    check(
        'bake leaves the content template untouched',
        Math.abs(template.boundingBox!.min.x + 0.5) < 1e-6 &&
            template.getAttribute('color') === undefined,
    );
}

// ===== spawn fit =====
console.log('Spawn fit');
for (const id of THEME_IDS) {
    const radius = themeRadius(THEMES[id]);
    check(
        `[${id}] every object radius fits sideMargin`,
        radius <= PLAYFIELD.sideMargin,
        `radius=${radius.toFixed(3)} margin=${PLAYFIELD.sideMargin}`,
    );
}
check(
    'every object id is a slug',
    allDefs.every(({ def }) => SLUG.test(def.id)),
    allDefs
        .map(({ def }) => def.id)
        .filter((id) => !SLUG.test(id))
        .join(', '),
);
check(
    'model sizes sit in a sane band',
    allDefs.every(({ def }) => def.model.size >= 0.8 && def.model.size <= 1.2),
);

// ===== gameplay isolation =====
console.log('Gameplay isolation');
const SRC_DIR = decodeURIComponent(new URL('../src/', import.meta.url).pathname);
const sourceFilesList = sourceFiles(SRC_DIR);
const relativePath = (path: string): string => path.slice(SRC_DIR.length);

{
    const gameplay = sourceFilesList.filter((path) => relativePath(path).startsWith('game/'));
    check('gameplay source files are scanned', gameplay.length > 0, `${gameplay.length} files`);
    const leaks = gameplay.filter((path) =>
        importPaths(path).some((specifier) => /content\/(themes|models)/.test(specifier)),
    );
    check(
        'gameplay never imports themes or models',
        leaks.length === 0,
        leaks.map(relativePath).join(', '),
    );

    const themeImporters = sourceFilesList.filter((path) => {
        const name = relativePath(path);
        return (
            !name.startsWith('content/themes/') &&
            name !== 'main.ts' &&
            importPaths(path).some((specifier) => specifier.includes('content/themes'))
        );
    });
    check(
        'only main.ts imports the theme registry',
        themeImporters.length === 0,
        themeImporters.map(relativePath).join(', '),
    );

    const rendering = sourceFilesList.filter((path) => relativePath(path).startsWith('rendering/'));
    const concrete = rendering.filter((path) =>
        importPaths(path).some((specifier) => /content\/(themes|models)/.test(specifier)),
    );
    check(
        'rendering imports no concrete theme or model',
        concrete.length === 0,
        concrete.map(relativePath).join(', '),
    );

    const content = sourceFilesList.filter((path) =>
        /content\/(themes|models)\//.test(relativePath(path)),
    );
    const upward = content.filter((path) =>
        importPaths(path).some((specifier) => /(game|rendering)\//.test(specifier)),
    );
    check(
        'content themes and models stay data-only',
        upward.length === 0,
        upward.map(relativePath).join(', '),
    );
}

// ===== config =====
console.log('Config');
check(
    'OBJECT_MATERIAL roughness and metalness are in [0, 1]',
    OBJECT_MATERIAL.roughness >= 0 &&
        OBJECT_MATERIAL.roughness <= 1 &&
        OBJECT_MATERIAL.metalness >= 0 &&
        OBJECT_MATERIAL.metalness <= 1,
);
check(
    'restricted emissive reads stronger than target',
    OBJECT_MATERIAL.restrictedEmissive > OBJECT_MATERIAL.targetEmissive,
);

// ===== step 10: built default + boot-only override =====
console.log('Selection');
{
    check('DEFAULT_THEME_ID is a registry key', Object.hasOwn(THEMES, DEFAULT_THEME_ID));

    check(
        "resolveThemeId('christmas') wins over default",
        resolveThemeId('christmas') === 'christmas',
    );
    check("resolveThemeId('halloween') is exact", resolveThemeId('halloween') === 'halloween');

    for (const value of [null, undefined, '', 'nope', 'Christmas']) {
        check(
            `unknown ${JSON.stringify(value) ?? 'undefined'} falls back to DEFAULT_THEME_ID`,
            resolveThemeId(value) === DEFAULT_THEME_ID,
        );
    }

    check(
        'resolveDefaultThemeId honours the injected build value',
        resolveDefaultThemeId('christmas') === 'christmas' &&
            resolveDefaultThemeId('halloween') === 'halloween' &&
            resolveDefaultThemeId('nope') === 'halloween' &&
            resolveDefaultThemeId(undefined) === 'halloween',
    );

    check(
        'both themes reachable from one build',
        Object.keys(THEMES).includes('halloween') && Object.keys(THEMES).includes('christmas'),
    );
}

if (failures > 0) {
    throw new Error(`${failures} content check(s) failed`);
}
console.log(`ALL PASS — ${total} checks`);
