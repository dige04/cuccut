import { mediaKindOf, urlValid } from '../../model/new-flow.ts';
import { LANDING_COPY } from './landing-copy.ts';

/**
 * The source as the card sends it: trimmed, and a bare web address (`youtube.com/watch?v=…`, `youtu.be/…`) gets
 * `https://` in front so it reads as the link it is. A bare file name (`clip.mp4`, `notes.txt`) stays a path.
 */
export function normalizeClipSource(value: string): string {
  const source = value.trim();
  if (!source || urlValid(source)) return source;
  // A host followed by a path (`youtu.be/…`) or starting with `www.`; a lone `notes.txt` is a file name, not a site.
  const head = source.split(/[/?#]/)[0]!;
  const domainLike = /^(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?$/i.test(head) && mediaKindOf(head) !== 'video';
  const rest = source.slice(head.length);
  return domainLike && (/^[/?#]./.test(rest) || /^www\./i.test(head)) ? `https://${source}` : source;
}

/** A source the clip card accepts: a web link the download tool can fetch, or a video file on this computer. */
export function clipSourceError(value: string): string | null {
  const source = normalizeClipSource(value);
  if (!source) return LANDING_COPY.clips.empty;
  if (urlValid(source)) return null;
  return mediaKindOf(source) === 'video' ? null : LANDING_COPY.clips.notVideo;
}
