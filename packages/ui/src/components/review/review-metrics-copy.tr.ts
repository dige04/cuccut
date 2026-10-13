import type { ReviewMetricsMessages } from './review-metrics-copy.ts';

export const tr: ReviewMetricsMessages = {
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
