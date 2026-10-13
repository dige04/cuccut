import { useMemo } from 'react';
import type { CaptionItem, Id, Sequence } from '@cuccut/protocol';
import { EditLabel } from '@cuccut/protocol/messages/ui';
import { Text, ToggleButton } from '@react-spectrum/s2';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { STAGE_TOOLBAR_COPY as COPY } from '../../copy.ts';
import { editBlock, editLine, lineView } from '../../model/caption-lines.ts';
import { captionKind } from '../../model/caption-tracks.ts';
import { captionBox } from '../../model/stage-caption-move.ts';
import { M as TOOLBAR_COPY } from '../../model/stage-toolbar-copy.ts';
import { captionCase, captionToolbar, nextCaptionCase, type CaptionCase, type Tool } from '../../model/stage-toolbar.ts';
import type { CaptionHit } from '../../render/render-planner.ts';
import { num, type Json, type LineKind } from '../../render/text-style.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useEditor } from '../../state/editor-store.ts';
import { useVideo } from '../../state/video-store.ts';
import { saveCaptionStyleToBrand } from './brand-save.ts';
import { openCaptionActive, openCaptionEditor, openCaptionStyles } from './caption-open.ts';
import { previewCaptionStyle, saveCaptionStyle } from './caption-style-edit.ts';
import { useEditorActions } from './editor-context.tsx';
import { EDITOR_COPY as E } from './editor-copy.ts';
import { ToolbarFontField } from './font-field.tsx';
import { ColorField } from './inspector-controls.tsx';
import type { View } from './stage-boxes.tsx';
import type { FrameRect } from './stage-objects.tsx';
import { SpacingRow, type ToolHost } from './stage-toolbar-menu.tsx';
import { FloatingBar, SizePicker, ToolbarBody, quiet } from './stage-toolbar.tsx';
import { CAPTION_STYLE_COPY as S } from './subtitle-copy.ts';
import { useCaptionStyle } from './use-caption-style.ts';

/**
 * Floating toolbar for captions (the `subtitle` entry in prototype stage-toolbar.jsx): when a caption on the picture is selected, it floats above the caption box.
 * It edits the caption style document, written the same way as the caption properties page (see inspector-caption.tsx). While dragging it is only overlaid on the preview; on release a new version is written, and captions that share the same style change together.
 *
 * Which line is changed: if one line is selected, that line is changed (in bilingual mode, written into its override). If both bilingual lines are selected, both change together (written to the root style). The two “source | translation” buttons at the front of the bar switch which line is being edited. They are the same switch as the row at the top of the properties page (which item is selected).
 */

const scope = style({ display: 'flex', alignItems: 'center', gap: '[2px]' });

/** The glyph drawn on the case button (prototype `case`). */
const CASE_GLYPH: Record<CaptionCase, string> = { none: 'Aa', uppercase: 'AB', title: 'Ab', lowercase: 'ab' };

/** The two buttons at the front of the bar in bilingual mode: the line currently on the picture takes priority; if there is none, the first segment on that caption track is used. */
interface Line {
  kind: LineKind;
  itemId: Id;
}

