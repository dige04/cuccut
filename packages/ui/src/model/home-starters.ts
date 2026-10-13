import { HOME_STARTER_COPY } from '../copy.ts';
import { fillSlot, filledSlot, slotLabels } from './prompt-slots.ts';

/**
 * The quick-start cards on the Home start page (product design §3.2.1; prototype model-newproject.js `homeStarters`): a few common things to do with an existing video or audio.
 * Clicking one only puts a prompt sentence into the input box; it does not send or expand a form. Once that sentence is in the input box it is the user's own words and can be edited; material is still added via “+” or drag and drop,
 * and a video link can also be pasted (a page address the download tool can fetch).
 *
 * “Transcribe and translate” has no default target language: if one was entered last time it is reused (state/home-memory-store.ts); if not, an unfilled slot is left (template pack spec §5.5),
 * and it can still be sent without filling it in: the Agent receives `[目标语言]` (target language) and asks first.
 */

export type StarterKey = 'sub' | 'trans' | 'clean' | 'a2v';
/** Color hue of the card illustration (the hue in prototype model-newproject.js `GOALS`). */
export type StarterTone = 'blue' | 'green' | 'orange' | 'magenta';

export interface HomeStarter {
  key: StarterKey;
  tone: StarterTone;
  title: string;
  prompt: string;
  /** Hover description: what still needs to be done after filling it in. */
  tip: string;
}

/** Order of this row (same order as the prototype). */
export const STARTER_KEYS: readonly StarterKey[] = ['sub', 'trans', 'clean', 'a2v'];
const STARTER_TONE: Record<StarterKey, StarterTone> = { sub: 'blue', trans: 'green', clean: 'orange', a2v: 'magenta' };

/** `target`: the target language entered last time for “the user's own words”; when there is none, the sentence keeps an unfilled slot. */
export function homeStarters(target: string | null = null): HomeStarter[] {
  return STARTER_KEYS.map((key) => starterOf(key, target));
}

export function starterOf(key: StarterKey, target: string | null = null): HomeStarter {
  const copy = HOME_STARTER_COPY[key];
  const slot = slotLabels(copy.prompt)[0];
  const prompt = slot && target?.trim() ? fillSlot(copy.prompt, slot, target.trim()) : copy.prompt;
  return { key, tone: STARTER_TONE[key], title: copy.title, prompt, tip: HOME_STARTER_COPY.tip(copy.needs, copy.link) };
}

/** The target language for “转录并翻译” as filled in the sent sentence (remembered for next time); null when the sentence is not that one, has been edited beyond recognition, or was not filled in. */
export function starterTarget(text: string): string | null {
  const template = HOME_STARTER_COPY.trans.prompt;
  const slot = slotLabels(template)[0];
  return slot ? filledSlot(template, slot, text) : null;
}
