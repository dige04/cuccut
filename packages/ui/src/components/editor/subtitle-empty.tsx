import { useMemo } from 'react';
import type { AssetRecord, DocumentRecord, Id, Sequence } from '@cuccut/protocol';
import { Button, Menu, MenuItem, MenuTrigger, Text } from '@react-spectrum/s2';
import CloseCaptions from '@react-spectrum/s2/icons/CloseCaptions';
import Import from '@react-spectrum/s2/icons/Import';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { useEditor } from '../../state/editor-store.ts';
import { SUBTITLE_COPY as C } from './subtitle-copy.ts';
import { TRANSCRIBE_SETUP_COPY } from './transcribe-copy.ts';
import { generateFromSpeech, mediaCandidates, startTranscribe, type MediaCandidate } from './transcribe-run.ts';
import { TranscribeSettings, useTranscribeRequest } from './transcribe-settings.tsx';

/** Once the transcription settings are expanded they may be taller than the panel, so the empty state scrolls by itself. */
const scroller = style({ flexGrow: 1, minHeight: 0, overflowY: 'auto' });
const centered = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
  paddingX: 24,
  paddingY: 40,
  textAlign: 'center',
});
const emptyIcon = style({ '--iconPrimary': { type: 'fill', value: 'gray-500' } });
const emptyTitle = style({ font: 'title-sm', color: 'gray-900', margin: 0 });
const emptyText = style({ font: 'ui-sm', color: 'gray-600', margin: 0 });
const emptyActions = style({ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 8 });
const settings = style({ alignSelf: 'stretch', marginTop: 16, textAlign: 'start' });
const settingsNote = style({ margin: 0, marginTop: 4, font: 'ui-xs', color: 'gray-600' });

/**
 * Subtitle empty state (prototype panel-subtitle.jsx lines 316–324): when there is media, the primary button is “Generate subtitles”; when there is none, “Add media”. Importing a subtitle file is always available.
 * The clips to transcribe are only those placed on the timeline: with one clip it is used directly, with several a menu picks one. If the clip has already been transcribed, that transcript is used directly and nothing is recognized again.
 * When there is a clip to transcribe, a collapsed “transcription settings: language, speech model, recognition prompt” hangs below the button; leaving it untouched means the defaults.
 */
export function SubtitleEmpty({
  videoId,
  sequence,
  assets,
  documents,
  editable,
  busy,
  onImport,
}: {
  videoId: Id;
  sequence: Sequence;
  assets: Record<Id, AssetRecord>;
  documents: Record<Id, DocumentRecord>;
  editable: boolean;
  /** This video is being transcribed or generated: the button stays disabled so it cannot be clicked twice. */
  busy: boolean;
  onImport(): void;
}) {
  const candidates = useMemo(() => mediaCandidates(sequence, assets, documents), [sequence, assets, documents]);
  const hasMedia = Object.values(assets).some((asset) => asset.kind === 'video' || asset.kind === 'audio');
  const only = candidates.length === 1 ? candidates[0]! : null;
  const request = useTranscribeRequest(videoId);
  const run = (candidate: MediaCandidate) =>
    candidate.speech ? void generateFromSpeech(videoId, candidate.asset, candidate.speech.id) : void startTranscribe(videoId, candidate.asset, request);
  const toTranscribe = candidates.filter((candidate) => !candidate.speech).length;
  const text = !hasMedia ? C.emptyNoMedia : !candidates.length ? C.emptyNotPlaced : only?.speech ? C.emptyReuse(only.asset.name) : C.emptyReady;
  const disabled = !editable || busy;

  let primary;
  if (!candidates.length) {
    primary = (
      <Button variant="secondary" onPress={() => useEditor.getState().showPanel('video')}>
        {C.addMedia}
      </Button>
    );
  } else if (only) {
    primary = (
      <Button variant="secondary" isDisabled={disabled} onPress={() => run(only)}>
        {C.generate}
      </Button>
    );
  } else {
    primary = (
      <MenuTrigger>
        <Button variant="secondary" isDisabled={disabled}>
          {C.generate}
        </Button>
        <Menu
          aria-label={C.pickAsset}
          onAction={(key) => {
            const candidate = candidates.find((c) => c.asset.id === key);
            if (candidate) run(candidate);
          }}>
          {candidates.map((candidate) => (
            <MenuItem key={candidate.asset.id} id={candidate.asset.id} textValue={candidate.asset.name}>
              <Text slot="label">{candidate.asset.name}</Text>
              <Text slot="description">{candidate.speech ? C.pickReuse : C.pickTranscribe}</Text>
            </MenuItem>
          ))}
        </Menu>
      </MenuTrigger>
    );
  }

  return (
    <div className={`${scroller} cc-scroll`}>
      <div className={centered}>
        <span className={emptyIcon}>
          <CloseCaptions />
        </span>
        <h3 className={emptyTitle}>{C.emptyTitle}</h3>
        <p className={emptyText}>{text}</p>
        <div className={emptyActions}>
          {primary}
          <Button variant="secondary" isDisabled={!editable} onPress={onImport}>
            <Import />
            <Text>{C.importFile}</Text>
          </Button>
        </div>
        {toTranscribe ? (
          <div className={settings}>
            <TranscribeSettings videoId={videoId} documents={documents} editable={editable} />
            {toTranscribe < candidates.length ? <p className={settingsNote}>{TRANSCRIBE_SETUP_COPY.reuse}</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
