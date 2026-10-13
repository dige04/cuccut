import { useMemo, useRef, useState } from 'react';
import type { Id, JobRecord } from '@cuccut/protocol';
import { ActionButton, Button, Text, ToastQueue } from '@react-spectrum/s2';
import TextIcon from '@react-spectrum/s2/icons/Text';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { textModelLine, textParameters } from '../../model/models-text.ts';
import { listedRecords } from '../../model/tools-records.ts';
import { entryReason } from '../../model/tool-space-input.ts';
import { modelReason, saveTarget, withSaveDir } from '../../model/tool-frame.ts';
import { findOption, initialModelKey, modelOptions } from '../../model/tools-models.ts';
import {
  againTextDraft,
  textSample,
  textCounter,
  textEffortLine,
  textHeaderChip,
  textProblems,
  textRequest,
  textStatus,
} from '../../model/tools-text.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useModels } from '../../state/models-store.ts';
import { useShell } from '../../state/shell-store.ts';
import { useSpace } from '../../state/space-store.ts';
import { useTools } from '../../state/tools-store.ts';
import { EmptyCard, PageStatus } from '../models/model-parts.tsx';
import { useNow } from '../use-now.ts';
import { TextRecord } from './text-record.tsx';
import { ModelRow, SaveDirRow } from './tool-frame.tsx';
import {
  BarStatus,
  detailGrow,
  detailOver,
  HeaderChip,
  hintText,
  Section,
  SectionLink,
  SideFoot,
  SideHead,
  submitOnModEnter,
  ToolPage,
  ToolTextArea,
  Workbench,
} from './tool-parts.tsx';
import { SpacePicker } from './tool-video-picker.tsx';
import { FORM_COPY, FRAME_COPY, GALLERY_COPY, RECORD_COPY, TEXT_COPY } from './tools-copy.ts';
import { useSubmitFailed, useToolRecords } from './use-tool-records.ts';
import { useToolStatus } from './use-tool-status.ts';
import { usePreset, useRerun } from './video-tool-parts.tsx';

/*
 * Design file tool-llm.jsx `LlmToolPage kind='text'` (44-104): one text-model call, with no Agent session and no tool calls.
 * On the left, following the common skeleton (product design §2.7): description, generation requirements (“Fill in example”, character count / 16,000), and model (“Manage text models” goes to the models page); on the right, “Generation records” and “View in Space”.
 * Submission goes through `models.generateText`; the records are jobs of this kind in the `jobs` topic; the result is listed by the Runtime as one document in the Space (architecture design §5.7).
 * A document or subtitle from the Space (`material`, architecture design §7.9) can be attached; an entry brought from the Space viewer is attached in advance.
 */

const lede = style({ margin: 0, font: 'ui-sm', color: 'gray-700' });
const textFoot = style({ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 });

