import { useRef, useState, type HTMLAttributes, type Ref } from 'react';
import type { Id, Sequence } from '@cuccut/protocol';
import { ActionButton, Header, Heading, Menu, MenuItem, MenuSection, MenuTrigger, Text, Tooltip, TooltipTrigger } from '@react-spectrum/s2';
import Cut from '@react-spectrum/s2/icons/Cut';
import Delete from '@react-spectrum/s2/icons/Delete';
import Edit from '@react-spectrum/s2/icons/Edit';
import More from '@react-spectrum/s2/icons/More';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { CHAPTER_TITLE_MAX, cutChapterOperations, sequenceChapters, type ChapterSpan } from '../../model/chapters.ts';
import { formatClock } from '../../model/format.ts';
import { canEdit, useVideo } from '../../state/video-store.ts';
import { removeChapter, renameChapter } from './chapter-commands.ts';
import { CHAPTER_COPY as C } from './chapter-copy.ts';
import { useEditorActions } from './editor-context.tsx';
import { applyChapterCut } from './transcript-actions.ts';
import { scopeCopyItems, useScopeCopy } from './transcript-copy-button.tsx';
import { TRANSCRIPT_TOOLS_COPY as T } from './transcript-copy.ts';
import { useHoldRow } from './use-virtual-rows.ts';

/**
 * Chapter header row in the transcript (design mock panels.jsx `.chead`): it sticks to the top of the panel while scrolling. Clicking the chapter name renames it in place (Enter or moving focus away saves, Esc discards). Clicking the start or end time jumps to the start of this chapter, and on the right is the number of paragraphs in the chapter. A chapter with no paragraphs gets a line under the header (`TranscriptChapterEmpty`, its own row in the transcript list). When `chapter` is null, it means “before the first chapter.” The header is itself one row in the transcript virtual list (`rowProps`: the ref used to measure height and the list item attributes). For sticky positioning it must be a direct child of that section's outer element. While the menu or the name input is open, the list must not unmount this row.
 *
 * On the far right is the “This chapter…” menu (design mock `.chead__b` + `ScopeMenu`, shown on hover, when focus is inside it, or while the menu is open). It offers: copy this chapter (per the copy settings or text only, arranged by the transcript panel from this chapter's paragraphs), rename, cut this chapter (`removeRange` deletes that time span and marks it deleted, the later chapters move forward, all in one transaction), and delete the chapter marker (content unchanged). “Before the first chapter” only has copy. The design's menu items that re-run transcription, polishing, or speaker identification for a single chapter are not implemented (per-chapter re-runs do not exist yet). Dragging paragraphs between chapters is also not implemented; use the ↑ ↓ on the paragraph row.
 */

const head = style({
  position: 'sticky',
  top: 0,
  zIndex: 2,
  display: 'flex',
  alignItems: 'baseline',
  gap: 8,
  boxSizing: 'border-box',
  height: 40,
  paddingTop: 12,
  paddingBottom: 2,
  paddingX: 12,
  marginX: -12,
  backgroundColor: 'gray-50',
  borderBottomWidth: 1,
  borderTopWidth: 0,
  borderStartWidth: 0,
  borderEndWidth: 0,
  borderStyle: 'solid',
  borderColor: 'gray-200',
});
const title = style({
  flexShrink: 1,
  minWidth: 0,
  height: 20,
  marginStart: -4,
  paddingX: 4,
  paddingY: 0,
  borderWidth: 0,
  borderRadius: 'sm',
  backgroundColor: { default: 'transparent', isHovered: 'gray-100', isStatic: 'transparent' },
  font: 'ui',
  fontWeight: 'bold',
  color: 'gray-900',
  textAlign: 'start',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  cursor: { default: 'text', isStatic: 'default' },
});
const input = style({
  flexGrow: 1,
  minWidth: 0,
  height: 20,
  marginStart: -4,
  paddingX: 4,
  paddingY: 0,
  boxSizing: 'border-box',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'blue-800',
  borderRadius: 'sm',
  backgroundColor: 'gray-25',
  font: 'ui',
  fontWeight: 'bold',
  color: 'gray-900',
  outlineStyle: 'none',
});
const range = style({
  flexShrink: 0,
  padding: 0,
  borderWidth: 0,
  borderRadius: 'sm',
  backgroundColor: 'transparent',
  font: 'code-xs',
  color: 'gray-600',
  cursor: 'pointer',
  textDecoration: { default: 'none', isHovered: 'underline' },
  whiteSpace: 'nowrap',
});
const grow = style({ flexGrow: 1 });
/** “This chapter…” button (design mock `.chead__b`): transparent normally, shown on hover, when focus is inside it, or while the menu is open. */
const menuSlot = style({ flexShrink: 0, alignSelf: 'center', opacity: { default: 0, isShown: 1 } });
const count = style({ flexShrink: 0, font: 'ui-xs', color: 'gray-500', whiteSpace: 'nowrap' });
const empty = style({ margin: 0, paddingX: 4, paddingTop: 8, paddingBottom: 12, font: 'ui-sm', color: 'gray-500' });

