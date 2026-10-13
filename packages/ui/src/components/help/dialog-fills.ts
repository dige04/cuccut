/*
 * Fills used inside agentcut's dialog material (cc/ui/dialog.tsx `dialog-surface`): the dialog is already the surface,
 * so what sits on it is a thin white tint and a fine white edge, never another layer of glass. One place for the
 * values the help center and the update window share. Tailwind classes, combined with each part's Spectrum layout
 * style; the Spectrum styles leave colour to these.
 */

/** A fine edge between regions of the dialog (header, nav, footer, list rows). */
export const EDGE = 'border-white/10';
/** A fainter edge between rows of one list. */
export const ROW_EDGE = 'border-white/8';
/** A recessed region on the dialog (the help nav, a list). */
export const INSET = 'bg-white/3';
/** The darker strip under a fine line at the foot of a dialog (same recipe as cc `DialogFooter`). */
export const FOOT = 'border-white/10 bg-black/35';
/** A pressable row in a list: tints on hover and press (react-aria sets the data attributes). */
export const ROW_FILL = 'bg-transparent data-[hovered]:bg-white/5 data-[pressed]:bg-white/8';
/** A navigation row: tints on hover, holds a stronger tint while it is the current section. */
export const NAV_FILL = 'bg-transparent data-[hovered]:bg-white/5 aria-[current=page]:bg-white/10';
/** A pressable tile on the dialog (quick-start cards). */
export const TILE_FILL = 'border-white/10 bg-white/4 data-[hovered]:border-white/20 data-[hovered]:bg-white/8';
