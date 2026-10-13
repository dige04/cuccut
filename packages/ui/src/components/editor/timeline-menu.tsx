import { useRef, type ReactElement } from 'react';
import type { AssetRecord, DocumentRecord, Id, Sequence } from '@cuccut/protocol';
import { Header, Heading, Keyboard, Menu, MenuItem, MenuSection, MenuTrigger, Text } from '@react-spectrum/s2';
import CopyIcon from '@react-spectrum/s2/icons/Copy';
import CutIcon from '@react-spectrum/s2/icons/Cut';
import DeleteIcon from '@react-spectrum/s2/icons/Delete';
import DuplicateIcon from '@react-spectrum/s2/icons/Duplicate';
import PasteIcon from '@react-spectrum/s2/icons/Paste';
import Visibility from '@react-spectrum/s2/icons/Visibility';
import VisibilityOff from '@react-spectrum/s2/icons/VisibilityOff';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { Pressable } from 'react-aria-components';
import { TIMELINE_EDIT_COPY as COPY } from '../../copy.ts';
import { itemLabel } from '../../model/editor.ts';
import type { DubBlock } from '../../model/timeline-dub.ts';
import { useEditor } from '../../state/editor-store.ts';
import { canEdit, useVideo } from '../../state/video-store.ts';
import { DubFitHost } from './dub-fit-dialog.tsx';
import { useEditorActions } from './editor-context.tsx';
import { ItemReplaceHost } from './item-replace.tsx';
import { DubBlockMenu } from './timeline-dub.tsx';
import {
  MOD_KEY,
  canRemoveSelectionSpan,
  canSplitAt,
  copySelection,
  cutSelection,
  deleteSelection,
  duplicateSelection,
  pasteClipboard,
  removeSelectionSpan,
  setItemEnabled,
  splitAtPlayhead,
} from './timeline-commands.ts';
import { TIMELINE_RIPPLE_COPY as RIPPLE } from './timeline-ripple-copy.ts';

/** Which item was right-clicked, and where the pointer is (viewport coordinates). */
export interface TimelineMenuTarget {
  itemId: Id;
  x: number;
  y: number;
}

/**
 * Right-click menu for timeline clips (prototype timeline-menu.jsx): the clip name as the title; split at the playhead; copy, cut, paste, duplicate; disable or enable this item; delete; delete this range from all tracks (⇧Delete, the same as marquee-selecting all tracks and then deleting). Commands and shortcuts are one set (timeline-commands).
 *
 * The menu opens at the pointer point: a 0-size anchor with `position: fixed` is used as the trigger (the timeline is a scroll area, and a floating layer attached to the clip would scroll with it and get clipped). Open state is controlled. The prototype only gives video blocks “split at playhead”; here every kind gets it, consistent with S and ⌘B. It is disabled when the playhead is not within this item.
 * Dub blocks switch to the block menu (timeline-dub.tsx `DubBlockMenu`): listen to this sentence, mute, regenerate, edit translation and re-dub, delete these sentences.
 * The “Edit translation and re-dub” dialog is also always mounted here (dub-fit-dialog.tsx); the block menu, the dub track header, and the dub group card all open it through `openDubFit`. The replace window for the canvas toolbar's “Replace video / Replace image” is also mounted here (item-replace.tsx).
 */
export function TimelineMenu(props: {
  target: TimelineMenuTarget | null;
  sequence: Sequence;
  assets: Record<Id, AssetRecord>;
  documents: Record<Id, DocumentRecord>;
  /** Dub block on the timeline: when the right-click lands on one of the blocks, the block menu opens. */
  dubBlocks?: ReadonlyMap<Id, DubBlock>;
  onClose(): void;
}) {
  return (
    <>
      <TimelineItemMenu {...props} />
      <DubFitHost sequence={props.sequence} documents={props.documents} blocks={props.dubBlocks ?? EMPTY_BLOCKS} />
      <ItemReplaceHost sequence={props.sequence} assets={props.assets} />
    </>
  );
}

const EMPTY_BLOCKS: ReadonlyMap<Id, DubBlock> = new Map();

