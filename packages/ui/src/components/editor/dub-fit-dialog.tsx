import { useState } from 'react';
import type { DocumentRecord, Id, Sequence } from '@cuccut/protocol';
import { itemRangeSeconds } from '@cuccut/protocol';
import { Button, ButtonGroup, Content, Dialog, DialogContainer, Heading, Text, TextArea } from '@react-spectrum/s2';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { failedUnits, placedUnits, planUnitOrder, type FailedUnit } from '../../model/dub-takes.ts';
import { planRecordOf, type DubBlock } from '../../model/timeline-dub.ts';
import { readTranslation, type TranslationUnit } from '../../model/translation-doc.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { DUB_REGEN_COPY as C } from './dub-copy.ts';
import { closeDubFit, regenDeps, retextAndRegenerate, useDubRegen, type FitRequest } from './dub-regen.ts';
import { useEditorActions } from './editor-context.tsx';
import { useDocumentBody } from './use-document-body.ts';
import { rateText } from './timeline-dub.tsx';

/**
 * “Edit translation and re-dub” (simplified version of design panel-dub-fit.jsx): one row per sentence to re-dub, showing the current dub's length and speed, or why it was not synthesized. Below is that sentence's translation (`naturalText`, which synthesis reads), which can be edited. On confirm, a new version of the translation is written first (only the sentences that were changed), then only those sentences are re-dubbed (dub-regen.ts).
 * No speech-rate library estimates, and no model is asked to shorten or re-translate; editing the translation does not re-split the subtitles generated from it.
 * The timeline mounts one of these permanently (timeline-menu.tsx); the block menu, the dub row header and the asset page's dub group card open it through `openDubFit`.
 */
export function DubFitHost({ sequence, documents, blocks }: { sequence: Sequence; documents: Record<Id, DocumentRecord>; blocks: ReadonlyMap<Id, DubBlock> }) {
  const fit = useDubRegen((s) => s.fit);
  return (
    <DialogContainer onDismiss={closeDubFit}>
      {fit ? <DubFitDialog key={`${fit.groupId}:${fit.units.join(',')}`} fit={fit} sequence={sequence} documents={documents} blocks={blocks} /> : null}
    </DialogContainer>
  );
}

const rowStyle = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  paddingY: 8,
  borderTopWidth: 1,
  borderStyle: 'solid',
  borderColor: 'gray-200',
  borderBottomWidth: 0,
  borderStartWidth: 0,
  borderEndWidth: 0,
});
const rowLine = style({ font: 'detail-sm', color: { default: 'neutral-subdued', isFailed: 'negative' } });
const listStyle = style({ display: 'flex', flexDirection: 'column', marginTop: 12 });

interface FitRow {
  unitId: Id;
  index: number;
  /** The current dub (when this sentence is on the timeline). */
  dub: { seconds: number; rate: string } | null;
  failed: FailedUnit | null;
  unit: TranslationUnit | null;
}

