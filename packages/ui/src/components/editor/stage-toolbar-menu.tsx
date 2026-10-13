import { useState, type ComponentType, type ReactElement, type ReactNode } from 'react';
import type { ArrangeDirection, Id } from '@cuccut/protocol';
import { EditLabel } from '@cuccut/protocol/messages/ui';
import {
  ActionButton,
  Content,
  ContextualHelpPopover,
  DialogTrigger,
  Heading,
  Keyboard,
  Menu,
  MenuItem,
  MenuSection,
  Popover,
  SubmenuTrigger,
  Text,
  ToggleButton,
  Tooltip,
  TooltipTrigger,
  UnavailableMenuItemTrigger,
} from '@react-spectrum/s2';
import Animation from '@react-spectrum/s2/icons/Animation';
import AudioWave from '@react-spectrum/s2/icons/AudioWave';
import Brand from '@react-spectrum/s2/icons/Brand';
import BrightnessContrast from '@react-spectrum/s2/icons/BrightnessContrast';
import Brush from '@react-spectrum/s2/icons/Brush';
import ChevronDown from '@react-spectrum/s2/icons/ChevronDown';
import ChevronLeft from '@react-spectrum/s2/icons/ChevronLeft';
import ChevronUp from '@react-spectrum/s2/icons/ChevronUp';
import Clock from '@react-spectrum/s2/icons/Clock';
import CornerRadius from '@react-spectrum/s2/icons/CornerRadius';
import Crop from '@react-spectrum/s2/icons/Crop';
import Delete from '@react-spectrum/s2/icons/Delete';
import Duplicate from '@react-spectrum/s2/icons/Duplicate';
import Edit from '@react-spectrum/s2/icons/Edit';
import Effects from '@react-spectrum/s2/icons/Effects';
import Filters from '@react-spectrum/s2/icons/Filters';
import FlipHorizontal from '@react-spectrum/s2/icons/FlipHorizontal';
import FlipVertical from '@react-spectrum/s2/icons/FlipVertical';
import FullScreen from '@react-spectrum/s2/icons/FullScreen';
import LineHeight from '@react-spectrum/s2/icons/LineHeight';
import More from '@react-spectrum/s2/icons/More';
import Order from '@react-spectrum/s2/icons/Order';
import Properties from '@react-spectrum/s2/icons/Properties';
import Replace from '@react-spectrum/s2/icons/Replace';
import SortDown from '@react-spectrum/s2/icons/SortDown';
import SortUp from '@react-spectrum/s2/icons/SortUp';
import SpeedFast from '@react-spectrum/s2/icons/SpeedFast';
import StrokeWidth from '@react-spectrum/s2/icons/StrokeWidth';
import TextAlignCenter from '@react-spectrum/s2/icons/TextAlignCenter';
import TextAlignLeft from '@react-spectrum/s2/icons/TextAlignLeft';
import TextAlignRight from '@react-spectrum/s2/icons/TextAlignRight';
import TextBold from '@react-spectrum/s2/icons/TextBold';
import TextItalic from '@react-spectrum/s2/icons/TextItalic';
import TextVariableFontSettings from '@react-spectrum/s2/icons/TextVariableFontSettings';
import ViewTransparency from '@react-spectrum/s2/icons/ViewTransparency';
import VisibilityOff from '@react-spectrum/s2/icons/VisibilityOff';
import VolumeTwo from '@react-spectrum/s2/icons/VolumeTwo';
import ZoomFitToScreen from '@react-spectrum/s2/icons/ZoomFitToScreen';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { STAGE_TOOLBAR_COPY as COPY } from '../../copy.ts';
import { canArrange } from '../../model/editor-ops.ts';
import { fitCanvas } from '../../model/geometry-panel.ts';
import { patchTextStyle } from '../../model/property-values.ts';
import { placeFields, poseOf, type PlacedItem } from '../../model/stage-pose.ts';
import { M as TOOLBAR_COPY } from '../../model/stage-toolbar-copy.ts';
import { ARRANGE_COPY, ARRANGE_ROWS, brandTarget, itemAsset, type InspectorSection, type MenuGroup, type Tool, type ToolId } from '../../model/stage-toolbar.ts';
import { asObject, num } from '../../render/text-style.ts';
import type { RuntimeSession } from '../../runtime/session.ts';
import { useEditor } from '../../state/editor-store.ts';
import { saveAssetToBrand } from './brand-save.ts';
import type { EditorActions } from './editor-context.tsx';
import { ValueRow } from './inspector-controls.tsx';
import { OpacityRow, TimeSection, type ItemPageProps } from './inspector-sections.tsx';
import { openItemReplace } from './item-replace.tsx';
import { MOD_KEY, arrangeItem, deleteItems, detachAudio, duplicateItems, setItemEnabled } from './timeline-commands.ts';
import { EDITOR_COPY as E } from './editor-copy.ts';
import { INSPECTOR_COPY as IC } from './inspector-copy.ts';

