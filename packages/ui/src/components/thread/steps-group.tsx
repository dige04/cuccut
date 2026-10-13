import { memo, useRef, useState, type ReactNode } from 'react';
import type { Id, TimelineItem } from '@cuccut/protocol';
import { PixelLoader } from '@react-spectrum/ai/loader';
import AlertTriangle from '@react-spectrum/s2/icons/AlertTriangle';
import Asset from '@react-spectrum/s2/icons/Asset';
import AudioWave from '@react-spectrum/s2/icons/AudioWave';
import Bookmark from '@react-spectrum/s2/icons/Bookmark';
import Checkmark from '@react-spectrum/s2/icons/Checkmark';
import Collection from '@react-spectrum/s2/icons/Collection';
import ColorHarmony from '@react-spectrum/s2/icons/ColorHarmony';
import Cut from '@react-spectrum/s2/icons/Cut';
import Data from '@react-spectrum/s2/icons/Data';
import Delete from '@react-spectrum/s2/icons/Delete';
import Download from '@react-spectrum/s2/icons/Download';
import Export from '@react-spectrum/s2/icons/Export';
import FileText from '@react-spectrum/s2/icons/FileText';
import Image from '@react-spectrum/s2/icons/Image';
import Key from '@react-spectrum/s2/icons/Key';
import Layers from '@react-spectrum/s2/icons/Layers';
import Layout from '@react-spectrum/s2/icons/Layout';
import ListBulleted from '@react-spectrum/s2/icons/ListBulleted';
import SaveFloppy from '@react-spectrum/s2/icons/SaveFloppy';
import Shapes from '@react-spectrum/s2/icons/Shapes';
import Text from '@react-spectrum/s2/icons/Text';
import Transcript from '@react-spectrum/s2/icons/Transcript';
import Translate from '@react-spectrum/s2/icons/Translate';
import Undo from '@react-spectrum/s2/icons/Undo';
import Video from '@react-spectrum/s2/icons/Video';
import ChevronDown from '@react-spectrum/s2/icons/ChevronDown';
import ChevronRight from '@react-spectrum/s2/icons/ChevronRight';
import Clock from '@react-spectrum/s2/icons/Clock';
import Edit from '@react-spectrum/s2/icons/Edit';
import Folder from '@react-spectrum/s2/icons/Folder';
import Lightbulb from '@react-spectrum/s2/icons/Lightbulb';
import More from '@react-spectrum/s2/icons/More';
import Search from '@react-spectrum/s2/icons/Search';
import Tools from '@react-spectrum/s2/icons/Tools';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { T } from './thread-copy.ts';
import type { CucCutStepKind } from '../../model/agent-tool-steps.ts';
import { diffLines, elapsedLabel, looksLikeDiff, nextToolStatus, stepError, stepMeta } from '../../model/agent-turn.ts';
import { changedFiles, stepsSummary, toolStep, type StepKind, type StepsBlock } from '../../model/thread.ts';
import { useShell } from '../../state/shell-store.ts';
import { useNow } from '../use-now.ts';
import { loaderSequence } from './agent-loader-icons.ts';
import { ChangeCard } from './change-card.tsx';
import { CopyButton } from './copy-button.tsx';
import './agent-thread.css';

type Step = StepsBlock['items'][number];
type ToolCall = Extract<TimelineItem, { kind: 'tool-call' }>;
type Reasoning = Extract<TimelineItem, { kind: 'reasoning' }>;

const group = style({ display: 'flex', flexDirection: 'column', alignItems: 'start', gap: 8 });
const files = style({ display: 'flex', flexWrap: 'wrap', gap: 4, paddingX: 8 });
const fileLink = style({
  padding: 0,
  borderStyle: 'none',
  backgroundColor: 'transparent',
  font: 'ui-xs',
  color: { default: 'accent', isHovered: 'accent-900' },
  textDecoration: { default: 'none', isHovered: 'underline' },
  cursor: 'pointer',
});

const KIND_ICON: Record<StepKind, ReactNode> = {
  command: <Tools />,
  read: <Folder />,
  edit: <Edit />,
  search: <Search />,
  other: <More />,
};

/** CucCut 自己的工具按类别取图标（agent-tool-steps.ts）。 */
const TOOL_ICON: Record<CucCutStepKind, ReactNode> = {
  'video-list': <ListBulleted />,
  'video-create': <Video />,
  'video-read': <Video />,
  'video-delete': <Delete />,
  'document-read': <FileText />,
  translate: <Translate />,
  cut: <Cut />,
  import: <Asset />,
  'edit-video': <Edit />,
  undo: <Undo />,
  captions: <Text />,
  transcribe: <Transcript />,
  speech: <AudioWave />,
  image: <Image />,
  models: <Data />,
  'model-install': <Download />,
  export: <Export />,
  download: <Download />,
  'downloads-save': <SaveFloppy />,
  job: <Layers />,
  artifact: <SaveFloppy />,
  space: <Collection />,
  'space-search': <Search />,
  skill: <Bookmark />,
  grant: <Key />,
  contract: <Checkmark />,
  slides: <Layout />,
  design: <Shapes />,
  'design-system': <ColorHarmony />,
};

