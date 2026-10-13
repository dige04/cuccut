import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { Project, ProfileRule } from '@cuccut/protocol';
import { ToastQueue } from '@react-spectrum/s2';
import { Loader2, Plus, XIcon } from 'lucide-react';
import { cn } from 'cn';
import { Badge } from '../../cc/ui/badge.tsx';
import { Button } from '../../cc/ui/button.tsx';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../cc/ui/dialog.tsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../cc/ui/tabs.tsx';
import { Textarea } from '../../cc/ui/textarea.tsx';
import { ruleEffects, stageLabel, type RuleTemplateOption } from '../../model/profile.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { loadProjectProfile, putRule, setProjectPreferences } from '../../runtime/profile-commands.ts';
import { useConnection } from '../../state/connection-store.ts';
import { useProfile } from '../../state/profile-store.ts';
import { useShell, type Route } from '../../state/shell-store.ts';
import { PANEL } from '../settings/settings-ui.tsx';
import { useRuleTemplates } from '../settings/rules-settings.tsx';
import { PROFILE_COPY } from './profile-copy.ts';
import { EmptyCard, ErrorLine, LockNote, ProfileSkeleton, errorText, useDraft, useProfileLock } from './profile-parts.tsx';
import { RuleForm } from './rule-form.tsx';
import { RuleEffectList, RuleRow } from './rule-row.tsx';
import { RULES_COPY } from './rules-copy.ts';
import { useRuleActions } from './use-rule-actions.ts';

const C = () => PROFILE_COPY.project;

/**
 * A project's "Rules and preferences" (docs/cuccut/m2-profile-rules.md §2.6, agentcut `rules-panel.tsx` in the editor's Video menu): the rules and
 * the preferences that apply only in this project, on top of the ones for every project, which are shown here read-only with a way to where they
 * are edited. Opened from the project's menu in the sessions list and from a project session's menu. A dialog (20px), so no glass inside it.
 */
export function ProjectProfileDialog({ project, onClose }: { project: Pick<Project, 'id' | 'name'>; onClose(): void }) {
  /** Leaving for the settings page where the general level is edited: close first, so the dialog does not sit over it. */
  const goTo = (route: Route) => {
    onClose();
    useShell.getState().go(route);
  };
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent
        data-cc=""
        showCloseButton={false}
        className="flex w-[min(38rem,calc(100%-2rem))] flex-col gap-4 sm:max-w-[min(38rem,calc(100%-2rem))]">
        <div className="flex items-start gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <DialogTitle>{C().title}</DialogTitle>
            <DialogDescription className="[overflow-wrap:anywhere]">{C().subtitle(project.name)}</DialogDescription>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" className="-me-2 -mt-1" aria-label={C().close} title={C().close} onClick={onClose}>
            <XIcon aria-hidden />
          </Button>
        </div>
        <ProjectProfileBody projectId={project.id} goTo={goTo} />
        <p className="m-0 text-xs text-muted-foreground">{C().note}</p>
      </DialogContent>
    </Dialog>
  );
}

