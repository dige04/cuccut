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
/** Sent images are placed above the body text (prototype spectrum.css `.cc-ai-sent-attachments` :53-54). */
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
/** The user message bubble is S2 AI's UserMessage (prototype 9bd7f6f); line breaks in the body are kept, and the text can be selected and copied. */
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
 * Read-only handles for sent images, remembered by “session:attachment” (the attachment locator for `media.resolve`); a new one is requested when less than a minute remains before expiry.
 * When the thread is redrawn or the user switches sessions back and forth, there is no need to request them every time.
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

/** One sent image (prototype `UserMsg` :45-50): S2 Card S, with the image on top and the file name below. When the image can't be obtained, an image icon is drawn. */
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
        // The scene template attached at send time (template pack spec §5.2): it is only a marker; the template body and the brief guidance are handed to the agent and are not in the message body.
        <div className={contextLine}>
          <ViewGrid />
          <span>{HOME_COPY.templateToken(item.template.title)}</span>
        </div>
      ) : null}
      {messageSkills(item).map((skill) => (
        // Skills selected at send time (product design §6.9), one row each in the order they were attached: only markers; the SKILL.md body is handed to the agent and is not in the message body.
        <div key={skill.id} className={contextLine} title={skill.id}>
          <Code />
          <span>{SKILL_COPY.token(skill.name)}</span>
        </div>
      ))}
      {item.slideAnnotations?.length ? (
        // Slide annotations handed over with this message (docs/design/slides §8.2): expand to see each one; clicking one opens that slide and jumps to its page.
        <div className={contextLine}>
          <AnnotationsToken
            kind="slides"
            items={item.slideAnnotations.map((a, i) => ({ id: sentAnnotationId(item.id, i), target: a.deck, anchor: a.anchor, label: a.label, text: a.text }))}
          />
        </div>
      ) : null}
      {item.designAnnotations?.length ? (
        // Design-draft annotations handed over with this message (docs/design/canvas §8.2): clicking one opens that design and positions it on that element or area.
        <div className={contextLine}>
          <AnnotationsToken
            kind="design"
            items={item.designAnnotations.map((a, i) => ({ id: sentAnnotationId(item.id, i), target: a.canvas, anchor: a.anchor, label: a.label, text: a.text }))}
          />
        </div>
      ) : null}
      {item.designSystemAnnotations?.length ? (
        // Design-system annotations handed over with this message (docs/design/canvas §10.6): clicking one opens that design system, expands that section and positions it on the target.
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