export function StageCaptionToolbar({
  items,
  sequence,
  hits,
  frame,
  view,
  yielding,
}: {
  /** Selected captions (at least one, with the same style). */
  items: CaptionItem[];
  sequence: Sequence;
  /** Geometry of all caption lines on this frame of the picture. */
  hits: readonly CaptionHit[];
  frame: FrameRect;
  view: View;
  yielding: boolean;
}) {
  const runtime = useRuntime();
  const { apply } = useEditorActions();
  const records = useVideo((s) => s.video?.state?.video.documents) ?? {};
  const primary = items[0]!;
  const { record, body, root, chip, own, sharing, paired } = useCaptionStyle(primary, sequence, records);
  const styled = !!record;
  const web = runtime.host.platform === 'web';
  const spec = useMemo(() => captionToolbar({ paired, styled, web }), [paired, styled, web]);

  // The bar sits above the whole caption block: in bilingual mode both lines are counted together, so selecting the lower line will not cover the upper one.
  const byId = new Map(sequence.items.map((item) => [item.id, item]));
  const shares = (id: Id) => {
    const item = byId.get(id);
    return item?.type === 'caption' && (primary.styleDocumentId ? item.styleDocumentId === primary.styleDocumentId : items.some((i) => i.id === id));
  };
  const aabb = captionBox(hits.filter((hit) => shares(hit.itemId)));
  if (!root || !aabb) return null;

  const block = paired && new Set(items.map((item) => captionKind(item.documentId, records))).size > 1;
  const kind: LineKind = block ? 'original' : own;
  const shown = lineView(root, kind, paired);
  const next = (patch: Json) => (block ? editBlock(root, patch) : editLine(root, patch, kind, paired, paired));
  const live = (patch: Json) => previewCaptionStyle(record, body, next(patch));
  const commit = (patch: Json) =>
    saveCaptionStyle(apply, { sequence, record, body, before: root, style: next(patch), label: EditLabel.editSubtitleStyle() }, block || paired ? undefined : kind);

  const align = shown.textAlign ?? shown.align;
  const textCase = captionCase(shown.textTransform);
  const lineName = kind === 'translation' ? S.translation : S.original;

  const lines: Line[] = (['original', 'translation'] as const).flatMap((k) => {
    const onStage = hits
      .map((hit) => byId.get(hit.itemId))
      .find((item) => item?.type === 'caption' && item.styleDocumentId === primary.styleDocumentId && captionKind(item.documentId, records) === k);
    const track = sharing.find((c) => c.kind === k) ?? (own === k ? chip : undefined);
    const itemId = onStage?.id ?? track?.itemIds[0];
    return itemId ? [{ kind: k, itemId }] : [];
  });

  const host: ToolHost = {
    isOn: (id) => {
      if (id === 'bold') return shown.bold === true;
      if (id === 'italic') return shown.italic === true || shown.fontStyle === 'italic';
      if (id === 'align-left') return align === 'left';
      if (id === 'align-right') return align === 'right';
      if (id === 'align-center') return align !== 'left' && align !== 'right';
      return false;
    },
    run: (tool) => {
      const on = host.isOn(tool.id);
      switch (tool.id) {
        case 'bold':
          return commit({ bold: !on });
        case 'italic':
          return commit(on ? { italic: false, fontStyle: 'normal' } : { italic: true });
        case 'align-left':
          return commit({ textAlign: 'left' });
        case 'align-center':
          return commit({ textAlign: 'center' });
        case 'align-right':
          return commit({ textAlign: 'right' });
        case 'case':
          return commit({ textTransform: nextCaptionCase(shown.textTransform) });
        case 'sub-edit':
          return openCaptionEditor(primary);
        case 'sub-style':
          return openCaptionStyles(chip?.key);
        case 'sub-animation':
          return openCaptionActive(primary);
        case 'hide-subs':
          return useEditor.getState().setCaptionsHidden(true);
        case 'save-to-brand-kit':
          if (record) void saveCaptionStyleToBrand(runtime, record);
          return;
        default:
          return;
      }
    },
    subPage: (tool) =>
      tool.id === 'line-height' || tool.id === 'letter-spacing' ? (
        <SpacingRow id={tool.id} style={shown} isDisabled={false} onLive={live} onCommit={commit} />
      ) : null,
    face: (tool) => (tool.id === 'case' ? <Text>{CASE_GLYPH[textCase]}</Text> : undefined),
    label: (tool) => (tool.id === 'case' ? E.withNote(tool.label, S.cases.find((c) => c.key === textCase)?.label ?? textCase) : tool.label),
  };

  const render = (tool: Tool) => {
    switch (tool.id) {
      case 'sub-scope':
        return (
          <span role="group" aria-label={tool.label} className={scope}>
            {lines.map((line) => (
              <ToggleButton
                key={line.kind}
                isQuiet
                size="S"
                isSelected={!block && kind === line.kind}
                onChange={() => useEditor.getState().select([line.itemId])}>
                <Text>{line.kind === 'translation' ? S.translation : S.original}</Text>
              </ToggleButton>
            ))}
          </span>
        );
      case 'color':
        return (
          <ColorField
            label={paired && !block ? E.withNote(COPY.textColor, lineName) : COPY.textColor}
            value={shown.fontColor}
            fallback="#FFFFFF"
            onLive={(fontColor) => live({ fontColor })}
            onCommit={(fontColor) => commit({ fontColor })}
          />
        );
      case 'font':
        return (
          <span className={quiet}>
            <ToolbarFontField label={tool.label} value={shown.fontFamily} onChange={(fontFamily) => commit({ fontFamily })} />
          </span>
        );
      case 'size':
        return <SizePicker label={tool.label} size={num(shown.fontSize, 30)} isDisabled={false} onChange={(fontSize) => commit({ fontSize })} />;
      default:
        return undefined;
    }
  };

  // There is no rotate knob above the caption box: the bar sits 12px from the box, and flips below it when it would touch the top of the stage.
  const box = { x: frame.left + aabb.x * view.kx, y: frame.top + aabb.y * view.ky, w: aabb.w * view.kx, h: aabb.h * view.ky };
  return (
    <FloatingBar box={box} knob={false} yielding={yielding} label={TOOLBAR_COPY.subtitleBar}>
      <ToolbarBody spec={spec} host={host} render={render} />
    </FloatingBar>
  );
}