/** Text generation (local or cloud text models). */
export function TextTool() {
  const runtime = useRuntime();
  const go = useShell((s) => s.go);
  const view = useModels((s) => s.capabilities);
  const draft = useTools((s) => s.text);
  const patch = useTools((s) => s.patchText);
  const records = useToolRecords('generateText');
  const now = useNow(30_000);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [tried, setTried] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submitFailed = useSubmitFailed('generateText', TEXT_COPY.submitFailed);
  const { saveDirectory } = useToolStatus();
  // The directory picked with “Change…” lives only on this page (it is not written back to settings).
  const [saveOverride, setSaveOverride] = useState<string | null>(null);
  // The attached Space entry: `attach` opens the picker, and `entryId` is the one selected. It lives only on this page.
  const [attach, setAttach] = useState(false);
  const [entryId, setEntryId] = useState<Id | null>(null);
  usePreset('generate-text', (id) => {
    setAttach(true);
    setEntryId(id);
  });
  const entry = useSpace((s) => (attach && entryId ? (s.entries.find((e) => e.id === entryId) ?? null) : null));
  const material = entry && !entryReason(entry) ? { entryId: entry.id, name: entry.name } : null;
  const needEntry = attach && !material;

  const options = useMemo(() => (view ? modelOptions(view, 'generateText') : []), [view]);
  const option = findOption(options, initialModelKey(options, draft.model, view?.generateText.effective ?? null));
  const reason = view ? modelReason(options, option, FRAME_COPY.textNoun) : null;
  const base = reason ? { text: reason, bad: true } : textStatus(draft, option, tried);
  const status = !base.bad && needEntry ? { text: FORM_COPY.needEntry, bad: tried } : base;
  const toSettings = () => go({ tab: 'models', category: 'llm', page: option?.local ? 'local' : 'cloud' });
  // Cancelled items are not listed (one that may already have been billed is kept, to be accurate), consistent with image generation; the empty state is based on what is listed.
  const shown = listedRecords(records.list);

  const generate = () => {
    setTried(true);
    if (!option || !option.usable || submitting) return;
    const problems = [...textProblems(draft), ...(needEntry ? [FORM_COPY.needEntry] : [])];
    if (problems.length) {
      ToastQueue.neutral(problems[0]!, { timeout: 4000 });
      return;
    }
    setSubmitting(true);
    runtime
      .generateText(withSaveDir(textRequest(draft, option, material), saveTarget(saveDirectory, saveOverride)))
      .then(() => ToastQueue.positive(TEXT_COPY.submitted, { timeout: 3000 }), submitFailed)
      .finally(() => setSubmitting(false));
  };

  const again = (job: JobRecord) => {
    const next = againTextDraft(job);
    if (!next) return;
    patch(next);
    inputRef.current?.focus();
    ToastQueue.neutral(TEXT_COPY.againDone, { timeout: 3000 });
  };
  useRerun('generate-text', again);

  const bar = (
    <>
      <BarStatus text={status.text} bad={status.bad} />
      <Button variant="accent" isDisabled={!option?.usable} isPending={submitting} onPress={generate}>
        <TextIcon />
        <Text>{TEXT_COPY.submit}</Text>
      </Button>
    </>
  );
  const chip = textHeaderChip(option);

  if (!view) {
    return (
      <ToolPage title={TEXT_COPY.title}>
        <PageStatus>{GALLERY_COPY.loading}</PageStatus>
      </ToolPage>
    );
  }

  const counter = textCounter(draft);

  const main = (
    <>
      <p className={lede}>{TEXT_COPY.lede}</p>

      <Section title={TEXT_COPY.inputLabel}>
        <ToolTextArea
          label={TEXT_COPY.inputLabel}
          inputRef={inputRef}
          value={draft.input}
          onChange={(input) => patch({ input })}
          placeholder={TEXT_COPY.inputPlaceholder}
        />
        <div className={textFoot}>
          <span className={counter.over ? detailOver : detailGrow}>{counter.text}</span>
          {draft.input ? (
            <SectionLink onPress={() => patch({ input: '' })}>{TEXT_COPY.clear}</SectionLink>
          ) : (
            <SectionLink onPress={() => patch({ input: textSample() })}>{TEXT_COPY.sample}</SectionLink>
          )}
        </div>
      </Section>

      <Section
        title={TEXT_COPY.material}
        aside={
          attach ? (
            <SectionLink onPress={() => setAttach(false)}>{TEXT_COPY.materialRemove}</SectionLink>
          ) : (
            <SectionLink onPress={() => setAttach(true)}>{TEXT_COPY.materialAdd}</SectionLink>
          )
        }>
        {attach ? (
          <SpacePicker tool="generate-text" data={null} value={entryId} onChange={setEntryId} />
        ) : (
          <span className={detailGrow}>{TEXT_COPY.materialNote}</span>
        )}
        {material ? <span className={detailGrow}>{TEXT_COPY.materialPicked(material.name)}</span> : null}
      </Section>

      <ModelRow
        noun={FRAME_COPY.textNoun}
        manage={TEXT_COPY.manage}
        local={false}
        onSettings={toSettings}
        options={options}
        selected={option}
        disableUnusable
        onSelect={(o) => patch({ model: o.key })}
        factsOf={(o) => textModelLine(o.info)}>
        {option?.usable ? <p className={hintText}>{textEffortLine(textParameters(view), option.info)}</p> : null}
      </ModelRow>
      <SaveDirRow saveDirectory={saveDirectory} override={saveOverride} onChange={setSaveOverride} />
    </>
  );

  const side = (
    <>
      <SideHead
        title={TEXT_COPY.side}
        live={records.live ? RECORD_COPY.live(records.live) : null}
        count={RECORD_COPY.count(shown.length)}
        extra={
          <ActionButton isQuiet size="S" onPress={() => go({ tab: 'space', category: 'document', projectId: null })}>
            <Text>{TEXT_COPY.viewInSpace}</Text>
          </ActionButton>
        }
      />
      {!records.ready ? (
        <PageStatus>{GALLERY_COPY.loading}</PageStatus>
      ) : shown.length ? (
        shown.map((job) => <TextRecord key={job.jobId} job={job} all={records.all} view={view} now={now} onAgain={again} />)
      ) : (
        <EmptyCard icon={<TextIcon />} title={TEXT_COPY.empty} body={TEXT_COPY.emptyBody} />
      )}
      <SideFoot>{TEXT_COPY.sideFoot}</SideFoot>
    </>
  );

  return (
    <ToolPage title={TEXT_COPY.title} bar={bar} chip={chip ? <HeaderChip text={chip} /> : null}>
      <Workbench main={main} side={side} sideLabel={TEXT_COPY.side} onKeyDown={submitOnModEnter(generate)} />
    </ToolPage>
  );
}
