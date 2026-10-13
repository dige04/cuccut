import path from 'node:path';
import { RpcError } from '@cuccut/protocol';
import type { TrustedPrincipal } from '../gateway.ts';
import type { RpcHandlers } from '../handlers.ts';
import type { MediaRegistry } from '../media.ts';
import type { ExportService } from '../exports/export-service.ts';
import type { FontService } from './font-service.ts';
import { RcFonts } from '@cuccut/protocol/messages/runtime-core';

type FontMethod =
  | 'fonts.resolve'
  | 'fonts.catalogue'
  | 'fonts.download'
  | 'fonts.downloaded'
  | 'fonts.remove'
  | 'fonts.clear'
  | 'fonts.sample'
  | 'fonts.usage';

/**
 * Handlers for `fonts.*` (architecture design §9.1), merged into the method table by `handlers.ts`. Downloading and deleting change this machine's font cache and are only for the UI and CLI. The Web service's allowlist does not include `fonts.*`, and it is blocked again here for browsers and external services (`fonts.resolve` only resolves for them, and does not download).
 */
export function fontMethods(
  fonts: () => FontService,
  media: MediaRegistry,
  exports: () => Pick<ExportService, 'fontCensus'>,
): Pick<RpcHandlers['methods'], FontMethod> {
  const own = (principal: TrustedPrincipal) => principal.kind !== 'service' && principal.kind !== 'web';
  const ownOnly = (principal: TrustedPrincipal) => {
    if (!own(principal)) throw new RpcError('forbidden', RcFonts.manageOnlyInAppOrCli());
  };
  return {
    // The engine picks the face, and this hands out a read handle for the file it lives in (scoped to that one file; the UI reads tables by range). The same applies to files in the download cache.
    'fonts.resolve': async (p, principal) => {
      const { faces, missing } = await fonts().resolve(p.faces, {
        download: (p.download ?? false) && own(principal),
        submitter: { kind: 'connection', id: principal.connectionId },
      });
      return {
        faces: await Promise.all(
          faces.map(async ({ path: file, ...face }) => ({ ...face, file: await media.issue(path.dirname(file), path.basename(file)) })),
        ),
        missing,
      };
    },
    'fonts.catalogue': (p) => fonts().catalogueList(p),
    'fonts.download': (p, principal) => {
      ownOnly(principal);
      return fonts().download(p, { kind: 'connection', id: principal.connectionId });
    },
    'fonts.downloaded': () => fonts().downloaded(),
    'fonts.remove': (p, principal) => {
      ownOnly(principal);
      return fonts().remove(p);
    },
    'fonts.clear': (_p, principal) => {
      ownOnly(principal);
      return fonts().clear();
    },
    // Sample rendering goes online, so like downloading it is only for the UI and CLI.
    'fonts.sample': (p, principal) => {
      ownOnly(principal);
      return fonts().sample(p);
    },
    // The census is typeset in the Render Worker (with the same frozen set as export); status and downloads are in the font service.
    'fonts.usage': async (p, principal) => {
      ownOnly(principal);
      const census = await exports().fontCensus({
        videoId: p.videoId,
        ...(p.sequenceId ? { sequenceId: p.sequenceId } : {}),
        ...(p.burnCaptions !== undefined ? { burnCaptions: p.burnCaptions } : {}),
      });
      return fonts().usage(census, { download: p.download ?? false, submitter: { kind: 'connection', id: principal.connectionId } });
    },
  };
}
