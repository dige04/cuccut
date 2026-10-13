import { createContext, memo, useContext, useEffect, useMemo, useId, useRef, useState, type ReactNode } from 'react';
import Markdown, { defaultUrlTransform, type Components } from 'react-markdown';
import { ActionButton, Tooltip, TooltipTrigger } from '@react-spectrum/s2';
import { Link } from '@react-spectrum/s2/Link';
import Settings from '@react-spectrum/s2/icons/Settings';
import { advanceCut, closeStreamingTail, revealStep, splitBlocks } from '../../model/agent-stream.ts';
import { gapBetween, parsePathToken, pathTip, type PathToken } from '../../model/agent-turn.ts';
import { useShell } from '../../state/shell-store.ts';
import { markdownFilePath } from '../../model/markdown-file-link.ts';
import { settingsLink } from '../../model/settings-link.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { CopyButton } from './copy-button.tsx';
import { T } from './thread-copy.ts';
import { remarkPlugins } from './remark-plugins.ts';
import './agent-thread.css';
import { openMarkdownPath, ThreadMediaPreview } from './thread-media-preview.tsx';

/**
 * Agent reply body (product design §3.2.2): revealed character by character at an even pace, rendered as Markdown blocks.
 *
 * - The full text stays in the store; `useRevealedText` only reveals a slice. Each frame advances in proportion to the backlog (`revealStep`), and the cut point falls on a grapheme cluster boundary. Once streaming ends, the full text shows at once; a message that was already fully written when mounted is shown in full.
 * - The reply is split into blocks (`splitBlocks`), each block being a memo component. While streaming, only the text of the last block changes, so earlier blocks are not re-parsed. The last block first goes through `closeStreamingTail`, which closes any markers still open, before it is rendered.
 */

/** 60Hz cap: on high-refresh displays, advance every other frame. */
const FRAME_MS = 1000 / 60 - 0.5;

