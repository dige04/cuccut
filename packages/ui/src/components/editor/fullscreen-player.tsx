import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactElement, type ReactNode, type RefObject } from 'react';
import { sequenceDisplayName, type AssetRecord, type DocumentRecord, type Id, type Sequence } from '@cuccut/protocol';
import {
  ActionButton,
  Header,
  Keyboard,
  Menu,
  MenuItem,
  MenuSection,
  MenuTrigger,
  Provider,
  Slider,
  Text,
  ToastQueue,
  ToggleButton,
  Tooltip,
  TooltipTrigger,
} from '@react-spectrum/s2';
import ChevronDoubleLeft from '@react-spectrum/s2/icons/ChevronDoubleLeft';
import ChevronDoubleRight from '@react-spectrum/s2/icons/ChevronDoubleRight';
import CloseCaptions from '@react-spectrum/s2/icons/CloseCaptions';
import FullScreenExit from '@react-spectrum/s2/icons/FullScreenExit';
import HelpCircle from '@react-spectrum/s2/icons/HelpCircle';
import Pause from '@react-spectrum/s2/icons/Pause';
import Play from '@react-spectrum/s2/icons/Play';
import Refresh from '@react-spectrum/s2/icons/Refresh';
import VolumeOff from '@react-spectrum/s2/icons/VolumeOff';
import VolumeOne from '@react-spectrum/s2/icons/VolumeOne';
import VolumeTwo from '@react-spectrum/s2/icons/VolumeTwo';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { UNSAFE_PortalProvider } from 'react-aria/PortalProvider';
import { Slider as AriaSlider, SliderThumb, SliderTrack } from 'react-aria-components/Slider';
import { PREVIEW_KEYS_COPY } from '../../copy.ts';
import { captionChips, languageName } from '../../model/caption-tracks.ts';
import { chapterAt, nextChapterStart, prevChapterStart, sequenceChapters, visibleChapters, type ChapterSpan } from '../../model/chapters.ts';
import { durationSeconds, playButtonState, type PlayButtonState } from '../../model/editor.ts';
import { formatTenths } from '../../model/format.ts';
import { keyLabel } from '../../model/key-labels.ts';
import {
  PLAYER_KEYS,
  SEEK_STEP,
  SEEK_STEP_LONG,
  captionAvailability,
  captionModes,
  chapterTicks,
  chromeHidden,
  cycleCaptionMode,
  effectiveCaptionMode,
  holdingVisible,
  percentTime,
  previewSize,
  resolvePlayerKey,
  seekFraction,
  seekFrame,
  stepTime,
  timeAt,
  type CaptionMode,
  type PlayerKey,
} from '../../model/player.ts';
import { monitorGain, monitorLevel, stepMonitor, toggleMute, type MonitorLevel } from '../../model/preview-volume.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useEditor } from '../../state/editor-store.ts';
import { PLAYBACK_RATES } from '../../state/player-store.ts';
import { useVideo } from '../../state/video-store.ts';
import { P } from '../player/player-copy.ts';
import { CHAPTER_COPY } from './chapter-copy.ts';
import { useEditorActions } from './editor-context.tsx';
import { EDITOR_COPY as E } from './editor-copy.ts';
import { FULLSCREEN_PLAYER_COPY as F } from './fullscreen-player-copy.ts';
import './fullscreen-player.css';

/**
 * The editor's fullscreen player (prototype player.jsx and model-player.js; the criteria are in model/player.ts). When the preview stage goes fullscreen (preview.tsx), it is laid over the picture:
 *
 * - The picture is not redrawn: it is still the preview engine's single instance. Only the captions are filtered by level (`engine.setCaptionView`), and the playback rate is multiplied into the clock (`engine.setRate`). Both are view state of this window: they do not enter the video, undo, or affect export. The caption level applies only to this fullscreen session; on exit it returns to the stage's caption visibility. The playback rate is shared with the stage toolbar (editor-store), and stays as set after exiting fullscreen.
 * - Controls: progress bar (chapter ticks; on hover, a bubble with one frame of picture, the timecode and the chapter name; dragging), play, previous / next chapter, volume (the slider expands on hover), timecode, four caption levels, playback rate, key table, exit fullscreen. While playing and the mouse has not moved for 3 seconds, the controls hide together with the pointer (`chromeHidden`).
 * - Keyboard: in fullscreen the player has exclusive use (it captures in the capture phase, and the editor's shortcuts yield; see `useEditorKeys` in video-editor). The key table is `PLAYER_KEYS`. When the browser grants keyboard lock (Chromium / Electron), Esc goes to the player: with the key table open, Esc closes the table first, and a second press exits. Without the lock, Esc is handled by the browser and exits fullscreen directly.
 * - A single click on the picture = play / pause; a double click = exit fullscreen.
 *
 * This layer sits on top of the video and cannot know the brightness underneath, so it does not flip with the light or dark theme. Controls use S2's `staticColor="white"`, a gradient mask sits under the control bar, and menus, tooltips and sliders use the dark scheme (wrapped in a `Provider colorScheme="dark"`). Popovers are mounted inside the fullscreen stage, since only its subtree is visible while fullscreen.
 */

