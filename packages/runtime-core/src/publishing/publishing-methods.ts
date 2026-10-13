import path from 'node:path';
import type { RpcMethod, RpcParams, RpcResult } from '@cuccut/protocol';
import type { TrustedPrincipal } from '../gateway.ts';
import type { MediaRegistry } from '../media.ts';
import type { PublishingActor, PublishingService } from './publishing-service.ts';

/**
 * The `publishing.*` RPC methods (design `docs/cuccut/m2-publishing.md` §4.3): thin handlers over `PublishingService`, which the agent tools call too
 * (one gateway). The handler only turns the connection into an actor (§4.2); the service enforces what each actor may do, so the web allowlist is not
 * the only guard.
 */

type PublishingMethod = Extract<RpcMethod, `publishing.${string}`>;
type Handler<M extends RpcMethod> = (params: RpcParams<M>, principal: TrustedPrincipal) => RpcResult<M> | Promise<RpcResult<M>>;

/** The actor of an RPC caller: the desktop app is the owner, the browser is the owner at a distance, the CLI and agents are not the owner. */
export function publishingActor(principal: TrustedPrincipal): PublishingActor {
  const kind = principal.kind === 'desktop' ? 'human' : principal.kind === 'web' ? 'web' : principal.kind === 'cli' || principal.kind === 'local' ? 'cli' : 'agent';
  return { kind, name: principal.name, submitter: { kind: 'connection', id: principal.connectionId } };
}

export interface PublishingMethodDeps {
  publishing: PublishingService;
  /** Read handles for pinned exports (the web service swaps in its own same-origin media channel). */
  media: Pick<MediaRegistry, 'issue'>;
}

export function publishingMethods({ publishing, media }: PublishingMethodDeps): { [M in PublishingMethod]: Handler<M> } {
  const actor = publishingActor;
  return {
    'publishing.get': (p) => publishing.get(p.publicationId),
    'publishing.calendar': (p) => publishing.calendar(p),
    'publishing.prepare': async (p, principal) => ({ publications: await publishing.prepare(p, actor(principal)) }),
    'publishing.update': (p, principal) => publishing.update(p, actor(principal)),
    'publishing.reschedule': (p, principal) => publishing.reschedule(p.publicationId, p.revision, p.placements, actor(principal)),
    'publishing.slots': (p, principal) => publishing.slots(p, actor(principal)),
    'publishing.pin': (p, principal) => publishing.pin(p.publicationId, p.revision, p.source, actor(principal)),
    'publishing.exports': (p) => ({ exports: publishing.pinnable(p.videoId) }),
    'publishing.approve': (p, principal) => publishing.approve(p.publicationId, p.revision, actor(principal)),
    'publishing.validate': (p) => ({ issues: publishing.validate(p.publicationId) }),
    'publishing.authorize': (p, principal) => publishing.authorize(p.publicationId, p.revision, actor(principal)),
    'publishing.send': (p, principal) => publishing.send(p.publicationId, p.revision, actor(principal)),
    'publishing.batch': async (p, principal) => ({ results: await publishing.batch(p.action, p.items, actor(principal)) }),
    'publishing.withdraw': (p, principal) => publishing.withdraw(p.publicationId, p.revision, p.destinationId, actor(principal)),
    'publishing.cancel': (p, principal) => publishing.cancel(p.publicationId, p.revision, p.destinationId, actor(principal)),
    'publishing.reconcile': (p, principal) => publishing.reconcile(p, actor(principal)),
    'publishing.archive': (p, principal) => publishing.archive(p.publicationId, p.revision, actor(principal)),
    'publishing.unarchive': (p, principal) => publishing.unarchive(p.publicationId, p.revision, actor(principal)),
    'publishing.cleanup': (_p, principal) => publishing.cleanup(actor(principal)),
    'publishing.copy.propose': (p, principal) => publishing.copy.propose(p.publicationId, p.instruction, actor(principal)),
    'publishing.copy.apply': (p, principal) => publishing.copy.apply(p.publicationId, p.revision, p.copy, actor(principal)),
    'publishing.openHandle': async (p) => {
      const { file } = publishing.exportFile(p.publicationId);
      return media.issue(path.dirname(file), path.basename(file));
    },
    'publishing.settings.save': (p, principal) => publishing.saveSettings(p.settings, actor(principal)),
    'publishing.connections.save': async (p, principal) => ({ connection: await publishing.saveConnection(p, actor(principal)) }),
    'publishing.connections.remove': (p, principal) => publishing.removeConnection(p.connectionId, actor(principal)),
    'publishing.accounts.save': async (p, principal) => ({ account: await publishing.saveAccount(p, actor(principal)) }),
    'publishing.accounts.remove': async (p, principal) => ({ account: await publishing.removeAccount(p.accountId, actor(principal)) }),
    'publishing.accounts.link': async (p, principal) => ({ account: await publishing.linkAccount(p.accountId, p.equivalentTo, actor(principal)) }),
    'publishing.transfer.export': (_p, principal) => publishing.transfer.export(actor(principal)),
    'publishing.transfer.preview': (p, principal) => publishing.transfer.preview(p.archive, actor(principal)),
    'publishing.transfer.apply': (p, principal) => publishing.transfer.apply(p.archive, actor(principal)),
  };
}
