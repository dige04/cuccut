import { defineMessages } from '@cuccut/protocol';
import { revealLabel } from '../../copy.ts';
import { zhHans } from './space-copy.zh-Hans.ts';
import { zhHant } from './space-copy.zh-Hant.ts';
import { ja } from './space-copy.ja.ts';
import { ko } from './space-copy.ko.ts';
import { es } from './space-copy.es.ts';
import { fr } from './space-copy.fr.ts';
import { de } from './space-copy.de.ts';
import { nl } from './space-copy.nl.ts';
import { ptBR } from './space-copy.pt-BR.ts';
import { it } from './space-copy.it.ts';
import { ru } from './space-copy.ru.ts';
import { pl } from './space-copy.pl.ts';
import { tr } from './space-copy.tr.ts';
import { vi } from './space-copy.vi.ts';

/** English “n things” phrasing: only distinguishes singular from plural. */
const count = (n: number, one: string, other: string) => `${n} ${n === 1 ? one : other}`;

/**
 * Copy for the Space page (product design §4; prototypes page-space.jsx, space-list.jsx, space-viewer.jsx). English is the source of keys and types;
 * translations are in `space-copy.<locale>.ts`. For actions that cannot be done, write one real reason; the reason itself lives in model/space-actions.ts.
 */
const en = {
  searchPlaceholder: "Search names, files, or what's said in videos",
  searchLabel: 'Search the Library',

  // Lists and menus
  openVideo: 'Open video',
  viewInfo: 'View info',
  /** Videos with files attached (product design §4.3): menu item, the “N files” on cards, a line under the list name, the file list in the viewer, and back to video. */
  viewInfoFiles: 'View info and files',
  filesButton: (n: number) => count(n, 'file', 'files'),
  /** `summary` is the per-type breakdown (“Export 2 · Subtitles 1”). */
  filesButtonLabel: (n: number, summary: string) => `${count(n, 'file', 'files')}: ${summary}`,
  filesLine: (n: number, summary: string) => `${count(n, 'file', 'files')} · ${summary}`,
  filesTitle: 'Files',
  filesListLabel: "This video's files",
  viewVideo: 'View video',
  factFolder: 'Folder',
  /** Transcription action for video items (product design §4.4): not yet transcribed, transcribed, last attempt failed. */
  transcribe: { first: 'Transcribe…', redo: 'Re-transcribe…', retry: 'Retry transcription…' },
  info: 'Video details…',
  view: 'View',
  continue: 'Continue in session',
  favorite: 'Favorite',
  unfavorite: 'Remove from favorites',
  rename: 'Rename',
  get reveal() {
    return revealLabel();
  },
  viewTask: 'View task',
  trash: 'Move to Trash',
  restore: 'Restore from Trash',
  purge: 'Delete permanently',
  clear: 'Clear',
  columnMeasure: 'Duration or dimensions',
  columnStatus: 'Status',
  noValue: '—',
  favorited: 'Favorited',

  // Toolbar
  statusPicker: 'Status',
  refreshMenu: 'Refresh',
  rescan: 'Rescan project folders',
  rescanHint: 'Read the files in every project and session folder again',
  rebuild: 'Rebuild index',
  rebuildHint: 'Discard the derived catalog and content index and rebuild them; favorites, display names, and Trash are kept',
  scanning: 'Scanning project folders',
  rebuilt: (entries: number, pending: number) =>
    pending > 0
      ? `Index rebuilt · ${count(entries, 'item', 'items')} · content index for ${count(pending, 'video', 'videos')} still updating in the background`
      : `Index rebuilt · ${count(entries, 'item', 'items')}`,

  // New
  newLabel: 'New',
  newBlank: 'New blank video',
  newBlankHint: 'A 16:9 blank video that opens right away, with no transcription or queue',
  newFromFile: 'New video from file',
  newFromFileHint: 'Video or audio goes to the Home composer so you can say what to do with it; images go straight onto the timeline',
  newFromPackage: 'New video from portable package',
  newFromPackageHint: 'A .cuccut exported elsewhere, with all its assets inside',
  pickPackageTitle: 'Choose a portable package',
  pickPackageButton: 'Open',
  pickPackageFilter: 'CucCut portable package',
  openPackage: 'Open as new video',
  packageBlocked: (reason: string) => `Open as new video: ${reason}`,
  packageOpening: (name: string) => `Opening "${name}"…`,
  packageOpened: (name: string) => `Opened "${name}" as a new video`,
  importAssets: 'Import assets',
  importAssetsHint: 'Register files as project assets; files outside the project are copied into its imports/',
  whichProject: 'Which project',
  noProject: 'Open a project folder in Home first',
  pickNotMedia: "That isn't a video, audio, or image file",
  createdFromFile: (name: string) => `Created video "${name}" and placed the asset`,
  createdEmpty: (reason: string) => `The video was created, but the asset wasn't placed: ${reason}`,

  // Import dialog (prototype SpaceImport)
  importTitle: 'Import assets',
  importProject: 'Import to project',
  importHint:
    "Choose videos, audio, or images. Files in the project folder are registered in place; files outside it are copied into the project's imports/ and the originals stay put. Nothing is added to any video.",
  importPick: 'Choose files…',
  importNoProject: 'No projects yet: open a project folder in Home first.',
  importing: 'Importing',

  // Viewer dialog
  factSource: 'Source',
  factFile: 'File',
  factMeasure: 'Duration or dimensions',
  factSize: 'Size',
  factStatus: 'Status',
  factActivity: 'Last activity',
  factConversation: 'Source session',
  factGenerated: 'Generated',
  factVersion: 'Version',
  factNote: 'Note',
  viewConversation: 'View source session',
  close: 'Close',
  editBlocked: (reason: string) => `Edit again: ${reason}`,
  continueBlocked: (reason: string) => `Continue in session: ${reason}`,
  version: (frozen: string, current: string | null) =>
    current && current !== frozen ? `Video version ${frozen}; the video is now ${current}` : `Video version ${frozen}`,
  missingTitle: "Can't find this file",
  // Screen-reader descriptions for card badges and list thumbnails (prototype sp-prev__flag)
  missingFile: 'File not found',
  missingBody: 'The item is still here. Its status recovers once the file is back.',
  failedTitle: 'Generation failed',
  failedBody: "No file was produced. See why and try again on the Tasks page, or clear it if you don't need it.",
  changedTitle: 'Source video changed since',
  changedBody: 'This result matches an earlier version of the video. It still works, but no longer reflects the current video.',
  reexport: 'Export again from the source video',
  noPreviewVideo: 'Videos open in the editor.',

  // Capabilities (origin.capability)
  capability: {
    synthesizeSpeech: 'Voice-over',
    generateImage: 'Generate image',
    generateMusic: 'Generate music',
    generateText: 'Generate text',
    export: 'Export',
    'videos-derive': 'Cut into shorts',
  } as Record<string, string>,

  // Action results
  trashed: (name: string) => `Moved to Trash · ${name}`,
  undo: 'Undo',
  restored: (name: string) => `Restored · ${name}`,
  purged: (name: string) => `Permanently deleted · ${name}`,
  cleared: (name: string) => `Cleared · ${name}`,
  renamed: 'Renamed',
  continued: (created: boolean, name: string, title: string) =>
    created
      ? `Started a new session with "${name}" attached: write what to do, then send`
      : `Back in "${title}" with "${name}" attached: write what to do, then send`,
  sourceGone: "The source video isn't in any project or session folder right now, so it can't be opened",
  /** `what` is the action name (e.g. `trash`, `rebuild`); it is readable regardless of case. */
  failed: (what: string, reason: string) => `${what} failed: ${reason}`,

  // Delete video (product design §4.9)
  trashVideoTitle: 'Delete this video?',
  trashVideoBody: "The whole video folder moves to the project's Trash and can be restored. Linked original assets stay where they are.",
  trashVideoRelated: (n: number) =>
    `${count(n, 'item', 'items')} exported or generated from it will stay in the Library and won't be deleted with the video:`,
  trashVideoConfirm: 'Delete video',

  // Delete permanently
  purgeTitle: 'Delete permanently?',
  purgeBody: (name: string) =>
    `"${name}" will be deleted from disk and can't be restored. If a video or a running task still uses it, nothing is deleted and you'll see what's using it.`,
  purgeVideoBody: (name: string) =>
    `The whole folder of video "${name}" will be deleted from disk and can't be restored. Linked original assets aren't affected.`,
  purgeConfirm: 'Delete permanently',
  blockedTitle: "Can't delete yet",
  blockedBody: (name: string) => `"${name}" is still in use, so nothing was deleted:`,
  gotIt: 'Got it',

  // Rename
  renameTitle: 'Rename',
  renameLabel: 'Display name',
  renameHint: (fileName: string) =>
    `Only changes the name shown in the Library; the file itself stays the same. Leave it empty to go back to "${fileName}".`,
  save: 'Save',

  // Source video has changed (product design §4.6)
  changedDialogTitle: 'The source video has changed',
  changedDialogBody: (frozen: string | null, current: string | null) =>
    `This result matches video version ${frozen ?? '(unknown)'}; the video is now ${current ?? '(unknown)'}. The current working copy will open.`,
  changedOpenCurrent: 'Open current working copy',
  changedFromFrozen: 'Continue from that version',
  changedFromFrozenReason:
    "Continuing from the version this export was made from isn't possible yet (Runtime has no command to go back to a version). You can open the current working copy and view that version in History.",

  // Content hits (architecture design §5.11)
  hitsTitle: 'Said in videos',
  hitsCount: (n: number) => count(n, 'match', 'matches'),
  hitsSearching: 'Searching the content index',
  hitsNone: 'Nothing said in videos matches',
  hitsError: (reason: string) => `Can't search the content index: ${reason}`,
  hitUnopenable: "This video isn't in any project or session folder right now, or it's in Trash, so it can't be opened",
  hitSourceClock: 'This is in an asset, not on the timeline: open the video and look for it',
  hitStale: 'The video changed after it was indexed, so the position may be off',
  // Filtering and grouping of content hits (design draft page-projects.jsx HitGroup; kind and speaker are filters of the contract's space.search)
  hitsGrouped: (n: number, videos: number) => `${count(n, 'match', 'matches')} · ${count(videos, 'video', 'videos')}`,
  hitKind: 'Document type',
  hitKindAll: 'All types',
  hitSpeaker: 'Speaker',
  hitSpeakerAll: 'All speakers',
  hitSpeakerNone: 'None of these matches has a speaker',
  hitsNoneFiltered: 'Nothing matches this type or speaker. Try another one.',
  hitsMore: (n: number) => `Show ${n} more`,

  // Other text on the page
  cancel: 'Cancel',
  openForEdit: 'Open for editing',
  newVideo: 'New video',
  revealUnavailable: "This file isn't in any project or session folder, so there's no location to show",
  sidebarLabel: 'Library categories',
  kindsHeader: 'Categories',
  mineHeader: 'Organize',
  sidebarNote: 'The Library shows the videos, assets, and outputs in all your projects. The files stay in their own project folders. Files exported or generated from a video are grouped with it; browse by type to see them one by one.',
  all: 'All',
  emptyFiltered: 'No matching items',
  emptyTrash: 'Trash is empty',
  emptyFavorite: 'No favorites yet',
  emptyAll: 'No items yet',
  /** A type category (`label` is the category name) has no entries yet. */
  emptyCategory: (label: string) => `Nothing in ${label} yet`,
  emptyFilteredBody: 'Try other keywords, or clear the project and status filters.',
  emptyTrashBody: 'Items you move to Trash show up here. You can restore them or delete them permanently.',
  emptyBody: 'Ask the agent in a session and its outputs show up here. You can also import assets from "New", or open an existing folder in Home.',
  projectPicker: 'Project',
  allProjects: 'All projects',
  sortPicker: 'Sort',
  viewPicker: 'View',
  viewGrid: 'Grid',
  viewList: 'List',
  issuesTitle: (n: number) => (n === 1 ? "1 folder wasn't fully listed" : `${n} folders weren't fully listed`),
  issueTruncated: (detail: string) => `Too many files, only some were listed: ${detail}`,
  issueUnreadable: (detail: string) => `Can't read: ${detail}`,
  preparing: 'Getting the Library ready…',
  preparingBody: 'The first time, project folders need to be scanned. This takes a moment.',
  /** Description of the new-menu item: when filtered to a project, state which project it will be created in. */
  createIn: (project: string, hint: string) => `In "${project}" · ${hint}`,
  /** Screen-reader name for submenus such as “New blank video”: `label` is the menu item's name. */
  whichProjectFor: (label: string) => `${label}: which project`,
  entryActions: (name: string) => `Actions for "${name}"`,
  entriesLabel: 'Library items',
  columnName: 'Name',
  columnKind: 'Type',
  columnSource: 'Source',
  columnActivity: 'Last activity',
  columnMenu: 'Actions',
  /** When deleting a video, list only the first few related items and fold the rest into one line: `n` is the total. */
  relatedMore: (n: number) => `…${n} in total`,
  /** One-sentence import result (`text` comes from `importSummary` in model/space-actions.ts), followed by the project name. */
  importSummaryIn: (text: string, project: string) => `${text} (${project})`,
  /** Viewer “recent activity”: the relative time is followed by the exact time in brackets. */
  activityAt: (ago: string, at: string) => `${ago} (${at})`,
  /** Put the reason for an item's status before the explanation: `reason` is one sentence with no closing punctuation. */
  withReason: (reason: string, body: string) => `${reason}. ${body}`,
  /** Derived count on the parent video card / row (cut into shorts). */
  shortsCount: (n: number) => (n === 1 ? '1 short' : `${n} shorts`),
  /** Screen-reader name for “N shorts” on cards and rows: filters to the shorts cut from this video's source. */
  shortsView: 'See shorts cut from this',
  /** The “shorts cut from it” section in the parent video's viewer (product design §4.5): the title, the action in the top-right that switches the filter to “All”, and the hint shown when only the first few are displayed. */
  shortsTitle: 'Shorts cut from this video',
  shortsInList: 'Show in list',
  shortsMore: (n: number) => (n === 1 ? '1 more short. Show them all in the list.' : `${n} more shorts. Show them all in the list.`),
  /** The range one short occupies on its parent video (`from` and `to` are timecodes). */
  shortsSpan: (from: string, to: string) => `Original ${from}–${to}`,
  /** Viewer for a short: swapped for the parent video's viewer. */
  viewSourceVideo: 'View source video',
  /** Filter bar shown at the top when filtering by source: `name` is the parent video's name. */
  shortsFilter: (name: string) => `Shorts cut from “${name}”`,
  shortsFilterClear: 'Clear filter',
  /** When deleting a parent video, add a note: derived videos are not deleted with it. */
  trashVideoShorts: (n: number) => (n === 1 ? '1 video was derived from it; it stays on its own.' : `${n} videos were derived from it; each stays on its own.`),
};

export type SpaceMessages = typeof en;

export const SPACE_COPY = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
