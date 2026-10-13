import { RpcError } from '@cuccut/protocol';
import { detectCookieBrowsers } from '@cuccut/jobs';
import type { TrustedPrincipal } from '../gateway.ts';
import type { RpcHandlers } from '../handlers.ts';
import type { ExternalToolService } from './external-tool-service.ts';
import { RcExternalTools } from '@cuccut/protocol/messages/runtime-core';

type ExternalToolMethod =
  | 'externalTools.list'
  | 'externalTools.detect'
  | 'externalTools.install'
  | 'externalTools.update'
  | 'externalTools.setPath'
  | 'externalTools.remove'
  | 'externalTools.consent'
  | 'externalTools.cookieBrowsers';

/**
 * Handlers for `externalTools.*` (architecture design §12.9), merged into the method table by `handlers.ts`. They manage this machine (downloading and running third-party programs, running update commands on the user's behalf), so they are offered only to the UI and the CLI: the Web service allowlist has no `externalTools.*`, and public-facing services do not go through the gateway and the tool catalog has no install or update.
 */
export function externalToolMethods(tools: () => ExternalToolService): Pick<RpcHandlers['methods'], ExternalToolMethod> {
  const own = (principal: TrustedPrincipal) => {
    // A second check beyond the allowlist: neither the browser nor public-facing services may download, update, or specify an executable.
    if (principal.kind === 'service' || principal.kind === 'web') throw new RpcError('forbidden', RcExternalTools.manageOnlyInAppOrCli());
  };
  return {
    'externalTools.list': async () => ({ tools: await tools().list() }),
    'externalTools.detect': async (p) => ({ tools: await tools().detect(p.name) }),
    'externalTools.install': (p, principal) => {
      own(principal);
      return tools().install(p, { kind: 'connection', id: principal.connectionId });
    },
    'externalTools.update': (p, principal) => {
      own(principal);
      return tools().update(p, { kind: 'connection', id: principal.connectionId });
    },
    'externalTools.setPath': (p, principal) => {
      own(principal);
      return tools().setPath(p);
    },
    'externalTools.remove': (p, principal) => {
      own(principal);
      return tools().remove(p);
    },
    'externalTools.consent': (p, principal) => {
      own(principal);
      return tools().consent(p);
    },
    // Only checks whether each browser's cookie database exists and when it last changed; does not read the contents. Like importing from a link, it is given only to the UI and the CLI (not in the allowlist).
    'externalTools.cookieBrowsers': async () => ({ platform: process.platform, browsers: await detectCookieBrowsers() }),
  };
}
