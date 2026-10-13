import type { RpcHandlers } from '../handlers.ts';
import type { SkillCatalog } from './skill-catalog.ts';
import type { SkillInstaller } from './skill-installer.ts';

type SkillMethod =
  'skills.list' | 'skills.get' | 'skills.readFile' | 'skills.setEnabled' | 'skills.add' | 'skills.importGithub' | 'skills.remove';

/**
 * `skills.*` (architecture design §3.8, §12.9), merged into the method table by `handlers.ts`. Viewing and toggling are open to all clients; add, import and remove are not in the Web service's allowlist (`WEB_DEFAULT_METHODS`), and are rejected with `WEB_METHOD_NOT_ALLOWED` on the Web gateway when called from a browser. Sending a picked skill is in `templateMethods`.
 */
export function skillMethods(deps: { skills: SkillCatalog; installer: SkillInstaller }): Pick<RpcHandlers['methods'], SkillMethod> {
  const { skills, installer } = deps;
  return {
    'skills.list': () => skills.list(),
    'skills.get': (p) => skills.get(p.id),
    'skills.readFile': (p) => skills.readFile(p.id, p.path),
    'skills.setEnabled': (p) => skills.setEnabled(p.id, p.enabled),
    'skills.add': (p) => installer.add(p),
    'skills.importGithub': (p) => installer.importGithub(p),
    'skills.remove': (p) => installer.remove(p.id),
  };
}
