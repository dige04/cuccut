import type { DocumentRecord, Id, Sequence } from '@cuccut/protocol';
import { EditLabel } from '@cuccut/protocol/messages/ui';
import { ActionButton, Header, Heading, Menu, MenuItem, MenuSection, MenuTrigger, Text, ToastQueue, Tooltip, TooltipTrigger } from '@react-spectrum/s2';
import AudioWave from '@react-spectrum/s2/icons/AudioWave';
import DeleteIcon from '@react-spectrum/s2/icons/Delete';
import More from '@react-spectrum/s2/icons/More';
import Redo from '@react-spectrum/s2/icons/Redo';
import Refresh from '@react-spectrum/s2/icons/Refresh';
import VolumeTwo from '@react-spectrum/s2/icons/VolumeTwo';
import { languageName } from '../../model/caption-tracks.ts';
import {
  canListenDub,
  failedUnits,
  placedUnits,
  queuedKey,
  queuedSet,
  regenCandidates,
  sourceGroup,
  sourceOf,
  switchSourceOperations,
  trackCounts,
  type DubSource,
} from '../../model/dub-takes.ts';
import { rootSequence } from '../../model/editor.ts';
import { dubGroups, groupLocked, hasBackground, planRecordOf, type DubBlock, type DubGroup } from '../../model/timeline-dub.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useJobs } from '../../state/jobs-store.ts';
import { canEdit, useVideo } from '../../state/video-store.ts';
import { openAiTool } from './ai-tools-nav.ts';
import { DUB_REGEN_COPY as C, TIMELINE_DUB_COPY as DUB } from './dub-copy.ts';
import { openDubFit } from './dub-regen.ts';
import { useEditorActions } from './editor-context.tsx';
import { deleteDubGroup } from './timeline-commands.ts';
import { useDocumentBody } from './use-document-body.ts';

/**
 * The sentences of one dub track right now: the blocks on the timeline, those not yet synthesized in the plan, those queued for re-dub, and their counts. The name tooltip on the track header and the ⋯ header share this one (the design draft uses `trackLine(d.blocks)` in both places), so the sentence counts on the two match.
 */
/** Name of the edit that switches the dub group's playback source. */
const HEAR_LABEL = { dub: EditLabel.hearDub, original: EditLabel.hearOriginal, both: EditLabel.hearBoth };

export function useDubTrack(group: DubGroup, sequence: Sequence, documents: Record<Id, DocumentRecord>, blocks: ReadonlyMap<Id, DubBlock>) {
  const videoId = useVideo((s) => s.video?.videoId ?? null);
  const queued = queuedSet(useJobs((s) => queuedKey(s.jobs, videoId)));
  const plan = planRecordOf(documents, group.groupId);
  const planBody = useDocumentBody(plan ?? undefined);
  const own = group.itemIds.flatMap((id) => blocks.get(id) ?? []);
  const failed = failedUnits(planBody, placedUnits(sequence, group.groupId));
  return { videoId, queued, plan, planBody, own, failed, counts: trackCounts(own, failed, queued) };
}

/**
 * The ⋯ on the dub track header (design draft timeline-dub.jsx `DubHead` / `DubHeadMenu`): the header gives the track's sentence count, unsynthesized, too fast, muted, and regenerating;
 * Listen to dub / Listen to original / Listen to both (the current one is checked; model/dub-takes.ts derives it from the track, mute, and ducking); Regenerate N sentences… (the unsynthesized and too-fast ones; opens “Edit translation and re-dub”); Re-dub… (goes to the tool page's translation dub, carrying this language); Remove this dub group (this used to be in the block menu).
 * Regenerate and re-dub are AI entry points and are not offered on the Web surface. Switching the source is a reversible edit (toggling mute or ducking on the track or the instance) and runs no model.
 */