/**
 * The toolbar's overflow menu (prototype stage-toolbar-menu.jsx) and the actions shared by the toolbar and the menu:
 * the first section is a row of icon buttons (flip · fit to canvas, or B / I · three alignments), the rest are menu items; the slider and time items drill down one level in the same popover
 * (the prototype expands a submenu to the right; here it stays inside the popover so it does not cover the picture). Disabled items are greyed out, and opening them explains why.
 *
 * `ToolHost` supplies what each cell does: one for on-screen clips (`itemHost`) and one for captions (stage-caption-toolbar); the menu only lays them out.
 */

export type ToolProps = ItemPageProps<PlacedItem>;

/** What each cell on the bar and the menu does (one set for on-screen elements, one for captions). */
export interface ToolHost {
  /** Whether the toggle cell is currently on. */
  isOn(id: ToolId): boolean;
  /** Cells that take effect immediately: commands, toggles, and jumps elsewhere. */
  run(tool: Tool): void;
  /** Edits that drill down one level (sliders, timing). */
  subPage(tool: Tool): ReactNode;
  /** Flyout submenu (layer order); `close` collapses the whole popover. */
  submenu?(tool: Tool, close: () => void): ReactElement | undefined;
  /** What to draw on the icon button: by default the icon from `TOOL_ICON` (the caption case button draws a glyph). */
  face?(tool: Tool): ReactNode;
  /** Hover tooltip and screen-reader name of the icon button; defaults to the display name. */
  label?(tool: Tool): string;
}

const pop = style({ display: 'flex', flexDirection: 'column', width: 232 });
const row = style({ display: 'flex', alignItems: 'center', gap: 12, paddingX: 4, paddingY: '[2px]' });
const cluster = style({ display: 'flex', alignItems: 'center', gap: '[2px]' });
const rule = style({ height: '[1px]', backgroundColor: 'gray-100', marginY: 4, marginX: '[2px]' });
const subHead = style({ display: 'flex', alignItems: 'center', gap: 4, font: 'ui', fontWeight: 'bold', color: 'gray-900', paddingBottom: 4 });
const subBody = style({ display: 'flex', flexDirection: 'column', gap: 8, paddingX: 4, paddingBottom: 4 });

/** Icon for each cell (prototype `Ic`); shared by menu items and icon buttons on the bar. */
export const TOOL_ICON: Partial<Record<ToolId, ComponentType>> = {
  'text-styles': Brush,
  animation: Animation,
  volume: VolumeTwo,
  speed: SpeedFast,
  adjust: BrightnessContrast,
  border: StrokeWidth,
  properties: Properties,
  copy: Duplicate,
  arrange: Order,
  'save-to-brand-kit': Brand,
  'adjust-timing': Clock,
  disable: VisibilityOff,
  delete: Delete,
  bold: TextBold,
  italic: TextItalic,
  'align-left': TextAlignLeft,
  'align-center': TextAlignCenter,
  'align-right': TextAlignRight,
  'line-height': LineHeight,
  'letter-spacing': TextVariableFontSettings,
  'flip-vertical': FlipVertical,
  'flip-horizontal': FlipHorizontal,
  'fit-canvas': ZoomFitToScreen,
  'fill-canvas': FullScreen,
  opacity: ViewTransparency,
  'round-corners': CornerRadius,
  filters: Filters,
  effects: Effects,
  'crop-video': Crop,
  'replace-video': Replace,
  'replace-image': Replace,
  'detach-audio': AudioWave,
  'sub-edit': Edit,
  'sub-style': Brush,
  'sub-animation': Animation,
  'hide-subs': VisibilityOff,
};

