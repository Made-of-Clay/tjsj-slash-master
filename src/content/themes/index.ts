import type { Theme } from '../types';
import { christmas } from './christmas';
import { halloween } from './halloween';

export type ThemeId = 'halloween' | 'christmas';

export const THEMES: Record<ThemeId, Theme> = { halloween, christmas };

function isThemeId(value: string | undefined): value is ThemeId {
    return value !== undefined && Object.hasOwn(THEMES, value);
}

export function resolveDefaultThemeId(value: string | null | undefined): ThemeId {
    return typeof value === 'string' && isThemeId(value) ? value : 'halloween';
}

export const DEFAULT_THEME_ID: ThemeId = resolveDefaultThemeId(import.meta.env?.VITE_DEFAULT_THEME);

export function getTheme(id: ThemeId): Theme {
    return THEMES[id];
}

export function resolveThemeId(value: string | null | undefined): ThemeId {
    if (typeof value === 'string' && isThemeId(value)) {
        return value;
    }
    return DEFAULT_THEME_ID;
}
