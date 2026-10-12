import type { FileTarget, SpaceEntry } from '@cuccut/protocol';
import { entryOfTarget } from './workspace.ts';

/** 回环主机名互换（docs/design/canvas §6.2）：界面在 `127.0.0.1` 时编辑器用 `localhost`，反之亦然。 */
const OTHER_LOOPBACK: Record<string, string> = { '127.0.0.1': 'localhost', localhost: '127.0.0.1' };

/**
 * 设计稿与设计系统编辑器 iframe 的地址：桌面端 `design.open` / `designSystem.open` 给的是网关的绝对地址，原样用；
 * Web 服务给相对地址 `/design/<grant>/`、`/design-system/<grant>/`，换到另一个回环主机名，那里没有会话 cookie，
 * 画板脚本连不上 Runtime（§6.2 D2、§10.4）。页面不在这两个主机名上时换不了，返回 null，标签显示不可用的说明，不退回同源。
 */
export function designFrameUrl(address: string, location: Pick<Location, 'protocol' | 'hostname' | 'port'>): string | null {
  if (!address.startsWith('/')) return address;
  const other = OTHER_LOOPBACK[location.hostname];
  if (!other) return null;
  return `${location.protocol}//${other}${location.port ? `:${location.port}` : ''}${address}`;
}

/** 设计系统编辑器地址上的设计系统目录参数（docs/design/canvas §10.4）：编辑器写给智能体的提示里用它指明是哪个设计系统。 */
export const DESIGN_SYSTEM_PATH_PARAM = 'path';

/**
 * 加在设计系统编辑器地址上的 `path`：`FileTarget.path`；按 Space 条目打开的用条目在来源目录里的相对路径。
 * 找不到条目、条目不在来源目录里时返回 null，地址上不带。
 */
export function designSystemPath(target: FileTarget, entries: readonly SpaceEntry[]): string | null {
  if ('path' in target) return target.path;
  const entry = entryOfTarget(entries, target);
  // 不在来源目录里的条目，relPath 只是显示用的名字
  return entry && (entry.source.projectId || entry.source.conversationId) ? entry.relPath : null;
}