/** The selection inspector (inspector-column.tsx), wherever it is mounted: the session's slot or the pane's own column. */
const panelSelector = () => '[data-inspector]';

/** Section header titles in the properties page (follow the UI language); `jump()` takes the stable section key. */
const SECTION_TITLES: Record<InspectorSection, () => string> = {
  style: () => IC.style,
  transition: () => IC.transition,
  effects: () => IC.effects,
};

/** Section header: the title is the first span inside the header (SecHead in inspector-controls). */
function sectionHead(panel: Element, section: InspectorSection): HTMLElement | null {
  const title = SECTION_TITLES[section]();
  for (const span of panel.querySelectorAll('span')) {
    if (span.textContent === title && span.parentElement?.firstElementChild === span) return span.parentElement;
  }
  return null;
}

/**
 * Opens the properties page for this item and scrolls to a section (`null` is the top of the page). If the selection also holds other things (the main video), select only this item first, so the properties page is its own page.
 * When the page has just mounted, the section headers may not be there yet: look for them over a few frames, and if they are still missing, stay at the top.
 */
export function jumpToSection(itemId: Id, section: InspectorSection | null): void {
  const editor = useEditor.getState();
  if (editor.selection.length !== 1 || editor.selection[0] !== itemId) editor.select([itemId]);
  let tries = 0;
  const seek = () => {
    const panel = document.querySelector(panelSelector());
    const head = panel && section ? sectionHead(panel, section) : null;
    if (head) return head.scrollIntoView({ block: 'start', behavior: 'smooth' });
    if (tries++ < 10) return void requestAnimationFrame(seek);
    panel?.querySelector('.cc-scroll')?.scrollTo({ top: 0, behavior: 'smooth' });
  };
  if (section) requestAnimationFrame(seek);
  else requestAnimationFrame(() => document.querySelector(panelSelector())?.querySelector('.cc-scroll')?.scrollTo({ top: 0, behavior: 'smooth' }));
}

/** Whether the toggle cells are currently on (flip, bold/italic, alignment). */
export function toolIsOn(id: ToolId, item: PlacedItem): boolean {
  const style = item.type === 'text' ? asObject(item.style) : {};
  const align = style.textAlign ?? style.align;
  switch (id) {
    case 'flip-horizontal':
      return !!item.place.flipX;
    case 'flip-vertical':
      return !!item.place.flipY;
    case 'bold':
      return style.bold === true;
    case 'italic':
      return style.italic === true || style.fontStyle === 'italic';
    case 'align-left':
      return align === 'left';
    case 'align-right':
      return align === 'right';
    case 'align-center':
      return align !== 'left' && align !== 'right';
    default:
      return false;
  }
}

