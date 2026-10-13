import { defineMessages, live, localizeText, type DocumentRecord, type ExportKind, type Id } from '@cuccut/protocol';
import { formatRangeTime } from './export-range.ts';
import { fmtSize } from './task-facts.ts';
import { zhHans } from './export-rejection.zh-Hans.ts';
import { zhHant } from './export-rejection.zh-Hant.ts';
import { ja } from './export-rejection.ja.ts';
import { ko } from './export-rejection.ko.ts';
import { es } from './export-rejection.es.ts';
import { fr } from './export-rejection.fr.ts';
import { de } from './export-rejection.de.ts';
import { nl } from './export-rejection.nl.ts';
import { ptBR } from './export-rejection.pt-BR.ts';
import { it } from './export-rejection.it.ts';
import { ru } from './export-rejection.ru.ts';
import { pl } from './export-rejection.pl.ts';
import { tr } from './export-rejection.tr.ts';
import { vi } from './export-rejection.vi.ts';
import { refIn, remedyText } from './localized-text.ts';
import { findingLine } from './review.ts';

/** Copy for export rejection or failure (English is the source of keys and types; translations are in `export-rejection.zh-Hans.ts`). The Runtime's own wording does not pass through here. */
const en = {
  portableReason: {
    missing: 'File not found',
    changed: 'Content differs from when it was added',
    unreadable: 'Can’t be read',
  } as Record<string, string>,
  titles: {
    VIDEO_NOT_OPEN: 'The video isn’t open',
    EXPORT_KIND_UNSUPPORTED: 'This version can’t export this kind of content yet',
    EXPORT_SOURCE_UNSUPPORTED: 'This document can’t be exported this way',
    EXPORT_NOTHING_TO_EXPORT: 'Nothing in the range can be exported',
    EXPORT_SOURCE_NOT_FOUND: 'No document can be exported',
    EXPORT_SOURCE_AMBIGUOUS: 'Several documents can be exported',
    EXPORT_TOOL_MISSING: 'This computer is missing a tool needed for export',
    EXPORT_UNSUPPORTED_CONTENT: 'Some content can’t be rendered for export',
    ASSET_MISSING: 'Some assets can’t be read',
    ASSET_CHANGED: 'Some assets have changed',
    ENTITY_NOT_FOUND: 'The sequence doesn’t exist',
    DUB_GROUP_NOT_FOUND: 'This voice-over group can’t be found',
    EXPORT_PACKAGE_LOCAL_PATH: 'Some documents contain paths on this computer',
    EXPORT_PACKAGE_UNSUPPORTED: 'Some files can’t go into a portable package',
    EXPORT_INSUFFICIENT_SPACE: 'Not enough space on the export location’s disk',
    EXPORT_DESTINATION_EXISTS: 'A file with the same name already exists',
    EXPORT_DESTINATION_UNWRITABLE: 'Can’t write to the export location',
    EXPORT_RENDER_FAILED: 'The video couldn’t be rendered',
    EXPORT_VALIDATION_FAILED: 'The exported file didn’t pass validation',
    EXPORT_PUBLISH_FAILED: 'The files couldn’t be saved to the export location',
    EXPORT_PARTIALLY_PUBLISHED: 'Only some files were saved',
    RESOURCE_ADMISSION_UNSATISFIABLE: 'This computer doesn’t have enough resources for this export',
    REVIEW_BLOCKED: 'This video doesn’t meet your standard yet',
  } as Record<string, string>,
  resources: {
    memory: 'Memory',
    gpuMemory: 'GPU memory',
    cpuThreads: 'CPU threads',
    scratchDisk: 'Disk space for temporary files',
  } as Record<string, string>,
  problemSeparator: '; ',
  fileProblems: (file: string, problems: string) => `${file}: ${problems}`,
  notStarted: 'Export didn’t start',
  failed: 'Export failed',
  missingTool: (tool: string) => `Missing: ${tool}`,
  assetMissingHint: 'Find the file or relink it in Assets, then export again.',
  assetChangedHint: 'Relink this asset or put the original file back, then export again.',
  nothingHint: 'Pick a different range, or put something on the timeline first.',
  space: (required: string, available: string) => `Needs about ${required}; only ${available} left`,
  notEnough: (resource: string) => `Not enough: ${resource}`,
  resourceHint: 'Export a shorter range or choose a lower resolution, then try again.',
  reviewHint: 'Fix what’s listed, or open the review and let a finding stand with a reason.',
  reviewItem: (said: string, fix: string) => (fix ? `${said}. ${fix}` : `${said}.`),
  openReview: 'Open the review',
};
export type ExportRejectionMessages = typeof en;
export const EXPORT_REJECTION_COPY = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
const M = EXPORT_REJECTION_COPY;

