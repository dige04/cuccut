import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { localizeText, RULE_STAGES, type ProfileRule, type ProfileRuleInput, type ProfileRulePutResult } from '@cuccut/protocol';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { cn } from 'cn';
import { Button } from '../../cc/ui/button.tsx';
import { Disclosure } from '../../cc/ui/disclosure.tsx';
import { Input } from '../../cc/ui/input.tsx';
import { Label } from '../../cc/ui/label.tsx';
import { Switch } from '../../cc/ui/switch.tsx';
import { Textarea } from '../../cc/ui/textarea.tsx';
import {
  newRuleId,
  ruleDraft,
  ruleDraftErrors,
  ruleEffects,
  ruleInputOfDraft,
  stageLabel,
  type RuleDraft,
  type RuleTemplateOption,
} from '../../model/profile.ts';
import { PANEL } from '../settings/settings-ui.tsx';
import { ErrorLine, LockNote, ProfileSelect, errorText } from './profile-parts.tsx';
import { RuleEffectList } from './rule-row.tsx';
import { RULES_COPY } from './rules-copy.ts';

const C = () => RULES_COPY.form;

/** Where a rule is saved: across projects, or only in the project the form was opened from. */
export type RuleLevel = 'workspace' | 'project';

/**
 * The rule form (docs/cuccut/m2-profile-rules.md §2.2, agentcut `rule-form.tsx`), shared by Settings › Rules and the project dialog: it replaces
 * the list while open. A review card says in sentences what the rule will do; the fields under it are the rule. "Save rule" is the view's one
 * tinted action and says why it is off. A save with warnings (a template that is not installed) stays open with the notes, as "Saved with notes".
 */