/** Cells that take effect immediately: commands, toggles, and jumps to the properties page. Value changes follow the same path as the properties page (`edit.commit`). */
export function runTool(tool: Tool, { item, sequence, assets, edit }: ToolProps, actions: EditorActions, runtime: RuntimeSession): void {
  const target = { sequenceId: sequence.id, itemId: item.id };
  const text = (patch: Record<string, unknown>) =>
    item.type === 'text' && edit.commit([{ type: 'setStyle', ...target, style: patchTextStyle(item.style, patch) }]);
  switch (tool.action.kind) {
    case 'jump':
      return jumpToSection(item.id, tool.action.section);
    case 'command':
      if (tool.id === 'copy') return void duplicateItems(actions, [item.id]);
      if (tool.id === 'delete') return void deleteItems(actions, [item.id]);
      // Once disabled, the item disappears from the picture and the bar collapses with the selection box; the notice has an Undo and says it can be re-enabled by right-clicking it on the timeline.
      if (tool.id === 'disable') return void setItemEnabled(actions, item.id, false, TOOLBAR_COPY.disabledNotice);
      if (tool.id === 'detach-audio' && item.type === 'video') return void detachAudio(actions, sequence, item, TOOLBAR_COPY.detachedNotice);
      if (tool.id === 'replace-video' || tool.id === 'replace-image') {
        const asset = itemAsset(item, assets);
        if (asset) openItemReplace(item.id, asset.id);
        return;
      }
      if (tool.id === 'save-to-brand-kit') {
        const asset = itemAsset(item, assets);
        const target = brandTarget(asset);
        if (asset && 'source' in target) void saveAssetToBrand(runtime, asset, target.kind, target.source);
        return;
      }
      if (tool.id === 'fit-canvas' || tool.id === 'fill-canvas') {
        const pose = poseOf(item, sequence.canvas, assets);
        const fields = placeFields(
          item,
          { ...pose, ...fitCanvas(pose, sequence.canvas, tool.id === 'fill-canvas') },
          sequence.canvas,
          assets,
        );
        if (!Object.keys(fields).length) return;
        return edit.commit([{ type: 'setTransform', ...target, ...fields }], tool.id === 'fill-canvas' ? EditLabel.fillCanvas() : EditLabel.fitCanvas());
      }
      return;
    case 'toggle': {
      const on = toolIsOn(tool.id, item);
      if (tool.id === 'flip-horizontal') return edit.commit([{ type: 'setTransform', ...target, flipX: !on }], EditLabel.flip());
      if (tool.id === 'flip-vertical') return edit.commit([{ type: 'setTransform', ...target, flipY: !on }], EditLabel.flip());
      if (tool.id === 'bold') return void text({ bold: !on });
      if (tool.id === 'italic') return void text(on ? { italic: false, fontStyle: 'normal' } : { italic: true });
      if (tool.id === 'align-left') return void text({ textAlign: 'left' });
      if (tool.id === 'align-center') return void text({ textAlign: 'center' });
      if (tool.id === 'align-right') return void text({ textAlign: 'right' });
      return;
    }
    default:
      return;
  }
}

/** Explanation popover for unavailable cells (shared by the bar and the menu). */
export function OffNote({ tool }: { tool: Tool }) {
  return (
    <ContextualHelpPopover>
      <Heading>
        {tool.label} · {COPY.unavailable}
      </Heading>
      <Content>{tool.action.kind === 'off' ? tool.action.reason : null}</Content>
    </ContextualHelpPopover>
  );
}

/** The row of icon buttons in the first section of the menu: toggles use ToggleButton, commands use ActionButton; unavailable ones are greyed out, and opening them explains why. */
function RowTool({ tool, host }: { tool: Tool; host: ToolHost }) {
  const Icon = TOOL_ICON[tool.id];
  const icon = host.face?.(tool) ?? (Icon ? <Icon /> : <Text>{tool.label}</Text>);
  const label = host.label?.(tool) ?? tool.label;
  if (tool.action.kind === 'off')
    return (
      <DialogTrigger>
        <ActionButton isQuiet size="S" aria-label={E.withNote(label, COPY.unavailable)}>
          {icon}
        </ActionButton>
        <OffNote tool={tool} />
      </DialogTrigger>
    );
  const button =
    tool.action.kind === 'toggle' ? (
      <ToggleButton isQuiet size="S" aria-label={label} isSelected={host.isOn(tool.id)} onChange={() => host.run(tool)}>
        {icon}
      </ToggleButton>
    ) : (
      <ActionButton isQuiet size="S" aria-label={label} onPress={() => host.run(tool)}>
        {icon}
      </ActionButton>
    );
  return (
    <TooltipTrigger placement="top">
      {button}
      <Tooltip>{label}</Tooltip>
    </TooltipTrigger>
  );
}

const KEYS: Partial<Record<ToolId, string>> = { copy: `${MOD_KEY}D`, delete: '⌫' };

/** One menu item row; `submenu` supplies the submenu that flies out on hover or click (in the prototype, submenus always fly out). */
function MenuTool({ tool, submenu }: { tool: Tool; submenu?: ReactElement }) {
  const Icon = TOOL_ICON[tool.id];
  const item = (
    // DialogTrigger also gives the menu a “collapse on select” state: drill-down items must stay in the popover and switch pages, so they must not collapse it.
    <MenuItem id={tool.id} textValue={tool.label} shouldCloseOnSelect={tool.action.kind !== 'sub'}>
      {Icon ? <Icon /> : null}
      <Text slot="label">{tool.label}</Text>
      {KEYS[tool.id] ? <Keyboard>{KEYS[tool.id]}</Keyboard> : null}
    </MenuItem>
  );
  if (submenu && tool.action.kind !== 'off') {
    return (
      <SubmenuTrigger>
        {item}
        {submenu}
      </SubmenuTrigger>
    );
  }
  if (tool.action.kind !== 'off') return item;
  return (
    <UnavailableMenuItemTrigger isUnavailable>
      {item}
      <OffNote tool={tool} />
    </UnavailableMenuItemTrigger>
  );
}

