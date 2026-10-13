import { elementPresets, lazyObject, type ProgressPreset } from '@cuccut/editor-wasm';

/**
 * Progress bars (`cuccut.progress`): 14 styles. Order, box shapes, and default primary and secondary colors come from the built-in recipes in `motion` (through the edit-semantics WASM), and the render draws from the same source. For the `square` styles, the inscribed square within the box is used; `bar` and `frame` use the whole box. This is the style catalog for creation and the property panel; drawing happens in the render kernel.
 */
export type ProgressStyle = ProgressPreset;

/** Key order is the recipe's `order` (the order of the property panel's style catalog). */
export const PROGRESS_STYLES: Readonly<Record<string, ProgressStyle>> = lazyObject(() =>
  Object.fromEntries(elementPresets().progress.map((preset) => [preset.id, preset])),
);
