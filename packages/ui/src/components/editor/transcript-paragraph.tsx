import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Id } from '@cuccut/protocol';
import { ActionButton, Header, Heading, Menu, MenuItem, MenuSection, MenuTrigger, Text, Tooltip, TooltipTrigger } from '@react-spectrum/s2';
import ChevronDown from '@react-spectrum/s2/icons/ChevronDown';
import ChevronUp from '@react-spectrum/s2/icons/ChevronUp';
import Cut from '@react-spectrum/s2/icons/Cut';
import More from '@react-spectrum/s2/icons/More';
import Play from '@react-spectrum/s2/icons/Play';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import type { ParagraphMove } from '../../model/chapters.ts';
import { formatClock } from '../../model/format.ts';
import { displayWidth } from '../../model/speech-cues.ts';
import type { TextRange } from '../../model/text-find.ts';
import { playedEnd, type TranscriptParagraph, type TranscriptWord } from '../../model/transcript-cut.ts';
import { wordHighlights, type ParagraphText, type TranscriptView, type WordHighlight } from '../../model/transcript-text.ts';
import { scopeCopyItems, useScopeCopy } from './transcript-copy-button.tsx';
import { SHORTS_COPY } from './shorts-copy.ts';
import { TRANSCRIPT_COPY as C, TRANSCRIPT_TOOLS_COPY as T } from './transcript-copy.ts';
import { useHoldRow } from './use-virtual-rows.ts';

/**
 * One paragraph in the transcript (design panels.jsx `ParaRow`). The header row shows the speaker and the paragraph's start time (click to jump there). On the right are ↑ ↓ (move to the adjacent chapter, shown on hover), play this paragraph, and the ⋯ menu (copy this paragraph per the copy settings or as text only, move to which chapter, cut this paragraph). Below are the words (in the original view or bilingual) and the translation lines (in the translation view or bilingual). Find matches are marked on the words (when a space between words is covered, the space is marked too) and on the translation lines. All actions are passed back to the transcript panel (`onAction`).
 *
 * A paragraph is one row in the transcript virtual list. The 8px gap from the previous row is supplied by the list's row wrapper. While the ⋯ menu is open, the list must not unmount this row, since the menu is attached to the row's button.
 */

/** A match within a paragraph, handed to the paragraph card to draw. */
export interface ParaMarks {
  src: Array<TextRange & { current: boolean }>;
  trans: Array<TextRange & { current: boolean }>;
  key: string;
}

/** Actions on a paragraph row. */
/** `copy` is text only; `copy-set` follows the copy settings (transcript-copy-button.tsx). */
export type ParagraphAction = 'play' | 'up' | 'down' | 'copy' | 'copy-set' | 'cut';

/** The two ways to move a paragraph to an adjacent chapter, and the reasons it cannot be moved. Only shown with two or more chapters. */
export interface ParagraphMoves {
  up: ParagraphMove | null;
  down: ParagraphMove | null;
  upReason: string;
  downReason: string;
}

const para = style({
  paddingX: 8,
  paddingY: 8,
  borderRadius: 'lg',
  backgroundColor: { default: 'gray-25', isHovered: 'gray-50', isGone: 'gray-50' },
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'gray-200',
});
const paraHead = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  height: 20,
  marginBottom: 2,
});
/** The few buttons on the right of a paragraph row (design `.para__act`): transparent normally but they keep their space. They show on hover, when keyboard focus is inside, or while a menu is open, without the layout jumping. */
const paraActs = style({
  display: 'flex',
  alignItems: 'center',
  gap: 2,
  marginStart: 'auto',
  opacity: { default: 0, isShown: 1 },
});
const speakerName = style({
  font: 'ui-xs',
  fontWeight: 'bold',
  color: {
    default: 'gray-700',
    hue: {
      0: 'blue-900',
      1: 'green-900',
      2: 'orange-900',
      3: 'purple-900',
      4: 'cyan-900',
      5: 'magenta-900',
    },
  },
});
const paraTime = style({
  padding: 0,
  borderWidth: 0,
  backgroundColor: 'transparent',
  font: 'ui-xs',
  color: 'gray-500',
  cursor: { default: 'pointer', isGone: 'default' },
  textDecoration: { default: 'none', isHovered: 'underline', isGone: 'none' },
  borderRadius: 'sm',
});
const paraText = style({
  font: 'body-sm',
  lineHeight: '[1.8]',
  color: 'gray-800',
  overflowWrap: 'break-word',
});
/** The translation line: when translation only is shown, it is the body. In bilingual view it is one step smaller (design `.para__b--tr`). */
const paraTranslation = style({
  font: { default: 'body-sm', isSecondary: 'body-xs' },
  lineHeight: '[1.7]',
  // Translations have no word-level timing, so the paragraph only greys out once it has been played through entirely (prototype `.para.is-done .para__b--tr`).
  color: { default: 'gray-800', isSecondary: 'gray-600', isMissing: 'gray-500', isPlayed: 'gray-500' },
  fontStyle: { default: 'normal', isMissing: 'italic' },
  marginTop: { default: 0, isSecondary: 4 },
  overflowWrap: 'break-word',
});
/**
 * A word: once read (the playhead has passed it), it fades to gray-500. It is the same color as a cut word but has no strikethrough and no background (prototype `.para__w.is-played`). The current word's yellow background and the selected word's blue background take precedence over “already read.”
 * When the same asset segment is used twice, the second occurrence's word is both the current word and already read, so the current word also states its color explicitly.
 */
