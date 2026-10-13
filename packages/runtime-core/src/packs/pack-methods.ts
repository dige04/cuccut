import type { RpcHandlers } from '../handlers.ts';
import type { PackInstaller } from './pack-installer.ts';
import type { PackRegistry } from './pack-registry.ts';

type PackMethod = 'packs.list' | 'packs.get' | 'packs.inspect' | 'packs.install' | 'packs.remove' | 'packs.restore';

/**
 * `packs.*` (pack spec §8), merged into the method table by `handlers.ts`. Listing and the pack page are open to every client; inspect, install, remove and restore write to
 * the Runtime Home from arbitrary folders or the network, so like `skills.add` they are not on the Web allowlist (`WEB_DEFAULT_METHODS`). Results that change the list
 * return the full list; there is no topic.
 */
export function packMethods(deps: { registry: PackRegistry; installer: PackInstaller }): Pick<RpcHandlers['methods'], PackMethod> {
  const { registry, installer } = deps;
  return {
    'packs.list': () => registry.list(),
    'packs.get': (p) => registry.detail(p.id),
    'packs.inspect': (p) => installer.inspect(p),
    'packs.install': (p) => installer.install(p),
    'packs.remove': (p) => installer.remove(p.id),
    'packs.restore': (p) => installer.restore(p.trashId),
  };
}
