import { useEffect, useMemo, useRef, useState } from 'react';
import type { ProfileRule } from '@cuccut/protocol';
import { Plus } from 'lucide-react';
import { SectionHeader } from '../../cc/components/page-chrome.tsx';
import { Button } from '../../cc/ui/button.tsx';
import { moveRule, ruleInputOf, type RuleTemplateOption } from '../../model/profile.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { putRule, removeRule, reorderRules } from '../../runtime/profile-commands.ts';
import { loadTemplates } from '../../runtime/template-commands.ts';
import { useConnection } from '../../state/connection-store.ts';
import { useProfile } from '../../state/profile-store.ts';
import { useTemplateCatalog } from '../../state/template-catalog-store.ts';
import { EmptyCard, ErrorLine, LockNote, ProfileSkeleton, errorText, undoToast, useProfileLock } from '../profile/profile-parts.tsx';
import { RuleForm } from '../profile/rule-form.tsx';
import { RuleRow } from '../profile/rule-row.tsx';
import { RULES_COPY } from '../profile/rules-copy.ts';

const C = () => RULES_COPY;

/** The installed templates as the rule form offers them: id and title (the catalog is fetched once the Runtime is connected). */
export function useRuleTemplates(): RuleTemplateOption[] {
  const runtime = useRuntime();
  const connected = useConnection((s) => s.state.status === 'connected');
  const templates = useTemplateCatalog((s) => s.templates);
  useEffect(() => {
    if (connected) void loadTemplates(runtime);
  }, [runtime, connected]);
  return useMemo(() => templates.map((t) => ({ id: t.id, title: t.title })), [templates]);
}

/**
 * Settings › Rules (docs/cuccut/m2-profile-rules.md §2.2, agentcut `rules-settings-view.tsx`): the workspace rules in the order they are read,
 * each switched on or off, moved, edited or deleted (with Undo instead of a confirmation). Creating or editing one replaces the list with the
 * rule form, heading included.
 */
export function RulesSettings({ title }: { title: string }) {
  const runtime = useRuntime();
  const snapshot = useProfile((s) => s.snapshot);
  const lock = useProfileLock();
  const templates = useRuleTemplates();
  const [editing, setEditing] = useState<{ rule: ProfileRule | null } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  if (editing) {
    return (
      <RuleForm
        initial={editing.rule}
        templates={templates}
        lock={lock}
        onSave={(rule) => putRule(runtime, rule)}
        onClose={() => setEditing(null)}
      />
    );
  }

  const rules = snapshot?.rules ?? [];
  const create = (
    <Button type="button" disabled={!!lock} title={lock ?? undefined} onClick={() => setEditing({ rule: null })}>
      <Plus aria-hidden />
      {C().create}
    </Button>
  );

  /** Runs one change to the list; a failure shows under the list and takes focus. */
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

  const move = (index: number, by: -1 | 1) => {
    const ids = moveRule(
      rules.map((r) => r.id),
      index,
      by,
    );
    if (!ids) return;
    void run('order', async () => void (await reorderRules(runtime, ids)), C().rule.moveFailed);
  };

  const toggle = (rule: ProfileRule, enabled: boolean) =>
    void run(rule.id, async () => void (await putRule(runtime, ruleInputOf(rule, { enabled }))), C().rule.toggleFailed);

  const remove = (rule: ProfileRule) =>
    void run(
      rule.id,
      async () => {
        const { undo } = await removeRule(runtime, rule.id);
        undoToast(C().rule.deleted(rule.name), undo);
      },
      C().rule.removeFailed,
    );

  return (
    <>
      <SectionHeader title={title} blurb={C().blurb} actions={rules.length ? create : undefined} />
      <div data-cc className="flex flex-col gap-3">
        {!snapshot ? (
          <ProfileSkeleton label={C().loading} panels={1} />
        ) : rules.length === 0 ? (
          <>
            <EmptyCard title={C().empty.title} action={create}>
              {C().empty.body}
            </EmptyCard>
            <LockNote>{lock}</LockNote>
          </>
        ) : (
          <>
            <LockNote>{lock}</LockNote>
            <ol aria-label={C().listLabel} className="m-0 flex list-none flex-col gap-2 p-0">
              {rules.map((rule, index) => (
                <RuleRow
                  key={rule.id}
                  rule={rule}
                  index={index}
                  count={rules.length}
                  templates={templates}
                  lock={lock}
                  busy={busy === rule.id || busy === 'order'}
                  onMove={(by) => move(index, by)}
                  onToggle={(enabled) => toggle(rule, enabled)}
                  onEdit={() => setEditing({ rule })}
                  onDelete={() => remove(rule)}
                />
              ))}
            </ol>
            <p className="m-0 max-w-prose text-xs text-muted-foreground">{C().footnote}</p>
          </>
        )}
        <ErrorLine ref={errorRef}>{error}</ErrorLine>
      </div>
    </>
  );
}