const MAC = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
const PLAY_ICON = { play: Play, pause: Pause, replay: Refresh } satisfies Record<PlayButtonState, unknown>;

const root = style({ position: 'absolute', inset: 0, outlineStyle: 'none' });
/** The layer on the picture that takes clicks and double clicks: covers the whole stage. The hint card on the stage (`children`) and the controls sit above it. */
const surface = style({ position: 'absolute', inset: 0 });
const title = style({ font: 'title', color: 'white', truncate: true });
const subtitle = style({ font: 'ui-sm', color: 'transparent-white-800', truncate: true });
const row = style({ display: 'flex', alignItems: 'center', gap: 8 });
const spacer = style({ flexGrow: 1 });
const clock = style({ font: 'code-sm', color: 'white', whiteSpace: 'nowrap', paddingX: 4 });
const clockTotal = style({ color: 'transparent-white-600' });
const volumeSlider = style({ width: 80, flexShrink: 0 });
const keyRow = style({ display: 'flex', alignItems: 'center', gap: 12, minHeight: 24, font: 'ui-sm', color: 'transparent-white-800' });
const keyLabelStyle = style({ flexGrow: 1, minWidth: 0 });
const keyPill = style({ flexShrink: 0, paddingX: '[6px]', borderRadius: 'sm', backgroundColor: 'transparent-white-200', color: 'white', font: 'code-xs', whiteSpace: 'nowrap' });
const keysTitle = style({ font: 'title', color: 'white', marginTop: 0, marginBottom: 12 });
const keysFooter = style({ font: 'ui-xs', color: 'transparent-white-600', marginTop: 12, marginBottom: 0 });
const seekFill = style({ backgroundColor: 'accent' });
const bubbleTime = style({ font: 'code-xs', color: 'white' });
const bubbleChapter = style({ font: 'ui-xs', color: 'transparent-white-800', maxWidth: 220, truncate: true });

/** The browser's keyboard lock (Keyboard Lock API; it can lock Esc only in fullscreen). Safari and Firefox do not have it. */
type KeyboardLock = { lock?(keys?: string[]): Promise<void>; unlock?(): void };

/** Put the preview stage into fullscreen (F, and the entry button at the top of the preview). It must be called within the user gesture, because browsers only accept transient activation. If it cannot be entered, show a hint saying so. */
export function enterPreviewFullscreen(stage: HTMLElement | null): void {
  const failed = () => ToastQueue.neutral(PREVIEW_KEYS_COPY.fullscreenFailed, { timeout: 5000 });
  if (!stage?.requestFullscreen) return void failed();
  void stage.requestFullscreen().catch(failed);
}

export function exitPreviewFullscreen(): void {
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
}