/** Icons and shortcuts for the four “layer order” rows (prototype OrderSub: bring to front F, bring forward ⌘↑, send backward ⌘↓, send to back B). */
const ARRANGE_ICON: Record<ArrangeDirection, ComponentType> = { front: SortUp, forward: ChevronUp, backward: ChevronDown, back: SortDown };
const ARRANGE_KEY: Record<ArrangeDirection, string> = { front: 'F', forward: `${MOD_KEY}↑`, backward: `${MOD_KEY}↓`, back: 'B' };

/**
 * The “layer order” flyout menu: two rows for moving forward, a divider, then two rows for moving backward. A direction that can't move is greyed out (the item is alone on its track, or already at the top / bottom of the stack of pictures and captions);
 * clicking a row commits one change and collapses the whole popover.
 */
function ArrangeSub({ props, actions, onDone }: { props: ToolProps; actions: EditorActions; onDone(): void }) {
  const { item, sequence, canChange } = props;
  const disabled = ARRANGE_ROWS.flat().filter((direction) => !canChange || !canArrange(sequence, item.id, direction));
  return (
    <Menu
      aria-label={ARRANGE_COPY.label}
      size="S"
      disabledKeys={disabled}
      onAction={(key) => {
        onDone();
        arrangeItem(actions, item.id, key as ArrangeDirection);
      }}>
      {ARRANGE_ROWS.map((group, i) => (
        <MenuSection key={i}>
          {group.map((direction) => {
            const Icon = ARRANGE_ICON[direction];
            return (
              <MenuItem key={direction} id={direction} textValue={ARRANGE_COPY[direction]}>
                <Icon />
                <Text slot="label">{ARRANGE_COPY[direction]}</Text>
                <Keyboard>{ARRANGE_KEY[direction]}</Keyboard>
              </MenuItem>
            );
          })}
        </MenuSection>
      ))}
    </Menu>
  );
}

/** Two sliders for line height and letter spacing (shared by text elements and captions): the same controls as the properties page; while dragging they only overlay a draft, and on release one change is committed. */
export function SpacingRow({
  id,
  style,
  isDisabled,
  onLive,
  onCommit,
}: {
  id: 'line-height' | 'letter-spacing';
  style: Record<string, unknown>;
  isDisabled: boolean;
  onLive(patch: Record<string, unknown>): void;
  onCommit(patch: Record<string, unknown>): void;
}) {
  return id === 'line-height' ? (
    <ValueRow
      label={IC.lineHeight}
      value={Math.round(num(style.lineHeight, 1.2) * 100)}
      min={90}
      max={200}
      unit="%"
      isDisabled={isDisabled}
      onLive={(v) => onLive({ lineHeight: v / 100 })}
      onCommit={(v) => onCommit({ lineHeight: v / 100 })}
    />
  ) : (
    <ValueRow
      label={IC.letterSpacing}
      value={num(style.letterSpacing, 0)}
      min={-10}
      max={30}
      step={0.5}
      digits={1}
      isDisabled={isDisabled}
      onLive={(letterSpacing) => onLive({ letterSpacing })}
      onCommit={(letterSpacing) => onCommit({ letterSpacing })}
    />
  );
}

/** Edits that drill down one level for an on-screen clip: opacity, line height, letter spacing, adjust timing. */
function ItemSubPage({ tool, props }: { tool: Tool; props: ToolProps }) {
  const { item, sequence, edit, canChange } = props;
  if (tool.id === 'opacity') return <OpacityRow {...props} />;
  if (tool.id === 'adjust-timing') return <TimeSection {...props} />;
  if ((tool.id === 'line-height' || tool.id === 'letter-spacing') && item.type === 'text')
    return (
      <SpacingRow
        id={tool.id}
        style={asObject(item.style)}
        isDisabled={!canChange}
        onLive={(patch) => edit.live({ style: patchTextStyle(item.style, patch) })}
        onCommit={(patch) => edit.commit([{ type: 'setStyle', sequenceId: sequence.id, itemId: item.id, style: patchTextStyle(item.style, patch) }])}
      />
    );
  return null;
}

