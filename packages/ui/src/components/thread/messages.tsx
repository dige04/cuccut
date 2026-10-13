import {ImageLightbox} from '../media/image-lightbox.tsx';
import {useShell} from '../../state/shell-store.ts';
import {IMAGE as IMAGE_COPY} from '../image-preview-copy.ts';
import { memo, useEffect, useState } from 'react';
import { localizeText, messageSkills, type AttachmentRef, type Id, type MediaHandle, type TimelineItem } from '@cuccut/protocol';
import { UserMessage as UserBubble } from '@react-spectrum/ai';
import { ActionButton, Card, Content, Text } from '@react-spectrum/s2';
import AlertTriangle from '@react-spectrum/s2/icons/AlertTriangle';
import Code from '@react-spectrum/s2/icons/Code';
import Asset from '@react-spectrum/s2/icons/Asset';
import ImageIcon from '@react-spectrum/s2/icons/Image';
import InfoCircle from '@react-spectrum/s2/icons/InfoCircle';
import MovieCamera from '@react-spectrum/s2/icons/MovieCamera';
import ViewGrid from '@react-spectrum/s2/icons/ViewGrid';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { T } from './thread-copy.ts';
import { HOME_COPY, sentAttachmentsLabel, SKILL_COPY } from '../../copy.ts';
import { formatClock } from '../../model/format.ts';
import { sentAnnotationId } from '../../model/slide-annotations.ts';
import { referenceDescription, referencesText } from '../../model/space-actions.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { AgentMarkdown } from './agent-markdown.tsx';
import { CopyButton } from './copy-button.tsx';
import { AnnotationsToken } from '../annotations-token.tsx';

type Item<K extends TimelineItem['kind']> = Extract<TimelineItem, { kind: K }>;

