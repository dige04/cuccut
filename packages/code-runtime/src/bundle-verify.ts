import {
  type CodeBundleCheck,
  type CodeBundleCheckId,
  type CodeBundleContract,
  type CodeBundleVerificationReport,
  type VerifiedCapabilities,
} from '@cuccut/protocol';
import { CodeBundleError, type InspectedBundle } from './bundle-inspect.ts';
import { CompositionHost, frameTicketAt, intrinsicMismatches, type CompositionSession, type RenderedFrame } from './composition-host.ts';

/**
 * Verification per code bundle spec §6.2 (first-phase subset): opens the bundle in an off-screen host, fetches frames at sampled times, and produces a `CodeBundleVerificationReport`.
 *
 * - `manifest` / `files` / `content-hash` / `network-static`: already checked by `inspectBundle` (static scanning may still leave references in non-strict mode).
 * - `timeline` / `root`: the contract is ready when the session opens. Mismatches in size, frame rate and manifest are also recorded on `root` (`COMPOSITION_INTRINSIC_MISMATCH`).
 * - `seek`: frame 0, a middle frame, the last frame, and a frame past the end. The out-of-range frame must be clamped to the duration.
 * - `determinism`: the middle frame is fetched again after other frames have been fetched out of order. The PNG digests must match. When the first frame and the middle frame are the same, this is only noted and does not fail.
 * - `alpha`: when transparency is declared, it fails only if none of the sampled frames has a transparent pixel.
 * - `network-runtime`: fails if any request was intercepted during the session.
 * - `duration`: the page duration differs from the manifest by no more than one frame.
 */

export interface VerifyBundleOptions {
  /** Covers the regular sampling times (in seconds). A sample past the end is always appended. */
  sampleSeconds?: number[];
  /** When transparency is declared, checks for transparent pixels (default true). */
  checkAlpha?: boolean;
}

const ORDER: CodeBundleCheckId[] = [
  'manifest',
  'files',
  'content-hash',
  'network-static',
  'timeline',
  'root',
  'duration',
  'seek',
  'determinism',
  'alpha',
  'network-runtime',
];

