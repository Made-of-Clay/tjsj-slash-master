/// <reference types="vite/client" />
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { getTheme, resolveDefaultThemeId } from './src/content/themes/index.ts';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const themeColor = getTheme(resolveDefaultThemeId(env.VITE_DEFAULT_THEME)).background.top;

    return {
        build: {
            target: 'esnext',
            rollupOptions: {
                output: {
                    manualChunks(id) {
                        if (id.includes('node_modules')) {
                            return 'vendor';
                        }
                        return undefined;
                    },
                },
            },
            chunkSizeWarningLimit: 1000,
        },
        plugins: [
            VitePWA({
                // Takes over the page as soon as a new build is ready.
                registerType: 'autoUpdate',
                // We register from src/main.ts instead, so it stays type-checked.
                injectRegister: null,
                includeAssets: ['favicon.svg'],
                manifest: {
                    name: 'Slash Master',
                    short_name: 'Slash Master',
                    description: 'Fruit Ninja-style 3D slicing game.',
                    theme_color: themeColor,
                    background_color: '#050e11',
                    display: 'standalone',
                    display_override: ['fullscreen', 'standalone', 'minimal-ui'],
                    orientation: 'landscape',
                    start_url: '/',
                    scope: '/',
                    icons: [
                        {
                            src: '/icons/icon-192.png',
                            sizes: '192x192',
                            type: 'image/png',
                            purpose: 'any',
                        },
                        {
                            src: '/icons/icon-512.png',
                            sizes: '512x512',
                            type: 'image/png',
                            purpose: 'any',
                        },
                        {
                            src: '/icons/maskable-192.png',
                            sizes: '192x192',
                            type: 'image/png',
                            purpose: 'maskable',
                        },
                        {
                            src: '/icons/maskable-512.png',
                            sizes: '512x512',
                            type: 'image/png',
                            purpose: 'maskable',
                        },
                    ],
                },
                workbox: {
                    globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
                    navigateFallback: 'index.html',
                    cleanupOutdatedCaches: true,
                },
                // Phone testing runs against `vite preview` (a real build), so the
                // dev server stays SW-free and avoids stale-cache confusion.
                devOptions: {
                    enabled: false,
                },
            }),
        ],
    };
});
