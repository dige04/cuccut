/*
 * @ mentions and / slash commands in the composer (prototype `mentionQuery` / `slashQuery` / `slashItems` / `applySlash` in model-agent.js).
 *
 * The quoting rules for @ mention paths are ported from paseo (Apache-2.0, Copyright (c) 2025-present Mohamed Boudra),
 * packages/app/src/utils/file-mention-autocomplete.ts (`findActiveFileMention`, `formatQuotedFileMentionPath`), modified:
 * the query uses the prototype's rules (an @ must be at the start or after whitespace, and the query cannot contain whitespace or quotes); when inserting, the @ prefix is kept, and quotes are added only when the path contains whitespace or quotes.
 */
import { defineMessages, type Id, type SpaceEntry } from '@cuccut/protocol';
import { SLASH_COMMANDS, type SlashCommand } from '../copy.ts';
import type { ChapterSpan } from './chapters.ts';
import { zhHans } from './composer-completions.zh-Hans.ts';
import { zhHant } from './composer-completions.zh-Hant.ts';
import { ja } from './composer-completions.ja.ts';
import { ko } from './composer-completions.ko.ts';
import { es } from './composer-completions.es.ts';
import { fr } from './composer-completions.fr.ts';
import { de } from './composer-completions.de.ts';
import { nl } from './composer-completions.nl.ts';
import { ptBR } from './composer-completions.pt-BR.ts';
import { it } from './composer-completions.it.ts';
import { ru } from './composer-completions.ru.ts';
import { pl } from './composer-completions.pl.ts';
import { tr } from './composer-completions.tr.ts';
import { vi } from './composer-completions.vi.ts';
import { KIND_LABEL } from './space.ts';
import { timeStamp } from './transcript-text.ts';

/**
 * Copy for @ candidates (the English is the source of keys and types; the translations live in `composer-completions.zh-Hans.ts`). The reference inserted into the body also follows the UI language:
 * it is part of the user's message.
 */
const en = {
  chapterN: (n: number) => `Chapter ${n}`,
  chapterRange: (range: string) => `Chapter · ${range}`,
  chapterInsert: (ordinal: string, name: string | null, range: string) => `@${ordinal}${name ? ` ${name}` : ''} (${range})`,
  speaker: 'Speaker',
  speakerInsert: (name: string) => `@Speaker “${name}”`,
};
export type ComposerCompletionsMessages = typeof en;
const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/** The completion being typed before the cursor: `raw` is the original text to be replaced (including the @ or /), and `query` is the part used for filtering. */
export interface ActiveCompletion {
  kind: 'slash' | 'mention';
  query: string;
  raw: string;
}

/**
 * The `completionTrigger` passed to PromptTokenField: an @ or / at the start or after whitespace. It searches backward from the cursor for the last match;
 * the text from that position to the cursor is `filterValue`. Whether it actually counts as a completion is decided by `activeCompletion`.
 */
export const COMPLETION_TRIGGER = /(?<=^|\s)[@/]/;

/**
 * Whether there is a completion being typed in the body text before the cursor.
 * Slash commands are recognised only as a **leading** /token at the start of the body, with no space typed after it yet: it is the verb of the whole sentence, and in the middle it would become a path.
 * @ can appear anywhere, but it must be at the start or after whitespace (`a@b.com` is not a mention).
 */
