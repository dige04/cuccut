/**
 * Family names of the fonts shipped with the render kernel (`BUNDLED_FONT_FILES` in `crates/frame-render`; the files are in `crates/render-raster/assets/fonts`).
 * When typesetting, these families always use the kernel's own copy (never a locally installed or downloaded one), so the font picker marks them “bundled with the kernel” and does not download them.
 * The test that checks these family names against the files is in `bundled-fonts.test.ts`.
 */
export const BUNDLED_FONT_FAMILIES: readonly string[] = [
  'Alata',
  'Anton',
  'Archivo Black',
  'Arimo',
  'Bangers',
  'Bebas Neue',
  'Carter One',
  'Dancing Script',
  'Fredoka One',
  'Inter',
  'Lexend Deca',
  'Montserrat',
  'Noto Sans SC',
  'Oswald',
  'Paytone One',
  'Permanent Marker',
  'Playfair Display',
  'Poppins',
  'Poppins Black',
  'Press Start 2P',
  'Roboto Mono',
  'Rubik',
  'Shrikhand',
  'Source Serif 4',
  'Squada One',
  'VK Code',
  'VK Sans',
];

/**
 * The render kernel's fallback family (`frame_render::FALLBACK_FAMILY`): a family that was named but could not be obtained anywhere (not downloaded, download failed, or auto-download off) is drawn with this font.
 * `fonts.usage` uses the value reported by the Render Worker; this is the same value used when the Worker has not run (empty sequence).
 */
export const FALLBACK_FONT_FAMILY = 'Noto Sans SC';

const BUNDLED = new Set(BUNDLED_FONT_FAMILIES.map((family) => family.toLowerCase()));

export function isBundledFamily(family: string): boolean {
  return BUNDLED.has(family.trim().toLowerCase());
}
