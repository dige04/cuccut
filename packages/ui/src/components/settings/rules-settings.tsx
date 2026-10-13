import { useEffect, useMemo, useState } from 'react';
import type { ProfileRule } from '@cuccut/protocol';
import { Plus } from 'lucide-react';
import { SectionHeader } from '../../cc/components/page-chrome.tsx';
import { Button } from '../../cc/ui/button.tsx';
import type { RuleTemplateOption } from '../../model/profile.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { putRule } from '../../runtime/profile-commands.ts';
import { loadTemplates } from '../../runtime/template-commands.ts';
import { useConnection } from '../../state/connection-store.ts';
import { useProfile } from '../../state/profile-store.ts';
import { useTemplateCatalog } from '../../state/template-catalog-store.ts';
import { EmptyCard, ErrorLine, LockNote, ProfileSkeleton, useProfileLock } from '../profile/profile-parts.tsx';
import { RuleForm } from '../profile/rule-form.tsx';
import { RuleRow } from '../profile/rule-row.tsx';
import { RULES_COPY } from '../profile/rules-copy.ts';
import { useRuleActions } from '../profile/use-rule-actions.ts';

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
  const rules = snapshot?.rules ?? [];
  const actions = useRuleActions(rules);

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

  const create = (
    <Button type="button" size="sm" disabled={!!lock} title={lock ?? undefined} onClick={() => setEditing({ rule: null })}>
      <Plus aria-hidden />
      {C().create}
    </Button>
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
                  busy={actions.isBusy(rule)}
                  onMove={(by) => actions.move(index, by)}
                  onToggle={(enabled) => actions.toggle(rule, enabled)}
                  onEdit={() => setEditing({ rule })}
                  onDelete={() => actions.remove(rule)}
                />
              ))}
            </ol>
            <p className="m-0 max-w-prose text-xs text-muted-foreground">{C().footnote}</p>
          </>
        )}
        <ErrorLine ref={actions.errorRef}>{actions.error}</ErrorLine>
      </div>
    </>
  );
}
