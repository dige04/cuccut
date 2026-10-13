import { defineCatalog } from '../../message-ref.ts';
import { languageName } from './language-name.ts';
import { zhHans } from './edit-label.zh-Hans.ts';
import { zhHant } from './edit-label.zh-Hant.ts';
import { ja } from './edit-label.ja.ts';
import { ko } from './edit-label.ko.ts';
import { es } from './edit-label.es.ts';
import { fr } from './edit-label.fr.ts';
import { de } from './edit-label.de.ts';
import { nl } from './edit-label.nl.ts';
import { ptBR } from './edit-label.pt-BR.ts';
import { it } from './edit-label.it.ts';
import { ru } from './edit-label.ru.ts';
import { pl } from './edit-label.pl.ts';
import { tr } from './edit-label.tr.ts';
import { vi } from './edit-label.vi.ts';

const noun: Record<string, string> = { video: 'video', image: 'image', audio: 'audio' };

/**
 * The change name given when the editor submits an edit transaction (`label` and `labelRef` of `edits.apply`; command and protocol spec §3.1): history, undo hints, change cards
 * and what the Agent reads are all regenerated in the reader's language. Content such as asset names and element names is passed as is, as string parameters; the `language` parameter is a language tag, and the language name is shown in the reader's
 * language. Keys are never renamed or reused once published.
 */
const en = {
  // Timeline: clips and tracks
  addClip: 'Add clip',
  addSoundtrack: 'Add soundtrack',
  importAndAdd: 'Import and add assets',
  moveClips: 'Move clips',
  moveTrack: 'Move track',
  hideTrack: 'Hide track',
  showTrack: 'Show track',
  muteTrack: 'Mute track',
  unmuteTrack: 'Unmute',
  lockTrack: 'Lock track',
  unlockTrack: 'Unlock track',
  cutClips: 'Cut clips',
  pasteClips: 'Paste clips',
  duplicateClips: 'Duplicate clips',
  deleteClips: 'Delete clips',
  splitClip: 'Split clip',
  nudgeClip: 'Nudge clip timing',
  disableClip: 'Disable clip',
  enableClip: 'Enable clip',
  removeSpan: 'Delete span from all tracks',
  detachAudio: 'Detach audio',
  changeStacking: 'Change stacking order',
  // Assets
  replaceAsset: (p: { kind: string }) => `Replace ${noun[p.kind] ?? p.kind}`,
  collectAsset: 'Collect into video folder',
  importAssets: 'Import assets',
  setBackground: 'Set background',
  addWaveform: 'Add waveform',
  relinkAsset: (p: { name: string }) => `Relink “${p.name}”`,
  addNamed: (p: { name: string }) => `Add ${p.name}`,
  // Picture
  alignClips: 'Align clips',
  distributeClips: 'Distribute clips',
  fillCanvas: 'Fill canvas',
  fitCanvas: 'Fit canvas',
  flip: 'Flip',
  move: 'Move',
  resize: 'Resize',
  scale: 'Scale',
  rotate: 'Rotate',
  reframe: 'Reframe',
  groupMove: 'Move together',
  groupScale: 'Scale together',
  resetRotation: 'Reset rotation',
  editText: 'Edit text',
  nudgePosition: 'Nudge position',
  applyFramingToAll: 'Apply to whole short',
  aspectRatio: (p: { ratio: string }) => `Aspect ratio ${p.ratio}`,
  /** `ratio` of `aspectRatio`: the original aspect ratio. */
  originalRatio: 'Original',
  renameVideo: 'Rename video',
  // Captions
  applySubtitleStyle: 'Apply subtitle style',
  editSubtitleStyle: 'Edit subtitle style',
  importSubtitles: 'Import subtitles',
  generateSubtitles: 'Generate subtitles',
  rewriteSubtitle: 'Edit subtitle',
  splitSubtitle: 'Split subtitle',
  mergeSubtitles: 'Merge subtitles',
  replaceSubtitleText: 'Replace subtitle text',
  dropSubtitle: 'Remove subtitles from the canvas',
  landSubtitle: 'Put subtitles back on the canvas',
  flipSubtitle: 'Swap subtitle order',
  /** `language` is the target language's own name (readers in each language see the same thing); when there is no target language, pass `unnamedTranslation`. */
  translateTo: (p: { language: string }) => `Translate to ${p.language}`,
  unnamedTranslation: 'Translation',
  editTranslation: 'Edit translation',
  markTranslationStale: 'Mark translation out of date',
  clearTranslationStale: 'Clear out-of-date mark',
  // Transcript and chapters
  cutText: 'Cut in transcript',
  restoreText: 'Restore cut content',
  editTranscript: 'Edit text',
  replaceText: 'Replace transcript text',
  moveText: 'Move paragraph to neighboring chapter',
  cutChapter: 'Cut chapter',
  retimeCut: 'Change cut range',
  addChapter: 'Add chapter',
  renameChapter: 'Rename chapter',
  removeChapter: 'Delete chapter',
  moveChapter: 'Move chapter start',
  // Dubbing
  editDubText: 'Edit translation (revoice)',
  switchDubTake: (p: { take: number }) => `Switch to voice-over take ${p.take}`,
  hearDub: 'Hear voice-over',
  hearOriginal: 'Hear original',
  hearBoth: 'Hear both',
  /** `language` is a language tag. */
  undoDub: (p: { language: string }) => `Undo voice-over (${languageName('en', p.language)})`,
  muteDub: 'Mute voice-over',
  unmuteDub: 'Unmute voice-over',
  removeDub: 'Delete voice-over',
  /** `language` is a language tag; empty when the dub group did not record a language. */
  removeDubGroup: (p: { language: string }) => `Remove voice-over (${languageName('en', p.language)})`,
  removeThisDubGroup: 'Remove this voice-over group',
  stretchDub: 'Change voice-over speed',
};

export type EditLabelMessages = typeof en;

export const EditLabel = defineCatalog('editLabel', en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