function ProjectProfileBody({ projectId, goTo }: { projectId: string; goTo(route: Route): void }) {
  const runtime = useRuntime();
  const connected = useConnection((s) => s.state.status === 'connected');
  const state = useProfile((s) => s.projects[projectId]);
  const snapshot = useProfile((s) => s.snapshot);
  const appLock = useProfileLock();
  const templates = useRuleTemplates();

  // Fetched each time the dialog opens (the project file is read from disk, and another program may have changed it); kept fresh by the topic.
  useEffect(() => {
    if (connected) void loadProjectProfile(runtime, projectId);
  }, [runtime, connected, projectId]);

  const profile = state?.profile ?? null;
  // Why nothing here can change: the app's reason (browser, newer workspace file, no Runtime), or this project's file is from a newer CucCut.
  const lock = appLock ?? (profile?.readOnly ? PROFILE_COPY.common.readOnly : null);
  if (!profile) {
    if (state?.status === 'failed') {
      return (
        <div className="flex flex-col items-start gap-2">
          <ErrorLine>{C().loadFailed(state.error ?? '')}</ErrorLine>
          <Button type="button" variant="outline" size="sm" disabled={!connected} onClick={() => void loadProjectProfile(runtime, projectId)}>
            {C().retry}
          </Button>
        </div>
      );
    }
    return <ProfileSkeleton label={C().loading} panels={1} />;
  }

  return (
    <Tabs defaultValue="rules" className="gap-4">
      <TabsList className="w-full">
        <TabsTrigger value="rules">{C().tabRules}</TabsTrigger>
        <TabsTrigger value="prefs">{C().tabPrefs}</TabsTrigger>
      </TabsList>
      {state?.status === 'failed' ? <ErrorLine>{C().loadFailed(state.error ?? '')}</ErrorLine> : null}
      <LockNote>{lock}</LockNote>
      <TabsContent value="rules" className="flex flex-col gap-5">
        <ProjectRules
          projectId={projectId}
          rules={profile.rules}
          workspaceRules={snapshot?.rules ?? []}
          templates={templates}
          lock={lock}
          goTo={goTo}
        />
      </TabsContent>
      <TabsContent value="prefs" className="flex flex-col gap-5">
        <ProjectPreferences
          projectId={projectId}
          text={profile.preferences}
          general={[snapshot?.preferences.interview ?? '', snapshot?.preferences.own ?? ''].filter((t) => t.trim()).join('\n\n')}
          lock={lock}
          goTo={goTo}
        />
      </TabsContent>
    </Tabs>
  );
}

