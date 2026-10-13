import { defineMessages } from '@cuccut/protocol';
import { zhHans } from './stage-toolbar-copy.zh-Hans.ts';
import { zhHant } from './stage-toolbar-copy.zh-Hant.ts';
import { ja } from './stage-toolbar-copy.ja.ts';
import { ko } from './stage-toolbar-copy.ko.ts';
import { es } from './stage-toolbar-copy.es.ts';
import { fr } from './stage-toolbar-copy.fr.ts';
import { de } from './stage-toolbar-copy.de.ts';
import { nl } from './stage-toolbar-copy.nl.ts';
import { ptBR } from './stage-toolbar-copy.pt-BR.ts';
import { it } from './stage-toolbar-copy.it.ts';
import { ru } from './stage-toolbar-copy.ru.ts';
import { pl } from './stage-toolbar-copy.pl.ts';
import { tr } from './stage-toolbar-copy.tr.ts';
import { vi } from './stage-toolbar-copy.vi.ts';

/** Copy for the floating canvas toolbar (English is the source of the keys and types; translations are in `stage-toolbar-copy.<language>.ts`). */
const en = {
  /** Display name of each cell; for icon buttons, the name is the hover tooltip. */
  toolLabel: {
    color: 'Color',
    font: 'Font',
    size: 'Size',
    'text-styles': 'Styles',
    animation: 'Animation',
    transitions: 'Transitions',
    volume: 'Volume',
    speed: 'Speed',
    adjust: 'Adjust',
    border: 'Stroke',
    'fill-list': 'Fill colors',
    'progress-colors': 'Color',
    'progress-picker': 'Styles',
    'wave-colors': 'Color',
    'wave-picker': 'Styles',
    'counter-mode': 'Mode',
    'volume-levels': 'Volume levels',
    properties: 'Properties',
    copy: 'Duplicate',
    arrange: 'Order',
    'save-to-brand-kit': 'Save to brand kit',
    'adjust-timing': 'Adjust timing',
    disable: 'Disable clip',
    delete: 'Delete',
    bold: 'Bold',
    italic: 'Italic',
    'align-left': 'Align left',
    'align-center': 'Center',
    'align-right': 'Align right',
    'line-height': 'Line height',
    'letter-spacing': 'Letter spacing',
    'flip-vertical': 'Flip vertical',
    'flip-horizontal': 'Flip horizontal',
    'fit-canvas': 'Fit to canvas',
    'fill-canvas': 'Fill canvas',
    opacity: 'Opacity',
    'round-corners': 'Corner radius',
    filters: 'Filters',
    effects: 'Effects',
    'crop-video': 'Smart crop',
    'replace-video': 'Replace video',
    'replace-image': 'Replace image',
    'detach-audio': 'Detach audio',
    'sub-scope': 'Line to edit',
    'sub-edit': 'Edit',
    'sub-style': 'Styles',
    'sub-animation': 'Animation',
    case: 'Case',
    'hide-subs': 'Hide subtitles',
  },
  /** Why some cells are unavailable: no matching operation in the protocol yet, the source file for the asset cannot be obtained, no brand library in the browser, etc. */
  offReason: {
    animation: "Animations can't be picked in the editor yet.",
    brand: "This clip's media can't be stored in the brand kit.",
    roundCorners: "The preview can't draw rounded corners yet, so they can't be set here.",
    filters: 'Filters (LUT) are a reserved name in the video format and are rejected on write.',
    crop: 'Smart crop needs a model and has no entry point yet. Coming soon.',
    speed: 'This clip does not play at a constant rate, so its speed cannot be changed here.',
    sound: 'This clip has no sound.',
    captionDefaultStyle: 'These subtitles still use the default style. Change any setting first, then save it to the brand kit.',
    brandText: 'The brand kit has no section for text styles yet.',
    brandWeb: 'The brand kit is only available in the desktop app and the CLI.',
  },
  /** The four rows of the “Layer” drill-down page and the name of this operation. */
  arrange: {
    front: 'Bring to front',
    forward: 'Bring forward',
    backward: 'Send backward',
    back: 'Send to back',
    label: 'Change stacking order',
  },
  /** Name of the subtitle toolbar (for screen readers). */
  subtitleBar: 'Subtitle toolbar',
  /** Notice after disabling a clip from the canvas toolbar (with undo): the clip disappears from the frame; say clearly where to re-enable it. */
  disabledNotice: 'Clip disabled. Right-click it on the timeline to enable it again.',
  /** Notice after separating audio (with undo): where the new audio is, and what happened to the video clip. */
  detachedNotice: 'Detached the sound to a new audio track. The video clip is muted.',
  textStyleLocked: (schema: string) => `This text uses the ${schema} style format and cannot be edited here yet.`,
};

export type StageToolbarMessages = typeof en;

export const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