function TimelineItemMenu({
  target,
  sequence,
  assets,
  documents,
  dubBlocks,
  onClose,
}: {
  target: TimelineMenuTarget | null;
  sequence: Sequence;
  assets: Record<Id, AssetRecord>;
  documents: Record<Id, DocumentRecord>;
  /** Dub block on the timeline: when the right-click lands on one of the blocks, the block menu opens. */
  dubBlocks?: ReadonlyMap<Id, DubBlock>;
  onClose(): void;
}) {
  const actions = useEditorActions();
  const editable = useVideo((s) => canEdit(s.video));
  // On close, the fade-out still has to draw the previous content.
  const last = useRef(target);
  if (target) last.current = target;
  const at = last.current;
  if (!at) return null;
  const item = sequence.items.find((candidate) => candidate.id === at.itemId);
  const name = item ? itemLabel(item, assets, documents) : '';
  const dub = item ? dubBlocks?.get(item.id) : undefined;
  const enabled = item?.enabled ?? true;
  const canSplit = !!item && canSplitAt(sequence, item.id, useEditor.getState().playhead);
  // When only subtitles are selected there is no segment to take (subtitle instances fill the whole track).
  const canRemoveSpan = canRemoveSelectionSpan(sequence);
  const disabled = editable
    ? [...(canSplit ? [] : ['split']), ...(canRemoveSpan ? [] : ['removeSpan'])]
    : ['split', 'cut', 'paste', 'duplicate', 'toggle', 'delete', 'removeSpan'];

  const run = (key: string) => {
    if (!item) return;
    switch (key) {
      case 'split':
        return splitAtPlayhead(actions, [item.id]);
      case 'copy':
        return void copySelection();
      case 'cut':
        return void cutSelection(actions);
      case 'paste':
        return void pasteClipboard(actions);
      case 'duplicate':
        return void duplicateSelection(actions);
      case 'toggle':
        return void setItemEnabled(actions, item.id, !enabled);
      case 'delete':
        return void deleteSelection(actions);
      case 'removeSpan':
        return void removeSelectionSpan(actions);
    }
  };

  const trigger = (menu: ReactElement) => (
    <MenuTrigger
      trigger="contextMenu"
      isOpen={!!target}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}>
      <Pressable>
        <span role="button" tabIndex={-1} aria-label={COPY.menuLabel(name)} className={anchor} style={{ left: at.x, top: at.y }} />
      </Pressable>
      {menu}
    </MenuTrigger>
  );
  if (dub && dubBlocks) return trigger(<DubBlockMenu dub={dub} blocks={dubBlocks} sequence={sequence} documents={documents} name={name} />);

  return (
    <MenuTrigger
      trigger="contextMenu"
      isOpen={!!target}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}>
      <Pressable>
        <span role="button" tabIndex={-1} aria-label={COPY.menuLabel(name)} className={anchor} style={{ left: at.x, top: at.y }} />
      </Pressable>
      <Menu aria-label={COPY.menuLabel(name)} disabledKeys={disabled} onAction={(key) => run(String(key))}>
        <MenuSection>
          <Header>
            <Heading>{name}</Heading>
          </Header>
          <MenuItem id="split" textValue={COPY.split}>
            <CutIcon />
            <Text slot="label">{COPY.split}</Text>
            {canSplit ? null : <Text slot="description">{COPY.splitUnavailable}</Text>}
            <Keyboard>S</Keyboard>
          </MenuItem>
        </MenuSection>
        <MenuSection>
          <MenuItem id="copy" textValue={COPY.copy}>
            <CopyIcon />
            <Text slot="label">{COPY.copy}</Text>
            <Keyboard>{MOD_KEY}C</Keyboard>
          </MenuItem>
          <MenuItem id="cut" textValue={COPY.cutItem}>
            <CutIcon />
            <Text slot="label">{COPY.cutItem}</Text>
            <Keyboard>{MOD_KEY}X</Keyboard>
          </MenuItem>
          <MenuItem id="paste" textValue={COPY.paste}>
            <PasteIcon />
            <Text slot="label">{COPY.paste}</Text>
            <Keyboard>{MOD_KEY}V</Keyboard>
          </MenuItem>
          <MenuItem id="duplicate" textValue={COPY.duplicate}>
            <DuplicateIcon />
            <Text slot="label">{COPY.duplicate}</Text>
            <Keyboard>{MOD_KEY}D</Keyboard>
          </MenuItem>
        </MenuSection>
        <MenuSection>
          <MenuItem id="toggle" textValue={enabled ? COPY.disable : COPY.enable}>
            {enabled ? <VisibilityOff /> : <Visibility />}
            <Text slot="label">{enabled ? COPY.disable : COPY.enable}</Text>
            <Text slot="description">{enabled ? COPY.disableHint : COPY.enableHint}</Text>
          </MenuItem>
        </MenuSection>
        <MenuSection>
          <MenuItem id="delete" textValue={COPY.remove}>
            <DeleteIcon />
            <Text slot="label">{COPY.remove}</Text>
            <Keyboard>⌫</Keyboard>
          </MenuItem>
          <MenuItem id="removeSpan" textValue={RIPPLE.removeSpan}>
            <DeleteIcon />
            <Text slot="label">{RIPPLE.removeSpan}</Text>
            <Text slot="description">{canRemoveSpan ? RIPPLE.removeSpanHint : RIPPLE.removeSpanCaptions}</Text>
            <Keyboard>⇧⌫</Keyboard>
          </MenuItem>
        </MenuSection>
      </Menu>
    </MenuTrigger>
  );
}

/** The menu anchor: the pointer point. It takes no space and doesn't receive pointer events. */
const anchor = style({ position: 'fixed', width: 0, height: 0, pointerEvents: 'none', outlineStyle: 'none' });
