import { useRef, useState } from 'react';
import type { Id, ProfileRule } from '@cuccut/protocol';
import { moveRule, ruleInputOf } from '../../model/profile.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { putRule, removeRule, reorderRules } from '../../runtime/profile-commands.ts';
import { errorText, undoToast } from './profile-parts.tsx';
import { RULES_COPY } from './rules-copy.ts';

/**
 * The changes a list of rules offers on each row, at the workspace level or in one project (`projectId`): move one place, switch on or off, and
 * delete with Undo (the same rule put back at the same order). One change runs at a time; a failure is kept in `error` for an `ErrorLine` under
 * the list, which takes focus.
 */
export function useRuleActions(rules: readonly ProfileRule[], projectId?: Id) {
  const runtime = useRuntime();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  const run = async (key: string, change: () => Promise<void>, failed: (message: string) => string) => {
    setBusy(key);
    setError(null);
    try {
      await change();
    } catch (err) {
      setError(failed(errorText(err)));
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      setBusy(null);
    }
  };

  return {
    /** The rule whose change is in flight, or `'order'` while the list is being reordered. */
    busy,
    error,
    errorRef,
    isBusy: (rule: ProfileRule) => busy === rule.id || busy === 'order',
    move(index: number, by: -1 | 1) {
      const ids = moveRule(
        rules.map((r) => r.id),
        index,
        by,
      );
      if (!ids) return;
      void run('order', async () => void (await reorderRules(runtime, ids, projectId)), RULES_COPY.rule.moveFailed);
    },
    toggle(rule: ProfileRule, enabled: boolean) {
      void run(rule.id, async () => void (await putRule(runtime, ruleInputOf(rule, { enabled }), projectId)), RULES_COPY.rule.toggleFailed);
    },
    remove(rule: ProfileRule) {
      void run(
        rule.id,
        async () => {
          const { undo } = await removeRule(runtime, rule.id, projectId);
          undoToast(RULES_COPY.rule.deleted(rule.name), undo);
        },
        RULES_COPY.rule.removeFailed,
      );
    },
  };
}
