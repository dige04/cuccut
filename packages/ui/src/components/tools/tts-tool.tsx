import { useMemo, useRef, useState } from 'react';
import type { Id, JobRecord } from '@cuccut/protocol';
import { ActionButton, Button, Text, ToastQueue } from '@react-spectrum/s2';
import AudioWave from '@react-spectrum/s2/icons/AudioWave';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { downloadableBundle } from '../../model/models-install.ts';
import { modelReason, saveTarget, withSaveDir } from '../../model/tool-frame.ts';
import { entryReason } from '../../model/tool-space-input.ts';
import { findOption, initialModelKey, installedAlternative, modelOptions } from '../../model/tools-models.ts';
import {
  draftFromJob,
  headerChip,
  sampleText,
  speechModelLine,
  speechRequest,
  speechTitle,
  switchModel,
  textStats,
  ttsProblems,
  ttsStatus,
  type TtsMaterial,
} from '../../model/tools-tts.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useModels } from '../../state/models-store.ts';
import { useShell } from '../../state/shell-store.ts';
import { useSpace } from '../../state/space-store.ts';
import { useTools } from '../../state/tools-store.ts';
import { useVoices } from '../../state/voices-store.ts';
import { useNow } from '../use-now.ts';
import { EmptyCard, PageStatus } from '../models/model-parts.tsx';
import { LocalDownloadGate } from './local-model-gate.tsx';
import { ModelRow, SaveDirRow } from './tool-frame.tsx';
import {
  BarStatus,
  detailGrow,
  detailOver,
  HeaderChip,
  Section,
  SectionLink,
  SideFoot,
  SideHead,
  submitOnModEnter,
  ToolPage,
  ToolTextArea,
  Workbench,
} from './tool-parts.tsx';
import { ToolSourceSwitch } from './tool-run-view.tsx';
import { SpacePicker } from './tool-video-picker.tsx';
import { FORM_COPY, FRAME_COPY, GALLERY_COPY, GATE_COPY, RECORD_COPY, SAVE_COPY, TTS_COPY } from './tools-copy.ts';
import { TtsRecord } from './tts-record.tsx';
import { OptionsSection, VoiceSection } from './tts-sections.tsx';
import { useSubmitFailed, useToolRecords } from './use-tool-records.ts';
import { useToolStatus } from './use-tool-status.ts';
import { usePreset, useRerun } from './video-tool-parts.tsx';

/*
 * Design mockup tool-tts.jsx `TtsToolPage` (672-785): text, model (local and cloud, the unified “模型” (model) row of product design §2.7), voice (voice / style / rate), language and details; generation records on the right. The text to speak can be typed directly, or chosen from a document or subtitle in Space (`material`; the Runtime reads out the text; architecture design §7.9, “Space 条目作输入”); entries brought from the Space viewer are pre-selected.
 */

const textFoot = style({ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 });

