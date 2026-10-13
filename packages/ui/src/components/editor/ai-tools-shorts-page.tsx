import { useMemo, useState } from 'react';
import type { DocumentRecord, Id, Sequence } from '@cuccut/protocol';
import { NumberField, Picker, PickerItem, Radio, RadioGroup, SegmentedControl, SegmentedControlItem } from '@react-spectrum/s2';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import {
  aiTool,
  intentPrompt,
  SHORTS_COUNTS,
  SHORTS_CUSTOM,
  SHORTS_DEFAULTS,
  SHORTS_FOCUS,
  SHORTS_LENGTHS,
  SHORTS_RATIOS,
  SHORTS_STYLES,
  SHORTS_TRACKS,
  shortsAutoHint,
  shortsLengthRange,
  shortsLines,
  toolEffect,
  toolTemplate,
  type ShortsCount,
  type ShortsFocus,
  type ShortsLength,
  type ShortsRatio,
  type ShortsSettings,
  type ShortsStyle,
  type ShortsTracks,
} from '../../model/ai-tools.ts';
import { chapterPieces } from '../../model/export-range.ts';
import { AgentGateLine } from './agent-gate-line.tsx';
import { AiToolPrompt, useToolHandoff } from './ai-tool-prompt.tsx';
import { Option, Row, ToolCard } from './ai-tools-agent-page.tsx';
import { AI_TOOLS_COPY as C } from './ai-tools-copy.ts';
import { PanelHead } from './panel-head.tsx';
import { recordShortsRun } from './shorts-runs.ts';