const userRow = style({ display: 'flex', flexDirection: 'column', alignItems: 'end', gap: 4 });
/** 已发送的图片排在正文上方（原型 spectrum.css `.cc-ai-sent-attachments` :53-54）。 */
const sentAttachments = style({ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 });
const sentPreview = style({ display: 'block', width: 80, height: 64, objectFit: 'cover' });
const sentPlaceholder = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 80,
  height: 64,
  backgroundColor: 'gray-75',
  color: 'gray-600',
});
/** 用户消息的气泡是 S2 AI 的 UserMessage（原型 9bd7f6f）；正文保留换行，可以选中复制。 */
const userText = style({ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', userSelect: 'text' });
const contextLine = style({ display: 'flex', alignItems: 'center', gap: 4, font: 'ui-xs', color: 'gray-600', maxWidth: '[75%]' });
const agentRow = style({ display: 'flex', alignItems: 'start' });
const agentBody = style({ display: 'flex', flexDirection: 'column', gap: 4, flexGrow: 1, minWidth: 0 });
const actions = style({ display: 'flex', gap: 4, minHeight: 24 });
const notice = style({
  display: 'flex',
  alignItems: 'start',
  gap: 8,
  font: 'ui-sm',
  color: {
    default: 'gray-700',
    level: { error: 'negative', warning: 'gray-800' },
  },
  paddingX: 4,
});
const noticeIcon = style({ flexShrink: 0, marginTop: 2 });

/**
 * 已发送图片的只读句柄，按「会话:附件」记住（`media.resolve` 的附件定位），离过期不到一分钟就重新要。
 * 线程重画、来回切会话时不用每次都去要。
 */
const attachmentHandles = new Map<string, MediaHandle>();

function useAttachmentUrl(conversationId: Id, attachmentId: Id): { url: string | null; failed: boolean } {
  const runtime = useRuntime();
  const key = `${conversationId}:${attachmentId}`;
  const cached = attachmentHandles.get(key);
  const fresh = cached && Date.parse(cached.expiresAt) - Date.now() > 60_000 ? cached.url : null;
  const [state, setState] = useState<{ key: string; url: string | null; failed: boolean }>({ key, url: fresh, failed: false });
  const current = state.key === key ? state : { key, url: fresh, failed: false };

  useEffect(() => {
    if (current.url || current.failed) return;
    let cancelled = false;
    runtime
      .resolveMedia({ conversationId, attachmentId })
      .then((handle) => {
        attachmentHandles.set(key, handle);
        if (!cancelled) setState({ key, url: handle.url, failed: false });
      })
      .catch(() => {
        if (!cancelled) setState({ key, url: null, failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [runtime, conversationId, attachmentId, key, current.url, current.failed]);

  return { url: current.url, failed: current.failed };
}

/** 已发送的一张图（原型 `UserMsg` :45-50）：S2 Card S，上面是图，下面是文件名。图取不到时画图片图标。 */
function SentAttachment({ conversationId, attachment, attachments }: { conversationId: Id; attachment: AttachmentRef; attachments: AttachmentRef[] }) {
  const [preview,setPreview]=useState(false);
  const isImage=(a:AttachmentRef)=>a.kind==='image'||/\.(png|jpe?g|gif|webp|svg|avif)$/i.test(a.fileName);
  const candidate=(a:AttachmentRef)=>({target:{conversationId,attachmentId:a.id},name:a.fileName});
  const { url } = useAttachmentUrl(conversationId, attachment.id);
  return (
    <><ActionButton UNSAFE_className="cc-sent-attachment" aria-label={`${IMAGE_COPY.openAttachment}: ${attachment.fileName}`} onPress={()=>{if(isImage(attachment))setPreview(true);else useShell.getState().openPane({kind:'file',target:{conversationId,attachmentId:attachment.id},name:attachment.fileName});}}>
      {url && isImage(attachment) ? (
        <img className={sentPreview} src={url} alt={attachment.fileName} decoding="async" />
      ) : (
        <span className={sentPlaceholder} aria-hidden>
          <ImageIcon />
        </span>
      )}
      <Content>
        <Text slot="title">{attachment.fileName}</Text>
      </Content>
    </ActionButton>{preview&&<ImageLightbox files={attachments.filter(isImage).map(candidate)} initial={candidate(attachment)} conversationId={conversationId} onClose={()=>setPreview(false)}/>}</>
  );
}

export const UserMessage = memo(function UserMessage({ item, conversationId }: { item: Item<'user-message'>; conversationId: Id }) {
  const context = item.context;
  const attachments = item.attachments ?? [];
  return (
    <div className={userRow} data-role="user">
      {/* agentcut's user turn: a right-aligned white/8 bubble with a tucked bottom corner (agent-thread.css). */}
      <UserBubble data-cc-bubble="">
        {attachments.length ? (
          <div className={sentAttachments} role="group" aria-label={sentAttachmentsLabel()}>
            {attachments.map((attachment) => (
              <SentAttachment key={attachment.id} conversationId={conversationId} attachment={attachment} attachments={attachments} />
            ))}
          </div>
        ) : null}
        <div className={userText}>{item.text}</div>
      </UserBubble>
      {context ? (
        <div className={contextLine} title={T.message.contextTitle}>
          <MovieCamera />
          <span>
            {T.message.context(context.videoName, context.revision, formatClock(context.playheadSeconds, { tenths: true }), context.selection.length)}
          </span>
        </div>
      ) : null}
      {item.references?.length ? (
        <div className={contextLine} title={item.references.map((ref) => T.withDetail(ref.name, referenceDescription(ref))).join('\n')}>
          <Asset />
          <span>{referencesText(item.references)}</span>
        </div>
      ) : null}
      {item.template ? (
        // 发送时挂着的场景模板（模板包规范 §5.2）：只是标记，模板正文与简报引导交给了智能体，不在正文里。
        <div className={contextLine}>
          <ViewGrid />
          <span>{HOME_COPY.templateToken(item.template.title)}</span>
        </div>
      ) : null}
      {messageSkills(item).map((skill) => (
        // 发送时点选的 skill（产品设计 §6.9），按挂上的顺序各一行：只是标记，SKILL.md 正文交给了智能体，不在正文里。
        <div key={skill.id} className={contextLine} title={skill.id}>
          <Code />
          <span>{SKILL_COPY.token(skill.name)}</span>
        </div>
      ))}
      {item.slideAnnotations?.length ? (
        // 随这条消息交出去的幻灯片标注（docs/design/slides §8.2）：点开看各条，点一条打开那份幻灯片跳到那一页。
        <div className={contextLine}>
          <AnnotationsToken
            kind="slides"
            items={item.slideAnnotations.map((a, i) => ({ id: sentAnnotationId(item.id, i), target: a.deck, anchor: a.anchor, label: a.label, text: a.text }))}
          />
        </div>
      ) : null}
      {item.designAnnotations?.length ? (
        // 随这条消息交出去的设计稿标注（docs/design/canvas §8.2）：点一条打开那份设计稿，定位到那个元素或区域。
        <div className={contextLine}>
          <AnnotationsToken
            kind="design"
            items={item.designAnnotations.map((a, i) => ({ id: sentAnnotationId(item.id, i), target: a.canvas, anchor: a.anchor, label: a.label, text: a.text }))}
          />
        </div>
      ) : null}
      {item.designSystemAnnotations?.length ? (
        // 随这条消息交出去的设计系统标注（docs/design/canvas §10.6）：点一条打开那套设计系统，展开那一节定位到那个目标。
        <div className={contextLine}>
          <AnnotationsToken
            kind="design-system"
            items={item.designSystemAnnotations.map((a, i) => ({
              id: sentAnnotationId(item.id, i),
              target: a.system,
              anchor: a.anchor,
              section: a.section,
              label: a.label,
              text: a.text,
            }))}
          />
        </div>
      ) : null}
      <div className={actions}>
        <CopyButton text={item.text} />
      </div>
    </div>
  );
});

/**
 * The agent's reply: Markdown in agentcut's reply bubble (hairline, card at 60%, tucked start-bottom corner; agent-thread.css
 * `[data-cc-reply]`). No caret or "replying" marker while streaming; the turn footer says whether the turn is running and
 * holds Copy for the whole turn.
 */
export const AgentMessage = memo(function AgentMessage({
  item,
  conversationId,
  cwd,
}: {
  item: Item<'agent-message'>;
  conversationId: string;
  cwd?: string | null;
}) {
  return (
    <div className={agentRow} data-role="agent">
      <div className={agentBody} data-cc-reply={item.text ? '' : undefined}>
        {item.text ? <AgentMarkdown text={item.text} streaming={item.streaming} conversationId={conversationId} cwd={cwd} /> : null}
      </div>
    </div>
  );
});

export const NoticeLine = memo(function NoticeLine({ item }: { item: Item<'notice'> }) {
  const Icon = item.level === 'info' ? InfoCircle : AlertTriangle;
  return (
    <div className={notice({ level: item.level })} role={item.level === 'error' ? 'alert' : undefined}>
      <span className={noticeIcon}>
        <Icon />
      </span>
      <span>{localizeText(item.text, item.textRef)}</span>
    </div>
  );
});
