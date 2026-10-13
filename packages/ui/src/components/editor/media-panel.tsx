import { useEffect, useState, type DragEvent, type ReactNode } from 'react';
import type { AssetRecord, Id, Sequence } from '@cuccut/protocol';
import { mediaTimeToSeconds } from '@cuccut/protocol';
import { EditLabel } from '@cuccut/protocol/messages/ui';
import { ActionButton, Button, Link, Tab, TabList, TabPanel, Tabs, Text, ToastQueue, Tooltip, TooltipTrigger } from '@react-spectrum/s2';
import Add from '@react-spectrum/s2/icons/Add';
import AIMark from '@react-spectrum/s2/icons/AIMark';
import AudioWave from '@react-spectrum/s2/icons/AudioWave';
import Collection from '@react-spectrum/s2/icons/Collection';
import Image from '@react-spectrum/s2/icons/Image';
import Import from '@react-spectrum/s2/icons/Import';
import Microphone from '@react-spectrum/s2/icons/Microphone';
import MusicNote from '@react-spectrum/s2/icons/MusicNote';
import Pause from '@react-spectrum/s2/icons/Pause';
import Play from '@react-spectrum/s2/icons/Play';
import Translate from '@react-spectrum/s2/icons/Translate';
import Video from '@react-spectrum/s2/icons/Video';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { frameAt } from '../../model/editor.ts';
import { audioAside, dubGroupIds, libraryAssets, placeAsset, usageCount, type PlaceableKind } from '../../model/editor-ops.ts';
import { formatClock } from '../../model/format.ts';
import { formatBytes } from '../../model/space.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useEditor } from '../../state/editor-store.ts';
import { canEdit, useVideo } from '../../state/video-store.ts';
import { openAiTool } from './ai-tools-nav.ts';
import { useEditorActions } from './editor-context.tsx';
import { ImageGenPane } from './image-gen-panel.tsx';
import { MediaAssetMenu } from './media-asset-menu.tsx';
import { DubGroupCard } from './media-dub-groups.tsx';
import { AUDIO_GEN_COPY, generatedMark, IMAGE_GEN_COPY } from './media-gen-copy.ts';
import { useMediaGen, useMediaGenStore, type ImageSegment } from './media-gen-store.ts';
import { PanelHead, panelBody } from './panel-head.tsx';
import { ShortsMadeGroup } from './shorts-made-group.tsx';
import { ASSET_DRAG_TYPE } from './timeline.tsx';
import { TtsPanel } from './tts-panel.tsx';
import { useAssetUrl } from './use-asset-url.ts';
import { MEDIA_COPY as MC } from './media-copy.ts';

const body = style({ display: 'flex', flexDirection: 'column', gap: 8 });
/** Import box (prototype .vl-import): dashed box, description on the left, “Import” on the right; files can be dragged straight in. */
const importBox = style({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: 12,
  borderWidth: 1,
  borderStyle: 'dashed',
  borderRadius: 'lg',
  borderColor: { default: 'gray-400', isDropTarget: 'blue-800' },
  backgroundColor: { default: 'gray-75', isDropTarget: 'blue-100' },
  color: 'gray-700',
  '--iconPrimary': { type: 'fill', value: 'currentColor' },
});
const importText = style({ display: 'flex', flexDirection: 'column', gap: 4, flexGrow: 1, minWidth: 0 });
const strong = style({ font: 'ui-sm', fontWeight: 'bold', color: 'gray-900' });
const small = style({ font: 'ui-xs', color: 'gray-600' });
const heading = style({ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, paddingTop: 8, paddingX: 4 });
const list = style({ display: 'flex', flexDirection: 'column', gap: 4, margin: 0, padding: 0, listStyleType: 'none' });
const empty = style({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, paddingY: 24, textAlign: 'center' });
const foot = style({ font: 'ui-xs', color: 'gray-600', margin: 0, paddingX: 4 });
/** The generate entry row at the top of the audio page (prototype .mact): Generate voice / Clone voice. */
const genRow = style({ display: 'flex', flexWrap: 'wrap', gap: 8 });
/** The two segments of the image page (video media | AI generate): the tabs fill the area below the page header, and each segment scrolls on its own. */
const sourceTabs = style({ flexGrow: 1, flexShrink: 1, minHeight: 0 });
const sourceTabList = style({ marginX: 12, marginTop: 4 });
const sourcePane = style({ boxSizing: 'border-box', height: 'full', overflowY: 'auto', paddingX: 12, paddingTop: 12, paddingBottom: 12 });
/** Media card (prototype .vl-row): 96×54 thumbnail cell, name, specs, where it is used, and “Add to timeline” on the right. */
const card = style({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: 8,
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'gray-200',
  borderRadius: 'lg',
  backgroundColor: { default: 'gray-25', ':hover': 'gray-75' },
  cursor: 'grab',
});
const thumb = style({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  width: 96,
  height: 54,
  borderRadius: 'default',
  backgroundColor: 'gray-200',
  color: 'gray-600',
  '--iconPrimary': { type: 'fill', value: 'currentColor' },
});
const duration = style({
  position: 'absolute',
  insetEnd: 4,
  bottom: 4,
  paddingX: 4,
  borderRadius: 'sm',
  backgroundColor: 'gray-25',
  color: 'gray-900',
  fontSize: '[10px]',
  lineHeight: '[13px]',
});
const info = style({ display: 'flex', flexDirection: 'column', gap: 4, flexGrow: 1, minWidth: 0 });
const nameStyle = style({
  font: 'ui-sm',
  fontWeight: 'bold',
  color: 'gray-900',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});