/**
 * What the UI says and can do when an export is rejected or fails (the preflight and failure codes in architecture design §9.11, and the Runtime's export-service.ts).
 *
 * - Rejected at submission: `exports.create` throws an RPC error, `details.code` is the export's rejection code, and no job is created.
 * - Failed partway through: the job record's `error.code` is the code of a `TaskFailure` (render, validation or publish failure, or only part was published).
 *
 * Both are normalized to the same shape: a one-line title, the Runtime's own wording, an itemized list, the Runtime's remedy note (`details.remedy` / `details.recovery`),
 * and the step the UI can take directly (resubmit skipping what cannot be drawn, resubmit skipping missing assets, choose another location, pick one document).
 */

export type ExportRemedy =
  /** Final video: resubmit with `onUnsupported: 'skip'`; each item that cannot be drawn is skipped and a warning is logged. */
  | { kind: 'skip-unsupported' }
  /** Portable package: resubmit with `missingAssets: 'skip'`; missing items are honestly marked in the manifest. */
  | { kind: 'skip-missing-assets' }
  /** Choose a different export location. */
  | { kind: 'pick-dir' }
  /** Several documents can be exported: choose one. */
  | { kind: 'choose-document'; candidates: { documentId: Id; name: string; language: string | null }[] }
  /** The review gate refused a delivery (docs/cuccut/m2-review-gate.md §2.2): open the video's review, to fix or let a finding stand. */
  | { kind: 'open-review' };

export interface ExportProblem {
  code: string | null;
  title: string;
  /** The Runtime's own wording. */
  message: string;
  /** Itemized: content that cannot be drawn, assets that cannot be read, files that were not saved, ... */
  items: string[];
  /** The Runtime's remedy note (verbatim). */
  hint: string | null;
  remedy: ExportRemedy | null;
}

interface ErrorLike {
  message?: string;
  code?: string;
  details?: unknown;
}

const record = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});
const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);
const list = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.map(record) : []);

/** For a submission-time RPC error, the rejection code is in `details.code`; for a failed job, the code is in `error.code`. */
export function exportErrorCode(error: unknown): string | null {
  const e = record(error);
  return text(record(e.details).code) ?? (typeof e.code === 'string' && /^[A-Z_]+$/.test(e.code) ? e.code : null);
}

const PORTABLE_REASON: Record<string, string> = live(() => M.portableReason);

const TITLES: Record<string, string> = live(() => M.titles);

/** The resource-admission dimension that is missing (architecture design §7.7, the Runtime's `ResourceDimension`). */
const RESOURCE_LABEL: Record<string, string> = live(() => M.resources);

export interface ExplainContext {
  kind: ExportKind;
  /** Whether it was rejected at submission (no job created yet) or the job failed. */
  stage: 'rejected' | 'failed';
  documents?: Record<Id, DocumentRecord>;
}