/** A titled part of a tab, with a link on the right (to where the general level is edited) or an action. */
function Part({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 className="m-0 flex-1 text-sm font-medium text-foreground">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function ProjectRules({ projectId, rules, workspaceRules, templates, lock, goTo }: {
  projectId: string;
  rules: ProfileRule[];
  workspaceRules: ProfileRule[];
  templates: RuleTemplateOption[];
  lock: string | null;
  goTo(route: Route): void;
}) {
  const runtime = useRuntime();
  const [editing, setEditing] = useState<{ rule: ProfileRule | null } | null>(null);
  const actions = useRuleActions(rules, projectId);

  if (editing) {
    return (
      <RuleForm
        initial={editing.rule}
        templates={templates}
        lock={lock}
        projectLevel
        onSave={(rule, level) => putRule(runtime, rule, level === 'project' ? projectId : undefined)}
        onClose={() => setEditing(null)}
      />
    );
  }

  const create = (primary: boolean) => (
    <Button
      type="button"
      variant={primary ? 'default' : 'outline'}
      size={primary ? 'default' : 'sm'}
      disabled={!!lock}
      title={lock ?? undefined}
      onClick={() => setEditing({ rule: null })}>
      <Plus aria-hidden />
      {RULES_COPY.create}
    </Button>
  );

  return (
    <>
      <Part title={C().rulesTitle} aside={rules.length ? create(false) : undefined}>
        {rules.length ? (
          <ol aria-label={C().rulesTitle} className="m-0 flex list-none flex-col gap-2 p-0">
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
        ) : (
          // With no project rules yet, "Create a rule" is this tab's one tinted action.
          <EmptyCard title={RULES_COPY.empty.title} action={create(true)}>
            {C().rulesEmpty}
          </EmptyCard>
        )}
        <ErrorLine ref={actions.errorRef}>{actions.error}</ErrorLine>
      </Part>
      <Part title={C().everyTitle} aside={<SettingsLink onPress={() => goTo({ tab: 'settings', section: 'rules' })}>{C().toRules}</SettingsLink>}>
        {workspaceRules.length ? (
          <ul aria-label={C().everyTitle} className="m-0 flex list-none flex-col gap-2 p-0">
            {workspaceRules.map((rule) => (
              <WorkspaceRule key={rule.id} rule={rule} templates={templates} />
            ))}
          </ul>
        ) : (
          <p className="m-0 text-sm text-muted-foreground">{C().everyEmpty}</p>
        )}
      </Part>
    </>
  );
}

/** A rule for every project, read here (it is changed in Settings › Rules): name, badges, condition and what it does. */
function WorkspaceRule({ rule, templates }: { rule: ProfileRule; templates: readonly RuleTemplateOption[] }) {
  return (
    <li className={cn(PANEL, 'flex flex-col gap-1 px-4 py-3', !rule.enabled && 'opacity-70')}>
      <p className="m-0 flex flex-wrap items-center gap-2">
        <span className={cn('text-sm font-medium [overflow-wrap:anywhere]', rule.enabled ? 'text-foreground' : 'text-muted-foreground')}>{rule.name}</span>
        <Badge variant="outline">{PROFILE_COPY.badge.everyProject}</Badge>
        <Badge variant="secondary">{stageLabel(rule.stage)}</Badge>
        {rule.enabled ? null : <Badge variant="secondary">{RULES_COPY.rule.off}</Badge>}
      </p>
      <p className="m-0 text-sm [overflow-wrap:anywhere] text-muted-foreground">{RULES_COPY.rule.when(rule.when)}</p>
      <RuleEffectList effects={ruleEffects(rule, templates)} className="text-xs" />
    </li>
  );
}

function SettingsLink({ onPress, children }: { onPress(): void; children: ReactNode }) {
  return (
    <Button type="button" variant="link" size="sm" className="h-auto px-0" onClick={onPress}>
      {children}
    </Button>
  );
}

const sameText = (a: string, b: string) => a === b;

/** The project's own text, edited here; the general text shown above it read-only (Settings › You is where it changes). */
function ProjectPreferences({ projectId, text, general, lock, goTo }: {
  projectId: string;
  text: string;
  general: string;
  lock: string | null;
  goTo(route: Route): void;
}) {
  const runtime = useRuntime();
  const id = useId();
  const [draft, setDraft] = useDraft(text, sameText);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const dirty = draft !== text;

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!dirty || busy || lock) return;
    setBusy(true);
    setError(null);
    try {
      await setProjectPreferences(runtime, projectId, draft);
      ToastQueue.positive(C().saved, { timeout: 3000 });
    } catch (err) {
      setError(C().saveFailed(errorText(err)));
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Part title={C().general} aside={<SettingsLink onPress={() => goTo({ tab: 'settings', section: 'you' })}>{C().toYou}</SettingsLink>}>
        {general ? (
          // It scrolls, so it is focusable: a keyboard can read it to the end.
          <pre
            tabIndex={0}
            role="region"
            aria-label={C().general}
            className="m-0 max-h-40 overflow-auto rounded-xl bg-foreground/[0.04] p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            {general}
          </pre>
        ) : (
          <p className="m-0 text-sm text-muted-foreground">{C().generalEmpty}</p>
        )}
      </Part>
      <form className="flex flex-col gap-2.5" onSubmit={(event) => void save(event)}>
        <label htmlFor={`${id}-prefs`} className="text-sm font-medium text-foreground">
          {C().prefs}
        </label>
        <Textarea
          id={`${id}-prefs`}
          rows={6}
          className="font-mono text-xs leading-relaxed md:text-xs"
          value={draft}
          placeholder={C().prefsPlaceholder}
          disabled={!!lock}
          onChange={(event) => setDraft(event.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2">
          {/* The tab's one tinted action, and only while there is something to save. */}
          <Button
            type="submit"
            variant={dirty && !lock ? 'default' : 'secondary'}
            size="sm"
            disabled={!dirty || busy || !!lock}
            title={lock ?? (dirty ? undefined : PROFILE_COPY.own.unchanged)}>
            {busy ? <Loader2 aria-hidden className="motion-safe:animate-spin" /> : null}
            {C().save}
          </Button>
          {dirty ? (
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setDraft(text)}>
              {PROFILE_COPY.own.discard}
            </Button>
          ) : null}
        </div>
        <ErrorLine ref={errorRef}>{error}</ErrorLine>
      </form>
    </>
  );
}
