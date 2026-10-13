import type { FontFaceQuery, FontsResolveResult } from '@cuccut/protocol';

/** How often a face that is still downloading is asked about again. */
const POLL_MS = 1_500;
/** Maximum time to wait (after that, drawing falls back to the fallback font; it is requested again the next time the document is opened). */
const MAX_WAIT_MS = 10 * 60_000;

export interface DownloadWaitOptions {
  pollMs?: number;
  maxWaitMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

/** Faces that arrive first in a batch: ones already available locally, ones already downloaded, and ones that finished downloading while waiting. */
export type PartialFaces = (faces: FontsResolveResult['faces']) => void;

/**
 * On-demand downloaded fonts (architecture design §9.1): wraps `fonts.resolve`, asking with `download: true`. A face that is in the font catalog but not yet downloaded is started by the Runtime according to settings, and marked `downloading`. Here those faces are asked again after a while until the downloads finish (once downloaded they are available; if they fail or are cancelled, drawing falls back to the fallback font), and the combined results are handed to `runtimeFonts`. During this time the preview draws with the fallback font and does not report a missing font (this face is still being “fetched”).
 * When asking again, `download` is not passed: it only waits for downloads already started. A cancellation is not a failure and does not block automatic download; if `download` were passed, a just-cancelled download would be restarted by the next ask.
 * Faces in the same batch that arrive first (ones available locally, ones already downloaded, and ones that finish downloading while waiting) are handed out first through `onPartial`, without waiting for the slowest one in the batch.
 */
export function downloadingResolve(
  request: (params: { faces: FontFaceQuery[]; download: boolean }) => Promise<FontsResolveResult>,
  options: DownloadWaitOptions = {},
): (faces: FontFaceQuery[], onPartial?: PartialFaces) => Promise<FontsResolveResult> {
  const pollMs = options.pollMs ?? POLL_MS;
  const maxWaitMs = options.maxWaitMs ?? MAX_WAIT_MS;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  return async (faces, onPartial) => {
    const first = await request({ faces, download: true });
    const found = [...first.faces];
    let missing = first.missing.filter((m) => m.reason !== 'downloading');
    let waiting: FontFaceQuery[] = first.missing
      .filter((m) => m.reason === 'downloading')
      .map(({ family, weight, italic }) => ({ family, weight, italic }));
    if (waiting.length > 0 && first.faces.length > 0) onPartial?.(first.faces);
    for (let waited = 0; waiting.length > 0 && waited < maxWaitMs; waited += pollMs) {
      await sleep(pollMs);
      const again = await request({ faces: waiting, download: false });
      found.push(...again.faces);
      missing = [...missing, ...again.missing.filter((m) => m.reason !== 'downloading')];
      waiting = again.missing.filter((m) => m.reason === 'downloading').map(({ family, weight, italic }) => ({ family, weight, italic }));
      if (waiting.length > 0 && again.faces.length > 0) onPartial?.(again.faces);
    }
    return { faces: found, missing: [...missing, ...waiting.map((face) => ({ ...face, reason: 'downloading' as const }))] };
  };
}