export function explainExportError(error: ErrorLike | unknown, ctx: ExplainContext): ExportProblem {
  const e = record(error);
  const details = record(e.details);
  const code = exportErrorCode(error);
  const message = localizeText(text(e.message), refIn(e.messageRef)) ?? '';
  // The Runtime's remedy note (`remedyRef`) and the engine's (`recoveryRef`) carry references and are shown in the current language.
  const hint = remedyText(details) ?? text(localizeText(text(details.recovery), refIn(details.recoveryRef)));
  // When a job fails (TaskFailure), each file that was not saved is listed individually in `details.failed`.
  const failed = list(details.failed).map((f) => {
    const problems = Array.isArray(f.problems) ? (f.problems as unknown[]).filter((p) => typeof p === 'string').join(M.problemSeparator) : '';
    const fileName = text(f.fileName);
    return fileName && problems ? M.fileProblems(fileName, problems) : (fileName ?? problems);
  });
  const docName = (id: unknown) => (typeof id === 'string' ? (ctx.documents?.[id]?.name ?? id) : '');
  const base: ExportProblem = {
    code,
    title: (code && TITLES[code]) ?? (ctx.stage === 'rejected' ? M.notStarted : M.failed),
    message,
    items: failed,
    hint,
    remedy: null,
  };
  switch (code) {
    case 'EXPORT_UNSUPPORTED_CONTENT':
      return {
        ...base,
        items: list(details.items).map((i) => text(i.message) ?? String(i.itemId ?? '')),
        remedy: ctx.kind === 'video' ? { kind: 'skip-unsupported' } : null,
      };
    case 'EXPORT_TOOL_MISSING':
      return { ...base, items: text(details.missing) ? [M.missingTool(details.missing as string)] : [] };
    case 'ASSET_MISSING': {
      const items = list(details.items);
      if (items.length) {
        return {
          ...base,
          items: items.map((i) => {
            const reason = typeof i.reason === 'string' ? (PORTABLE_REASON[i.reason] ?? i.reason) : '';
            return [text(i.name) ?? text(i.path) ?? String(i.assetId ?? ''), reason].filter(Boolean).join(' · ');
          }),
          remedy: ctx.kind === 'portable' ? { kind: 'skip-missing-assets' } : null,
        };
      }
      return { ...base, items: text(details.path) ? [details.path as string] : [], hint: hint ?? M.assetMissingHint };
    }
    case 'ASSET_CHANGED':
      return { ...base, items: text(details.path) ? [details.path as string] : [], hint: hint ?? M.assetChangedHint };
    case 'EXPORT_SOURCE_AMBIGUOUS': {
      const candidates = list(details.candidates).map((c) => ({
        documentId: String(c.documentId ?? ''),
        name: text(c.name) ?? String(c.documentId ?? ''),
        language: text(c.language),
      }));
      return {
        ...base,
        items: candidates.map((c) => (c.language ? `${c.name} · ${c.language}` : c.name)),
        remedy: candidates.length ? { kind: 'choose-document', candidates } : null,
      };
    }
    case 'EXPORT_NOTHING_TO_EXPORT': {
      const range = record(details.range);
      const items =
        typeof range.start === 'number' && typeof range.end === 'number' ? [`${formatRangeTime(range.start)}–${formatRangeTime(range.end)}`] : [];
      return { ...base, items, hint: hint ?? M.nothingHint };
    }
    case 'EXPORT_PACKAGE_LOCAL_PATH':
      return { ...base, items: list(details.items).map((i) => docName(i.documentId)) };
    case 'EXPORT_PACKAGE_UNSUPPORTED':
      return { ...base, items: list(details.items).map((i) => [text(i.path), text(i.reason)].filter(Boolean).join(' · ')) };
    case 'EXPORT_INSUFFICIENT_SPACE': {
      const items =
        typeof details.required === 'number' && typeof details.available === 'number'
          ? [M.space(fmtSize(details.required), fmtSize(details.available))]
          : text(details.dir)
            ? [details.dir as string]
            : [];
      return { ...base, items, remedy: { kind: 'pick-dir' } };
    }
    case 'EXPORT_DESTINATION_EXISTS':
    case 'EXPORT_DESTINATION_UNWRITABLE':
      return { ...base, items: text(details.path) ? [details.path as string] : failed, remedy: { kind: 'pick-dir' } };
    case 'EXPORT_PUBLISH_FAILED':
      return { ...base, remedy: { kind: 'pick-dir' } };
    case 'REVIEW_BLOCKED': {
      // One item per open critical finding, "<said>. <fix>" in the reader's words; the limit is structured, so the UI phrases it.
      const items = list(details.findings).flatMap((f) => {
        if (typeof f.metric !== 'string' || (typeof f.value !== 'number' && typeof f.value !== 'boolean')) return text(f.id) ? [f.id as string] : [];
        const { said } = findingLine({ metric: f.metric, value: f.value, limit: record(f.limit) });
        return [M.reviewItem(said, text(f.fix) ?? '')];
      });
      // The Runtime's sentence ("…: 2 findings stop this export") only repeats the title when the findings are listed.
      return { ...base, ...(items.length ? { message: '' } : {}), items, hint: M.reviewHint, remedy: { kind: 'open-review' } };
    }
    case 'RESOURCE_ADMISSION_UNSATISFIABLE': {
      const dims = Array.isArray(details.dimensions) ? (details.dimensions as unknown[]).filter((d): d is string => typeof d === 'string') : [];
      return { ...base, items: dims.map((d) => M.notEnough(RESOURCE_LABEL[d] ?? d)), hint: hint ?? M.resourceHint };
    }
    default:
      return base;
  }
}
