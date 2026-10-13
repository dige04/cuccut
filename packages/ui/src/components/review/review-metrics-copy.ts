import { defineMessages } from '@cuccut/protocol';
import { zhHans } from './review-metrics-copy.zh-Hans.ts';
import { zhHant } from './review-metrics-copy.zh-Hant.ts';
import { ja } from './review-metrics-copy.ja.ts';
import { ko } from './review-metrics-copy.ko.ts';
import { es } from './review-metrics-copy.es.ts';
import { fr } from './review-metrics-copy.fr.ts';
import { de } from './review-metrics-copy.de.ts';
import { nl } from './review-metrics-copy.nl.ts';
import { ptBR } from './review-metrics-copy.pt-BR.ts';
import { it } from './review-metrics-copy.it.ts';
import { ru } from './review-metrics-copy.ru.ts';
import { pl } from './review-metrics-copy.pl.ts';
import { tr } from './review-metrics-copy.tr.ts';
import { vi } from './review-metrics-copy.vi.ts';

/**
 * The review metric catalogue in people's words (docs/cuccut/m2-review-gate.md §3.2): one `label` (what a finding says,
 * "Placeholder boxes is 2") and one `what` (the hint under the measurement picker) per metric name. The Runtime's own
 * `what` stays English and agent-facing; a name missing here is shown as is.
 */
const en = {
  metrics: {
    'video.durationSec': { label: 'Length', what: 'How long the finished video runs.' },
    'video.shortSidePx': { label: 'Short side', what: 'The short side of the canvas, in pixels.' },
    'video.shots': { label: 'Shots', what: 'Video and image clips on the main track.' },
    'video.cutsPerMin': { label: 'Cuts per minute', what: 'How often the main track cuts to the next clip.' },
    'video.longestShotSec': { label: 'Longest shot', what: 'The longest clip on the main track.' },
    'video.longestBlankSec': { label: 'Longest blank', what: 'The longest stretch with nothing on screen at all.' },
    'captions.on': { label: 'Captions shown', what: 'Whether the video draws captions at all.' },
    'captions.wordsPerSec': { label: 'Caption words per second', what: 'How fast the captions ask to be read.' },
    'hook.present': { label: 'Hook', what: 'A hook line: the one the short was cut with, or text starting in the first 2 seconds.' },
    'hook.words': { label: 'Hook words', what: 'How many words the hook is.' },
    'text.offCanvas': { label: 'Text past the edge', what: 'Whether a text box runs past the left or right edge of the frame.' },
    'items.placeholders': { label: 'Placeholder boxes', what: 'Placeholder boxes still waiting for media.' },
    'transitions.count': { label: 'Transitions', what: 'Transitions between clips.' },
    'layers.max': { label: 'Extra layers', what: 'Picture tracks in use beyond the first; 0 is a single track.' },
    'export.durationSec': { label: 'Exported length', what: 'How long the exported file runs.' },
    'export.width': { label: 'Exported width', what: 'Width of the exported picture, in pixels.' },
    'export.height': { label: 'Exported height', what: 'Height of the exported picture, in pixels.' },
    'export.loudnessLufs': { label: 'Loudness', what: 'Loudness of the export after normalising; only read when it was normalised.' },
    'export.truePeakDb': { label: 'True peak', what: 'The loudest peak of the export after normalising; only read when it was normalised.' },
  },
};

export type ReviewMetricsMessages = typeof en;
export const REVIEW_METRICS_COPY = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/** The words for one metric, or null for a name this build has no copy for (shown as the name itself). */
export function metricCopy(name: string): { label: string; what: string } | null {
  return (REVIEW_METRICS_COPY.metrics as Record<string, { label: string; what: string } | undefined>)[name] ?? null;
}

/** What a finding calls a metric: its label, or the name itself. */
export function metricLabel(name: string): string {
  return metricCopy(name)?.label ?? name;
}
