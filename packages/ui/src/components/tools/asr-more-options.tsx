import { useState } from 'react';
import { Button, Disclosure, DisclosurePanel, DisclosureTitle, ProgressBar, Switch } from '@react-spectrum/s2';
import Download from '@react-spectrum/s2/icons/Download';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import type { ModelBundleStatus, TranscribeModelInfo } from '@cuccut/protocol';
import { inlineInstallMode } from '../../model/models-install.ts';
import { fmtSize } from '../../model/task-facts.ts';
import {
  speakerCopy,
  speakerGateLine,
  speakerPackFacts,
  speakerPackId,
  speakerPackInstalled,
  speakerSwitch,
  type SpeakerPackFacts,
  type SpeakerSwitch,
} from '../../model/transcribe-speakers.ts';
import { useModels } from '../../state/models-store.ts';
import { InstallDialog } from '../models/install-dialog.tsx';
import { detail } from './tool-parts.tsx';
import { TRANSCRIBE_TOOL_COPY } from './tools-copy.ts';

/*
 * “更多选项” (More options) below the speech model: identify speakers (design file tool-transcribe.jsx `AsrMoreOptions`, tools.css `.asrmore`). Shared by the transcription tool page and
 * re-transcription. Collapsed by default; the title shows the current state, and while collapsed it still shows why the job cannot start. If it is switched on but speaker diarization is not installed, a download is offered in place (through the same install dialog as the model page),
 * and it stays on once the download finishes.
 */

const subtitle = style({ marginStart: 8, font: 'ui-sm', fontWeight: 'normal', color: 'gray-600' });
const body = style({ display: 'flex', flexDirection: 'column', alignItems: 'start', gap: 4 });
const gate = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  alignSelf: 'stretch',
  marginTop: 4,
  paddingY: 8,
  paddingX: 12,
  borderRadius: 'default',
  backgroundColor: 'orange-100',
  font: 'ui-xs',
  color: 'orange-1000',
});
const gateText = style({ flexGrow: 1, minWidth: 0 });
const bar = style({ width: 120 });

export interface SpeakerState {
  s: SpeakerSwitch;
  pack: ModelBundleStatus | null;
  facts: SpeakerPackFacts;
  /** Whether the in-place download of the speaker model is a fresh download or a completion (`inlineInstallMode`). */
  mode: 'install' | 'complete';
}

/** The current state of “识别说话人” (Identify speakers) for this speech model: `pick` is the value the user set by hand (null if never set). */
export function useSpeakerState(info: TranscribeModelInfo | null | undefined, pick: boolean | null): SpeakerState {
  const bundles = useModels((s) => s.bundles);
  const id = speakerPackId(info);
  const pack = id ? (bundles.find((b) => b.bundleId === id) ?? null) : null;
  return {
    s: speakerSwitch(info, pick, speakerPackInstalled(info, pack)),
    pack,
    facts: speakerPackFacts(pack, fmtSize),
    mode: pack ? inlineInstallMode(pack, bundles) : 'install',
  };
}

export function AsrMoreOptions({ state, name, onPick }: { state: SpeakerState; name: string; onPick: (on: boolean) => void }) {
  const { s, pack, facts } = state;
  // The choice between download and completion is fixed when the dialog opens; the plan does not change during a download.
  const [installing, setInstalling] = useState<'install' | 'complete' | null>(null);
  const copy = speakerCopy(s, name, facts);
  const install = pack?.install;
  const running = !!install && install.state !== 'paused';
  const pct = running
    ? install.totalBytes
      ? Math.min(100, Math.floor((install.receivedBytes / install.totalBytes) * 100))
      : null
    : undefined;
  return (
    <>
      <Disclosure isQuiet size="S">
        <DisclosureTitle>
          {TRANSCRIBE_TOOL_COPY.more}
          <span className={subtitle}>{copy.summary}</span>
        </DisclosureTitle>
        <DisclosurePanel>
          <div className={body}>
            <Switch size="S" isSelected={s.on} isDisabled={s.locked} onChange={onPick}>
              {TRANSCRIBE_TOOL_COPY.speakers}
            </Switch>
            <span className={detail}>{copy.note}</span>
            {s.missing ? (
              <div className={gate} role={running ? 'status' : undefined}>
                <span className={gateText}>{speakerGateLine(facts, pct)}</span>
                {running ? (
                  <ProgressBar
                    size="S"
                    styles={bar}
                    aria-label={speakerGateLine(facts, pct)}
                    isIndeterminate={pct === null}
                    value={pct ?? undefined}
                  />
                ) : pack ? (
                  <Button variant="secondary" size="S" onPress={() => setInstalling(state.mode)}>
                    <Download />
                    {install?.state === 'paused' ? TRANSCRIBE_TOOL_COPY.resumePack : TRANSCRIBE_TOOL_COPY.downloadPack}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </DisclosurePanel>
      </Disclosure>
      {installing && pack ? (
        <InstallDialog
          bundleId={pack.bundleId}
          name={facts.name}
          license={pack.license ?? null}
          mode={installing}
          onClose={() => setInstalling(null)}
        />
      ) : null}
    </>
  );
}
