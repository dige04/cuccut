import { defineCatalog } from '../../message-ref.ts';
import { zhHans } from './rc-agent-tools.zh-Hans.ts';
import { zhHant } from './rc-agent-tools.zh-Hant.ts';
import { ja } from './rc-agent-tools.ja.ts';
import { ko } from './rc-agent-tools.ko.ts';
import { es } from './rc-agent-tools.es.ts';
import { fr } from './rc-agent-tools.fr.ts';
import { de } from './rc-agent-tools.de.ts';
import { nl } from './rc-agent-tools.nl.ts';
import { ptBR } from './rc-agent-tools.pt-BR.ts';
import { it } from './rc-agent-tools.it.ts';
import { ru } from './rc-agent-tools.ru.ts';
import { pl } from './rc-agent-tools.pl.ts';
import { tr } from './rc-agent-tools.tr.ts';
import { vi } from './rc-agent-tools.vi.ts';

/**
 * User-facing text for agent tools (agent-tools/): summaries on approval cards, purposes of outbound authorization, and edit notes written into video history. Tool descriptions, errors and next steps for the model are for the model only and are not here. English is the source of keys and types; translations are in `rc-agent-tools.<language>.ts`.
 */

/** How an export kind is worded in a summary. */
function exportKindLabel(kind: string): string {
  switch (kind) {
    case 'subtitles':
      return 'subtitles';
    case 'transcript':
      return 'transcript';
    case 'audio':
      return 'audio';
    case 'video':
      return 'video file';
    case 'portable':
      return 'portable package';
    case 'project':
      return 'project file';
    default:
      return kind;
  }
}