/**
 * 一组执行过程（产品设计 §3.2.2）：两段文字之间只有一行灰字摘要 + 箭头（「读取了 2 个文件、运行了命令」），不放图标；
 * 有失败也是灰字，只多写「N 项失败」。点开是一个带边框的框：一步一行、一张修改回执一行（§6.5 变更卡，撤销与恢复在行里），
 * 行间分隔线；框里每一行还能再点开看输入、输出与错误。
 * 会话在跑、这一组里有一步在跑时，摘要行换成那一步：类别的像素加载图形 + 扫光的类别名 + 已用时间，默认也折叠；
 * 几步一起跑时写「等 N 项」。点开后框里那一行用静止图标：一个会话里在动的只有摘要行与回合页脚。
 */
export const StepsGroup = memo(function StepsGroup({
  items,
  undone,
  live,
  conversationId,
  cwd,
}: {
  items: StepsBlock['items'];
  undone: StepsBlock['undone'];
  live: boolean;
  conversationId: string;
  cwd?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const failed = items.filter((i) => i.kind === 'tool-call' && i.status === 'failed').length;
  const running = live
    ? items.filter((i): i is ToolCall | Reasoning => (i.kind === 'tool-call' && i.status === 'running') || (i.kind === 'reasoning' && i.streaming))
    : [];
  const current = running.at(-1);
  const last = current ? null : lastStepText(items, cwd);
  return (
    <section className={`${group} cc-steps-group`}>
      {/* agentcut's collapsed turn: one capsule row — chevron, what happened, and the last step in monospace. */}
      <button type="button" className={`cc-work__head${current ? ' is-live' : ''}`} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="cc-work__chev" aria-hidden>
          <ChevronRight />
        </span>
        {current ? (
          <LiveHead item={current} count={running.length} cwd={cwd} />
        ) : (
          <>
            <span className="cc-work__sum">{[stepsSummary(items, cwd), failed ? T.steps.failed(failed) : null].filter(Boolean).join(' · ')}</span>
            {last && !open ? <span className="cc-work__last">{last}</span> : null}
          </>
        )}
      </button>
      {open ? (
        <ol className="cc-steps cc-steps--box">
          {items.map((item) => (
            <StepRow key={item.id} item={item} still={!!current} undone={undone} conversationId={conversationId} cwd={cwd} />
          ))}
        </ol>
      ) : null}
    </section>
  );
});

/** The last tool step of a finished group, as a terminal would show it (label and its argument). */
function lastStepText(items: StepsBlock['items'], cwd?: string | null): string | null {
  const last = items.findLast((item): item is ToolCall => item.kind === 'tool-call');
  if (!last) return null;
  const step = toolStep(last, cwd);
  return [step.label, step.summary].filter(Boolean).join(' ');
}

/** 在跑的摘要行：那一步的类别名与已用时间（自己每秒跳，组不跟着重渲）。几步一起跑时不写时间，写「等 N 项」。 */
function LiveHead({ item, count, cwd }: { item: ToolCall | Reasoning; count: number; cwd?: string | null }) {
  const now = useNow(1000);
  const label = item.kind === 'tool-call' ? toolStep(item, cwd).label : T.steps.thinking;
  const started = Date.parse(item.createdAt);
  return (
    <>
      <span className="cc-work__loader">
        <PixelLoader icon={loaderSequence(item.kind === 'tool-call' ? stepLoaderKey(item, cwd) : 'reasoning')} size={14} />
      </span>
      <span className="cc-work__sum cc-shimmer">{label}</span>
      {count > 1 ? (
        <span className="cc-work__meta">{T.steps.more(count)}</span>
      ) : Number.isFinite(started) ? (
        <span className="cc-work__meta">{elapsedLabel(now - started)}</span>
      ) : null}
    </>
  );
}

/** 步骤的加载图形键：CucCut 自己的工具按它的类别（与图标同一个优先级），其余按通用类别。 */
function stepLoaderKey(item: ToolCall, cwd?: string | null): string {
  const step = toolStep(item, cwd);
  return step.tool ?? step.kind;
}

/** 14px 的像素图放进与类别图标同尺寸的画布，换图标时这一行不动。 */
function RowLoader({ kind }: { kind: string }) {
  return (
    <span className="cc-step__ic cc-step__loader">
      <PixelLoader icon={loaderSequence(kind)} size={14} />
    </span>
  );
}

/** `still`：加载图形已在摘要行上，这一行在跑时用静止图标、只留扫光。 */
const StepRow = memo(function StepRow({
  item,
  still,
  undone,
  conversationId,
  cwd,
}: {
  item: Step;
  still: boolean;
  undone: ReadonlySet<Id>;
  conversationId: string;
  cwd?: string | null;
}) {
  if (item.kind === 'reasoning') return <ReasoningRow item={item} still={still} />;
  if (item.kind === 'video-change') return <ChangeCard item={item} undone={undone.has(item.transactionId)} conversationId={conversationId} />;
  return <ToolRow item={item} still={still} conversationId={conversationId} cwd={cwd} />;
});

/** 思考只露第一行（去掉 Markdown 加粗），全文在展开里。 */
function firstLine(text: string): string {
  const line = text.trim().split('\n')[0] ?? '';
  return line.replace(/\*\*/g, '').trim();
}

function ReasoningRow({ item, still }: { item: Reasoning; still: boolean }) {
  const [open, setOpen] = useState(false);
  const head = firstLine(item.text);
  const more = item.text.trim() !== head;
  return (
    <li className="cc-step">
      <button type="button" className="cc-step__row" aria-expanded={more ? open : undefined} onClick={() => more && setOpen((v) => !v)}>
        {item.streaming && !still ? (
          <RowLoader kind="reasoning" />
        ) : (
          <span className="cc-step__ic">
            <Lightbulb />
          </span>
        )}
        <span className={`cc-step__label${item.streaming ? ' cc-shimmer' : ''}`}>{T.steps.thinking}</span>
        <span className="cc-step__sum">{head}</span>
        {more ? <span className="cc-step__chev">{open ? <ChevronDown /> : <ChevronRight />}</span> : null}
      </button>
      {open ? (
        <div className="cc-step__detail">
          <p className="cc-step__reasoning">{item.text.trim()}</p>
        </div>
      ) : null}
    </li>
  );
}

/** 状态一旦失败，不再被这一行之后收到的更新改回。 */
function useLatchedStatus(status: ToolCall['status']): ToolCall['status'] {
  const latched = useRef<ToolCall['status'] | null>(null);
  latched.current = nextToolStatus(latched.current, status);
  return latched.current;
}

function ToolRow({ item, still, conversationId, cwd }: { item: ToolCall; still: boolean; conversationId: string; cwd?: string | null }) {
  const [open, setOpen] = useState(false);
  const openPane = useShell((s) => s.openPane);
  const status = useLatchedStatus(item.status);
  const step = toolStep(item, cwd);
  const failed = status === 'failed';
  const running = status === 'running';
  const changed = status === 'completed' ? changedFiles(item) : [];
  const icon = failed ? <AlertTriangle /> : status === 'interrupted' ? <Clock /> : step.tool ? TOOL_ICON[step.tool] : KIND_ICON[step.kind];
  const loaderKey = step.tool ?? step.kind;
  return (
    <li className={`cc-step${failed ? ' is-failed' : ''}`}>
      <button type="button" className="cc-step__row" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {running && !still ? <RowLoader kind={loaderKey} /> : <span className="cc-step__ic">{icon}</span>}
        <span className={`cc-step__label${running ? ' cc-shimmer' : ''}`}>{step.label}</span>
        <span className="cc-step__sum">{step.summary}</span>
        {stepMeta(item, status).map((meta) => (
          <span key={meta.text} className={`cc-step__meta${meta.code ? ' cc-step__meta--code' : ''}`}>
            {meta.text}
          </span>
        ))}
        <span className="cc-step__chev">{open ? <ChevronDown /> : <ChevronRight />}</span>
      </button>
      {open ? (
        <div className="cc-step__detail">
          {changed.length ? (
            <div className={files}>
              {changed.map((file) => (
                <button
                  key={file.path}
                  type="button"
                  className={fileLink({})}
                  onClick={() => openPane({ kind: 'file', target: { conversationId, path: file.path } })}>
                  {T.steps.viewFile(file.path.slice(file.path.lastIndexOf('/') + 1))}
                </button>
              ))}
            </div>
          ) : null}
          {item.detail ? <Section title={T.steps.input} text={item.detail} /> : null}
          {failed || status === 'declined' ? (
            <section className="cc-step__sec cc-step__sec--err">
              <header>{T.steps.error}</header>
              <pre tabIndex={0}>{stepError(item, status)}</pre>
            </section>
          ) : null}
          {item.output ? (
            <Section title={T.steps.output} text={item.output} diff={looksLikeDiff(item.output)} />
          ) : running ? (
            <div className="cc-step__skel" role="status" aria-label={T.steps.waiting}>
              <span />
              <span />
              <span />
            </div>
          ) : status === 'completed' ? (
            <p className="cc-step__none">{T.steps.noOutput}</p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function Section({ title, text, diff = false }: { title: string; text: string; diff?: boolean }) {
  return (
    <section className="cc-step__sec">
      <header>
        <span>{title}</span>
        <CopyButton text={text} />
      </header>
      {diff ? (
        <pre tabIndex={0}>
          {diffLines(text).map((line, i) => (
            <span key={i} className={`cc-step__dl cc-step__dl--${line.type}`}>
              {line.text || ' '}
              {'\n'}
            </span>
          ))}
        </pre>
      ) : (
        <pre tabIndex={0}>{text}</pre>
      )}
    </section>
  );
}