const word = style({
  borderRadius: 'sm',
  cursor: 'pointer',
  userSelect: 'none',
  color: {
    default: 'gray-900',
    isPlayed: 'gray-500',
    state: { cut: 'gray-500' },
    isActive: 'gray-900',
    isSelected: 'gray-900',
  },
  textDecoration: {
    default: 'none',
    state: { cut: 'line-through', partial: 'underline' },
  },
  backgroundColor: {
    default: 'transparent',
    state: { cut: 'red-200', partial: 'red-100' },
    isActive: 'yellow-300',
    isSelected: 'blue-300',
  },
});
/** A find match (marked the same way as in the subtitle panel): the current one is orange. */
const mark = style({ borderRadius: 'sm', backgroundColor: { default: 'yellow-200', isCurrent: 'orange-400' }, color: 'gray-900' });
const wordEditor = style({
  font: 'body-sm',
  lineHeight: '[1.4]',
  color: 'gray-900',
  backgroundColor: 'gray-50',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'blue-800',
  borderRadius: 'sm',
  paddingX: 2,
  paddingY: 0,
  marginX: 2,
  outlineStyle: 'none',
});

/** Splits the text within a match and draws it. The current match carries `data-match-current`, and find scrolls to it. */
function highlighted(text: string, ranges: readonly { start: number; end: number; current: boolean }[]): ReactNode {
  if (!ranges.length) return text;
  const parts: ReactNode[] = [];
  let at = 0;
  for (const range of [...ranges].sort((a, b) => a.start - b.start)) {
    if (range.start < at) continue;
    if (range.start > at) parts.push(text.slice(at, range.start));
    parts.push(
      <mark key={range.start} className={mark({ isCurrent: range.current })} {...(range.current ? { 'data-match-current': '' } : {})}>
        {text.slice(range.start, range.end)}
      </mark>,
    );
    at = range.end;
  }
  if (at < text.length) parts.push(text.slice(at));
  return parts;
}

