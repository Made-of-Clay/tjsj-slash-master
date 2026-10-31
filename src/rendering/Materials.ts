import { MeshStandardMaterial, SRGBColorSpace, TextureLoader } from 'three/webgpu';
import type { Node, Texture } from 'three/webgpu';
import { color, float, mix, screenSize, screenUV, smoothstep, texture, vec2 } from 'three/tsl';
import { OBJECT_MATERIAL } from '../config';
import type { ThemeGradient } from '../content/types';

/** TSL materials use `colorNode`, not the classic `color` property. */

/** `colorSpace` must be sRGB or the art samples as linear and reads washed out. */
export async function loadBackgroundImage(url: string): Promise<Texture> {
    const image = await new TextureLoader().loadAsync(url);
    image.colorSpace = SRGBColorSpace;
    return image;
}

/**
 * Full-screen TSL background: a vertical gradient — or theme art — with a radial
 * vignette.
 *
 * Driven by `screenUV`, so it is anchored to the screen and does not move with
 * camera framing or resize. One full-screen fragment, no geometry and no
 * post-processing (step 2 decision C, 2F).
 */
export function createBackgroundNode(palette: ThemeGradient, image?: Texture): Node {
    const base = image
        ? texture(image, coverUV(imageAspect(image)))
        : mix(color(palette.top), color(palette.bottom), screenUV.y);

    // Radial distance from screen centre: 0 at centre, ~0.71 at a corner.
    const fromCentre = vec2(screenUV.x.sub(0.5), screenUV.y.sub(0.5)).length();
    const vignette = smoothstep(0.25, 0.75, fromCentre).mul(palette.vignetteStrength);

    return mix(base, color(palette.vignette), vignette);
}

/**
 * Screen UVs that cover-fill the window with an image of `aspect`: centred, and
 * cropped on whichever axis overflows. Re-derived from `screenSize` per frame,
 * so a resize needs no uniform of its own.
 *
 * `screenUV` runs top-down (y = 0 at the top), while a flipY upload puts the
 * image's bottom row at v = 0 — hence the inverted v. The crop is symmetric
 * about the centre, so the flip commutes with it.
 */
function coverUV(aspect: number): Node {
    const screenAspect = screenSize.x.div(screenSize.y);
    const imageAspect = float(aspect);
    // Screen wider than the image → the image fills the width and overflows
    // vertically, so the visible fraction is < 1 on y (and vice versa).
    const crop = vec2(screenAspect.div(imageAspect).min(1), imageAspect.div(screenAspect).min(1));
    const uv = screenUV.sub(0.5).mul(crop).add(0.5);
    return vec2(uv.x, uv.y.oneMinus());
}

function imageAspect(image: Texture): number {
    const source = image.image as { width?: number; height?: number } | null;
    return (source?.width ?? 1) / (source?.height ?? 1);
}

/** Shared per-category material: vertex-colour base, accent as emissive. */
export function createObjectMaterial(
    accent: string,
    emissiveIntensity: number,
): MeshStandardMaterial {
    return new MeshStandardMaterial({
        vertexColors: true,
        color: '#ffffff',
        emissive: accent,
        emissiveIntensity,
        roughness: OBJECT_MATERIAL.roughness,
        metalness: OBJECT_MATERIAL.metalness,
    });
}