export function FullscreenPlayer({
  stage,
  sequence,
  assets,
  documents,
  children,
}: {
  /** The element that goes fullscreen (the preview stage): popovers are mounted inside it. */
  stage: RefObject<HTMLElement | null>;
  sequence: Sequence;
  assets: Record<Id, AssetRecord>;
  documents: Record<Id, DocumentRecord>;
  /** Hint card on the stage (the main media cannot play, loading and stalling): sits between the click layer on the picture and the controls. */
  children?: ReactNode;
}) {
  const { engine, seek, togglePlay } = useEditorActions();
  const playing = useEditor((s) => s.playing);
  const playhead = useEditor((s) => s.playhead);
  const name = useVideo((s) => s.video?.state?.video.name ?? s.video?.ref?.name) ?? sequenceDisplayName(sequence);
  const duration = durationSeconds(sequence);
  const chapters = useMemo(() => sequenceChapters(sequence), [sequence]);
  const shownChapters = useMemo(() => visibleChapters(chapters), [chapters]);
  const chapter = chapters[chapterAt(chapters, playhead)] ?? null;
  const rootRef = useRef<HTMLDivElement>(null);

  // Volume follows the engine (↑/↓ and M in the editor adjust the same volume listener).
  const [level, setLevelState] = useState<MonitorLevel>(() => monitorLevel(engine.monitor));
  useEffect(() => engine.onMonitor((gain) => setLevelState(monitorLevel(gain))), [engine]);
  const setLevel = useCallback((next: MonitorLevel) => engine.setMonitor(monitorGain(next)), [engine]);

  // Playback rate is shared with the stage toolbar (editor-store); preview.tsx hands it to the engine.
  const rate = useEditor((s) => s.rate);
  const setRate = useEditor((s) => s.setRate);

  // Caption level: if the level chosen before is still available, use it; otherwise take the default according to the captions actually on screen. If captions are hidden on the stage, start from “Off”.
  const [picked, setPicked] = useState<CaptionMode | null>(() => (useEditor.getState().captionsHidden ? 'off' : null));
  const { hasSource, hasTranslation } = useMemo(() => captionAvailability(sequence, documents), [sequence, documents]);
  const mode = effectiveCaptionMode(picked, hasSource, hasTranslation);
  const modes = captionModes(hasSource, hasTranslation);
  const languages = useMemo(() => captionLanguages(sequence, documents), [sequence, documents]);
  // After exiting fullscreen, preview.tsx restores it according to the stage's caption visibility.
  useEffect(() => engine.setCaptionView(mode), [engine, mode]);

  // ---- Auto-hide ----
  const [popup, setPopup] = useState<'captions' | 'rate' | null>(null);
  const [keysOpen, setKeysOpen] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [volumeDragging, setVolumeDragging] = useState(false);
  const lastPoke = useRef(performance.now());
  const [idleMs, setIdleMs] = useState(0);
  const poke = useCallback(() => {
    lastPoke.current = performance.now();
    setIdleMs(0);
  }, []);
  useEffect(() => {
    // Start the timer only when hiding is possible: while paused, the condition is always false.
    if (!playing) return;
    const timer = setInterval(() => setIdleMs(performance.now() - lastPoke.current), 250);
    return () => clearInterval(timer);
  }, [playing]);
  const holding = holdingVisible({ scrubbing, popup: popup !== null || keysOpen, volumeDragging });
  const hidden = chromeHidden({ playing, hovering, holding, idleMs });

  // Move focus into the fullscreen subtree. If it stayed outside, Tab would land on editor controls that are not visible.
  useEffect(() => rootRef.current?.focus({ preventScroll: true }), []);

  // Esc goes to the player: this only works when the lock is held in fullscreen. The key table says “press Esc to close this table” only when the lock is held.
  const [escOwned, setEscOwned] = useState(false);
  useEffect(() => {
    const keyboard = (navigator as Navigator & { keyboard?: KeyboardLock }).keyboard;
    if (!keyboard?.lock) return;
    let alive = true;
    keyboard.lock(['Escape']).then(
      () => alive && setEscOwned(true),
      () => {},
    );
    return () => {
      alive = false;
      keyboard.unlock?.();
    };
  }, []);

  const playState = playButtonState({ playing, playhead, duration });
  const playPause = () => {
    // Stopped at the end: play again from the start.
    if (playButtonState({ playing: engine.playing, playhead: useEditor.getState().playhead, duration }) === 'replay') seek(0);
    togglePlay();
  };

  const run = ({ action, digit }: PlayerKey) => {
    const now = useEditor.getState().playhead;
    switch (action) {
      case 'keys':
        return setKeysOpen((open) => !open);
      case 'exit':
        // Close the key table first when it is open: with a table open, pressing Esc means closing that table, not exiting the video as well.
        if (keysOpen) return setKeysOpen(false);
        return exitPreviewFullscreen();
      case 'play':
        return playPause();
      case 'back':
      case 'fwd':
        return seek(stepTime(now, action === 'back' ? -SEEK_STEP : SEEK_STEP, duration));
      case 'back10':
      case 'fwd10':
        return seek(stepTime(now, action === 'back10' ? -SEEK_STEP_LONG : SEEK_STEP_LONG, duration));
      case 'prevChapter':
        return seek(prevChapterStart(chapters, now));
      case 'nextChapter':
        return seek(nextChapterStart(chapters, now));
      case 'volUp':
      case 'volDown':
        return setLevel(stepMonitor(level, action === 'volUp' ? 1 : -1));
      case 'mute':
        return setLevel(toggleMute(level));
      case 'captions':
        return setPicked(cycleCaptionMode(mode, hasSource, hasTranslation));
      case 'start':
        return seek(0);
      case 'end':
        return seek(duration);
      case 'percent':
        return seek(percentTime(digit ?? 0, duration));
    }
  };
  const latest = useRef({ run, poke, popup });
  latest.current = { run, poke, popup };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;
      // While a menu is open, the arrow keys, Enter and Esc go to the menu.
      if (latest.current.popup) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="textbox"]')) return;
      const key = resolvePlayerKey(event);
      if (!key) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      latest.current.poke();
      latest.current.run(key);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const portal = useCallback(() => stage.current ?? document.body, [stage]);
  const PlayIcon = PLAY_ICON[playState];
  const VolumeIcon = level.muted || level.volume === 0 ? VolumeOff : level.volume <= 50 ? VolumeOne : VolumeTwo;
  const noChapters = shownChapters.length === 0;
  const captionSub = (m: CaptionMode) => (m === 'source' ? languages.original : m === 'trans' ? languages.translation : null);

  return (
    <UNSAFE_PortalProvider getContainer={portal}>
      <div
        ref={rootRef}
        className={`${root} cc-fsp`}
        data-idle={hidden || undefined}
        tabIndex={-1}
        role="region"
        aria-label={F.region}
        onPointerMove={poke}
        onPointerDown={poke}>
        <div
          className={surface}
          onClick={() => {
            poke();
            playPause();
          }}
          onDoubleClick={exitPreviewFullscreen}
        />
        {children}
        <Provider colorScheme="dark" UNSAFE_className="cc-fsp-chrome">
          <div className="cc-fsp-top">
            <div className={title}>{name}</div>
            {chapter ? <div className={subtitle}>{chapter.title}</div> : null}
          </div>

          {keysOpen ? (
            <div className="cc-fsp-keys" onClick={() => setKeysOpen(false)}>
              <div className="cc-fsp-keys-card" role="dialog" aria-label={F.keysTitle} onClick={(event) => event.stopPropagation()}>
                <h2 className={keysTitle}>{F.keysTitle}</h2>
                {PLAYER_KEYS.map((key) => (
                  <div key={key.action} className={keyRow}>
                    <span className={keyLabelStyle}>{F.keys[key.action as keyof typeof F.keys]}</span>
                    <Keyboard styles={keyPill}>{keyLabel(key.keys, MAC)}</Keyboard>
                  </div>
                ))}
                {escOwned ? <p className={keysFooter}>{F.keysFooter}</p> : null}
              </div>
            </div>
          ) : null}

          <div
            className="cc-fsp-bar"
            onPointerEnter={() => {
              setHovering(true);
              poke();
            }}
            onPointerLeave={() => setHovering(false)}>
            <SeekBar
              sequence={sequence}
              assets={assets}
              duration={duration}
              playhead={playhead}
              chapters={chapters}
              ticks={chapterTicks(shownChapters, duration)}
              onSeek={seek}
              onScrub={setScrubbing}
            />
            <div className={row}>
              <Tip label={E.playTip[playState]}>
                <ActionButton isQuiet staticColor="white" size="L" aria-label={E.playLabel[playState]} onPress={playPause}>
                  <PlayIcon />
                </ActionButton>
              </Tip>
              <Tip label={`${CHAPTER_COPY.prev} ${keyLabel('⇧←', MAC)}`}>
                <ActionButton
                  isQuiet
                  staticColor="white"
                  aria-label={CHAPTER_COPY.prev}
                  isDisabled={noChapters}
                  onPress={() => seek(prevChapterStart(chapters, useEditor.getState().playhead))}>
                  <ChevronDoubleLeft />
                </ActionButton>
              </Tip>
              <Tip label={`${CHAPTER_COPY.next} ${keyLabel('⇧→', MAC)}`}>
                <ActionButton
                  isQuiet
                  staticColor="white"
                  aria-label={CHAPTER_COPY.next}
                  isDisabled={noChapters}
                  onPress={() => seek(nextChapterStart(chapters, useEditor.getState().playhead))}>
                  <ChevronDoubleRight />
                </ActionButton>
              </Tip>
              {/* Volume: the button is always shown; the slider expands on hover, focus or drag. The control row should not permanently take 80px for a bar that is rarely needed. */}
              <div className="cc-fsp-volume" data-dragging={volumeDragging || undefined}>
                <Tip label={level.muted ? P.unmuteTip : P.muteTip}>
                  <ActionButton isQuiet staticColor="white" aria-label={level.muted ? P.unmute : P.mute} onPress={() => setLevel(toggleMute(level))}>
                    <VolumeIcon />
                  </ActionButton>
                </Tip>
                <div className="cc-fsp-volume-slider">
                  <Slider
                    size="S"
                    aria-label={P.volume}
                    styles={volumeSlider}
                    minValue={0}
                    maxValue={100}
                    step={5}
                    value={level.muted ? 0 : level.volume}
                    onChange={(volume) => {
                      setVolumeDragging(true);
                      setLevel({ volume, muted: volume === 0 });
                    }}
                    onChangeEnd={() => setVolumeDragging(false)}
                  />
                </div>
              </div>
              <span className={`${clock} cc-tabular`} aria-label={E.playhead}>
                {formatTenths(playhead)}
                <span className={clockTotal}> / {formatTenths(duration)}</span>
              </span>
              <div className={spacer} />
              <MenuTrigger align="end" direction="top" onOpenChange={(open) => setPopup(open ? 'captions' : null)}>
                <Tip label={F.captionsTip(F.captionMode[mode])}>
                  <ActionButton isQuiet staticColor="white" aria-label={F.captions}>
                    <CloseCaptions />
                  </ActionButton>
                </Tip>
                <Menu aria-label={F.captions}>
                  <MenuSection
                    selectionMode="single"
                    disallowEmptySelection
                    selectedKeys={[mode]}
                    onSelectionChange={(keys) => {
                      const [next] = keys === 'all' ? [] : [...keys];
                      if (next !== undefined) setPicked(next as CaptionMode);
                    }}>
                    <Header>{F.captions}</Header>
                    {modes.map((m) => {
                      const sub = captionSub(m);
                      return (
                        <MenuItem key={m} id={m} textValue={F.captionMode[m]}>
                          <Text slot="label">{F.captionMode[m]}</Text>
                          {sub ? <Text slot="description">{sub}</Text> : null}
                        </MenuItem>
                      );
                    })}
                  </MenuSection>
                </Menu>
              </MenuTrigger>
              <MenuTrigger align="end" direction="top" onOpenChange={(open) => setPopup(open ? 'rate' : null)}>
                <Tip label={P.rate}>
                  <ActionButton staticColor="white" aria-label={P.rateCurrent(rate)}>
                    <Text UNSAFE_className="cc-tabular">{`${rate}×`}</Text>
                  </ActionButton>
                </Tip>
                <Menu
                  aria-label={P.rate}
                  selectionMode="single"
                  disallowEmptySelection
                  selectedKeys={[String(rate)]}
                  onSelectionChange={(keys) => {
                    const [next] = keys === 'all' ? [] : [...keys];
                    if (next !== undefined) setRate(Number(next));
                  }}>
                  {PLAYBACK_RATES.map((r) => (
                    <MenuItem key={r} id={String(r)} textValue={`${r}×`}>
                      {r === 1 ? P.rateNormal : `${r}×`}
                    </MenuItem>
                  ))}
                </Menu>
              </MenuTrigger>
              <Tip label={F.keysTip}>
                <ToggleButton isQuiet staticColor="white" aria-label={F.keysTitle} isSelected={keysOpen} onChange={setKeysOpen}>
                  <HelpCircle />
                </ToggleButton>
              </Tip>
              <Tip label={P.exitFullscreen}>
                <ActionButton isQuiet staticColor="white" aria-label={P.exitFullscreen} onPress={exitPreviewFullscreen}>
                  <FullScreenExit />
                </ActionButton>
              </Tip>
            </div>
          </div>
        </Provider>
      </div>
    </UNSAFE_PortalProvider>
  );
}