export const Paragraph = memo(
  function Paragraph({
    assetId,
    index,
    paragraph,
    text,
    view,
    translation,
    marks,
    moves,
    editable,
    selected,
    active,
    played,
    editing,
    speaker,
    hue,
    onSeek,
    onCommit,
    onCancel,
    onAction,
    keptFrom = null,
    keptTo = null,
  }: {
    assetId: Id;
    index: number;
    paragraph: TranscriptParagraph;
    text: ParagraphText;
    view: TranscriptView;
    /** The translation of this paragraph (null in the original view, and an empty string when there is no matching translation). */
    translation: string | null;
    marks: ParaMarks | null;
    /** Only for the memo comparison: the matches within this paragraph. */
    markKey: string;
    moves: ParagraphMoves | null;
    editable: boolean;
    selected: ReadonlySet<number> | null;
    /** Only for the memo comparison: which words in this paragraph are selected. */
    selKey: string;
    active: number | null;
    /**
     * Read threshold (see `paragraphPlayed`): words whose earliest landing-point end is no later than it count as read. Fully read is `Infinity`, not read is `-Infinity`. Only the paragraph being read changes with the playhead; the other paragraphs do not re-render with it.
     */
    played: number;
    editing: number | null;
    speaker: string | null;
    hue: number | null;
    onSeek(seconds: number): void;
    onCommit(assetId: Id, index: number, text: string): void;
    onCancel(): void;
    onAction(assetId: Id, index: number, action: ParagraphAction, moves: ParagraphMoves | null): void;
    /**
     * Sub-video: the first and last words still on the timeline (`TranscriptWord.index`). Words struck through outside them are sentences outside the clip. Clicking one restores that run, and the hover hint says so. null when this is not a sub-video or it cannot be edited.
     */
    keptFrom?: number | null;
    keptTo?: number | null;
  }) {
    const [hovered, setHovered] = useState(false);
    const scopeCopy = useScopeCopy('para');
    const [focused, setFocused] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    useHoldRow(menuOpen);
    const start = paragraph.words.find((w) => w.placements.length)?.placements[0]?.start;
    const gone = start === undefined;
    const showWords = view !== 'translation';
    const highlights = useMemo(() => (marks?.src.length ? wordHighlights(text, marks.src) : null), [text, marks]);
    const act = (action: ParagraphAction) => onAction(assetId, index, action, moves);
    const actionButton = (action: ParagraphAction, label: string, icon: ReactNode, disabled = false) => (
      <TooltipTrigger>
        <ActionButton isQuiet size="XS" aria-label={label} isDisabled={disabled} onPress={() => act(action)}>
          {icon}
        </ActionButton>
        <Tooltip>{label}</Tooltip>
      </TooltipTrigger>
    );
    const disabledKeys = [...(!editable || !moves?.up ? ['up'] : []), ...(!editable || !moves?.down ? ['down'] : []), ...(!editable || gone ? ['cut'] : [])];
    return (
      <div className={para({ isGone: gone, isHovered: hovered })} onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)}>
        <div className={paraHead}>
          {speaker ? (
            <span
              className={speakerName({
                hue: hue === null ? undefined : (String(hue) as '0'),
              })}>
              {speaker}
            </span>
          ) : null}
          <button
            type="button"
            className={paraTime({ isGone: gone })}
            disabled={gone}
            title={gone ? C.cutWordTitle : C.jump}
            onClick={() => start !== undefined && onSeek(start)}>
            {gone ? C.cutWordTitle : formatClock(start)}
          </button>
          <span
            className={paraActs({ isShown: hovered || focused || menuOpen })}
            onFocus={() => setFocused(true)}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
            }}>
            {moves ? (
              <>
                {actionButton('up', T.moveUp, <ChevronUp />, !editable || !moves.up)}
                {actionButton('down', T.moveDown, <ChevronDown />, !editable || !moves.down)}
              </>
            ) : null}
            {actionButton('play', T.play, <Play />, gone)}
            <MenuTrigger align="end" isOpen={menuOpen} onOpenChange={setMenuOpen}>
              <TooltipTrigger>
                <ActionButton isQuiet size="XS" aria-label={T.paraMenu}>
                  <More />
                </ActionButton>
                <Tooltip>{T.paraMenu}</Tooltip>
              </TooltipTrigger>
              <Menu aria-label={T.paraMenu} disabledKeys={disabledKeys} onAction={(key) => act(key as ParagraphAction)}>
                <MenuSection>
                  <Header>
                    <Heading>{T.copyScopeHead(T.scopePara)}</Heading>
                  </Header>
                  {scopeCopyItems(scopeCopy)}
                </MenuSection>
                {moves ? (
                  <MenuSection>
                    <Header>
                      <Heading>{T.moveHead}</Heading>
                    </Header>
                    <MenuItem id="up" textValue={moves.up ? T.moveTo(moves.up.to.title) : T.moveUp}>
                      <ChevronUp />
                      <Text slot="label">{moves.up ? T.moveTo(moves.up.to.title) : T.moveUp}</Text>
                      <Text slot="description">{moves.up ? T.moveWith(moves.up.moved) : moves.upReason}</Text>
                    </MenuItem>
                    <MenuItem id="down" textValue={moves.down ? T.moveTo(moves.down.to.title) : T.moveDown}>
                      <ChevronDown />
                      <Text slot="label">{moves.down ? T.moveTo(moves.down.to.title) : T.moveDown}</Text>
                      <Text slot="description">{moves.down ? T.moveWith(moves.down.moved) : moves.downReason}</Text>
                    </MenuItem>
                  </MenuSection>
                ) : null}
                <MenuSection aria-label={T.cutPara}>
                  <MenuItem id="cut" textValue={T.cutPara}>
                    <Cut />
                    <Text slot="label">{T.cutPara}</Text>
                    <Text slot="description">{gone ? C.cutWordTitle : T.cutParaHint}</Text>
                  </MenuItem>
                </MenuSection>
              </Menu>
            </MenuTrigger>
          </span>
        </div>
        {showWords ? (
          <div className={paraText}>
            {paragraph.words.map((w, n) => (
              <WordView
                key={w.id}
                assetId={assetId}
                word={w}
                spaced={n > 0 && w.spaced}
                isSelected={!!selected?.has(w.index)}
                isActive={active === w.index}
                isPlayed={played > -Infinity && w.placements.length > 0 && playedEnd(w)! <= played}
                isEditing={editing === w.index}
                highlight={highlights?.get(w.index) ?? null}
                outside={keptFrom !== null && keptTo !== null && (w.index < keptFrom || w.index > keptTo)}
                onCommit={onCommit}
                onCancel={onCancel}
              />
            ))}
          </div>
        ) : null}
        {translation !== null ? (
          <div className={paraTranslation({ isSecondary: view === 'both', isMissing: !translation, isPlayed: played === Infinity })}>
            {translation ? highlighted(translation, marks?.trans ?? []) : T.noParagraphTranslation}
          </div>
        ) : null}
      </div>
    );
  },
  (a, b) =>
    a.paragraph === b.paragraph &&
    a.text === b.text &&
    a.index === b.index &&
    a.view === b.view &&
    a.translation === b.translation &&
    a.markKey === b.markKey &&
    a.moves === b.moves &&
    a.editable === b.editable &&
    a.selKey === b.selKey &&
    a.active === b.active &&
    a.played === b.played &&
    a.editing === b.editing &&
    a.speaker === b.speaker &&
    a.hue === b.hue &&
    a.assetId === b.assetId &&
    a.onSeek === b.onSeek &&
    a.onCommit === b.onCommit &&
    a.onCancel === b.onCancel &&
    a.onAction === b.onAction &&
    a.keptFrom === b.keptFrom &&
    a.keptTo === b.keptTo,
);