export function useRevealedText(text: string, streaming: boolean): string {
  const [shown, setShown] = useState(text.length);
  const shownRef = useRef(text.length);
  const textRef = useRef(text);
  textRef.current = text;

  useEffect(() => {
    if (!streaming) {
      shownRef.current = textRef.current.length;
      setShown(shownRef.current);
      return;
    }
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      if (now - last >= FRAME_MS) {
        const full = textRef.current;
        const from = Math.min(shownRef.current, full.length);
        const backlog = full.length - from;
        if (backlog > 0) {
          const next = advanceCut(full, from, revealStep({ backlog, elapsedMs: now - last }));
          shownRef.current = next;
          setShown(next);
        }
        last = now;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [streaming]);

  return streaming ? text.slice(0, Math.min(shown, text.length)) : text;
}

/** Paths in the body are opened relative to the working directory of which session. */
const PathScope = createContext<{ conversationId: string; cwd: string | null; mediaGroup: string }>({ conversationId: '', cwd: null, mediaGroup: '' });

/** Text inside a hast node. */
function textOf(node: unknown): string {
  const n = node as { type?: string; value?: string; children?: unknown[] } | undefined;
  if (!n) return '';
  if (n.type === 'text') return n.value ?? '';
  return (n.children ?? []).map(textOf).join('');
}

/** Code block: a copy button appears on hover; trailing newlines are removed when copying. Long lines wrap instead of scrolling horizontally. */
function CodeBlock({ code }: { code: string }) {
  const body = code.replace(/\n+$/, '');
  return (
    <div className="cc-amd-pre">
      <pre tabIndex={0}>
        <code>{body}</code>
      </pre>
      <span className="cc-amd-pre__copy">
        <CopyButton text={body} label={T.copyCode} />
      </span>
    </div>
  );
}

/** File paths in the body: clicking opens the file viewer in the feature area; the tooltip shows the relative path and line range. */
function PathLink({ raw, token }: { raw: string; token: PathToken }) {
  const scope = useContext(PathScope);
  const { cwd } = scope;
  const runtime = useRuntime();
  const path = token.path.startsWith('./') ? token.path.slice(2) : token.path;
  return (
    <TooltipTrigger delay={400}>
      <ActionButton
        isQuiet
        size="XS"
        UNSAFE_className="cc-amd-path"
        onPress={() => openMarkdownPath(path, scope, runtime)}>
        {raw}
      </ActionButton>
      <Tooltip>{pathTip(token, cwd)}</Tooltip>
    </TooltipTrigger>
  );
}

/** Explicit artifact links go into the right-hand viewer, just like inline paths, so the browser must not navigate to a local path. */
function MarkdownLink({ href, children, title }: { href?: string; children?: ReactNode; title?: string }) {
  const scope = useContext(PathScope);
  const runtime = useRuntime();
  // Settings paths take priority over external web pages and files; for the browser and unknown settings paths, only the text is shown (§3.2.2).
  if (href && /^\/settings(?:\/|$)/.test(href)) {
    const hit = runtime.host.platform !== 'web' ? settingsLink(href) : null;
    if (!hit) return <span>{children}</span>;
    return <TooltipTrigger delay={400}>
      <Link href={href} UNSAFE_className="cc-amd-settings">
        <Settings />{children}
      </Link>
      <Tooltip>{hit.trail}</Tooltip>
    </TooltipTrigger>;
  }
  const path = href ? markdownFilePath(href) : null;
  if (!href) return <span>{children}</span>;
  if (!path) return <a href={href} title={title} target="_blank" rel="noreferrer noopener" onClick={event => {
    if (!runtime.host.web || !/^https?:\/\//i.test(href)) return;
    event.preventDefault();
    useShell.getState().openPane({ kind: 'web', id: crypto.randomUUID(), url: href });
  }}>{children}</a>;
  const open = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (event.type === 'auxclick' && event.button !== 1) return;
    openMarkdownPath(path, scope, runtime);
  };
  return <a href={href} title={title ?? path} onClick={open} onAuxClick={open}>{children}</a>;
}

const MediaBlock = createContext(0);
function MarkdownMedia({ src, alt, offset = 0 }: { src?: string; alt?: string; offset?: number }) {
  const block = useContext(MediaBlock);
  const scope = useContext(PathScope);
  return src && scope ? <ThreadMediaPreview src={src} alt={alt ?? ''} scope={scope} block={block} offset={offset} /> : null;
}

const components: Components = {
  img: ({ src, alt, node }) => <MarkdownMedia src={src} alt={alt} offset={node?.position?.start.offset} />,
  a: ({ href, children, title }) => <MarkdownLink href={href} title={title}>{children}</MarkdownLink>,
  pre: ({ node }) => <CodeBlock code={textOf(node)} />,
  code: ({ children }) => {
    const raw = String(children ?? '');
    const token = parsePathToken(raw);
    return token ? <PathLink raw={raw} token={token} /> : <code className="cc-amd-code">{children}</code>;
  },
  table: ({ children }) => (
    <div className="cc-amd-table">
      <table>{children}</table>
    </div>
  ),
};

/** One Markdown block: not re-rendered while its text is unchanged. */
const MarkdownBlock = memo(function MarkdownBlock({ src, gap }: { src: string; gap: number }) {
  return (
    <div className="cc-amd-block" style={gap ? { marginTop: gap } : undefined}>
      <Markdown remarkPlugins={remarkPlugins} components={components}
        urlTransform={(url, key) => (key === 'href' || key === 'src') && markdownFilePath(url) ? url : defaultUrlTransform(url)}>
        {src}
      </Markdown>
    </div>
  );
});

export function AgentMarkdown({
  text,
  streaming,
  conversationId,
  cwd = null,
}: {
  text: string;
  streaming: boolean;
  conversationId: string;
  cwd?: string | null;
}): ReactNode {
  const shown = useRevealedText(text, streaming);
  const blocks = splitBlocks(shown);
  if (streaming && blocks.length) blocks[blocks.length - 1] = closeStreamingTail(blocks[blocks.length - 1]!);
  const mediaGroup = useId();
  const scope = useMemo(() => ({ conversationId, cwd, mediaGroup }), [conversationId, cwd, mediaGroup]);
  const gap = gapBetween('block', 'block');
  return (
    <PathScope.Provider value={scope}>
      <div className="cc-amd">
        {blocks.map((src, i) => (
          <MediaBlock.Provider key={i} value={i}><MarkdownBlock src={src} gap={i ? gap : 0} /></MediaBlock.Provider>
        ))}
      </div>
    </PathScope.Provider>
  );
}
