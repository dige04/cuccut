import { defineMessages, live } from '@cuccut/protocol';
import { zhHans } from './voices-copy.zh-Hans.ts';
import { zhHant } from './voices-copy.zh-Hant.ts';
import { ja } from './voices-copy.ja.ts';
import { ko } from './voices-copy.ko.ts';
import { es } from './voices-copy.es.ts';
import { fr } from './voices-copy.fr.ts';
import { de } from './voices-copy.de.ts';
import { nl } from './voices-copy.nl.ts';
import { ptBR } from './voices-copy.pt-BR.ts';
import { it } from './voices-copy.it.ts';
import { ru } from './voices-copy.ru.ts';
import { pl } from './voices-copy.pl.ts';
import { tr } from './voices-copy.tr.ts';
import { vi } from './voices-copy.vi.ts';

/**
 * Text for Models › Speech synthesis › My voices (design mock settings-voices.jsx). The page title and intro are in `VOICES_COPY` in models-copy.ts; this file has the list, dialogs and hints. Recording and “从视频里分人取一段”(Take a segment by speaker from a video) are not connected yet; the greyed-out reasons are written as one honest sentence.
 * English is the source of keys and types; translations are in `voices-copy.<语言>.ts`.
 */
const en = {
  myVoices: {
    offline: 'Voices appear once the Runtime is connected.',
    add: 'Add voice',
    fromFile: 'New from audio file…',
    fromFileHint: 'WAV, MP3 or FLAC, up to 20 MB; one full sentence of 5–12 seconds works best',
    importPackage: 'Import voice pack…',
    importHint: 'A .bcvoice someone exported',
    record: 'Record with microphone',
    recordWhy:
      'Recording in the app isn’t available yet: a recording has to be saved as a file before it can go to the Runtime, and that step isn’t built. Record with another app first (WAV, MP3 or FLAC), then use “New from audio file”.',
    /** `recordWhy`, plus why importing a voice package is unavailable (when the window cannot open a file dialog). */
    recordWhyNoPicker:
      'Recording in the app isn’t available yet: a recording has to be saved as a file before it can go to the Runtime, and that step isn’t built. Record with another app first (WAV, MP3 or FLAC), then use “New from audio file”. Importing a voice pack: this window can’t open the system file dialog; use the desktop app.',
    noPicker: 'This window can’t open the system file dialog; use the desktop app.',
    pickAudioTitle: 'Choose a reference recording',
    pickAudioFilter: 'Audio (WAV, MP3, FLAC)',
    pickPackageTitle: 'Choose a voice pack',
    pickPackageFilter: 'Voice pack',
    pickButton: 'Choose',
    notAudio: 'Reference recordings must be WAV, MP3 or FLAC files.',
    imported: (name: string) => `Imported “${name}” · available when generating speech and voice-overs`,
    importFailed: (text: string) => `Couldn't import: ${text}`,
    foot:
      'A voice = a reference recording + what it says + a consent statement. The reference recording stays on this computer; an exported voice pack (name.bcvoice) includes the recording and can be sent to others to import, but clones don’t travel with it. ' +
      'Voices without a statement on whether they’re the speaker’s own are never uploaded to any third party.',
    // Row
    play: (name: string) => `Preview ${name}`,
    stop: (name: string) => `Stop previewing ${name}`,
    playFailed: (text: string) => `Couldn't preview: ${text}`,
    more: (name: string) => `More · ${name}`,
    edit: 'Edit…',
    cloneTo: (label: string) => `Upload to ${label} to clone…`,
    recloneTo: (label: string) => `Upload to ${label} again…`,
    recloneHint: 'The reference recording changed, so the old clone is out of date',
    removeClone: (label: string) => `Delete clone from ${label}…`,
    export: 'Export voice pack…',
    remove: 'Delete…',
    cloning: (label: string) => `Uploading to ${label} to clone…`,
    cloneFailed: (label: string, text: string) => `The last clone on ${label} didn't succeed: ${text}`,
    loadingMeta: 'Loading…',
    // Create and edit
    createTitle: 'New voice',
    editTitle: (name: string) => `Edit “${name}”`,
    referenceFile: (file: string) => `Reference recording: ${file}`,
    name: 'Name',
    language: 'Language',
    languageHint: 'The language spoken in the reference recording',
    transcript: 'Transcript',
    transcriptHint: 'What’s said in the reference recording. Some engines need it to clone; leave it empty if you’re not sure.',
    consentHint: 'You can save without checking this, but the voice won’t be uploaded to any third party for cloning.',
    save: 'Save as voice',
    saveEdit: 'Save',
    cancel: 'Cancel',
    loading: 'Loading voice…',
    loadFailed: (text: string) => `Couldn't load this voice: ${text}`,
    saved: (name: string) => `Saved “${name}” · available when generating speech and voice-overs`,
    updated: (name: string) => `Saved “${name}”`,
    unchanged: 'No changes',
    // Clone
    uploadTitle: (label: string) => `Upload to ${label}?`,
    upload: 'Upload',
    cloneStarted: (label: string) => `Uploading to ${label} · progress is in Background tasks`,
    cloneRejected: (text: string) => `Couldn't start cloning: ${text}`,
    removeCloneTitle: (label: string) => `Delete the clone from ${label}?`,
    removeCloneBody: (label: string) =>
      `${label} will be asked to delete this cloned voice. To use this voice on ${label} afterwards, you’ll need to upload it again.`,
    removeCloneConfirm: 'Delete clone',
    cloneRemoved: (label: string) => `Deleted the clone from ${label}`,
    cloneGoneRemote: (label: string) => `${label} no longer has this clone; the record on this computer was cleared too`,
    cloneRemoveFailed: (text: string) => `Couldn't delete the clone: ${text}`,
    // Export
    exportTitle: 'Export voice pack',
    exportButton: 'Export',
    exported: (path: string) => `Exported to ${path}`,
    exportFailed: (text: string) => `Couldn't export: ${text}`,
    exportExists: 'CucCut doesn’t overwrite existing files. Choose another name or location and export again.',
    /** The full sentence when the target already exists (`exportFailed` plus `exportExists`). */
    exportFailedExists: (text: string) =>
      `Couldn't export: ${text}. CucCut doesn’t overwrite existing files. Choose another name or location and export again.`,
    // Delete
    deleteTitle: (name: string) => `Delete “${name}”?`,
    deleteConfirm: 'Delete',
    deleted: (name: string) => `Deleted “${name}”`,
    deleteFailed: (text: string) => `Couldn't delete: ${text}`,
    localOnlyTitle: (label: string) => `The clone on ${label} wasn't deleted`,
    localOnlyBody: (label: string, text: string) =>
      `${text}\n\nThe voice is still here. You can try again later, or delete only the record and voice on this computer. The clone in your ${label} account will then remain, and you’ll need to delete it on ${label} yourself.`,
    localOnlyConfirm: 'Delete only on this computer',
    later: 'Try again later',
  },
};

export type VoicesMessages = typeof en;

const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

export const MY_VOICES_COPY = live(() => M.myVoices);