export function TranscriptChapterHead({
  rowProps,
  sequence,
  chapter,
  paragraphs,
  cutTrackIds,
  onCopy,
}: {
  /** For the outer element of each virtual list row: the height-measuring ref, `role="listitem"`, and position. */
  rowProps?: HTMLAttributes<HTMLDivElement> & { ref?: Ref<HTMLDivElement> };
  sequence: Sequence;
  chapter: ChapterSpan | null;
  paragraphs: number;
  /** Tracks declared when cutting this chapter (same set as cutting a paragraph in the transcript: tracks that use the asset, linked tracks, and the caption track). */
  cutTrackIds: readonly Id[];
  /** Paragraphs to copy for this chapter: per the copy settings, or text only. */
  onCopy(withSettings: boolean): void;
}) {
  const actions = useEditorActions();
  const editable = useVideo((s) => canEdit(s.video));
  const [draft, setDraft] = useState<string | null>(null);
  const [hovered, setHovered] = useState<'title' | 'range' | null>(null);
  const [rowHovered, setRowHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // “Before the first chapter” has no chapter title to write, so it counts as one segment.
  const scopeCopy = useScopeCopy(chapter ? 'chapter' : 'para');
  // Enter commits, and unmounting the input after that can still fire a blur: commit only once.
  const settled = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useHoldRow(menuOpen || draft !== null);

  const startEdit = () => {
    if (!chapter || !editable) return;
    settled.current = false;
    setDraft(chapter.label.trim() || chapter.title);
  };
  const finish = (value: string | null) => {
    if (settled.current) return;
    settled.current = true;
    setDraft(null);
    if (chapter && value !== null) void renameChapter(actions, sequence, chapter, value);
  };

  let name;
  if (draft !== null)
    name = (
      <input
        className={input}
        ref={inputRef}
        aria-label={C.renameTitle}
        autoFocus
        value={draft}
        maxLength={CHAPTER_TITLE_MAX}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => finish(event.target.value)}
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            finish(event.currentTarget.value);
          } else if (event.key === 'Escape') {
            event.preventDefault();
            finish(null);
          }
          event.stopPropagation();
        }}
      />
    );
  else if (chapter && editable)
    name = (
      <button
        type="button"
        className={title({ isHovered: hovered === 'title' })}
        title={C.clickRename}
        onPointerEnter={() => setHovered('title')}
        onPointerLeave={() => setHovered(null)}
        onClick={startEdit}>
        {chapter.title}
      </button>
    );
  else
    name = (
      <span className={title({ isStatic: true })} role="heading" aria-level={4}>
        {chapter ? chapter.title : C.beforeFirst}
      </span>
    );

  const cutPlan = chapter ? cutChapterOperations(sequence, sequenceChapters(sequence), chapter, cutTrackIds) : null;
  const onAction = (key: string) => {
    if (key === 'copy' || key === 'copy-set') onCopy(key === 'copy-set');
    else if (!chapter || !editable) return;
    else if (key === 'rename') {
      startEdit();
      // Closing the menu returns focus to the ⋯ button (on the frame after it unmounts), so wait until then before moving focus into the input.
      requestAnimationFrame(() => requestAnimationFrame(() => inputRef.current?.focus()));
    } else if (key === 'cut' && cutPlan) void applyChapterCut(actions, chapter, cutPlan, sequence.fps);
    else if (key === 'remove') void removeChapter(actions, sequence, chapter);
  };
  const disabledKeys = !editable || !chapter ? ['rename', 'cut', 'remove'] : cutPlan?.ok ? [] : ['cut'];
  const scope = T.scopeChapter(chapter ? chapter.title : C.beforeFirst);

  const menu = (
    <span
      className={menuSlot({ isShown: rowHovered || focused || menuOpen })}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}>
      <MenuTrigger align="end" isOpen={menuOpen} onOpenChange={setMenuOpen}>
        <TooltipTrigger>
          <ActionButton isQuiet size="XS" aria-label={T.chapterMenu}>
            <More />
          </ActionButton>
          <Tooltip>{T.chapterMenu}</Tooltip>
        </TooltipTrigger>
        <Menu aria-label={T.chapterMenu} disabledKeys={disabledKeys} onAction={(key) => onAction(String(key))}>
          <MenuSection>
            <Header>
              <Heading>{T.copyScopeHead(scope)}</Heading>
            </Header>
            {scopeCopyItems(scopeCopy)}
          </MenuSection>
          {chapter ? (
            <MenuSection>
              <Header>
                <Heading>{T.chapterMenu}</Heading>
              </Header>
              <MenuItem id="rename" textValue={T.renameChapter}>
                <Edit />
                <Text slot="label">{T.renameChapter}</Text>
              </MenuItem>
              <MenuItem id="cut" textValue={T.cutChapter}>
                <Cut />
                <Text slot="label">{T.cutChapter}</Text>
                <Text slot="description">{cutPlan && !cutPlan.ok ? T.cutChapterRefused[cutPlan.reason] : T.cutChapterHint}</Text>
              </MenuItem>
              <MenuItem id="remove" textValue={T.removeMarker}>
                <Delete />
                <Text slot="label">{T.removeMarker}</Text>
                <Text slot="description">{T.removeMarkerHint}</Text>
              </MenuItem>
            </MenuSection>
          ) : null}
        </Menu>
      </MenuTrigger>
    </span>
  );

  return (
    <div {...rowProps} className={head} onPointerEnter={() => setRowHovered(true)} onPointerLeave={() => setRowHovered(false)}>
      {name}
      {chapter && draft === null ? (
        <button
          type="button"
          className={`${range({ isHovered: hovered === 'range' })} cc-tabular`}
          title={C.jump}
          onPointerEnter={() => setHovered('range')}
          onPointerLeave={() => setHovered(null)}
          onClick={() => actions.seek(chapter.start)}>
          {formatClock(chapter.start)}–{formatClock(chapter.end)}
        </button>
      ) : null}
      <span className={grow} />
      <span className={count}>{C.paragraphs(paragraphs)}</span>
      {menu}
    </div>
  );
}

/** The line under the header of a chapter that has no paragraphs. */
export function TranscriptChapterEmpty() {
  return <p className={empty}>{C.empty}</p>;
}