function DubFitDialog({
  fit,
  sequence,
  documents,
  blocks,
}: {
  fit: FitRequest;
  sequence: Sequence;
  documents: Record<Id, DocumentRecord>;
  blocks: ReadonlyMap<Id, DubBlock>;
}) {
  const runtime = useRuntime();
  const actions = useEditorActions();
  const busyGroup = useDubRegen((s) => !!s.busy[fit.groupId]);
  const [edits, setEdits] = useState<Record<Id, string>>({});
  const [busy, setBusy] = useState(false);
  const plan = planRecordOf(documents, fit.groupId);
  const planBody = useDocumentBody(plan ?? undefined);
  const ref = planBody && typeof planBody === 'object' ? (planBody as { translationRef?: { id?: unknown } }).translationRef : undefined;
  const translationId = typeof ref?.id === 'string' ? ref.id : null;
  const translationRecord = translationId ? documents[translationId] : undefined;
  const translationBody = useDocumentBody(translationRecord);
  const translation = translationBody === undefined ? undefined : readTranslation(translationBody);
  const loading = planBody === undefined || (!!translationRecord && translationBody === undefined);
  const unreadable = !loading && !translation;

  const failed = failedUnits(planBody, placedUnits(sequence, fit.groupId));
  const order = new Map((translation?.units ?? []).map((unit, i) => [unit.id, { unit, index: i + 1 }]));
  // With no translation to compare against (no reference in the plan, or it cannot be read), the sentence is labeled by its order in the plan: sentences not synthesized also take a number; the block order on the track does not count them.
  const planOrder = planUnitOrder(planBody);
  const rows: FitRow[] = fit.units.map((unitId, i) => {
    const block = [...blocks.values()].find((b) => b.groupId === fit.groupId && b.unitId === unitId);
    const item = block ? sequence.items.find((candidate) => candidate.id === block.itemId) : undefined;
    const range = item ? itemRangeSeconds(item, sequence.fps) : null;
    const hit = order.get(unitId);
    return {
      unitId,
      index: hit?.index ?? planOrder.get(unitId) ?? block?.index ?? i + 1,
      dub: block && range ? { seconds: range.end - range.start, rate: rateText(block.rate, block.fast) } : null,
      failed: failed.find((f) => f.unitId === unitId) ?? null,
      unit: hit?.unit ?? null,
    };
  });
  const texts = new Map<Id, string>();
  for (const row of rows) {
    const value = edits[row.unitId]?.trim();
    if (row.unit && value && value !== row.unit.naturalText.trim()) texts.set(row.unitId, value);
  }

  const submit = async () => {
    if (busy || busyGroup) return;
    setBusy(true);
    try {
      const jobId = await retextAndRegenerate(regenDeps(runtime, actions), {
        videoId: fit.videoId,
        groupId: fit.groupId,
        units: fit.units,
        planDocumentId: plan?.id ?? null,
        translationId: translation ? translationId : null,
        texts,
      });
      // If it was not submitted (already reported), stay in the dialog so edited text is not lost.
      if (jobId) closeDubFit();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog size="L">
      <Heading slot="title">{C.fitTitle(fit.units.length)}</Heading>
      <Content>
        <Text>{C.fitIntro}</Text>
        {loading ? <Text>{C.fitLoading}</Text> : unreadable ? <Text>{C.fitUnreadable(translationId ? C.unreadableFormat : C.unreadableNoTranslation)}</Text> : null}
        <div className={listStyle}>
          {rows.map((row) => (
            <div key={row.unitId} className={rowStyle}>
              <span className={rowLine({ isFailed: !row.dub && !!row.failed })}>
                {row.dub
                  ? C.fitDub(row.dub.seconds, row.dub.rate)
                  : row.failed
                    ? row.failed.reason === 'voice'
                      ? C.fitVoice
                      : C.fitOverlong(row.failed.overflowSeconds)
                    : null}
              </span>
              {row.unit ? (
                <TextArea
                  label={C.fitText(row.index)}
                  value={edits[row.unitId] ?? row.unit.naturalText}
                  onChange={(value) => setEdits((s) => ({ ...s, [row.unitId]: value }))}
                  isDisabled={busy}
                  styles={style({ width: 'full' })}
                />
              ) : !loading && translation ? (
                <span className={rowLine({ isFailed: false })}>{C.fitMissing}</span>
              ) : null}
            </div>
          ))}
        </div>
      </Content>
      <ButtonGroup>
        <Button variant="secondary" onPress={closeDubFit} isDisabled={busy}>
          {C.fitCancel}
        </Button>
        <Button variant="accent" isPending={busy} isDisabled={loading || busyGroup} onPress={() => void submit()}>
          {busy ? C.fitBusy : C.fitSubmit(fit.units.length, texts.size)}
        </Button>
      </ButtonGroup>
    </Dialog>
  );
}
