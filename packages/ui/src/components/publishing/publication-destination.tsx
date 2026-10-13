'use client';

import { useId, useState } from 'react';
import { FORMAT_NETWORK, isEditableDelivery, type DestinationOptions, type PublicationPrivacy } from '@cuccut/protocol';
import { cn } from 'cn';
import { Button } from '../../cc/ui/button';
import { Checkbox } from '../../cc/ui/checkbox';
import { Disclosure } from '../../cc/ui/disclosure';
import { Input } from '../../cc/ui/input';
import { Textarea } from '../../cc/ui/textarea';
import { captionPreview, hasOwnText, type DraftDestination, type DraftOverrides } from '../../model/publication-form.ts';
import { formatsOf } from '../../model/publication-sections.ts';
import { formatLabel } from '../../model/publishing-labels.ts';
import type { PublicationFormApi } from './publication-form.tsx';
import { PublicationTimeField } from './publication-time-field.tsx';
import { PC } from './publishing-copy.ts';
import { PublishingSelect } from './publishing-select.tsx';

type Audience = '' | 'false' | 'true';

const TIKTOK_TOGGLES = ['branded', 'ownBrand', 'comments', 'duet', 'stitch'] as const;

/** Tags as typed ("launch, behind the scenes") to the list YouTube takes. */
function parseTags(text: string): string[] {
  return text
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

/**
 * One account's tab (design §2.4): format, its own title (YouTube), description and hashtags (empty fields fall back to the shared text, "Reset to
 * shared text" drops every override), "Audience, visibility and more" (own time, audience, tags, visibility, synthetic media, TikTok toggles) and
 * the composed caption with its count. A destination already sent keeps its content, and the reason shows.
 */
export function PublicationDestinationFields({ form, destination: d }: { form: PublicationFormApi; destination: DraftDestination }) {
  const id = useId();
  const { draft } = form;
  const account = form.accounts.find((a) => a.id === d.accountId);
  const network = account?.network ?? FORMAT_NETWORK[d.format];
  const block = !isEditableDelivery(d.state) ? PC.form.locked : form.readOnly ? PC.form.readOnly : null;
  const disabled = !!block;
  const preview = captionPreview(draft, d.accountId);
  const [tagsText, setTagsText] = useState(d.options.tags.join(', '));
  const shownTags = parseTags(tagsText).join(',') === d.options.tags.join(',') ? tagsText : d.options.tags.join(', ');
  const set = (patch: { format?: DraftDestination['format']; overrides?: Partial<DraftOverrides>; options?: Partial<DestinationOptions>; scheduledAt?: string | null }) =>
    form.dispatch({ type: 'setDestination', accountId: d.accountId, patch });
  const audience: Audience = d.options.madeForKids === null ? '' : d.options.madeForKids ? 'true' : 'false';
  const privacy: PublicationPrivacy[] = network === 'youtube' ? ['public', 'unlisted', 'private'] : ['public', 'private'];

  return (
    <section aria-label={account?.name} className="min-w-0 space-y-4">
      {account ? <p className="text-sm font-medium text-foreground">{account.name}</p> : null}
      <fieldset disabled={disabled} className="min-w-0 space-y-4">
        <div className="space-y-1.5 text-sm">
          <label htmlFor={`${id}-format`}>{PC.form.format}</label>
          <PublishingSelect
            id={`${id}-format`}
            value={d.format}
            disabled={disabled}
            options={formatsOf(network).map((format) => ({ value: format, label: formatLabel(format) }))}
            onChange={(format) => set({ format })}
          />
        </div>
        {network === 'youtube' ? (
          <div className="space-y-1.5 text-sm">
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor={`${id}-title`}>{PC.form.title}</label>
              {preview?.titleLimit ? (
                <span className={cn('text-xs tabular-nums', preview.titleOver ? 'text-destructive' : 'text-muted-foreground')}>
                  {PC.form.titleCount(preview.titleCount ?? 0, preview.titleLimit)}
                </span>
              ) : null}
            </div>
            <Input
              id={`${id}-title`}
              value={d.overrides.title ?? draft.text.title}
              aria-invalid={preview?.titleOver || undefined}
              onChange={(e) => set({ overrides: { title: e.target.value } })}
            />
          </div>
        ) : null}
        <div className="space-y-1.5 text-sm">
          <label htmlFor={`${id}-description`}>{PC.form.description}</label>
          <Textarea
            id={`${id}-description`}
            rows={3}
            className="min-h-28"
            value={d.overrides.description ?? draft.text.description}
            onChange={(e) => set({ overrides: { description: e.target.value } })}
          />
        </div>
        <div className="space-y-1.5 text-sm">
          <label htmlFor={`${id}-hashtags`}>{PC.form.hashtags}</label>
          <Input
            id={`${id}-hashtags`}
            value={d.overrides.hashtags ?? draft.text.hashtags}
            aria-describedby={`${id}-hashtags-hint`}
            onChange={(e) => set({ overrides: { hashtags: e.target.value } })}
          />
          <p id={`${id}-hashtags-hint`} className="text-xs text-muted-foreground">
            {PC.form.hashtagsHint}
          </p>
        </div>
        {hasOwnText(d) ? (
          <Button type="button" size="sm" variant="outline" onClick={() => form.dispatch({ type: 'resetDestinationText', accountId: d.accountId })}>
            {PC.form.resetText}
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">{PC.form.inherits}</p>
        )}
        <Disclosure summary={PC.form.more} variant="card" contentClassName="space-y-4">
          <PublicationTimeField
            label={PC.form.ownTime}
            value={d.scheduledAt}
            timezone={draft.timezone}
            disabled={disabled}
            disabledReason={block ?? undefined}
            onChange={(scheduledAt) => set({ scheduledAt })}
          />
          {network === 'youtube' ? (
            <>
              <div className="space-y-1.5 text-sm">
                <label htmlFor={`${id}-audience`}>{PC.form.audience}</label>
                <PublishingSelect<Audience>
                  id={`${id}-audience`}
                  value={audience}
                  disabled={disabled}
                  options={[
                    { value: '', label: PC.form.chooseAudience },
                    { value: 'false', label: PC.form.notMadeForKids },
                    { value: 'true', label: PC.form.madeForKids },
                  ]}
                  onChange={(value) => set({ options: { madeForKids: value === '' ? null : value === 'true' } })}
                />
              </div>
              <div className="space-y-1.5 text-sm">
                <label htmlFor={`${id}-tags`}>{PC.form.tags}</label>
                <Input
                  id={`${id}-tags`}
                  value={shownTags}
                  aria-describedby={`${id}-tags-hint`}
                  onChange={(e) => {
                    setTagsText(e.target.value);
                    set({ options: { tags: parseTags(e.target.value) } });
                  }}
                />
                <p id={`${id}-tags-hint`} className="text-xs text-muted-foreground">
                  {PC.form.tagsHint}
                </p>
              </div>
            </>
          ) : null}
          <div className="space-y-1.5 text-sm">
            <label htmlFor={`${id}-visibility`}>{PC.form.visibility}</label>
            <PublishingSelect<PublicationPrivacy>
              id={`${id}-visibility`}
              value={d.options.privacy}
              disabled={disabled}
              options={privacy.map((value) => ({ value, label: PC.form[value] }))}
              onChange={(value) => set({ options: { privacy: value } })}
            />
          </div>
          <Checkbox checked={d.options.synthetic} disabled={disabled} onCheckedChange={(synthetic) => set({ options: { synthetic } })}>
            {PC.form.synthetic}
          </Checkbox>
          {network === 'tiktok' ? (
            <div className="flex flex-col">
              {TIKTOK_TOGGLES.map((key) => (
                <Checkbox key={key} checked={d.options[key]} disabled={disabled} onCheckedChange={(on) => set({ options: { [key]: on } })}>
                  {PC.form[key]}
                </Checkbox>
              ))}
            </div>
          ) : null}
        </Disclosure>
      </fieldset>
      {block ? <p className="text-xs text-muted-foreground">{block}</p> : null}
      {preview ? (
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="text-muted-foreground">{PC.form.captionPreview}</span>
            <span className={cn('tabular-nums', preview.over ? 'text-destructive' : 'text-muted-foreground')}>{PC.form.captionCount(preview.count, preview.limit)}</span>
          </div>
          <p className="rounded-xl bg-black/20 p-3 text-xs whitespace-pre-wrap text-foreground shadow-(--field-shadow)">{preview.caption}</p>
          {preview.over ? (
            <p role="alert" className="text-xs text-destructive">
              {PC.form.captionOver(preview.limit)}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