export function RuleForm({ initial, templates, lock, projectLevel = false, onSave, onClose }: {
  /** The rule to edit, or null for a new one. */
  initial: ProfileRule | null;
  templates: readonly RuleTemplateOption[];
  /** Why the profile can't be changed here (the form then only reads). */
  lock: string | null;
  /** Opened from a project: a new rule can be saved for that project only. */
  projectLevel?: boolean;
  onSave(rule: ProfileRuleInput, level: RuleLevel): Promise<ProfileRulePutResult>;
  onClose(): void;
}) {
  const id = useId();
  const isNew = initial === null;
  const [draft, setDraft] = useState<RuleDraft>(() => ruleDraft(initial));
  const [level, setLevel] = useState<RuleLevel>(projectLevel ? 'project' : 'workspace');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  // Once a new rule is stored, its level is fixed: saving again replaces it there instead of putting the same id in a second level.
  const [stored, setStored] = useState(false);
  // A new rule's id is made on the first save and kept, so saving again (after notes, or a lost reply) replaces it instead of adding a second.
  const ruleId = useRef<string | null>(initial?.id ?? null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const change = (patch: Partial<RuleDraft>) => {
    setSaved(false);
    setDraft((current) => ({ ...current, ...patch }));
  };

  const why = lock ?? ruleDraftErrors(draft);
  const effects = ruleEffects({ templateId: draft.templateId || null, instruction: draft.instruction }, templates);
  const installed = !draft.templateId || templates.some((t) => t.id === draft.templateId);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (why || busy) return;
    setBusy(true);
    setError(null);
    setNotes([]);
    try {
      ruleId.current ??= newRuleId(draft.name);
      const result = await onSave(ruleInputOfDraft(draft, ruleId.current), level);
      setStored(true);
      if (result.warnings.length) {
        setDraft(ruleDraft(result.rule));
        setNotes(result.warnings.map((w) => localizeText(w.message, w.messageRef)));
        setSaved(true);
        return;
      }
      onClose();
    } catch (err) {
      setError(errorText(err));
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      setBusy(false);
    }
  };

  const field = (name: string) => `${id}-${name}`;
  const showLevel = projectLevel && isNew && !stored;
  const whyId = field('why');

  return (
    <section data-cc aria-labelledby={field('title')} className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-col items-start gap-2">
        <Button type="button" variant="ghost" size="sm" className="-ms-2" disabled={busy} onClick={onClose}>
          <ArrowLeft aria-hidden />
          {C().back}
        </Button>
        <h2 id={field('title')} ref={titleRef} tabIndex={-1} className="m-0 text-2xl font-semibold tracking-[-0.02em] text-foreground outline-none">
          {isNew ? C().createTitle : C().editTitle}
        </h2>
        <p className="m-0 max-w-prose text-sm leading-relaxed text-muted-foreground">{C().lede}</p>
        <LockNote>{lock}</LockNote>
      </div>

      <ErrorLine ref={errorRef}>{error}</ErrorLine>
      {notes.length ? (
        <div role="status" className="flex flex-col gap-1.5 rounded-2xl px-4 py-3 text-sm ring-1 ring-foreground/15">
          <p className="m-0 font-medium text-foreground">{C().savedWithNotes}</p>
          {notes.map((note) => (
            <p key={note} className="m-0 text-muted-foreground">
              {note}
            </p>
          ))}
        </div>
      ) : null}

      <form className="flex min-w-0 flex-col gap-5" onSubmit={(event) => void save(event)}>
        <fieldset disabled={busy || !!lock} className="m-0 flex min-w-0 flex-col gap-5 border-0 p-0">
          <div className={cn(PANEL, 'flex flex-col gap-3 px-5 py-4')}>
            <h3 className="m-0 text-sm font-medium text-foreground">{C().review}</h3>
            <p className="m-0 text-sm [overflow-wrap:anywhere] text-foreground">
              <span className="font-medium">{C().whenLabel} </span>
              {draft.when.trim() || <span className="text-muted-foreground">{C().whenEmpty}</span>}
            </p>
            <RuleEffectList effects={effects} empty={C().noEffect} />
            <p className="m-0 text-sm text-muted-foreground">
              {[level === 'project' ? C().scopeProject : C().scopeAll, draft.enabled ? C().enabled : C().paused, C().existing].join(' ')}
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <FieldBlock id={field('when')} label={C().when}>
              <Textarea
                id={field('when')}
                rows={2}
                required
                value={draft.when}
                placeholder={C().whenPlaceholder}
                onChange={(event) => change({ when: event.target.value })}
              />
            </FieldBlock>
            <FieldBlock id={field('name')} label={C().name}>
              <Input
                id={field('name')}
                required
                value={draft.name}
                placeholder={C().namePlaceholder}
                onChange={(event) => change({ name: event.target.value })}
              />
            </FieldBlock>
            {/* Side by side only when there are two: alone, the stage field is as wide as the fields around it. */}
            <div className={cn('grid gap-4', showLevel && '@xl:grid-cols-2')}>
              <FieldBlock id={field('stage')} label={C().stage}>
                <ProfileSelect
                  id={field('stage')}
                  value={draft.stage}
                  disabled={busy || !!lock}
                  options={RULE_STAGES.map((stage) => ({ value: stage, label: stageLabel(stage) }))}
                  onChange={(stage) => change({ stage })}
                />
              </FieldBlock>
              {showLevel ? (
                <FieldBlock id={field('level')} label={C().level}>
                  <ProfileSelect<RuleLevel>
                    id={field('level')}
                    value={level}
                    disabled={busy || !!lock}
                    options={[
                      { value: 'project', label: C().levelProject },
                      { value: 'workspace', label: C().levelWorkspace },
                    ]}
                    onChange={setLevel}
                  />
                </FieldBlock>
              ) : null}
            </div>
            <FieldBlock id={field('instruction')} label={C().instruction} help={C().instructionHelp}>
              <Textarea
                id={field('instruction')}
                rows={3}
                value={draft.instruction}
                placeholder={C().instructionPlaceholder}
                aria-describedby={`${field('instruction')}-help`}
                onChange={(event) => change({ instruction: event.target.value })}
              />
            </FieldBlock>
            <FieldBlock id={field('template')} label={C().template}>
              <ProfileSelect
                id={field('template')}
                value={draft.templateId}
                disabled={busy || !!lock}
                options={[
                  { value: '', label: C().noTemplate },
                  ...(installed ? [] : [{ value: draft.templateId, label: C().notInstalled(draft.templateId) }]),
                  ...templates.map((template) => ({ value: template.id, label: template.title })),
                ]}
                onChange={(templateId) => change({ templateId })}
              />
            </FieldBlock>
            <Disclosure variant="plain" summary={C().more} summaryClassName="-ms-2" contentClassName="flex flex-col gap-4">
              <FieldBlock id={field('note')} label={C().note} help={C().noteHelp}>
                <Input
                  id={field('note')}
                  value={draft.note}
                  aria-describedby={`${field('note')}-help`}
                  onChange={(event) => change({ note: event.target.value })}
                />
              </FieldBlock>
              <FieldBlock id={field('order')} label={C().order}>
                <Input
                  id={field('order')}
                  type="number"
                  inputMode="numeric"
                  step={1}
                  className="max-w-40"
                  value={draft.order}
                  onChange={(event) => change({ order: event.target.value })}
                />
              </FieldBlock>
            </Disclosure>
            <Switch checked={draft.enabled} about={draft.name.trim() || undefined} label={C().enable} onCheckedChange={(enabled) => change({ enabled })} />
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={!!why || busy} aria-describedby={why ? whyId : undefined}>
            {busy ? <Loader2 aria-hidden className="motion-safe:animate-spin" /> : null}
            {saved ? C().saveChanges : C().save}
          </Button>
          <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>
            {saved ? C().done : C().cancel}
          </Button>
          {why ? (
            <span id={whyId} className="text-xs text-muted-foreground">
              {why}
            </span>
          ) : null}
        </div>
      </form>
    </section>
  );
}

/** A label over its control, with an optional line of help under it. */
function FieldBlock({ id, label, help, children }: { id: string; label: string; help?: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {help ? (
        <p id={`${id}-help`} className="m-0 text-xs text-muted-foreground">
          {help}
        </p>
      ) : null}
    </div>
  );
}
