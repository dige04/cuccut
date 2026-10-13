import type { RpcHandlers } from '../handlers.ts';
import type { PackExporter } from './pack-export.ts';
import type { PackInstaller } from './pack-installer.ts';
import type { PackRegistry } from './pack-registry.ts';
import type { PackStyle } from './pack-style.ts';

type PackMethod =
  | 'packs.list'
  | 'packs.get'
  | 'packs.inspect'
  | 'packs.install'
  | 'packs.remove'
  | 'packs.restore'
  | 'packs.active'
  | 'packs.choose'
  | 'packs.setStyle'
  | 'packs.export';

/**
 * `packs.*` (pack spec §8), merged into the method table by `handlers.ts`. Listing, the pack page, the active style guide and a project's choice are open to every client;
 * inspect, install, remove, restore, export and editing the guide write to the Runtime Home from arbitrary folders or the network, or decide what every later agent reads, so like
 * `skills.add` they are not on the Web allowlist (`WEB_DEFAULT_METHODS`). Results that change the list return the full list; there is no topic.
 */
export function packMethods(deps: {
  registry: PackRegistry;
  installer: PackInstaller;
  style: PackStyle;
  exporter: PackExporter;
}): Pick<RpcHandlers['methods'], PackMethod> {
  const { registry, installer, style, exporter } = deps;
  return {
    'packs.list': () => registry.list(),
    'packs.get': (p) => registry.detail(p.id),
    'packs.inspect': (p) => installer.inspect(p),
    'packs.install': (p) => installer.install(p),
    'packs.remove': (p) => installer.remove(p.id),
    'packs.restore': (p) => installer.restore(p.trashId),
    'packs.active': (p) => style.active(p),
    'packs.choose': (p) => style.choose(p.projectId, p.pack),
    'packs.setStyle': (p) => style.setStyle(p),
    'packs.export': (p) => exporter.export(p),
  };
}