/** Generates speech (local or cloud). Submission goes through `models.synthesizeSpeech`; the record is a job of this kind in the `jobs` topic. */
export function TtsTool() {
  const runtime = useRuntime();
  const go = useShell((s) => s.go);
  const view = useModels((s) => s.capabilities);
  const bundles = useModels((s) => s.bundles);
  const draft = useTools((s) => s.tts);
  const patch = useTools((s) => s.patchTts);
  // My voices: null until read (library voices do not check clone status here; the Runtime verifies that).
  const myVoices = useVoices((s) => (s.ready ? s.voices : null));
  const records = useToolRecords('synthesizeSpeech');
  const now = useNow(30_000);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [tried, setTried] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submitFailed = useSubmitFailed('synthesizeSpeech', TTS_COPY.submitFailed);
  const { saveDirectory } = useToolStatus();
  // The directory chosen with “更改…” (change…) lives only on this page (not written back to settings).
  const [saveOverride, setSaveOverride] = useState<string | null>(null);
  // Source of the text: typed directly, or a document or subtitle in Space. Lives only on this page (the draft stores the typed text).
  const [source, setSource] = useState<'text' | 'space'>('text');
  const [entryId, setEntryId] = useState<Id | null>(null);
  usePreset('synthesize-speech', (id) => {
    setSource('space');
    setEntryId(id);
  });
  const entry = useSpace((s) => (entryId ? (s.entries.find((e) => e.id === entryId) ?? null) : null));
  const material: TtsMaterial | null = source === 'space' && entry && !entryReason(entry) ? { entryId: entry.id, name: entry.name } : null;
  const needEntry = source === 'space' && !material;

  const options = useMemo(() => (view ? modelOptions(view, 'synthesizeSpeech') : []), [view]);
  const option = findOption(options, initialModelKey(options, draft.model, view?.synthesizeSpeech.effective ?? null));
  const reason = view ? modelReason(options, option, FRAME_COPY.speechNoun) : null;
  const status = reason
    ? { text: reason, bad: true }
    : needEntry
      ? { text: FORM_COPY.needEntry, bad: tried }
      : ttsStatus(draft, option, tried, myVoices, material);
  const toSettings = () => go({ tab: 'models', category: 'tts', page: option?.local ? 'local' : 'cloud' });
  // The chosen local model is not installed yet: a download card appears below the model row (design mockup `TtsModelGate`); when an installed local model exists, “换用已装的 X” (use installed X instead) is also offered.
  const gateBundle = downloadableBundle(bundles, option);
  const installed = gateBundle ? installedAlternative(options, option) : null;

  const generate = () => {
    setTried(true);
    if (!option || !option.usable || submitting) return;
    const problems = needEntry ? [FORM_COPY.needEntry] : ttsProblems(draft, option, myVoices, material);
    if (problems.length) {
      ToastQueue.neutral(problems[0]!, { timeout: 4000 });
      return;
    }
    setSubmitting(true);
    runtime
      .synthesizeSpeech(withSaveDir(speechRequest(draft, option, material), saveTarget(saveDirectory, saveOverride)))
      .then(
        () => ToastQueue.positive(TTS_COPY.submitted, { timeout: 3000 }),
        submitFailed,
      )
      .finally(() => setSubmitting(false));
  };

  const reuse = (job: JobRecord) => {
    const info = options.find((o) => o.providerId === job.providerId && o.modelId === job.modelId)?.info ?? null;
    const next = draftFromJob(job, info);
    if (!next) return;
    patch(next);
    setSource('text');
    textRef.current?.focus();
    ToastQueue.neutral(TTS_COPY.reused(speechTitle(job)), { timeout: 3000 });
  };
  useRerun('synthesize-speech', reuse);

  const bar = (
    <>
      <BarStatus text={status.text} bad={status.bad} />
      <Button variant="accent" isDisabled={!option?.usable} isPending={submitting} onPress={generate}>
        <AudioWave />
        <Text>{TTS_COPY.submit}</Text>
      </Button>
    </>
  );
  const chip = headerChip(option);

  if (!view) {
    return (
      <ToolPage title={TTS_COPY.title}>
        <PageStatus>{GALLERY_COPY.loading}</PageStatus>
      </ToolPage>
    );
  }

  const maxChars = option?.info.maxInputChars ?? 0;
  const over = maxChars > 0 && Array.from(draft.text.trim()).length > maxChars;

  const main = (
    <>
      <Section title={TTS_COPY.textLabel} aside={<ToolSourceSwitch tool="synthesize-speech" value={source} onChange={setSource} />}>
        {source === 'space' ? (
          <SpacePicker tool="synthesize-speech" data={null} value={entryId} onChange={setEntryId} />
        ) : (
          <>
            <ToolTextArea
              label={TTS_COPY.textLabel}
              inputRef={textRef}
              value={draft.text}
              onChange={(text) => patch({ text })}
              placeholder={TTS_COPY.textPlaceholder(maxChars || 4096)}
            />
            <div className={textFoot}>
              <span className={over ? detailOver : detailGrow}>{textStats(draft.text, maxChars || 4096)}</span>
              {draft.text ? (
                <SectionLink onPress={() => patch({ text: '' })}>{TTS_COPY.clear}</SectionLink>
              ) : (
                <SectionLink onPress={() => patch({ text: sampleText(draft, option?.info ?? null) })}>{TTS_COPY.sample}</SectionLink>
              )}
            </div>
          </>
        )}
      </Section>

      <ModelRow
        noun={FRAME_COPY.speechNoun}
        manage={TTS_COPY.manage}
        onSettings={toSettings}
        options={options}
        selected={option}
        onSelect={(o) => patch(switchModel(draft, o))}
        factsOf={(o) => speechModelLine(o.info)}
        localGate={!!gateBundle}>
        {gateBundle && option ? (
          <LocalDownloadGate
            bundle={gateBundle}
            name={option.label}
            category="tts"
            body={(paused) => (paused ? GATE_COPY.ttsDownloadBodyPaused : GATE_COPY.ttsDownloadBody)}
            extra={
              installed ? (
                <Button variant="secondary" size="S" onPress={() => patch(switchModel(draft, installed))}>
                  <AudioWave />
                  <Text>{GATE_COPY.switchToInstalled(installed.label)}</Text>
                </Button>
              ) : null
            }
          />
        ) : null}
      </ModelRow>

      {option ? <VoiceSection key={option.key} draft={draft} option={option} voices={myVoices} patch={patch} /> : null}
      {option ? <OptionsSection draft={draft} option={option} patch={patch} /> : null}
      <SaveDirRow saveDirectory={saveDirectory} override={saveOverride} onChange={setSaveOverride} />
    </>
  );

  const side = (
    <>
      <SideHead
        title={TTS_COPY.side}
        live={records.live ? RECORD_COPY.live(records.live) : null}
        count={RECORD_COPY.count(records.list.length)}
        extra={
          <ActionButton isQuiet size="S" onPress={() => go({ tab: 'space', category: 'audio', projectId: null })}>
            <Text>{SAVE_COPY.view}</Text>
          </ActionButton>
        }
      />
      {!records.ready ? (
        <PageStatus>{GALLERY_COPY.loading}</PageStatus>
      ) : records.list.length ? (
        records.list.map((job) => <TtsRecord key={job.jobId} job={job} all={records.all} view={view} now={now} onReuse={reuse} />)
      ) : (
        <EmptyCard icon={<AudioWave />} title={TTS_COPY.empty} body={TTS_COPY.emptyBody} />
      )}
      <SideFoot>
        {TTS_COPY.sideFoot}
      </SideFoot>
    </>
  );

  return (
    <ToolPage title={TTS_COPY.title} bar={bar} chip={chip ? <HeaderChip text={chip} /> : null}>
      <Workbench main={main} side={side} sideLabel={TTS_COPY.side} onKeyDown={submitOnModEnter(generate)} />
    </ToolPage>
  );
}
