import type { Id } from '@cuccut/protocol';
import { EDITOR_COPY as E } from './editor-copy.ts';
import type { StallReport, StallStep } from './preview-watch.ts';

/**
 * Preview loading and stalls (product design §5.1): what is drawn on the stage. Whether it is stuck is decided by the preview engine's stall diagnostics (`preview-watch.ts`, threshold `STALL_MS`);
 * here the diagnostic step is only turned into a one-line message for people (naming the asset, caption document or font family). Development details (element state, unexpected errors) stay in the dev log.
 */

/** Only show the spinner if loading still hasn't finished after this long (a video that opens quickly doesn't flash). */
export const SPINNER_DELAY_MS = 500;

/** Show at most 99% until conversion finishes: sitting at 100% reads like a freeze (design draft model-stage-load.js `MAX_PCT`). */
const MAX_PERCENT = 99;

/** Which kind of stall the hint describes (the same set of steps as design draft model-stage-load.js). */
export type StallTopic = 'engine' | 'video' | 'media' | 'prepare' | 'captions' | 'fonts' | 'paint';

export function stallTopic(step: StallStep): StallTopic {
  switch (step) {
    case 'planner-loading':
      return 'engine';
    case 'no-video':
    case 'video-error':
    case 'no-plan':
      return 'video';
    case 'media-pending':
      return 'media';
    case 'media-preparing':
      return 'prepare';
    case 'documents-pending':
      return 'captions';
    case 'fonts-loading':
      return 'fonts';
    case 'not-painted':
    case 'no-canvas':
      return 'paint';
  }
}

/** Look up a name by ID (the `name` of asset records and document records). */
export interface StallNames {
  asset(id: Id): string | undefined;
  document(id: Id): string | undefined;
}

/** The sentence for the step it is stuck at; when the named object's name can't be found, a generic phrase is used. */
export function stallDetail(report: Pick<StallReport, 'step' | 'media' | 'documents' | 'fonts'>, names: StallNames): string {
  const topic = stallTopic(report.step);
  if (topic === 'media' || topic === 'prepare') {
    const name = firstName(report.media.map((probe) => probe.assetId).filter((id): id is Id => Boolean(id)), names.asset);
    if (topic === 'prepare') return name ? E.stall.prepare(name) : E.stall.prepareUnnamed;
    return name ? E.stall.media(name) : E.stall.mediaUnnamed;
  }
  if (topic === 'captions') {
    const name = firstName(report.documents, names.document);
    return name ? E.stall.captions(name) : E.stall.captionsUnnamed;
  }
  if (topic === 'fonts') {
    const family = report.fonts.find((f) => f.trim());
    return family ? E.stall.fonts(family.trim()) : E.stall.paint;
  }
  return topic === 'engine' ? E.stall.engine : topic === 'video' ? E.stall.video : E.stall.paint;
}

/** Conversion progress (0–1) → displayed percentage: rounded down, capped at 99; null when progress is unknown (the progress bar is indeterminate). */
export function preparePercent(progress: number | null | undefined): number | null {
  if (typeof progress !== 'number' || !(progress >= 0)) return null;
  return Math.min(MAX_PERCENT, Math.floor(progress * 100));
}

/** How many seconds have been waited (`now` and `since` are on the same diagnostic clock). */
export function waitedSeconds(report: Pick<StallReport, 'since'>, now: number): number {
  return Math.max(0, Math.floor((now - report.since) / 1000));
}

function firstName(ids: readonly Id[], name: (id: Id) => string | undefined): string | null {
  for (const id of ids) {
    const found = name(id)?.trim();
    if (found) return found;
  }
  return null;
}