const meta = style({ font: 'ui-xs', color: 'gray-600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
const used = style({ font: 'ui-xs', color: 'gray-700' });
/** The thumbnail cell of an audio card is itself the preview button (prototype .fthumb--btn): play / pause shows on hover or while playing, and the progress overlays the bottom edge. */
const thumbButton = style({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  width: 96,
  height: 54,
  padding: 0,
  borderWidth: 0,
  borderRadius: 'default',
  backgroundColor: { default: 'gray-200', ':hover': 'gray-300' },
  color: { default: 'gray-600', isPlaying: 'blue-800' },
  cursor: 'pointer',
  overflow: 'hidden',
  outlineStyle: { default: 'none', ':focus-visible': 'solid' },
  outlineWidth: 2,
  outlineColor: 'focus-ring',
  '--iconPrimary': { type: 'fill', value: 'currentColor' },
});
const playBadge = style({
  position: 'absolute',
  insetStart: 4,
  top: 4,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  size: 20,
  borderRadius: 'full',
  backgroundColor: 'gray-25',
  color: 'gray-900',
  '--iconPrimary': { type: 'fill', value: 'currentColor' },
});
const progress = style({ position: 'absolute', insetX: 0, bottom: 0, height: 4, backgroundColor: 'gray-300' });
const progressFill = style({ display: 'block', height: 'full', backgroundColor: 'blue-800' });
const hint = style({ font: 'ui-xs', color: 'gray-700', margin: 0, paddingX: 4 });
const againRow = style({ display: 'flex', alignItems: 'center', gap: 8, paddingX: 4, paddingTop: 4 });

const KIND_ICON = { video: Video, image: Image, audio: MusicNote };

/**
 * Media panel (product design §5.9): image, video and audio media each get a page, and all of them are the video's own media library. Importing and adding to the timeline are two separate actions:
 * importing brings the file into the media library; “Add to timeline” places it at the playhead, and media can also be dragged onto a row of the timeline.
 */
export function MediaPanel({ kind, sequence, assets }: { kind: PlaceableKind; sequence: Sequence; assets: Record<Id, AssetRecord> }) {
  const runtime = useRuntime();
  const { apply } = useEditorActions();
  const editable = useVideo((s) => canEdit(s.video));
  const [over, setOver] = useState(false);
  const available = libraryAssets(assets, kind);
  // Generate voice / Clone voice and AI image generation are desktop-only (the web host keeps only import; prototype model-surface.js).
  const videoId = useVideo((s) => s.video?.videoId ?? null);
  const ai = runtime.host.platform !== 'web' && videoId !== null;
  const gen = useMediaGen(videoId);
  const setGen = useMediaGenStore((s) => s.patch);
  // The audio page groups by dub (design draft `audioGroups`): one card per dub group; loose files stay laid out flat below the groups as before.
  const shape = kind === 'audio' ? dubGroupIds(sequence, available) : { groups: [], loose: available };
  // Preview: only one plays at a time (the state lives on the list).
  const [audition, setAudition] = useState<Id | null>(null);
  // The home for translated dubbing is on the tools page (design draft 2026-09-16); this page only points there.
  const redub = () => {
    if (videoId) openAiTool(videoId, 'dub');
  };

  const importPaths = async (paths: string[]) => {
    if (!paths.length) return;
    const receipt = await apply(
      paths.map((path) => ({ type: 'importAsset', path })),
      EditLabel.importAssets(),
    );
    if (receipt) ToastQueue.positive(MC.imported, { timeout: 4000 });
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    setOver(false);
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    const paths = [...event.dataTransfer.files].map((file) => runtime.host.pathForFile(file)).filter(Boolean);
    void importPaths(paths);
  };

  const addToTimeline = (asset: AssetRecord & { kind: PlaceableKind }) => {
    const frame = frameAt(useEditor.getState().playhead, sequence.fps);
    void apply(placeAsset(sequence, asset, frame), EditLabel.addClip());
  };

  if (ai && kind === 'audio' && gen.audio) {
    return <TtsPanel key={gen.audio} videoId={videoId} page={gen.audio} sequence={sequence} assets={assets} />;
  }

  const library = (
    <div className={body}>
      {/* The parent video's “Short clips cut out” (product design §5.10; the prototype panel-media.jsx places it above the video library): takes no space when there are no child videos. */}
      {kind === 'video' && videoId ? <ShortsMadeGroup videoId={videoId} /> : null}
      {ai && kind === 'audio' ? (
        <div className={genRow}>
          <TooltipTrigger>
            <Button variant="secondary" size="S" isDisabled={!editable} onPress={() => setGen(videoId, { audio: 'tts' })}>
              <AudioWave />
              <Text>{AUDIO_GEN_COPY.generate}</Text>
            </Button>
            <Tooltip>{AUDIO_GEN_COPY.generateTip}</Tooltip>
          </TooltipTrigger>
          <TooltipTrigger>
            <Button variant="secondary" size="S" isDisabled={!editable} onPress={() => setGen(videoId, { audio: 'clone' })}>
              <Microphone />
              <Text>{AUDIO_GEN_COPY.clone}</Text>
            </Button>
            <Tooltip>{AUDIO_GEN_COPY.cloneTip}</Tooltip>
          </TooltipTrigger>
        </div>
      ) : null}
      <div
        className={importBox({ isDropTarget: over })}
        onDragOver={(event) => {
          if (!editable || !event.dataTransfer.types.includes('Files')) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}>
        <Import />
        <span className={importText}>
          <span className={strong}>{MC.addKind(kind)}</span>
          <span className={small}>{MC.dropOrPick(kind)}</span>
        </span>
        <Button
          variant="secondary"
          size="S"
          isDisabled={!editable}
          onPress={() => void runtime.host.pickMediaFiles().then(importPaths)}>
          <Import />
          <Text>{MC.import}</Text>
        </Button>
      </div>
      <div className={heading}>
        <span className={strong}>{MC.existing(kind)}</span>
        <span className={small}>{audioAside(shape.groups.length, available.length)}</span>
      </div>
      {shape.groups.map((groupId) => (
        <DubGroupCard key={groupId} groupId={groupId} sequence={sequence} assets={assets} editable={editable} />
      ))}
      {ai && kind === 'audio' ? (
        shape.groups.length ? (
          <div className={againRow}>
            <Button variant="secondary" size="S" onPress={redub}>
              <Translate />
              <Text>{MC.dubAnother}</Text>
            </Button>
            <span className={small}>{MC.dubbedGroups(shape.groups.length)}</span>
          </div>
        ) : (
          <p className={hint}>
            {MC.dubHintBefore}
            <Link onPress={redub}>{MC.dubHintLink}</Link>
            {MC.dubHintAfter}
          </p>
        )
      ) : null}
      {shape.loose.length ? (
        <ul className={list} aria-label={MC.existing(kind)}>
          {shape.loose.map((asset) => (
            <AssetRow
              key={asset.id}
              asset={asset}
              uses={usageCount(sequence, asset.id)}
              editable={editable}
              onAdd={() => addToTimeline(asset)}
              playing={audition === asset.id}
              onAudition={(on) => setAudition(on ? asset.id : null)}
              menu={<MediaAssetMenu asset={asset} sequence={sequence} assets={assets} editable={editable} />}
            />
          ))}
        </ul>
      ) : shape.groups.length ? null : (
        <div className={empty}>
          <span className={strong}>{MC.emptyLibrary}</span>
          <span className={small}>{MC.emptyHint}</span>
        </div>
      )}
      <p className={foot}>
        {MC.foot}
      </p>
    </div>
  );

  // Image page: two segments, video media | AI generate (design draft panel-media.jsx `IMAGE_TABS`); which segment is selected is remembered per video.
  if (ai && kind === 'image') {
    return (
      <>
        <PanelHead title={MC.panelTitle(kind)} />
        <Tabs
          aria-label={IMAGE_GEN_COPY.segments}
          styles={sourceTabs}
          density="compact"
          selectedKey={gen.image}
          onSelectionChange={(key) => setGen(videoId, { image: key as ImageSegment })}>
          <TabList aria-label={IMAGE_GEN_COPY.segments} styles={sourceTabList}>
            <Tab id="project">
              <Collection />
              <Text>{IMAGE_GEN_COPY.project}</Text>
            </Tab>
            <Tab id="gen">
              <AIMark />
              <Text>{IMAGE_GEN_COPY.gen}</Text>
            </Tab>
          </TabList>
          <TabPanel id="project">
            <div className={`${sourcePane} cc-scroll`}>{library}</div>
          </TabPanel>
          <TabPanel id="gen">
            <ImageGenPane videoId={videoId} sequence={sequence} assets={assets} />
          </TabPanel>
        </Tabs>
      </>
    );
  }

  return (
    <>
      <PanelHead title={MC.panelTitle(kind)} />
      <div className={`${panelBody} cc-scroll`}>{library}</div>
    </>
  );
}

function AssetRow({
  asset,
  uses,
  editable,
  onAdd,
  playing,
  onAudition,
  menu,
}: {
  asset: AssetRecord & { kind: PlaceableKind };
  uses: number;
  editable: boolean;
  onAdd(): void;
  playing: boolean;
  onAudition(on: boolean): void;
  menu: ReactNode;
}) {
  const revision = asset.revisions[asset.currentRevision];
  const Icon = KIND_ICON[asset.kind];
  const seconds = revision?.duration && asset.kind !== 'image' ? mediaTimeToSeconds(revision.duration) : null;
  const [played, setPlayed] = useState(0);
  const parts: string[] = [];
  if (revision?.video) parts.push(`${revision.video.displayWidth}×${revision.video.displayHeight}`);
  if (revision) parts.push(formatBytes(revision.byteLength));
  // Linked media stays in its original location and is not copied into the video folder.
  if (revision?.storage.mode === 'linked') parts.push(MC.linked);
  // Generated media (generated voice, AI-generated images) carries a “Generated” badge; its provenance (task, model, parameters) is recorded with the media.
  if (revision?.provenance.origin === 'generated') parts.push(generatedMark());
  return (
    <li
      className={card}
      draggable={editable}
      onDragStart={(event) => {
        event.dataTransfer.setData(ASSET_DRAG_TYPE, asset.id);
        event.dataTransfer.effectAllowed = 'copy';
      }}>
      {asset.kind === 'audio' ? (
        // The thumbnail cell of an audio card is the preview button (design draft 2026-09-11): one click plays it in place, with no need to add it to the timeline first; while playing, the duration slot changes to elapsed time.
        <button
          type="button"
          className={thumbButton({ isPlaying: playing })}
          aria-label={playing ? MC.pauseAuditionOf(asset.name) : MC.auditionOf(asset.name)}
          aria-pressed={playing}
          title={playing ? MC.pauseAudition : MC.auditionTip}
          onClick={() => {
            setPlayed(0);
            onAudition(!playing);
          }}>
          <AudioWave />
          <span className={playBadge}>{playing ? <Pause /> : <Play />}</span>
          {seconds !== null ? <span className={duration}>{formatClock(playing ? played : seconds)}</span> : null}
          {playing ? (
            <>
              <span className={progress}>
                <span className={progressFill} style={{ width: `${seconds ? Math.min(100, (played / seconds) * 100) : 0}%` }} />
              </span>
              <Audition asset={asset} onTime={setPlayed} onEnd={() => onAudition(false)} />
            </>
          ) : null}
        </button>
      ) : (
        <span className={thumb} aria-hidden>
          <Icon />
          {seconds !== null ? <span className={duration}>{formatClock(seconds)}</span> : null}
        </span>
      )}
      <span className={info}>
        <span className={nameStyle} title={asset.name}>
          {asset.name}
        </span>
        <span className={meta}>{parts.join(' · ') || MC.kindName(asset.kind)}</span>
        <span className={used}>{uses > 0 ? MC.usedTimes(uses) : MC.unused}</span>
      </span>
      <TooltipTrigger>
        <ActionButton isQuiet aria-label={MC.addToTimelineOf(asset.name)} isDisabled={!editable} onPress={onAdd}>
          <Add />
        </ActionButton>
        <Tooltip>{MC.addToTimelineTip}</Tooltip>
      </TooltipTrigger>
      {menu}
    </li>
  );
}

/** The clip being previewed: the address is requested from the Runtime per media version and played once received; stops when it ends or on error. */
function Audition({ asset, onTime, onEnd }: { asset: AssetRecord; onTime(seconds: number): void; onEnd(): void }) {
  const videoId = useVideo((s) => s.video?.videoId ?? null);
  const { url, error } = useAssetUrl(videoId, { id: asset.id, revision: asset.currentRevision });
  useEffect(() => {
    if (!error) return;
    ToastQueue.negative(MC.auditionFailed(asset.name, error), { timeout: 4000 });
    onEnd();
  }, [error]); // eslint-disable-line react-hooks/exhaustive-deps -- only prompt once, at the moment of the error
  return url && !error ? (
    <audio
      src={url}
      autoPlay
      hidden
      onTimeUpdate={(event) => onTime(event.currentTarget.currentTime)}
      onEnded={onEnd}
      onError={() => {
        ToastQueue.negative(MC.auditionFailedPlain(asset.name), { timeout: 4000 });
        onEnd();
      }}
    />
  ) : null;
}