export function DubHeadMenu({
  group,
  label,
  sequence,
  documents,
  blocks,
}: {
  group: DubGroup;
  /** Track header name (“配音 · 英语”, Dub · English). */
  label: string;
  sequence: Sequence;
  documents: Record<Id, DocumentRecord>;
  blocks: ReadonlyMap<Id, DubBlock>;
}) {
  const runtime = useRuntime();
  const actions = useEditorActions();
  const editable = useVideo((s) => canEdit(s.video));
  const { videoId, queued, plan, planBody, own, failed, counts } = useDubTrack(group, sequence, documents, blocks);
  const desktop = runtime.host.platform !== 'web';

  const candidates = regenCandidates(failed, own, group.groupId, queued);
  const self = sourceGroup(group.groupId, planBody);
  const loaded = planBody !== undefined;
  const source: DubSource = loaded ? sourceOf(sequence, self) : 'none';
  const bed = hasBackground(sequence, group.groupId);
  const others = dubGroups(sequence).length > 1;
  const language = group.language ? languageName(group.language) : label;

  const disabled = [
    ...(!editable || !loaded ? ['dub', 'original', 'both'] : canListenDub(self) ? [] : ['dub']),
    ...(editable && plan && videoId && candidates.length > 0 ? [] : ['regen']),
    ...(editable && !groupLocked(sequence, group.groupId) ? [] : ['remove']),
  ];

  /** Body of the dub plan: check the document cache first, and read it only if it isn't there. */
  const readBody = async (record: DocumentRecord | null): Promise<unknown> => {
    if (!record) return null;
    const cached = runtime.videos.documents.peek(record.id, record.currentRevision);
    if (cached !== undefined) return cached;
    if (!videoId) return null;
    return (await runtime.readDocument(videoId, record.id)).body;
  };

  const switchSource = async (target: Exclude<DubSource, 'none'>) => {
    let latest = sequence;
    let groups;
    try {
      groups = await Promise.all(dubGroups(sequence).map(async (g) => sourceGroup(g.groupId, await readBody(planRecordOf(documents, g.groupId)))));
      // The video may have changed while the plan was being read: compute the operations against the latest sequence.
      const snapshot = useVideo.getState().video?.state?.video;
      const fresh = snapshot ? rootSequence(snapshot) : null;
      if (fresh?.id === sequence.id) latest = fresh;
    } catch {
      ToastQueue.negative(DUB.planUnread, { timeout: 5000 });
      return;
    }
    const operations = switchSourceOperations(latest, groups, group.groupId, target);
    const done = target === 'dub' ? C.sourceDone.dub(language) : C.sourceDone[target];
    if (operations.length > 0 && !(await actions.apply(operations, HEAR_LABEL[target]()))) return;
    ToastQueue.neutral(done, { timeout: 3000 });
  };

  const run = (key: string) => {
    switch (key) {
      case 'dub':
      case 'original':
      case 'both':
        return void switchSource(key);
      case 'regen':
        if (videoId) openDubFit({ videoId, groupId: group.groupId, units: candidates });
        return;
      case 'redub':
        if (videoId) openAiTool(videoId, 'dub', { language: group.language ? languageName(group.language) : null });
        return;
      case 'remove':
        return void deleteDubGroup(actions, group.groupId, () => readBody(plan));
    }
  };

  const listenHint = !loaded ? C.fitLoading : canListenDub(self) ? C.listenDubHint({ bed, duck: self.policy === 'duck', others }) : C.listenDubKeep;
  return (
    <MenuTrigger align="start">
      <TooltipTrigger>
        <ActionButton isQuiet size="XS" aria-label={C.headMenu(label)}>
          <More />
        </ActionButton>
        <Tooltip>{C.headMenu(label)}</Tooltip>
      </TooltipTrigger>
      <Menu aria-label={C.headMenu(label)} disabledKeys={disabled} onAction={(key) => run(String(key))}>
        <MenuSection aria-label={C.sourceLabel.dub} selectionMode="single" selectedKeys={source === 'none' ? [] : [source]}>
          <Header>
            <Heading>{label}</Heading>
            <Text slot="description">{C.headLine(counts)}</Text>
          </Header>
          <MenuItem id="dub" textValue={C.listenDub}>
            <VolumeTwo />
            <Text slot="label">{C.listenDub}</Text>
            <Text slot="description">{listenHint}</Text>
          </MenuItem>
          <MenuItem id="original" textValue={C.listenOriginal}>
            <AudioWave />
            <Text slot="label">{C.listenOriginal}</Text>
            <Text slot="description">{C.listenOriginalHint(others)}</Text>
          </MenuItem>
          <MenuItem id="both" textValue={C.listenBoth}>
            <AudioWave />
            <Text slot="label">{C.listenBoth}</Text>
            <Text slot="description">{C.listenBothHint(bed)}</Text>
          </MenuItem>
        </MenuSection>
        {desktop && videoId ? (
          <MenuSection>
            <MenuItem id="regen" textValue={C.regenSome(candidates.length)}>
              <Refresh />
              <Text slot="label">{C.regenSome(candidates.length)}</Text>
              <Text slot="description">{editable ? C.regenSomeHint(failed.filter((f) => candidates.includes(f.unitId)).length, counts.fast) : C.readOnly}</Text>
            </MenuItem>
            <MenuItem id="redub" textValue={C.redub}>
              <Redo />
              <Text slot="label">{C.redub}</Text>
              <Text slot="description">{C.redubHint}</Text>
            </MenuItem>
          </MenuSection>
        ) : null}
        <MenuSection>
          <MenuItem id="remove" textValue={DUB.removeGroup}>
            <DeleteIcon />
            <Text slot="label">{DUB.removeGroup}</Text>
            <Text slot="description">{DUB.removeGroupHint(bed)}</Text>
          </MenuItem>
        </MenuSection>
      </Menu>
    </MenuTrigger>
  );
}
