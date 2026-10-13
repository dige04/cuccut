import type { ReactElement } from 'react';
import type { Conversation } from '@cuccut/protocol';
import {
  ActionButton,
  ActionButtonGroup,
  ActionMenu,
  MenuItem,
  ProgressCircle,
  SideNavItem,
  SideNavItemContent,
  SideNavItemLink,
  Text,
  Tooltip,
  TooltipTrigger,
} from '@react-spectrum/s2';
import Add from '@react-spectrum/s2/icons/Add';
import AlertTriangle from '@react-spectrum/s2/icons/AlertTriangle';
import Archive from '@react-spectrum/s2/icons/Archive';
import ClockPending from '@react-spectrum/s2/icons/ClockPending';
import Asset from '@react-spectrum/s2/icons/Asset';
import Comment from '@react-spectrum/s2/icons/Comment';
import Edit from '@react-spectrum/s2/icons/Edit';
import Folder from '@react-spectrum/s2/icons/Folder';
import FolderOpen from '@react-spectrum/s2/icons/FolderOpen';
import OpenIn from '@react-spectrum/s2/icons/OpenIn';
import PinOff from '@react-spectrum/s2/icons/PinOff';
import PinOn from '@react-spectrum/s2/icons/PinOn';
import { iconStyle, style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { revealLabel, untitled } from '../copy.ts';
import { S } from './shell-copy.ts';
import { agoLabel, shortenPath } from '../model/format.ts';
import { conversationStatus, sessionStatus, type ProjectRow } from '../model/sidebar.ts';
import { hrefFor } from '../state/shell-store.ts';

/** SideNav puts the text in an auto-width grid column: allow it to shrink, so titles are truncated instead of overflowing under the trailing row buttons. */
const fit = style({ minWidth: 0 });
const line = style({ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, width: 'full' });
const lineTitle = style({ flexGrow: 1, flexBasis: 0, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
const newHere = style({ color: 'gray-600' });
const tail = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  size: 16,
  color: { tone: { waiting: 'orange-900', failed: 'red-900', unread: 'green-900', running: 'gray-700' } },
  '--iconPrimary': { type: 'fill', value: 'currentColor' },
});
const unreadDot = style({ size: 8, borderRadius: 'full', backgroundColor: 'green-900' });
const tailIcon = iconStyle({ size: 'S' });

/** The trailing status of a session row: in progress is a loading ring; awaiting approval and failed each have a different icon; done-but-unread is a green dot (product design §3.1, user revision). */
function SessionTail({ conversation }: { conversation: Conversation }) {
  const status = sessionStatus(conversation);
  if (!status) return null;
  return (
    <span className={tail({ tone: status })} aria-hidden="true">
      {status === 'running' ? (
        <ProgressCircle size="S" isIndeterminate aria-label={S.common.working} />
      ) : status === 'waiting' ? (
        <ClockPending styles={tailIcon} />
      ) : status === 'failed' ? (
        <AlertTriangle styles={tailIcon} />
      ) : (
        <span className={unreadDot} />
      )}
    </span>
  );
}

export interface ConversationRowActions {
  togglePin(conversation: Conversation): void;
  archive(conversation: Conversation): void;
}

/**
 * Session row (pinned, under a project, recent, and the flat list: the same one in all four places): a single-line title plus the trailing status; the full status, project and time are in the hover tooltip.
 * On hover or focus, pin and archive appear at the trailing end. Pinned sessions get a chat bubble icon.
 */
export function conversationItem(
  conversation: Conversation,
  key: string,
  { now, projectName, pinned = false, actions }: { now: number; projectName: string | null; pinned?: boolean; actions: ConversationRowActions },
) {
  const title = conversation.title || untitled();
  const status = conversationStatus(conversation);
  const detail = [title, projectName ?? S.sidebarRows.noProject, status?.label, agoLabel(conversation.updatedAt, now)].filter(Boolean).join(' · ');
  return (
    <SideNavItem
      key={key}
      id={key}
      textValue={title}
      href={hrefFor({ tab: 'home', conversationId: conversation.id, projectId: null })}
      data-cc-row="">
      <SideNavItemContent>
        <SideNavItemLink aria-label={detail}>
          {pinned ? <Comment /> : null}
          <Text styles={fit}>
            <span className={line} title={detail}>
              <span className={lineTitle}>{title}</span>
              <SessionTail conversation={conversation} />
            </span>
          </Text>
        </SideNavItemLink>
        <ActionButtonGroup isQuiet size="S" UNSAFE_className="cc-row-actions" aria-label={S.sidebarRows.rowActions(title)}>
          <TooltipTrigger>
            <ActionButton aria-label={S.sidebarRows.togglePin(conversation.pinned, title)} onPress={() => actions.togglePin(conversation)}>
              {conversation.pinned ? <PinOff /> : <PinOn />}
            </ActionButton>
            <Tooltip>{conversation.pinned ? S.common.unpin : S.common.pin}</Tooltip>
          </TooltipTrigger>
          <TooltipTrigger>
            <ActionButton aria-label={S.sidebarRows.archiveNamed(title)} onPress={() => actions.archive(conversation)}>
              <Archive />
            </ActionButton>
            <Tooltip>{S.sidebarRows.archive}</Tooltip>
          </TooltipTrigger>
        </ActionButtonGroup>
      </SideNavItemContent>
    </SideNavItem>
  );
}

/**
 * One project: a single-line folder row plus its sessions; the status summary and path are in the hover tooltip. The project menu and expand button at the trailing end only appear on hover or focus.
 */
export function ProjectItem({
  id,
  row,
  open,
  onAction,
  conversationRow,
}: {
  id: string;
  row: ProjectRow;
  open: boolean;
  onAction: (key: string) => void;
  conversationRow: (conversation: Conversation, key: string) => ReactElement;
}) {
  const { project } = row;
  const newHref = hrefFor({ tab: 'home', conversationId: null, projectId: project.id });
  const detail = [project.name, row.summary, shortenPath(project.path)].filter(Boolean).join(' · ');
  return (
    <SideNavItem id={id} textValue={project.name} hasChildItems data-cc-expandable="">
      <SideNavItemContent>
        {open ? <FolderOpen /> : <Folder />}
        <Text styles={fit}>
          <span className={line} title={detail}>
            <span className={lineTitle}>{project.name}</span>
          </span>
        </Text>
        <ActionMenu
          aria-label={S.sidebarRows.projectActions(project.name)}
          isQuiet
          size="S"
          onAction={(key) => onAction(String(key))}>
          <MenuItem id="new" textValue={S.common.newSessionInProject}>
            <Add />
            <Text>{S.common.newSessionInProject}</Text>
          </MenuItem>
          <MenuItem id="pin" textValue={project.pinned ? S.common.unpin : S.common.pin}>
            {project.pinned ? <PinOff /> : <PinOn />}
            <Text>{project.pinned ? S.common.unpin : S.common.pin}</Text>
          </MenuItem>
          <MenuItem id="rename" textValue={S.common.rename}>
            <Edit />
            <Text>{S.common.renameEllipsis}</Text>
          </MenuItem>
          <MenuItem id="space" textValue={S.sidebarRows.showInSpace}>
            <Asset />
            <Text>{S.sidebarRows.showInSpace}</Text>
          </MenuItem>
          <MenuItem id="reveal" textValue={revealLabel()}>
            <OpenIn />
            <Text>{revealLabel()}</Text>
          </MenuItem>
        </ActionMenu>
      </SideNavItemContent>
      {row.conversations.map((conversation) => conversationRow(conversation, `${id}/${conversation.id}`))}
      {row.conversations.length ? null : (
        <SideNavItem id={`${id}/new`} textValue={S.sidebarRows.newHere} href={newHref} data-cc-row="">
          <SideNavItemContent>
            <SideNavItemLink>
              <Text>
                <span className={newHere}>{S.sidebarRows.newHere}</span>
              </Text>
            </SideNavItemLink>
          </SideNavItemContent>
        </SideNavItem>
      )}
    </SideNavItem>
  );
}