export function activeCompletion(beforeCaret: string): ActiveCompletion | null {
  const slash = /^\/([^\s/]*)$/.exec(beforeCaret);
  if (slash) return { kind: 'slash', query: slash[1]!, raw: beforeCaret };
  const mention = /(?:^|\s)(@([^\s@"']*))$/.exec(beforeCaret);
  if (mention) return { kind: 'mention', query: mention[2]!, raw: mention[1]! };
  return null;
}

export function slashMatches(query: string): SlashCommand[] {
  const q = query.toLowerCase();
  return SLASH_COMMANDS.filter((c) => !q || c.cmd.slice(1).toLowerCase().startsWith(q) || c.label.includes(query));
}

/** Choosing a slash command from the “+” menu: replaces the existing /token at the start of the body and keeps the rest after it, so the body gains only one `/xxx `. */
export function applySlash(text: string, cmd: string): string {
  return `${cmd} ${text.replace(/^\/[^\s/]*\s?/, '')}`;
}

/** “Reference” in the “+” menu: puts an @ at the end to open the candidates; if the character before it is not whitespace, a space is added first. */
export function appendMentionAnchor(text: string): string {
  return text && !/\s$/.test(text) ? `${text} @` : `${text}@`;
}

/** How a reference is inserted into the body: `@relative-path`; when the path contains whitespace or quotes, the whole thing is wrapped in quotes and the `"` inside is escaped. */
export function mentionText(path: string): string {
  return /[\s"']/.test(path) ? `@"${path.replace(/"/g, '\\"')}"` : `@${path}`;
}

export interface MentionCandidate {
  id: Id;
  label: string;
  description: string;
  insert: string;
}

/** Scope of candidates: the project the session belongs to; a session not in a project uses its own working directory. With neither (a new session with no project chosen yet), there are no candidates. */
export interface MentionScope {
  projectId: Id | null;
  conversationId: Id | null;
}

/**
 * @ candidates: the videos and files under this project (or the session's working directory) in the Space directory snapshot; items in the trash are excluded.
 * Only read-only references are brought in; the write target is still the directory bound to the session. Videos come first, the rest by most recent activity. For the chapters and speakers of the video currently open, see `videoMentionCandidates`.
 */
export function mentionCandidates(entries: readonly SpaceEntry[], scope: MentionScope, query: string, limit = 20): MentionCandidate[] {
  if (!scope.projectId && !scope.conversationId) return [];
  const q = query.toLowerCase();
  return entries
    .filter((e) => e.user.trashedAt === null)
    .filter((e) => (scope.projectId ? e.source.projectId === scope.projectId : e.source.conversationId === scope.conversationId))
    .filter((e) => !q || e.name.toLowerCase().includes(q) || e.relPath.toLowerCase().includes(q))
    .sort((a, b) => Number(b.kind === 'video') - Number(a.kind === 'video') || b.lastActivityAt.localeCompare(a.lastActivityAt))
    .slice(0, limit)
    .map((e) => ({ id: e.id, label: e.name, description: `${KIND_LABEL[e.kind]} · ${e.relPath}`, insert: mentionText(e.relPath) }));
}

/** Things in the currently open video that can be @-mentioned: chapters (sorted by start) and speakers (those who appear in the transcript, with names de-duplicated). */
export interface VideoMentions {
  chapters: readonly Pick<ChapterSpan, 'id' | 'index' | 'label' | 'title' | 'start' | 'end'>[];
  speakers: readonly { id: string; name: string }[];
}

/**
 * The “this video” group among the @ candidates (the chapters and speakers from `mentionItems` in the design draft model-agent.js): the editor context sent to the agent has no chapter or speaker fields,
 * so what gets inserted into the body is a text reference. A chapter carries its number, name and start/end time (`@第 2 章 开场（00:12–01:30）`), and the agent locates it by time;
 * a speaker is written as `@说话人「名字」` (`@` plus “speaker” plus the name). Queries match names, and also recognise 章节 (chapter), 说话人 (speaker) and 第 N 章 (chapter N).
 */
export function videoMentionCandidates(mentions: VideoMentions, query: string, limit = 20): MentionCandidate[] {
  const q = query.toLowerCase();
  const hit = (...keys: string[]) => !q || keys.some((key) => key.toLowerCase().includes(q));
  const out: MentionCandidate[] = [];
  for (const chapter of mentions.chapters) {
    const n = chapter.index + 1;
    const ordinal = M.chapterN(n);
    const name = chapter.label.trim();
    // i18n-ignore: search keywords; both Chinese and English terms are accepted, independent of the UI language
    if (!hit(chapter.title, ordinal, `第 ${n} 章`, `第${n}章`, `chapter ${n}`, '章节', 'chapter')) continue;
    const range = `${timeStamp(chapter.start)}–${timeStamp(chapter.end)}`;
    out.push({
      id: `chapter:${chapter.id}`,
      label: chapter.title,
      description: M.chapterRange(range),
      insert: M.chapterInsert(ordinal, name && name !== ordinal ? name : null, range),
    });
  }
  for (const speaker of mentions.speakers) {
    // i18n-ignore: search keywords; both Chinese and English terms are accepted, independent of the UI language
    if (!hit(speaker.name, '说话人', 'speaker')) continue;
    out.push({ id: `speaker:${speaker.id}`, label: speaker.name, description: M.speaker, insert: M.speakerInsert(speaker.name) });
  }
  return out.slice(0, limit);
}
