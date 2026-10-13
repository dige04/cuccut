import { elementPresets, lazyObject, type VisualizerPreset } from '@cuccut/editor-wasm';

/**
 * Waveform visualizers (`cuccut.audio-visualizer`): 10 styles and their old names. Order, box shapes, default colors and dB window come from the built-in recipes in `motion` (through the edit-semantics WASM), and the render draws from the same source. For the `square` styles, the inscribed square within the box is used. The two styles whose `hasControl` is false (oscilloscope and ring wave) read the time-domain row, so the dB window, smoothing and gain have no effect on them. Spectrum analysis happens in the host (BCS1); derivation and drawing happen in the render kernel.
 */
export type WaveStyle = VisualizerPreset;

const presets = lazyObject(() => elementPresets());

/** Key order is the recipe's `order` (the order of the property panel's style catalog). */
export const WAVE_STYLES: Readonly<Record<string, WaveStyle>> = lazyObject(() =>
  Object.fromEntries(presets.visualizer.map((preset) => [preset.id, preset])),
);

/** Style name (including old names merged away in an older catalog, so old videos still open) → key in the catalog; null if unrecognized. */
export function waveStyleKey(name: string): string | null {
  const key = presets.visualizerAliases[name] ?? name;
  return WAVE_STYLES[key] ? key : null;
}