/**
 * Progress bar (react-aria's Slider: dragging, keyboard and screen reader all come from it). Chapter ticks are drawn on top. On hover or drag, a bubble pops up with one frame of picture, the timecode you would land on if you released, and the chapter at that point. The bubble follows the pointer, not the playhead: it previews which frame releasing would land on.
 */
function SeekBar({
  sequence,
  assets,
  duration,
  playhead,
  chapters,
  ticks,
  onSeek,
  onScrub,
}: {
  sequence: Sequence;
  assets: Record<Id, AssetRecord>;
  duration: number;
  playhead: number;
  chapters: readonly ChapterSpan[];
  ticks: number[];
  onSeek(seconds: number): void;
  onScrub(scrubbing: boolean): void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const inside = useRef(false);
  const [hover, setHover] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const timeOf = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    return rect ? timeAt(clientX, rect, duration) : 0;
  };
  const max = duration || 1;
  return (
    <AriaSlider
      aria-label={P.position}
      className="cc-fsp-seek"
      data-active={dragging || undefined}
      minValue={0}
      maxValue={max}
      step={0.01}
      isDisabled={!(duration > 0)}
      value={Math.min(playhead, max)}
      onChange={(seconds) => {
        if (!dragging) {
          setDragging(true);
          onScrub(true);
        }
        setHover(seconds);
        onSeek(seconds);
      }}
      onChangeEnd={(seconds) => {
        onSeek(seconds);
        setDragging(false);
        onScrub(false);
        if (!inside.current) setHover(null);
      }}
      formatOptions={{ style: 'unit', unit: 'second', unitDisplay: 'long', maximumFractionDigits: 0 }}>
      <SliderTrack
        ref={trackRef}
        className="cc-fsp-seek-track"
        onPointerEnter={() => (inside.current = true)}
        onPointerMove={(event) => setHover(timeOf(event.clientX))}
        onPointerLeave={() => {
          inside.current = false;
          if (!dragging) setHover(null);
        }}>
        {({ state }) => (
          <>
            <div className="cc-fsp-seek-rail">
              <div className={`cc-fsp-seek-fill ${seekFill}`} style={{ width: `${state.getThumbPercent(0) * 100}%` }} />
              {ticks.map((at) => (
                <i key={at} className="cc-fsp-seek-tick" style={{ left: `${at * 100}%` }} />
              ))}
            </div>
            <SliderThumb className="cc-fsp-seek-thumb" />
            {hover === null ? null : (
              <SeekBubble sequence={sequence} assets={assets} chapters={chapters} seconds={hover} left={seekFraction(hover, duration)} />
            )}
          </>
        )}
      </SliderTrack>
    </AriaSlider>
  );
}

