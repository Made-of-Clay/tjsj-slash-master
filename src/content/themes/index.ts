import type { Theme } from '../types';
import { christmas } from './christmas';
import { halloween } from './halloween';

export type ThemeId = 'halloween' | 'christmas';

export const DEFAULT_THEME_ID: ThemeId = 'halloween';

export const THEMES: Record<ThemeId, Theme> = { halloween, christmas };

export function getTheme(id: ThemeId): Theme {
    return THEMES[id];
}

/** Step 10's `setTheme` rebuilds against this registry; boot resolves once. */
export function resolveThemeId(value: string | null | undefined): ThemeId {
    return value !== null && value !== undefined && Object.hasOwn(THEMES, value)
        ? (value as ThemeId)
        : DEFAULT_THEME_ID;
}