const body = style({ flexGrow: 1, minHeight: 0, overflowY: 'auto', paddingX: 12, paddingTop: 12, paddingBottom: 16 });
const secHead = style({ marginTop: 20, marginBottom: 0, font: 'detail', fontWeight: 'bold', color: 'gray-700' });
const rows = style({ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 });
const hint = style({ margin: 0, font: 'ui-xs', color: 'gray-600', lineHeight: '[1.5]' });
const field = style({ width: 'full' });
const pair = style({ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' });
const radioSub = style({ display: 'block', paddingStart: 24, marginTop: -2, marginBottom: 4, font: 'ui-xs', color: 'gray-600' });

/**
 * Parameter page for cutting shorts (prototype panel-aitools-shorts.jsx `ShortsCutSetup`, product design §5.10 “parameter page”). It is only handed to the Agent, so there is no “use” row, and it always opens a new session, so there is no “session” row. From top to bottom: an explanation card (finds topics worth posting on their own, each cut into a new sub-video); scope and “skip ones already cut”; what to cut into (how many and how long, both defaulting to “auto”, which the Agent decides from the topics, with a line below explaining how auto decides; aspect ratio); framing (when the aspect ratio is not the original); captions (which tracks, style); the prompt box (an intent sentence plus one-line-each parameters; the last line “create directly once found” can be removed on its own); the primary button and where it goes. Pressing it opens a new session with the request sent, brings that session into view, and returns the tool page to the list; the run is recorded (`recordShortsRun`). When it finishes and sub-videos have been cut, this video's AI tools tab switches to the result page (ai-tools-shorts-result.tsx).
 * When the video does not belong to a project, a new session is opened the same way: it shares the working directory of the session the video lives in (`folderOf` in `planHandoff`), no project is created, and the sub-videos are created next to the original video.
 */
export function ShortsToolPage({
  videoId,
  sequence,
  documents,
  skipDone,
  onBack,
}: {
  videoId: Id;
  sequence: Sequence;
  documents: Record<Id, DocumentRecord>;
  /** Coming in from the result page's “cut more”: “skip ones already cut” is checked. */
  skipDone?: boolean;
  onBack(): void;
}) {
  const handoff = useToolHandoff();
  const info = aiTool('shortscut');

  const chapters = useMemo(() => chapterPieces(sequence), [sequence]);
  const [scopeKey, setScopeKey] = useState<string>('all');
  const scopeIndex = chapters.findIndex((c) => c.id === scopeKey);
  const scope = scopeIndex >= 0 ? C.scopeChapter(scopeIndex + 1, chapters[scopeIndex]!.label) : null;

  const hasTranslation = useMemo(() => Object.values(documents).some((d) => d.kind === 'translation'), [documents]);
  const [s, setS] = useState<ShortsSettings>(() => ({ ...SHORTS_DEFAULTS, ...(skipDone ? { skipDone: true } : {}) }));
  const set = (patch: Partial<ShortsSettings>) => setS((prev) => ({ ...prev, ...patch }));
  const range = shortsLengthRange(s);
  const autoHint = shortsAutoHint(s);

  const intent = intentPrompt({ tool: 'shortscut', title: handoff.ref?.name ?? null, scope });
  const template = toolTemplate('shortscut', intent, { lines: shortsLines(s, { hasTranslation }) });

  return (
    <>
      <PanelHead title={info.name} back={{ label: C.back, onPress: onBack }} />
      <div className={`${body} cc-scroll`}>
        <ToolCard name={info.name} lines={info.setup ?? [info.desc]} effect={toolEffect('shortscut')} />

        <div className={rows}>
          <Row label={C.scope}>
            <Picker
              aria-label={C.scope}
              size="S"
              styles={field}
              isDisabled={!chapters.length}
              selectedKey={scopeIndex >= 0 ? scopeKey : 'all'}
              onSelectionChange={(key) => setScopeKey(String(key ?? 'all'))}>
              {[
                <PickerItem key="all" id="all">
                  {C.scopeAll}
                </PickerItem>,
                ...chapters.map((c, i) => (
                  <PickerItem key={c.id} id={c.id}>
                    {C.scopeChapter(i + 1, c.label)}
                  </PickerItem>
                )),
              ]}
            </Picker>
            {chapters.length ? null : <p className={hint}>{C.scopeNoChapters}</p>}
          </Row>
          <Option
            label={C.shortsSkipDone}
            sub={s.skipDone ? C.shortsSkipDoneOn : C.shortsSkipDoneOff}
            isSelected={s.skipDone}
            onChange={(on) => set({ skipDone: on })}
          />
        </div>

        <h3 className={secHead}>{C.shortsShape}</h3>
        <div className={rows}>
          <Row label={C.shortsCount}>
            <Picker
              aria-label={C.shortsCount}
              size="S"
              styles={field}
              selectedKey={String(s.count)}
              onSelectionChange={(key) => {
                if (key == null) return;
                const next: ShortsCount = key === 'auto' ? 'auto' : Number(key);
                set({ count: next });
              }}>
              {SHORTS_COUNTS.map((c) => (
                <PickerItem key={String(c.key)} id={String(c.key)}>
                  {c.label}
                </PickerItem>
              ))}
            </Picker>
          </Row>
          <Row label={C.shortsLength}>
            <Picker
              aria-label={C.shortsLength}
              size="S"
              styles={field}
              selectedKey={s.length}
              onSelectionChange={(key) => {
                if (!key) return;
                const next = key as ShortsLength;
                // When switching to custom, start from both ends of the current range; when switching from auto, reuse the two ends from the last custom setting.
                const start = range ?? { min: s.lenMin, max: s.lenMax };
                set(next === 'custom' ? { length: next, lenMin: start.min, lenMax: start.max } : { length: next });
              }}>
              {SHORTS_LENGTHS.map((l) => (
                <PickerItem key={l.key} id={l.key}>
                  {l.label}
                </PickerItem>
              ))}
            </Picker>
            {s.length === 'custom' ? (
              <div className={pair}>
                <NumberField
                  aria-label={C.shortsMin}
                  size="S"
                  minValue={SHORTS_CUSTOM.min}
                  maxValue={SHORTS_CUSTOM.max}
                  step={1}
                  formatOptions={{ style: 'unit', unit: 'second', unitDisplay: 'short' }}
                  value={s.lenMin}
                  onChange={(n) => Number.isFinite(n) && set({ lenMin: n })}
                />
                <span className={hint}>{C.shortsTo}</span>
                <NumberField
                  aria-label={C.shortsMax}
                  size="S"
                  minValue={SHORTS_CUSTOM.min}
                  maxValue={SHORTS_CUSTOM.max}
                  step={1}
                  formatOptions={{ style: 'unit', unit: 'second', unitDisplay: 'short' }}
                  value={s.lenMax}
                  onChange={(n) => Number.isFinite(n) && set({ lenMax: n })}
                />
              </div>
            ) : null}
          </Row>
          {autoHint ? <p className={hint}>{autoHint}</p> : null}
          <Row label={C.shortsRatio}>
            <SegmentedControl aria-label={C.shortsRatio} selectedKey={s.ratio} onSelectionChange={(key) => set({ ratio: key as ShortsRatio })}>
              {SHORTS_RATIOS.map((r) => (
                <SegmentedControlItem key={r.key} id={r.key}>
                  {r.label}
                </SegmentedControlItem>
              ))}
            </SegmentedControl>
          </Row>
        </div>

        {s.ratio === 'source' ? null : (
          <>
            <h3 className={secHead}>{C.shortsFraming}</h3>
            <div className={rows}>
              <RadioGroup aria-label={C.shortsFraming} size="S" value={s.focus} onChange={(value) => set({ focus: value as ShortsFocus })}>
                {SHORTS_FOCUS.map((f) => (
                  <div key={f.key}>
                    <Radio value={f.key} isDisabled={!!f.off}>
                      {f.label}
                    </Radio>
                    <span className={radioSub}>{f.off ?? f.sub}</span>
                  </div>
                ))}
              </RadioGroup>
            </div>
          </>
        )}

        <h3 className={secHead}>{C.shortsSubtitles}</h3>
        <div className={rows}>
          {hasTranslation ? (
            <Row label={C.shortsTracks}>
              <SegmentedControl aria-label={C.shortsTracks} selectedKey={s.tracks} onSelectionChange={(key) => set({ tracks: key as ShortsTracks })}>
                {SHORTS_TRACKS.map((t) => (
                  <SegmentedControlItem key={t.key} id={t.key}>
                    {t.label}
                  </SegmentedControlItem>
                ))}
              </SegmentedControl>
            </Row>
          ) : (
            <p className={hint}>{C.shortsNoTranslation}</p>
          )}
          <RadioGroup aria-label={C.shortsStyle} size="S" value={s.style} onChange={(value) => set({ style: value as ShortsStyle })}>
            {SHORTS_STYLES.map((t) => (
              <div key={t.key}>
                <Radio value={t.key}>{t.label}</Radio>
                <span className={radioSub}>{t.sub}</span>
              </div>
            ))}
          </RadioGroup>
        </div>

        {handoff.guide ? <AgentGateLine guide={handoff.guide} /> : null}
        <AiToolPrompt
          key="shortscut"
          videoId={videoId}
          tool="shortscut"
          template={template}
          handoff={handoff}
          onDone={onBack}
          onSent={(sent) =>
            recordShortsRun({ conversationId: sent.conversationId, parentVideoId: videoId, taskId: sent.taskId, handedAt: sent.handedAt })
          }
          target="new"
          hint={C.shortsHint}
        />
      </div>
    </>
  );
}
