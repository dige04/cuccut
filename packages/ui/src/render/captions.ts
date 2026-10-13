import { isObject, num } from './text-style.ts';

/**
 * Body of the caption document (`cuccut.caption/1`): times are folded into seconds on the document clock. The timeline and the caption panel read it; captions are drawn in the render kernel (`crates/frame-render` via `crates/subtitle-render`).
 */

export interface CaptionCue {
  id: string;
  /** Seconds on the document clock. */
  start: number;
  end: number;
  text: string;
}

export interface CaptionTrack {
  clock: 'source-asset' | 'sequence';
  cues: CaptionCue[];
}

const tracks = new WeakMap<object, CaptionTrack | null>();

/** Reads the body of the caption document; returns null when it is not `cuccut.caption/1`. The same body is parsed only once. */
export function readCaptions(body: unknown): CaptionTrack | null {
  if (!isObject(body)) return null;
  const cached = tracks.get(body);
  if (cached !== undefined) return cached;
  let track: CaptionTrack | null = null;
  if (body.schema === 'cuccut.caption/1' && Array.isArray(body.cues)) {
    const timescale = num(body.timescale, 1_000_000) || 1_000_000;
    const cues = body.cues.filter(isObject).map((cue, index) => {
      const start = num(cue.start, 0) / timescale;
      return {
        id: typeof cue.id === 'string' ? cue.id : `cue-${index}`,
        start,
        end: Math.max(start, num(cue.end, num(cue.start, 0)) / timescale),
        text: typeof cue.text === 'string' ? cue.text : '',
      };
    });
    track = { clock: body.clock === 'sequence' ? 'sequence' : 'source-asset', cues };
  }
  tracks.set(body, track);
  return track;
}
