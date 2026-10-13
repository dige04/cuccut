import type { CucCutStepKind } from './agent-tool-steps.ts';
import type { StepKind } from './thread.ts';

/**
 * Which images the pixel loader graphic uses while an agent is working in the session thread (the “in progress” state in product design §3.2.2; prototype model-agent-loader.js).
 * This only gives the graphic names. The view fetches the pixel cells by name from `@react-spectrum/ai/loader` and caches them by key, so the array reference stays stable (PixelLoader restarts from the first image whenever it receives a new array reference). One name loops; several names take turns, about 2.4 seconds per image.
 *
 * At most two things move in a session at once: the step that is running (a short sequence by category), and the “Working” (`THINKING`) before the turn footer. The image before a work-group heading is the first image for that step's category, and it is static; the session input box has no animation.
 */

/** All the pattern-type graphics from @react-spectrum/ai 0.4.0. The letter-based graphics and presets that contain letters render third-party wordmarks, so they are not used. */
export const ICONS = Object.freeze([
  'aiLogo',
  'brush',
  'eye',
  'hourglass',
  'mag',
  'crop',
  'flower',
  'image',
  'lasso',
  'page',
  'wand',
  'bargraph',
  'trefoil',
  'dial',
  'folder',
  'arrow',
  'cloud',
  'comment',
  'filter',
  'microphone',
  'pencil',
  'potion',
  'slider',
  'timeline',
  'eyedrop',
  'document',
  'graph',
  'cart',
  'shop',
  'journey',
  'floppy',
] as const);

export type LoaderIcon = (typeof ICONS)[number];

/** A generic sequence that uses all graphics, starting with aiLogo; adjacent graphics are kept in different categories where possible (sound, picture, text, file, and data alternate). */
export const THINKING: readonly LoaderIcon[] = Object.freeze([
  'aiLogo',
  'wand',
  'microphone',
  'timeline',
  'image',
  'comment',
  'crop',
  'document',
  'mag',
  'brush',
  'cloud',
  'slider',
  'flower',
  'page',
  'dial',
  'eye',
  'lasso',
  'potion',
  'folder',
  'eyedrop',
  'graph',
  'pencil',
  'trefoil',
  'filter',
  'journey',
  'arrow',
  'bargraph',
  'shop',
  'hourglass',
  'cart',
  'floppy',
]);

/** Unrecognized categories (and the generic “other tools”). */
export const FALLBACK: readonly LoaderIcon[] = Object.freeze(['aiLogo', 'flower', 'trefoil']);

/** Keys for loading graphics: generic step categories, CucCut tool categories (agent-tool-steps.ts), and the streaming thinking line. */
export type LoaderKind = StepKind | CucCutStepKind | 'reasoning';

const seq = (...names: LoaderIcon[]): readonly LoaderIcon[] => Object.freeze(names);

/** Category → a short sequence of 2–4 graphics. Exhaustive by type: adding a new step category makes this fail to compile, so a graphic has to be chosen for it. */
export const KINDS: Readonly<Record<LoaderKind, readonly LoaderIcon[]>> = Object.freeze({
  /* Generic categories */
  command: seq('dial', 'potion', 'trefoil'),
  read: seq('document', 'page', 'eye'),
  edit: seq('pencil', 'brush', 'document'),
  search: seq('mag', 'filter', 'eye'),
  other: FALLBACK,
  reasoning: seq('aiLogo', 'flower', 'potion'),
  /* Sound and text */
  transcribe: seq('microphone', 'comment', 'page'),
  speech: seq('microphone', 'comment'),
  translate: seq('comment', 'page', 'document'),
  captions: seq('comment', 'page', 'timeline'),
  /* Picture */
  image: seq('image', 'brush', 'wand', 'eyedrop'),
  /* Video and activity on the timeline */
  'video-list': seq('folder', 'image', 'eye'),
  'video-create': seq('image', 'wand', 'timeline'),
  'video-read': seq('eye', 'image', 'timeline'),
  'video-delete': seq('folder', 'arrow'),
  cut: seq('timeline', 'crop', 'lasso'),
  'edit-video': seq('timeline', 'slider', 'wand', 'pencil'),
  undo: seq('journey', 'arrow', 'timeline'),
  /* Documents and files */
  'document-read': seq('document', 'page', 'eye'),
  space: seq('folder', 'shop', 'cart'),
  'space-search': seq('mag', 'filter', 'folder'),
  /* In and out */
  import: seq('cloud', 'arrow', 'folder'),
  download: seq('cloud', 'arrow', 'floppy'),
  'downloads-save': seq('floppy', 'folder'),
  export: seq('floppy', 'arrow', 'journey'),
  artifact: seq('floppy', 'folder', 'cart'),
  /* Tasks, models, skills and permissions */
  job: seq('hourglass', 'bargraph', 'graph'),
  models: seq('dial', 'graph', 'potion'),
  'model-install': seq('cloud', 'arrow', 'dial'),
  skill: seq('page', 'potion', 'wand'),
  grant: seq('hourglass', 'dial'),
  contract: seq('document', 'pencil', 'page'),
  /* Slides, design drafts and design systems */
  slides: seq('page', 'eye', 'pencil'),
  design: seq('brush', 'eyedrop', 'eye'),
  'design-system': seq('eyedrop', 'slider', 'document'),
});

/** Category → sequence of graphic names; unrecognized categories fall back to FALLBACK. The same category always returns the same (frozen) array. */
export function forKind(kind: string): readonly LoaderIcon[] {
  return Object.hasOwn(KINDS, kind) ? KINDS[kind as LoaderKind] : FALLBACK;
}
