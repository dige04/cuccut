import { RpcError } from '@cuccut/protocol';
import { RcProfile } from '@cuccut/protocol/messages/runtime-core';
import type { RpcHandlers } from '../handlers.ts';
import type { ProfileService } from './profile-service.ts';

type ProfileMethod =
  | 'profile.get'
  | 'profile.getProject'
  | 'profile.saveAnswers'
  | 'profile.skipInterview'
  | 'profile.reopenInterview'
  | 'profile.dismissReminder'
  | 'profile.setPreferences'
  | 'profile.putRule'
  | 'profile.removeRule'
  | 'profile.reorderRules';

/**
 * `profile.*` (docs/cuccut/m2-profile-rules.md §4), merged into the method table by `handlers.ts`. Reading is open to the browser; every write is
 * desktop and CLI only (not in `WEB_DEFAULT_METHODS`).
 */
export function profileMethods(deps: { profile: ProfileService }): Pick<RpcHandlers['methods'], ProfileMethod> {
  const { profile } = deps;
  return {
    'profile.get': () => profile.snapshot(),
    'profile.getProject': (p) => profile.project(p.projectId),
    'profile.saveAnswers': (p) => profile.saveAnswers(p.answers),
    'profile.skipInterview': () => profile.skip(),
    'profile.reopenInterview': () => profile.reopen(),
    'profile.dismissReminder': () => profile.dismissReminder(),
    'profile.setPreferences': (p) => {
      if (p.projectId === undefined) {
        return profile.setPreferences({ ...(p.own !== undefined ? { own: p.own } : {}), ...(p.interview !== undefined ? { interview: p.interview } : {}) });
      }
      if (p.interview !== undefined) throw new RpcError('invalid-request', RcProfile.projectTextOnly(), { code: 'PROFILE_PROJECT_TEXT_ONLY' });
      return p.own === undefined ? profile.project(p.projectId) : profile.setProjectPreferences(p.projectId, p.own);
    },
    'profile.putRule': (p) => profile.putRule(p.rule, p.projectId),
    'profile.removeRule': (p) => profile.removeRule(p.id, p.projectId),
    'profile.reorderRules': (p) => profile.reorderRules(p.ids, p.projectId),
  };
}