/** What the cells on the bar and menu do when one on-screen item is selected. */
export function itemHost(props: ToolProps, actions: EditorActions, runtime: RuntimeSession): ToolHost {
  return {
    isOn: (id) => toolIsOn(id, props.item),
    run: (tool) => runTool(tool, props, actions, runtime),
    subPage: (tool) => <ItemSubPage tool={tool} props={props} />,
    submenu: (tool, close) => (tool.id === 'arrange' ? <ArrangeSub props={props} actions={actions} onDone={close} /> : undefined),
  };
}

/** The drill-down page: a back button at the top and this cell's name. */
function SubPage({ tool, onBack, children }: { tool: Tool; onBack(): void; children: ReactNode }) {
  return (
    <>
      <div className={subHead}>
        <ActionButton isQuiet size="S" aria-label={COPY.back} onPress={onBack}>
          <ChevronLeft />
        </ActionButton>
        <span>{tool.label}</span>
      </div>
      <div className={subBody}>{children}</div>
    </>
  );
}

/** Overflow menu: the ⋯ button opens a popover. Commands and jumps collapse it when clicked; drill-down items stay in the popover and switch to another page. */
export function StageToolbarMenu({ groups, host }: { groups: MenuGroup[]; host: ToolHost }) {
  const [open, setOpen] = useState(false);
  const [sub, setSub] = useState<Tool | null>(null);
  const tools = new Map(groups.flatMap((g) => (g.kind === 'row' ? g.clusters.flat() : g.tools)).map((t) => [t.id, t]));
  const rows = groups.filter((g): g is Extract<MenuGroup, { kind: 'row' }> => g.kind === 'row');
  const lists = groups.filter((g): g is Extract<MenuGroup, { kind: 'list' }> => g.kind === 'list');
  const submenus = new Map(lists.flatMap((g) => g.tools).flatMap((tool) => {
    const menu = host.submenu?.(tool, () => setOpen(false));
    return menu ? [[tool.id, menu] as const] : [];
  }));
  const onAction = (key: string | number) => {
    const tool = tools.get(String(key) as ToolId);
    if (!tool || tool.action.kind === 'off') return;
    // The flyout submenu (layer order) is opened and closed by SubmenuTrigger itself; other drill-down items switch pages inside the popover.
    if (submenus.has(tool.id)) return;
    if (tool.action.kind === 'sub') return setSub(tool);
    setOpen(false);
    host.run(tool);
  };
  return (
    <DialogTrigger
      isOpen={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSub(null);
      }}>
      <TooltipTrigger placement="top">
        <ActionButton isQuiet size="S" aria-label={COPY.more}>
          <More />
        </ActionButton>
        <Tooltip>{COPY.more}</Tooltip>
      </TooltipTrigger>
      <Popover placement="bottom end" aria-label={COPY.more}>
        <div className={pop}>
          {sub ? (
            <SubPage tool={sub} onBack={() => setSub(null)}>
              {host.subPage(sub)}
            </SubPage>
          ) : (
            <>
              {rows.map((g, i) => (
                <div key={i} className={row}>
                  {g.clusters.map((c, j) => (
                    <span key={j} className={cluster}>
                      {c.map((tool) => (
                        <RowTool key={tool.id} tool={tool} host={host} />
                      ))}
                    </span>
                  ))}
                </div>
              ))}
              {rows.length && lists.length ? <div className={rule} /> : null}
              {lists.length ? (
                <Menu aria-label={COPY.more} size="S" onAction={onAction}>
                  {lists.map((g, i) => (
                    <MenuSection key={i}>
                      {g.tools.map((tool) => (
                        <MenuTool key={tool.id} tool={tool} submenu={submenus.get(tool.id)} />
                      ))}
                    </MenuSection>
                  ))}
                </Menu>
              ) : null}
            </>
          )}
        </div>
      </Popover>
    </DialogTrigger>
  );
}