/** End of the summary for an import from a link: what to do after downloading. */
function linkImportAfter(p: { target: string; name: string | null; transcribe: boolean; language: string | null; provider: string | null; model: string | null; captions: boolean }): string {
  const recognition = `${p.language ? `, language ${p.language}` : ''}${p.provider ? ` (${p.provider}${p.model ? ` ${p.model}` : ''})` : ''}`;
  if (p.target === 'create') {
    return `, create video${p.name ? ` "${p.name}"` : ' (named after the page title)'} and add it to the timeline${p.transcribe ? `, then transcribe it${recognition}${p.captions ? ' and create a subtitle layer' : ''}` : ''}`;
  }
  if (p.target === 'video') return `, import it into the video${p.transcribe ? ' and transcribe it' : ''}`;
  if (p.target === 'project') return `, save to the project's downloads/${p.transcribe ? ' and transcribe to TXT and SRT' : ''}`;
  if (p.target === 'download') return `, save to the Downloads folder${p.transcribe ? ' and transcribe to TXT and SRT' : ''}`;
  return '';
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

const en = {
  instructionsNotSet: 'Session instructions have not been set: Runtime assembly order is incorrect',

  /** Separator between items in a list. */
  listSeparator: ', ',
  /** Separator between several explanatory paragraphs. */
  clauseSeparator: '; ',

  createVideoSummary: (p: { name: string }) => `Create video "${p.name}"`,
  slidesImportAssetSummary: (p: { file: string; deck: string }) => `Add "${p.file}" to the slides "${p.deck}"`,
  designImportAssetSummary: (p: { file: string; canvas: string }) => `Add "${p.file}" to the design "${p.canvas}"`,
  designSystemImportAssetSummary: (p: { file: string; system: string }) => `Add "${p.file}" to the design system "${p.system}"`,
  editsSummary: (p: { label: string; count: number; types: string }) =>
    `${p.label} (${plural(p.count, 'operation', 'operations')}: ${p.types})`,
  captionsSummary: (p: { documentId: string; bilingual: boolean }) =>
    `Add a ${p.bilingual ? 'bilingual ' : ''}subtitle layer for document ${p.documentId}`,
  /** Note for the edit that creates a caption track, in video history and undo. */
  captionsLabel: 'Add subtitle layer',
  undoSummary: (p: { transactionId: string }) => `Undo edit ${p.transactionId}`,
  undoLatestSummary: 'Undo the latest edit',
  deleteVideoSummary: (p: { name: string; path: string; days: number }) =>
    `Delete video "${p.name}" (${p.path}): move it to the Trash, where it can be restored in Library for ${plural(p.days, 'day', 'days')}. Original files of linked assets stay where they are`,
  importPackageSummary: (p: { file: string }) => `Open portable package ${p.file}`,
  /** Note in video history for the edit that changes the video name when a portable package is opened with a name given. */
  renameVideoLabel: 'Rename video',
  putDocumentSummary: (p: { documentId: string }) => `Write a new version of document ${p.documentId}`,
  newDocumentSummary: (p: { kind: string }) => `Create a document (${p.kind})`,
  /** Note for the document-writing edit in video history and undo (when the agent gave no label). */
  updateDocumentLabel: (p: { name: string }) => `Update document "${p.name}"`,
  newDocumentLabel: (p: { name: string }) => `Create document "${p.name}"`,
  /** Name used in the note when a new translation is created without a name. */
  translationDocumentName: (p: { language: string }) => `${p.language} translation`,
  importAssetSummary: (p: { name: string; place: boolean }) => `Import asset ${p.name}${p.place ? ' and add it to the timeline' : ''}`,
  /** Note for the import-media edit in video history and undo. */
  importAssetLabel: (p: { name: string; place: boolean }) => `Import ${p.name}${p.place ? ' and add it to the timeline' : ''}`,
  /** In-place replacement of a code composition (`compositions_import` with `replace`): the confirmation summary and the note for this edit in video history. */
  replaceCompositionSummary: (p: { name: string; clip: string }) => `Import ${p.name} and swap it into clip ${p.clip} on the timeline`,
  replaceCompositionLabel: (p: { name: string }) => `Replace the motion graphic with ${p.name}`,
  /** Cleanup of unreferenced assets (`assets_prune` with `apply`): the confirmation summary and the note for this edit in video history. `names` is the list of asset names. */
  pruneAssetsSummary: (p: { count: number; names: string }) => `Remove unused assets from the video (${p.count}): ${p.names}`,
  pruneAssetsLabel: (p: { count: number }) => `Remove unused assets (${p.count})`,
  /** Adopting source chapters (`chapters_adopt`): the confirmation summary and the default note for this edit in video history. `existing` is the number of existing chapters that will be replaced. */
  adoptChaptersSummary: (p: { count: number; existing: number; asset: string }) =>
    `Use the source chapters of ${p.asset} (${p.count})${p.existing ? `, replacing the current chapters (${p.existing})` : ''}`,
  adoptChaptersLabel: 'Adopt source chapters',

  transcribePurpose: (p: { assetId: string }) => `Transcribe asset ${p.assetId}`,
  transcribeSummary: (p: { assetId: string; provider: string | null; model: string | null }) =>
    `Transcribe asset ${p.assetId}${p.provider ? ` (${p.provider}${p.model ? ` ${p.model}` : ''})` : ''}`,
  speechPurpose: (p: { chars: number }) => `Synthesize speech (${plural(p.chars, 'character', 'characters')})`,
  speechSummary: (p: { chars: number; provider: string | null; voice: string | null }) =>
    `Synthesize speech (${plural(p.chars, 'character', 'characters')}${p.provider ? `, ${p.provider}` : ''}${p.voice ? `, voice ${p.voice}` : ''})`,
  imagePurpose: (p: { prompt: string }) => `Generate image: ${p.prompt}`,
  musicPurpose: (p: { style: string }) => `Generate music: ${p.style}`,
  musicSummary: (p: { mode: string; seconds: number | null; provider: string | null; style: string }) => `Generate ${p.mode === 'song' ? 'a song' : 'instrumental music'}${p.seconds ? `, up to ${p.seconds} s` : ''}${p.provider ? `, ${p.provider}` : ''}: ${p.style}`,
  imageSummary: (p: { count: number; size: string | null; provider: string | null; prompt: string }) =>
    `Generate ${plural(p.count, 'image', 'images')}${p.size ? `, ${p.size}` : ''}${p.provider ? `, ${p.provider}` : ''}: ${p.prompt}`,
  cancelJobSummary: (p: { jobId: string }) => `Cancel task ${p.jobId}`,
  retryPipelineSummary: (p: { jobId: string; pipeline: string; attempt: number }) =>
    `Rerun pipeline ${p.jobId} (${p.pipeline}, attempt ${p.attempt}) from the step that failed`,
  saveArtifactSummary: (p: { artifactId: string; path: string }) => `Save output ${p.artifactId} as ${p.path}`,
  overwriteArtifactSummary: (p: { artifactId: string; path: string }) =>
    `Overwrite the existing file ${p.path} with output ${p.artifactId}`,

  exportSummary: (p: {
    kind: string;
    format: string;
    rangeStart: number | null;
    rangeEnd: number | null;
    rangeCount: number | null;
    width: number | null;
    height: number | null;
    originalOnly: boolean;
    dubGroupId: string | null;
    fileName: string | null;
    overwrite: boolean;
  }) => {
    const range =
      p.rangeStart !== null ? `, ${p.rangeStart}–${p.rangeEnd}s` : p.rangeCount !== null ? `, ${plural(p.rangeCount, 'range', 'ranges')}` : '';
    const size =
      p.width !== null && p.height !== null
        ? `, ${p.width}×${p.height}`
        : p.width !== null
          ? `, width ${p.width}`
          : p.height !== null
            ? `, height ${p.height}`
            : '';
    const source = p.originalOnly ? ', original audio only' : p.dubGroupId ? `, voice-over ${p.dubGroupId} only` : '';
    return `Export ${exportKindLabel(p.kind)} (${p.format}${range}${size}${source})${p.fileName ? ` as ${p.fileName}` : ''}${p.overwrite ? ', overwriting the existing file' : ''}`;
  },

  installToolSummary: (p: { tool: string; version: string; size: string; estimated: boolean; license: string; url: string; host: string }) =>
    `Install ${p.tool} ${p.version} (${p.estimated ? `about ${p.size}` : p.size}, ${p.license}) from ${p.url} to download videos from links; downloading from ${p.host} needs it`,
  linkImportSummary: (p: { tool: string; version: string; host: string; url: string; target: string; name: string | null; transcribe: boolean; language: string | null; provider: string | null; model: string | null; captions: boolean }) =>
    `Download from ${p.host} with ${p.tool}${p.version ? ` ${p.version}` : ''}: ${p.url}${linkImportAfter(p)}`,
  linkImportConsentSummary: (p: {
    tool: string;
    version: string;
    path: string;
    host: string;
    url: string;
    target: string;
    name: string | null;
    transcribe: boolean;
    language: string | null;
    provider: string | null;
    model: string | null;
    captions: boolean;
  }) =>
    `Allow CucCut to use ${p.tool}${p.version ? ` ${p.version}` : ''} on this computer${p.path ? ` (${p.path})` : ''} to download videos from websites, and download from ${p.host}: ${p.url}${linkImportAfter(p)}`,

  downloadSaveSummary: (p: { source: string; size: string; target: string }) =>
    `Copy ${p.source} (${p.size}) from the working folder to the Downloads folder: ${p.target} (numbered if the name is taken, never overwritten)`,

  grantSummary: (p: { recipients: string; items: string }) => `Share data with ${p.recipients}: ${p.items}`,
  grantSummaryItem: (p: { purpose: string; maxCalls: number | null }) =>
    `${p.purpose} (${p.maxCalls === null ? 'no call limit' : `up to ${plural(p.maxCalls, 'call', 'calls')}`})`,

  testModelSummary: (p: { bundleId: string }) => `Check local model bundle ${p.bundleId}: run it end to end on a fixed sample`,
  installModelSummary: (p: { bundleId: string; size: string; estimated: boolean; resumed: string | null; source: string; parts: string }) =>
    `Download local model ${p.bundleId}: ${p.estimated ? `about ${p.size} (size unknown, estimated)` : p.size}${p.resumed ? `, resuming ${p.resumed} already downloaded` : ''}, from ${p.source} (${p.parts})`,

  registerProjectSummary: (p: { path: string; name: string | null }) =>
    `Register the existing folder ${p.path} as a project${p.name ? ` (${p.name})` : ''}`,
  createProjectSummary: (p: { path: string; name: string | null }) => `Create project folder ${p.path}${p.name ? ` (${p.name})` : ''}`,
  adoptSessionSummary: (p: { name: string | null }) =>
    `Create a project ${p.name ? `“${p.name}”` : 'named after the first video'} and move this session’s videos and files into it`,
  /** Approval summary for deriving a child video (`videos_derive`); from and to are mm:ss on the timeline. */
  deriveVideoSummary: (p: { name: string; from: string; to: string }) => `Create a child video "${p.name}" from ${p.from}–${p.to} of this video`,
  /** Note for the derive edit in history and undo; name is the parent video's name. */
  deriveVideoLabel: (p: { name: string }) => `Derive from "${p.name}"`,
  /** Name of the derivation source document (kind derivation) in a child video. */
  derivationDocumentName: 'Derivation source',
  /** Errors from `videos.derive` (error codes DERIVE_RANGE_EMPTY, DERIVE_UNSUPPORTED_ITEM, DERIVE_PARENT_UNPLACED). */
  deriveRangeEmpty: 'The range is empty after snapping to frames',
  deriveUnsupportedItem: (p: { kind: string }) => `The range contains a clip that can’t be copied into a child video (${p.kind})`,
  deriveParentUnplaced: 'This video isn’t inside a project or session folder, so a child video can’t be created next to it',
  /** Errors from `videos.shots` (error codes SHOTS_RANGE_EMPTY, SHOTS_RANGE_TOO_LONG); minutes is the upper limit of the range length. */
  shotsRangeEmpty: 'The range is empty after snapping to frames',
  shotsRangeTooLong: (p: { minutes: number }) => `The range is longer than ${p.minutes} minutes; detect shots in shorter pieces`,
  // Publishing (publications_* tools, design m2-publishing §5): approval summaries.
  publicationsPrepareSummary: (p: { videos: string; repeat: boolean }) =>
    p.repeat ? `Prepare a new release of ${p.videos} for publishing` : `Prepare ${p.videos} for publishing`,
  publicationsUpdateSummary: (p: { label: string }) => `Change the publication “${p.label}”`,
  publicationsRestoreSummary: (p: { label: string }) => `Restore the archived publication “${p.label}”`,
  publicationsRescheduleSummary: (p: { label: string; count: number }) =>
    `Move ${p.count === 1 ? 'one account' : `${p.count} accounts`} of “${p.label}” to new times`,
  publicationsReserveSummary: (p: { count: number }) =>
    `Reserve publishing times for ${p.count === 1 ? 'one publication' : `${p.count} publications`}`,
  publicationsPinSummary: (p: { label: string; render: boolean }) =>
    p.render ? `Render the video and pin the export to “${p.label}”` : `Pin a finished export to “${p.label}”`,
  publicationsProposeCopySummary: (p: { label: string }) => `Suggest text for “${p.label}” (you choose whether to use it)`,
  publicationsApproveSummary: (p: { label: string }) => `Approve the pinned export of “${p.label}” for publishing`,
  publicationsSendSummary: (p: { label: string; accounts: string }) => `Send “${p.label}” to ${p.accounts}`,
  publicationsWithdrawSummary: (p: { label: string; account: string }) => `Withdraw “${p.label}” from ${p.account}`,
  publicationsArchiveSummary: (p: { label: string }) => `Archive the publication “${p.label}”`,
  publicationsImportSummary: (p: { file: string; count: number }) =>
    `Import ${p.count === 1 ? 'one publication' : `${p.count} publications`} from ${p.file}`,
};

export type RcAgentToolsMessages = typeof en;

export const RcAgentTools = defineCatalog('rcAgentTools', en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
