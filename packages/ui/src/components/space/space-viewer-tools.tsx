import type { SpaceEntry } from '@cuccut/protocol';
import { ActionButton, Menu, MenuItem, MenuTrigger, Text } from '@react-spectrum/s2';
import Refresh from '@react-spectrum/s2/icons/Refresh';
import Tools from '@react-spectrum/s2/icons/Tools';
import type { ToolId } from '../../model/tool-catalog.ts';
import { ENTRY_TOOL_COPY as COPY } from '../tools/tools-copy.ts';
import type { EntryTools } from '../tools/use-entry-tools.ts';

/*
 * The tool-related parts of the Space viewer (product design §4.5, §2.7 “页面” (Page); design draft space-viewer.jsx): the facts state which tool made it and where it lives;
 * the bottom bar has “用工具处理…” (Process with tool…), with the item already selected when the tool page opens, and “再做一次” (Do again), which goes back to the tool page with the parameters filled in and reopens the video tool's run.
 */

/** The “工具” (Tool) and “位置” (Location) rows in the facts table; `term` / `value` use the viewer's own styles. */
export function ToolFacts({ tools, term, value }: { tools: EntryTools | null; term: string; value: string }) {
  if (!tools) return null;
  const { origin, location } = tools;
  return (
    <>
      {origin ? (
        <>
          <dt className={term}>{COPY.factTool}</dt>
          <dd className={value}>{origin.toolName}</dd>
        </>
      ) : null}
      {location && (origin || location.isSaveDir) ? (
        <>
          <dt className={term}>{COPY.factPlace}</dt>
          <dd className={value}>
            {location.label}
            {location.isSaveDir ? COPY.saveDir : ''}
          </dd>
        </>
      ) : null}
    </>
  );
}

/** The bottom bar's “用工具处理…” (Process with tool…) and “再做一次 / 重试” (Do again / Retry). Pressing one closes the viewer first, then goes to the tool page. */
export function ToolActions({ entry, tools, onClose }: { entry: SpaceEntry; tools: EntryTools | null; onClose: () => void }) {
  if (!tools) return null;
  const rerun = tools.origin?.rerun ?? null;
  const pick = (id: ToolId) => {
    onClose();
    tools.openTool(id);
  };
  return (
    <>
      {tools.tools.length ? (
        <MenuTrigger>
          <ActionButton isQuiet>
            <Tools />
            <Text>{COPY.menu}</Text>
          </ActionButton>
          <Menu aria-label={COPY.menuLabel(entry.name)} onAction={(key) => pick(String(key) as ToolId)}>
            {tools.tools.map((t) => (
              <MenuItem key={t.id} id={t.id} textValue={t.name}>
                <Text slot="label">{t.name}</Text>
              </MenuItem>
            ))}
          </Menu>
        </MenuTrigger>
      ) : null}
      {rerun ? (
        <ActionButton
          isQuiet
          aria-description={rerun.mode === 'refill' ? COPY.rerunHint : undefined}
          onPress={() => {
            onClose();
            tools.rerun();
          }}>
          <Refresh />
          <Text>{rerun.label}</Text>
        </ActionButton>
      ) : null}
    </>
  );
}