function WordView({
  assetId,
  word: w,
  spaced,
  isSelected,
  isActive,
  isPlayed,
  isEditing,
  highlight,
  outside,
  onCommit,
  onCancel,
}: {
  assetId: Id;
  word: TranscriptWord;
  spaced: boolean;
  isSelected: boolean;
  isActive: boolean;
  /** The playhead has passed it (cut words have no landing point, so they never count). */
  isPlayed: boolean;
  isEditing: boolean;
  highlight: WordHighlight | null;
  /** Sub-video: words outside the clip (clicking restores this run). */
  outside: boolean;
  onCommit(assetId: Id, index: number, text: string): void;
  onCancel(): void;
}) {
  const text = w.text.trim();
  if (isEditing) {
    return (
      <>
        {spaced ? ' ' : null}
        <WordEditor initial={text} onCommit={(value) => onCommit(assetId, w.index, value)} onCancel={onCancel} />
      </>
    );
  }
  const title = w.state === 'cut' ? (outside ? SHORTS_COPY.outsideWord : C.cutWordTitle) : w.state === 'partial' ? C.partialWordTitle : undefined;
  const gap = highlight?.gap ? (
    <mark className={mark({ isCurrent: highlight.gap === 2 })} {...(highlight.gap === 2 ? { 'data-match-current': '' } : {})}>
      {' '}
    </mark>
  ) : (
    ' '
  );
  return (
    <>
      {spaced ? gap : null}
      <span data-a={assetId} data-w={w.index} className={word({ state: w.state, isSelected, isActive, isPlayed })} title={title}>
        {highlight ? highlighted(text, highlight.ranges) : text}
      </span>
    </>
  );
}

/** Edit a word in place: Enter or blur commits, Esc discards. */
function WordEditor({ initial, onCommit, onCancel }: { initial: string; onCommit(value: string): void; onCancel(): void }) {
  const [value, setValue] = useState(initial);
  const done = useRef(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return (
    <input
      ref={ref}
      className={wordEditor}
      aria-label={C.editWord}
      value={value}
      size={Math.max(2, displayWidth(value) + 1)}
      onChange={(event) => setValue(event.target.value)}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Enter') {
          event.preventDefault();
          done.current = true;
          onCommit(value);
        } else if (event.key === 'Escape') {
          event.preventDefault();
          done.current = true;
          onCancel();
        }
      }}
      onBlur={() => {
        if (!done.current) onCommit(value);
      }}
    />
  );
}