export async function verifyBundle(
  host: CompositionHost,
  bundle: InspectedBundle,
  options: VerifyBundleOptions = {},
): Promise<CodeBundleVerificationReport> {
  const { manifest } = bundle;
  const checks = new Map<CodeBundleCheckId, CodeBundleCheck>();
  const set = (check: CodeBundleCheck) => checks.set(check.id, check);
  const sampledFrames: Array<{ seconds: number; sha256: string }> = [];

  set({ id: 'manifest', status: 'passed', ...(bundle.synthesized ? { detail: 'synthesized from the entry root attributes' } : {}) });
  set({ id: 'files', status: 'passed', detail: `${bundle.entries.length} files, ${bundle.totalBytes} bytes` });
  set({ id: 'content-hash', status: 'passed' });
  set(
    bundle.networkReferences.length === 0
      ? { id: 'network-static', status: 'passed' }
      : {
          id: 'network-static',
          status: 'failed',
          code: 'BUNDLE_NETWORK_REFERENCE',
          detail: bundle.networkReferences.map((r) => `${r.path}:${r.line} ${r.text}`).join('\n'),
        },
  );

  const fps = manifest.intrinsic.fps;
  const frameSeconds = fps.den / fps.num;
  const durationSeconds = manifest.intrinsic.durationFrames * frameSeconds;
  let capabilities: VerifiedCapabilities | null = null;

  let session: CompositionSession | null = null;
  try {
    session = await host.open(bundle, { strictIntrinsic: false });
  } catch (error) {
    if (!(error instanceof CodeBundleError) || error.code === 'COMPOSITION_HOST_UNAVAILABLE') throw error;
    if (error.code === 'COMPOSITION_ROOT_MISSING') {
      set({ id: 'timeline', status: 'passed' });
      set({ id: 'root', status: 'failed', code: error.code, detail: error.message });
    } else {
      set({ id: 'timeline', status: 'failed', code: error.code, detail: error.message });
    }
  }

  if (session) {
    try {
      set({ id: 'timeline', status: 'passed' });
      const mismatches = intrinsicMismatches(bundle, session.page);
      const sizeMismatch = mismatches.filter((m) => m.field !== 'duration');
      set(
        sizeMismatch.length === 0
          ? { id: 'root', status: 'passed' }
          : { id: 'root', status: 'failed', code: 'COMPOSITION_INTRINSIC_MISMATCH', detail: JSON.stringify(sizeMismatch) },
      );
      const durationMismatch = mismatches.find((m) => m.field === 'duration');
      set(
        durationMismatch
          ? {
              id: 'duration',
              status: 'failed',
              code: 'COMPOSITION_INTRINSIC_MISMATCH',
              detail: `page ${String(durationMismatch.page)} s, manifest ${String(durationMismatch.manifest)} s`,
            }
          : { id: 'duration', status: 'passed' },
      );

      const midFrame = Math.floor(manifest.intrinsic.durationFrames / 2);
      const lastFrame = Math.max(0, manifest.intrinsic.durationFrames - 1);
      const regular = options.sampleSeconds ?? [0, midFrame * frameSeconds, lastFrame * frameSeconds];
      const pastEnd = durationSeconds + frameSeconds;
      const frames: Array<{ seconds: number; frame: RenderedFrame }> = [];
      const render = async (seconds: number) => {
        const frame = await session!.frame(frameTicketAt(bundle, { seconds }, { quality: 'export-exact' }));
        sampledFrames.push({ seconds, sha256: frame.receipt.sha256 });
        frames.push({ seconds, frame });
        return frame;
      };

      // seek: regular samples and the out-of-range frame.
      let seekOk = true;
      try {
        for (const seconds of regular) await render(seconds);
        const beyond = await render(pastEnd);
        if (!beyond.receipt.clampedToDuration) {
          seekOk = false;
          set({
            id: 'seek',
            status: 'failed',
            code: 'COMPOSITION_SEEK_MISMATCH',
            detail: `request at ${pastEnd} s was not clamped to the duration`,
          });
        } else {
          set({ id: 'seek', status: 'passed' });
        }
      } catch (error) {
        if (!(error instanceof CodeBundleError) || error.code === 'COMPOSITION_HOST_UNAVAILABLE') throw error;
        seekOk = false;
        set({ id: 'seek', status: 'failed', code: error.code, detail: error.message });
      }

      // determinism: the middle time is fetched again after other frames have been fetched.
      const midSeconds = regular.length > 1 ? regular[Math.floor(regular.length / 2)]! : (regular[0] ?? 0);
      const first = frames.find((f) => f.seconds === midSeconds);
      if (!seekOk || !first) {
        set({ id: 'determinism', status: 'skipped', detail: 'seek failed' });
      } else {
        try {
          const again = await render(midSeconds);
          const start = frames.find((f) => f.seconds === regular[0]);
          const staticNote =
            start && start.seconds !== midSeconds && start.frame.receipt.sha256 === first.frame.receipt.sha256
              ? `frames at ${start.seconds} s and ${midSeconds} s are identical; the animation may be static`
              : undefined;
          set(
            again.receipt.sha256 === first.frame.receipt.sha256
              ? { id: 'determinism', status: 'passed', ...(staticNote ? { detail: staticNote } : {}) }
              : {
                  id: 'determinism',
                  status: 'failed',
                  code: 'COMPOSITION_NONDETERMINISTIC',
                  detail: `two renders at ${midSeconds} s differ (${first.frame.receipt.sha256} vs ${again.receipt.sha256})`,
                },
          );
        } catch (error) {
          if (!(error instanceof CodeBundleError) || error.code === 'COMPOSITION_HOST_UNAVAILABLE') throw error;
          set({ id: 'determinism', status: 'failed', code: error.code, detail: error.message });
        }
      }

      // alpha: when transparency is declared, at least one frame must have transparent pixels.
      const measuredAlpha = frames.some((f) => f.frame.transparentPixels > 0 || f.frame.translucentPixels > 0);
      if (!manifest.output.alpha || options.checkAlpha === false) {
        set({ id: 'alpha', status: 'skipped', detail: manifest.output.alpha ? 'disabled' : 'the bundle declares an opaque output' });
      } else if (frames.length === 0) {
        set({ id: 'alpha', status: 'skipped', detail: 'no frame was rendered' });
      } else {
        set(
          measuredAlpha
            ? { id: 'alpha', status: 'passed' }
            : { id: 'alpha', status: 'failed', detail: 'the bundle declares alpha but every sampled frame is fully opaque' },
        );
      }

      const blocked = session.blockedRequests;
      set(
        blocked.length === 0
          ? { id: 'network-runtime', status: 'passed' }
          : { id: 'network-runtime', status: 'failed', code: 'COMPOSITION_NETWORK_BLOCKED', detail: blocked.join('\n') },
      );

      const determinism = checks.get('determinism');
      capabilities = {
        // inspectBundle already guarantees the browser engine and a known contract.
        contract: (manifest.runtime as { contract: string }).contract as CodeBundleContract,
        randomAccess: determinism?.status === 'passed',
        alpha: manifest.output.alpha && measuredAlpha,
        audio: 'none',
        width: manifest.intrinsic.width,
        height: manifest.intrinsic.height,
        fps: manifest.intrinsic.fps,
        durationFrames: manifest.intrinsic.durationFrames,
        host: 'electron-offscreen',
        networkIsolated: true,
      };
    } finally {
      await session.dispose().catch(() => {});
    }
  }

  const ordered = ORDER.map((id) => checks.get(id) ?? { id, status: 'skipped' as const, detail: 'not reached' });
  return {
    format: 'cuccut.code-bundle-verification',
    schemaVersion: 1,
    bundleId: manifest.bundleId,
    revision: manifest.revision,
    contentHash: manifest.contentHash,
    verifiedAt: new Date().toISOString(),
    status: ordered.every((c) => c.status !== 'failed') ? 'passed' : 'failed',
    capabilities,
    checks: ordered,
    sampledFrames,
  };
}