function SeekBubble({
  sequence,
  assets,
  chapters,
  seconds,
  left,
}: {
  sequence: Sequence;
  assets: Record<Id, AssetRecord>;
  chapters: readonly ChapterSpan[];
  seconds: number;
  left: number;
}) {
  const media = useRuntime().videos.media;
  useSyncExternalStore(media.subscribe, media.version);
  const frame = seekFrame(sequence, assets, seconds);
  const url = frame ? media.thumbnail(frame.asset, frame.at) : null;
  const size = previewSize(sequence.canvas);
  const chapter = chapters[chapterAt(chapters, seconds)];
  return (
    <div className="cc-fsp-bubble" style={{ left: `${left * 100}%` }} aria-hidden>
      <div className="cc-fsp-bubble-frame" style={{ width: size.width, height: size.height, backgroundImage: url ? `url("${url}")` : undefined }} />
      <span className={`${bubbleTime} cc-tabular`}>{formatTenths(seconds)}</span>
      {chapter ? <span className={bubbleChapter}>{chapter.title}</span> : null}
    </div>
  );
}

/** Small line under the caption-level options: which language the original and the translation are in. The project may have several translation languages, and writing only “translation” would require switching to find out which one it is. */
function captionLanguages(sequence: Sequence, documents: Record<Id, DocumentRecord>): { original: string | null; translation: string | null } {
  const names = { original: new Set<string>(), translation: new Set<string>() };
  for (const chip of captionChips(sequence, documents)) {
    if (chip.state !== 'on') continue;
    const language = documents[chip.documentId]?.language;
    names[chip.kind].add(language ? languageName(language) : chip.name);
  }
  const join = (set: Set<string>) => (set.size ? [...set].join(' · ') : null);
  return { original: join(names.original), translation: join(names.translation) };
}

function Tip({ label, children }: { label: string; children: ReactElement }) {
  return (
    <TooltipTrigger placement="top">
      {children}
      <Tooltip>{label}</Tooltip>
    </TooltipTrigger>
  );
}
