/**
 * The tools page (a host page not on the editor toolbar; opened from the session `/`, the document panel's header menu, and the buttons beside each panel; prototype panel-aitools-flows.jsx `TOOLS` / `GROUPS` / `GROUP_SUB`, model-agent.js `INTENTS` / `intentPrompt`, panel-aitools-cut.jsx `cleanupExtra`, model-writing.js `intentExtra`): the tool catalog, who does each tool, and the intent sentence used when handing off to the Agent.
 *
 * Who does the work falls into three tiers, and the page says so plainly:
 * - `runtime`: the Runtime has this flow (identifying speakers, translating subtitles, translating dubbing), and the tools page is that flow's settings page. On the speaker-identification settings page, “Use” can still choose to hand it to the Agent (intent sentence per `INTENTS.speakers` above).
 * - `agent`: the Runtime has no separate flow, so it goes to the coding Agent: the intent sentence is sent straight into this video's session.
 * - `soon`: it has to track things on screen and pick a framing box (smart crop). The Runtime does not have this flow yet, so it is listed, but the page only explains why it cannot be used yet.
 * Cutting into short videos goes only to the Agent, and always opens a new session. Its parameters are folded into the prompt one sentence per line (`shortsLines`); in that session the Agent finds topics and cuts each into its own short video. The number of clips and the length of each default to “自动 (Auto)”, so the Agent decides from the topics it finds.
 *
 * The first row on the tools page, “Use”, can also choose “Call model directly”. Polishing, chapters, summary, blog, titles, and descriptions go through the Runtime's `ai-tool` flow (not through a conversation; see components/editor/ai-tool-direct.ts). Re-transcription, finding cut points, re-translating stale sentences, and making a cover are grayed out, and the reason is written.
 * (The transcription flow adds a transcript for the whole document on top, rather than replacing the word-level data by range, so “re-transcribe” still goes to the Agent; whole-document re-transcription is on the subtitles panel.)
 *
 * All the copy (tool names, descriptions, options, intent sentences, and extra requirements) is in the catalog. English is the source of keys and types, and translations are in `ai-tools.zh-Hans.ts`. Intent sentences are written in the interface language.
 */

import { defineMessages, intlLocale, live } from '@cuccut/protocol';
import { zhHans } from './ai-tools.zh-Hans.ts';
import { zhHant } from './ai-tools.zh-Hant.ts';
import { ja } from './ai-tools.ja.ts';
import { ko } from './ai-tools.ko.ts';
import { es } from './ai-tools.es.ts';
import { fr } from './ai-tools.fr.ts';
import { de } from './ai-tools.de.ts';
import { nl } from './ai-tools.nl.ts';
import { ptBR } from './ai-tools.pt-BR.ts';
import { it } from './ai-tools.it.ts';
import { ru } from './ai-tools.ru.ts';
import { pl } from './ai-tools.pl.ts';
import { tr } from './ai-tools.tr.ts';
import { vi } from './ai-tools.vi.ts';

export type AiToolId =
  | 'crop'
  | 'shortscut'
  | 'polish'
  | 'chapters'
  | 'speakers'
  | 'retranscribe'
  | 'cleanup'
  | 'translate'
  | 'stale'
  | 'dub'
  | 'summary'
  | 'blog'
  | 'title'
  | 'desc'
  | 'cover'
  | 'soundtrack';

/** Groups (data key; the display name is in `AI_TOOL_GROUP_LABEL`). */
export type AiToolGroup = 'frame' | 'transcript' | 'translate' | 'writing' | 'publish' | 'sound';
/** `tool`: not done on this tab; the video is taken to the tools page (generate music → Tools › 生成音乐 (Generate music)). */
export type AiToolTier = 'runtime' | 'agent' | 'soon' | 'tool';

/** The tools handed off to the Agent. */
export type AgentToolId =
  | 'polish'
  | 'chapters'
  | 'speakers'
  | 'retranscribe'
  | 'cleanup'
  | 'stale'
  | 'summary'
  | 'blog'
  | 'title'
  | 'desc'
  | 'cover'
  | 'shortscut';

export interface AiTool {
  id: AiToolId;
  group: AiToolGroup;
  name: string;
  /** The second line in the list. */
  desc: string;
  tier: AiToolTier;
  /** The few lines of the description card at the top of the tools page; `desc` is used when there are none. */
  setup?: readonly string[];
  /** For `soon` tools: why they cannot be used yet. */
  why?: string;
}

const CLEANUP_KEYS = ['fillers', 'pauses', 'repeats'] as const;
export type CleanupKey = (typeof CLEANUP_KEYS)[number];
const LENGTH_KEYS = ['short', 'medium', 'long'] as const;
export type WriteLength = (typeof LENGTH_KEYS)[number];
const STYLE_KEYS = ['plain', 'pop', 'sharp', 'light', 'pro', 'custom'] as const;
export type WriteStyle = (typeof STYLE_KEYS)[number];
const VIEW_KEYS = ['auto', 'author', 'viewer'] as const;
export type WriteView = (typeof VIEW_KEYS)[number];
const COVER_TEXT_KEYS = ['none', 'phrase', 'phrase-sub'] as const;
export type CoverText = (typeof COVER_TEXT_KEYS)[number];
const SHORTS_LENGTH_KEYS = ['auto', 'short', 'medium', 'long', 'extended', 'custom'] as const;
export type ShortsLength = (typeof SHORTS_LENGTH_KEYS)[number];
/** How many clips to cut: `auto` lets the Agent decide from the topics it finds, or 1–10 clips. */
export type ShortsCount = number | 'auto';
const SHORTS_RATIO_KEYS = ['9:16', '1:1', 'source'] as const;
export type ShortsRatio = (typeof SHORTS_RATIO_KEYS)[number];
const SHORTS_FOCUS_KEYS = ['auto', 'manual', 'speaker'] as const;
export type ShortsFocus = (typeof SHORTS_FOCUS_KEYS)[number];
const SHORTS_TRACK_KEYS = ['both', 'source', 'translation'] as const;
export type ShortsTracks = (typeof SHORTS_TRACK_KEYS)[number];
const SHORTS_STYLE_KEYS = ['shorts', 'video'] as const;
export type ShortsStyle = (typeof SHORTS_STYLE_KEYS)[number];

type IntentArgs = {
  p: string;
  scope: string | null;
  edited: number | boolean;
  cut: number | boolean;
  count: number | null;
};
type ToolText = {
  name: string;
  desc: string;
  setup?: readonly string[];
  why?: string;
};

const soonTail =
  'Runtime doesn’t have this workflow yet, and there’s no overlay on the video for adjusting the framing, so there’s no form to fill in here yet.';
/** The scope in the intent sentence: “第 2 章 · 开场 (Chapter 2 · Opening) of “A””; for the whole document, only the video is named. */
const scopeOf = (o: IntentArgs) => (o.scope ? `${o.scope} of ${o.p}` : o.p);

const en = {
  groups: {
    frame: 'Frame',
    transcript: 'Transcript',
    translate: 'Translation',
    writing: 'Writing',
    publish: 'Publishing',
    sound: 'Sound',
  } as Record<AiToolGroup, string>,
  tools: {
    crop: {
      name: 'Smart crop',
      desc: 'Change the aspect ratio while keeping speakers, whiteboards, and other key subjects in frame',
      why: `Smart crop has to follow speakers, whiteboards, and other key subjects through the video, then crop to the new aspect ratio. ${soonTail}`,
    },
    shortscut: {
      name: 'Cut into shorts',
      desc: 'Find the best topics in this video and cut each into a short',
      setup: ['Find the topics most worth posting on their own and cut each one into a complete short.'],
    },
    polish: {
      name: 'Polish transcript',
      desc: 'Fix typos, add punctuation, and split into paragraphs—without rewriting your words',
      setup: [
        'Fix obvious typos, add missing punctuation, and split into paragraphs by topic.',
        'Your wording isn’t rewritten and nothing is removed—only clear slips are fixed.',
      ],
    },
    chapters: {
      name: 'Generate chapters',
      desc: 'Split a long video into titled chapters',
      setup: ['Group paragraphs into chapters by topic and give each chapter a title.', 'Export and the share page use the same chapters.'],
    },
    speakers: {
      name: 'Identify speakers',
      desc: 'Tell who is speaking; subtitles and the transcript are labeled with names',
    },
    retranscribe: {
      name: 'Re-transcribe',
      desc: 'Rerun the audio with another model—just one chapter or segment if you like',
      setup: [
        'Rerun with another speech model and replace the word-level data in this range.',
        'The transcript, subtitles, and translations outside the range stay exactly as they are.',
      ],
    },
    cleanup: {
      name: 'Find cuts',
      desc: 'Find filler words, long pauses, and bad takes; review suggestions before cutting',
      setup: [
        'Scan for filler words, pauses of 0.8s or longer, and repeated sentence starts.',
        'You get a list of proposed cuts to confirm before anything is cut.',
      ],
    },
    translate: {
      name: 'Translate subtitles',
      desc: 'Translate sentence by sentence and align timecodes using word-level data',
    },
    stale: {
      name: 'Refresh outdated translations',
      desc: 'Retranslate only the sentences whose source was edited or cut',
      setup: [
        'Retranslate only sentences whose source changed: ones you edited, and ones where a cut removed part of the sentence.',
        'Translate from the source as cut; translations of fully cut sentences are cut along with them. Nothing else changes.',
      ],
    },
    dub: {
      name: 'Translate voice-over',
      desc: 'Pick a language and have the video speak it, sounding like the original speaker or a native speaker; the defaults are enough to start',
    },
    summary: {
      name: 'Write a summary',
      desc: 'Body text plus timestamped key points; click a time to jump there',
    },
    blog: {
      name: 'Write a blog post',
      desc: 'Rewrite it as an article, from the author’s or the viewer’s point of view',
    },
    title: {
      name: 'Suggest titles',
      desc: 'Get several candidates from different angles, then pick one',
    },
    desc: {
      name: 'Write a description',
      desc: 'A description for publishing, with chapter timecodes and tags',
    },
    cover: {
      name: 'Make a cover',
      desc: 'Make a few cover candidates from key frames, then pick one',
    },
    soundtrack: {
      name: 'Generate soundtrack',
      desc: 'Make background music as long as this video on this computer, and add it to the video’s music track',
    },
  } as Record<AiToolId, ToolText>,
  unknownTool: (id: string) => `No such AI tool: ${id}`,
  cleanup: {
    fillers: {
      label: 'Filler words',
      sub: 'Words like “um,” “uh,” “like,” and “you know”',
      off: 'filler words',
    },
    pauses: {
      label: 'Long pauses ≥ 0.8s',
      sub: 'Found using word-level timing',
      off: 'long pauses',
    },
    repeats: {
      label: 'Repeated starts',
      sub: 'A sentence started twice; the later one is kept',
      off: 'repeated starts',
    },
  } as Record<CleanupKey, { label: string; sub: string; off: string }>,
  /** The sentence formed from the categories that are not checked. */
  cleanupOff: (offs: readonly string[]) => `Don’t look for ${new Intl.ListFormat(intlLocale(), { type: 'conjunction' }).format(offs)}`,
  lengths: { short: 'Short', medium: 'Medium', long: 'Long' } as Record<WriteLength, string>,
  styles: {
    plain: 'Plain',
    pop: 'Explainer',
    sharp: 'Snarky',
    light: 'Casual',
    pro: 'Professional',
    custom: 'Custom…',
  } as Record<WriteStyle, string>,
  views: {
    auto: 'Auto',
    author: 'I’m the author',
    viewer: 'I’m a viewer',
  } as Record<WriteView, string>,
  /** The options for cutting into short videos (prototype model-shorts-cut.js) and the lines folded into the prompt. */
  shorts: {
    lengths: {
      auto: 'Auto',
      short: '15–30s',
      medium: '30–60s',
      long: '60–90s',
      extended: '1–3 min',
      custom: 'Custom',
    } as Record<ShortsLength, string>,
    ratioSource: 'Keep original',
    focus: {
      auto: { label: 'Auto', sub: 'Finds which side the speaker is on and puts the frame on them; centered if no one is found' },
      manual: { label: 'I’ll set it', sub: 'You place the frame for each short yourself afterwards' },
      speaker: { label: 'Follow the speaker', sub: 'The frame follows whoever is talking' },
    } as Record<ShortsFocus, { label: string; sub: string }>,
    speakerOff: 'This version doesn’t have a person and speaker model yet',
    tracks: { both: 'Original + translation', source: 'Original only', translation: 'Translation only' } as Record<ShortsTracks, string>,
    styles: {
      shorts: { label: 'Shorts captions', sub: 'Built-in preset that stays clear of platform buttons' },
      video: { label: 'Keep this video’s style', sub: 'Same size and position; platform buttons may cover them' },
    } as Record<ShortsStyle, { label: string; sub: string }>,
    /** Folded into the prompt: how the framing is described. Auto is the Agent's approach (sample frames to see which side the speaker is on, crop to them, and center if none is found). The “跟着说话的人 (follow the speaker)” version is not open yet, so it does not go into the sentence. */
    focusPrompt: {
      auto: 'auto: sample frames evenly across the segment, see which side of the frame the speaker is on, and place the crop on them; if no one is found, center it',
      manual: 'centered for now; I’ll adjust each one myself',
    } as Record<'auto' | 'manual', string>,
    /** An item in the “切几支 (how many clips)” dropdown (the Auto item uses `lengths.auto`). */
    countN: (n: number) => `${n}`,
    /** The explanation line under “切成什么样 (what the cut looks like)”: when one item is Auto, it says how that item is decided. */
    autoHint: {
      both: 'Auto: the Agent finds the strongest topics that stand on their own and decides how many shorts and how long each runs—no filler, no topic cut in half.',
      count: 'Auto: one short for every topic strong enough to stand on its own; no filler.',
      length: 'Auto: each short runs from its opening hook to where its topic lands, not stretched or trimmed to fit a length.',
    },
    /** The sentence about how many clips and how long. `count` null = Auto (the number of clips is decided by topics); `len` null = Auto (the length of each is decided by its topic). */
    lineCount: (count: number | null, len: { min: number; max: number } | null) =>
      `${count === null ? 'Decide how many shorts from the topics you find' : `Make ${count === 1 ? '1 short' : `${count} shorts`}`}, ${
        len ? `each ${len.min}–${len.max} seconds` : 'each as long as its topic needs, from the opening hook to where the point lands'
      }, starting and ending on sentence boundaries`,
    lineFrame: (ratio: string | null, focus: string) => (ratio ? `Aspect ratio ${ratio}, framing ${focus}` : 'Aspect ratio: keep the original, no cropping'),
    lineSubtitles: (tracks: string, style: string) => `Subtitles: ${tracks}, ${style}`,
    lineSkipDone: 'Skip the parts already cut into shorts',
    lineDirect: 'Create the videos as soon as they’re found; no need to ask me first',
  },
  coverText: {
    none: 'No text',
    phrase: 'A short phrase',
    'phrase-sub': 'A phrase plus a line of small text',
  } as Record<CoverText, string>,
  viewName: { author: 'author', viewer: 'viewer' } as Record<'author' | 'viewer', string>,
  extraScope: (scope: string) => `Focus only on ${scope}`,
  extraLength: (label: string) => `Length: ${label}`,
  extraStyle: (style: string) => `Style: ${style}`,
  extraLanguage: (language: string) => `Write in ${language}`,
  extraView: (view: string) => `Point of view: ${view}`,
  extraPlatform: (platform: string) => `Publishing to: ${platform}. Follow its rules, and remind me to check when you’re done`,
  extraFrames: 'Where a picture is needed, grab keyframes from the video and put them in the article, each with a caption',
  extraIdea: (idea: string) => `The one thing the cover should say: ${idea}`,
  extraRatio: (ratio: string) => `Aspect ratio ${ratio}`,
  extraCoverText: (label: string) => `Text on the cover: ${label}`,
  /** How the video name appears in the sentence; the wording used when there is no name. */
  titled: (title: string) => `“${title}”`,
  thisVideo: 'this video',
  /** The two kinds of sources for refreshing stale translations: when a count is given, it includes the number; otherwise only the category is named. */
  sourceEdited: (n: number | null) => (n === null ? 'source edited' : n === 1 ? '1 sentence edited in the source' : `${n} sentences edited in the source`),
  sourceCut: (n: number | null) => (n === null ? 'source cut' : n === 1 ? '1 sentence cut in the source' : `${n} sentences cut in the source`),
  sourceJoin: (parts: readonly string[]) => parts.join(', '),
  retranslateOne: (o: { p: string; language: string; time: string | null; text: string }) =>
    `Retranslate the sentence ${o.time ? `at ${o.time} ` : ''}in ${o.p} (“${o.text}”) into ${o.language}. Change only this sentence’s translation; leave the timing, subtitle style, and every other sentence exactly as they are.`,
  retranslateStale: (o: { p: string; language: string; count: number }) =>
    `${o.count === 1 ? '1 sentence' : `${o.count} sentences`} of the ${o.language} translation of ${o.p} ${o.count === 1 ? 'is' : 'are'} out of date or not yet translated. Retranslate only those sentences and leave everything else exactly as it is.`,
  intents: {
    stale: (o: IntentArgs & { why: string }) =>
      `Some translations in ${o.p} are out of date${o.why ? ` (${o.why})` : ' because the source was edited'}. Retranslate only those sentences${o.cut ? '; retranslate cut ones from the source as cut, and remove the translations of fully cut sentences along with them' : ''}. Leave everything else exactly as it is.`,
    polish: (o: IntentArgs) =>
      `Polish the transcript of ${scopeOf(o)}: fix typos, add punctuation, and split into paragraphs by topic, without rewriting my wording.`,
    chapters: (o: IntentArgs) => `Split ${o.p} into chapters by topic and give each chapter a short title.`,
    speakers: (o: IntentArgs) => `Identify the speakers in ${scopeOf(o)}. Show me the results to confirm before writing them into the video.`,
    retranscribe: (o: IntentArgs) => `Re-transcribe ${scopeOf(o)} with another speech model, and leave everything outside that range exactly as it is.`,
    cleanup: (o: IntentArgs) =>
      `Find filler words, long pauses, and repeated sentence starts in ${scopeOf(o)}. List them first; I’ll confirm before anything is cut.`,
    summary: (o: IntentArgs) => `Write a summary of key points with timecodes from the transcript of ${o.p}.`,
    blog: (o: IntentArgs) => `Rewrite ${o.p} as a blog post ready to publish.`,
    title: (o: IntentArgs & { count: number }) =>
      `Suggest ${o.count} title candidates for ${o.p}, each from a different angle, with a one-line reason for each, and recommend one.`,
    desc: (o: IntentArgs) => `Write a description of ${o.p} for publishing, with chapter timecodes and a line of tags.`,
    cover: (o: IntentArgs & { count: number }) =>
      `Make ${o.count} cover candidates for ${o.p}: pick key frames first, use a different base-image approach for each, and check them at a small size before showing me.`,
    shortscut: (o: IntentArgs) =>
      `Find the topics in ${scopeOf(o)} most worth posting on their own and cut each into a complete short: each one is a new video referencing the same source footage, and the original video and its timeline stay as they are.`,
  },
  /** A subtitle under a group's name on the list page (AI tools tab) that states who the group is for. */
  groupSub: {
    writing: 'For readers: what the video covers, without having to watch it',
    publish: 'For whoever posts the video: make people want to click, then deliver on it',
  } as Partial<Record<AiToolGroup, string>>,
  /** The footnote on the list page: where the tools not yet moved in this first batch are. */
  laterNote:
    'Translate subtitles is still in the Subtitles panel and Translate voice-over in the Audio panel; they’ll move here later. Smart crop is coming soon.',
  /** The line on the tools page description card that says whether pressing the button changes the video. */
  effect: {
    polish: 'Changes the transcript: applied when done, and one step undoes it',
    chapters: 'Changes the chapters: applied when done, and one step undoes it',
    speakers: 'You confirm the result first; it’s written into the video only when you apply it',
    retranscribe: 'Replaces the transcript in this range: applied when done, and one step undoes it',
    cleanup: 'Only proposes cuts; nothing is cut until you confirm',
    stale: 'Retranslates only the outdated sentences; nothing else changes',
    summary: 'Doesn’t change the video: the result is for you to read and copy',
    blog: 'Doesn’t change the video: the result is for you to read and copy',
    title: 'Doesn’t change the video: pick one to use',
    desc: 'Doesn’t change the video: the result is for you to read and copy',
    cover: 'Doesn’t change the video: pick one to use',
    shortscut: 'Creates new child videos; the original video and its timeline stay as they are',
  } as Record<AgentToolId, string>,
  /** The fixed constraints in the template (formerly the dropdowns for language, style, length, and viewpoint). `language` is the language name; when there is none, the language of the document is followed. */
  standMarkdown: (language: string | null) =>
    language ? `Write in Markdown, in ${language}.` : 'Write in Markdown, in the same language as the transcript.',
  standLanguage: (language: string | null) => (language ? `Write in ${language}.` : 'Write in the same language as the transcript.'),
  standing: {
    summary: ['Lead with the conclusion, then list the key points, each with a timecode (mm:ss).', 'Keep it moderate: three to five paragraphs.'],
    blog: [
      'Choose the point of view from the video’s source: write as the author if it’s my own video, and as a viewer if it’s someone else’s.',
      'Keep the style plain, with no marketing tone.',
    ],
    title: ['Put each candidate on its own line.'],
    desc: ['Include chapter timecodes and a line of tags.'],
    cover: ['Text on the cover uses the transcript’s language.'],
    polish: ['Don’t rewrite my wording or remove anything; only fix what is clearly a slip.'],
    chapters: ['Group by topic, with a short title for each chapter.'],
  } as Partial<Record<AgentToolId, readonly string[]>>,
  /** The session the handoff is sent to. */
  sessionNew: 'New session',
  sessionNewSub: 'Takes this video as context; one task per session, with no long history to resend',
  sessionCurrent: (title: string) => `Continue “${title}”`,
  sessionUntitled: 'this video’s session',
  sessionCurrentSub: (messages: number | null) =>
    messages === null
      ? 'Resends the session’s history, which costs more once the prompt cache expires'
      : `${messages === 1 ? '1 message' : `${messages} messages`} so far · resends the history, which costs more once the prompt cache expires`,
  /** The line under the main button: where pressing it will go. */
  hintNew: 'Starts a new session with this video as context. Follow along there; any change the Agent makes to the video can be undone.',
  hintCurrent: 'Sends to this video’s current session, with this video as context. Follow along there; any change the Agent makes to the video can be undone.',
  /** Adds a final punctuation mark to the extra requirements; how the intent sentence and the extra requirements are joined. */
  endSentence: (text: string) => (/[.!?]$/.test(text) ? text : `${text}.`),
  joinPrompt: (head: string, extra: readonly string[]) => [head, ...extra].join(' '),
};
export type AiToolsMessages = typeof en;
const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/** The display name of the group. */
export const AI_TOOL_GROUP_LABEL: Readonly<Record<AiToolGroup, string>> = live(() => M.groups);

const tool = (id: AiToolId, group: AiToolGroup, tier: AiToolTier): AiTool => ({
  id,
  group,
  tier,
  get name() {
    return M.tools[id].name;
  },
  get desc() {
    return M.tools[id].desc;
  },
  get setup() {
    return M.tools[id].setup;
  },
  get why() {
    return M.tools[id].why;
  },
});

export const AI_TOOLS: readonly AiTool[] = [
  tool('crop', 'frame', 'soon'),
  tool('shortscut', 'frame', 'agent'),
  tool('polish', 'transcript', 'agent'),
  tool('chapters', 'transcript', 'agent'),
  tool('speakers', 'transcript', 'runtime'),
  tool('retranscribe', 'transcript', 'agent'),
  tool('cleanup', 'transcript', 'agent'),
  tool('translate', 'translate', 'runtime'),
  tool('stale', 'translate', 'agent'),
  tool('dub', 'translate', 'runtime'),
  tool('summary', 'writing', 'agent'),
  tool('blog', 'writing', 'agent'),
  tool('title', 'publish', 'agent'),
  tool('desc', 'publish', 'agent'),
  tool('cover', 'publish', 'agent'),
  tool('soundtrack', 'sound', 'tool'),
];

const BY_ID = new Map(AI_TOOLS.map((t) => [t.id, t]));

export function aiTool(id: AiToolId): AiTool {
  const found = BY_ID.get(id);
  if (!found) throw new Error(M.unknownTool(id));
  return found;
}

export function isAiToolId(value: unknown): value is AiToolId {
  return typeof value === 'string' && BY_ID.has(value as AiToolId);
}

/** Writing and publishing: reads only the document and the picture, and the results are for people to read, pick from, and copy (prototype §15.11). */
export function isWritingTool(id: AiToolId): id is 'summary' | 'blog' | 'title' | 'desc' | 'cover' {
  return id === 'summary' || id === 'blog' || id === 'title' || id === 'desc' || id === 'cover';
}

/**
 * After a handoff, whether the tools page stays in place (product design §5.10 “hand to agent”, prototype model-ai-prompt.js `agentLeavesPage`). Finding cut points and refreshing stale translations stay on the page and show progress: the session is still created and the message still sent, but it does not switch to it. Other tools return to the list, and that session opens in front of you.
 */
export function agentStaysOnPage(id: AgentToolId): boolean {
  return id === 'cleanup' || id === 'stale';
}

/**
 * Whether the settings page shows a “范围 (Scope)” row: only for tools whose intent sentence includes the scope. Polishing, speakers, re-transcription, and finding cut points write `scope` into the sentence; writing and publishing folds it into “只看… (only look at…)”. The sentences for generating chapters and refreshing stale translations have no scope, so giving one has no effect.
 */
export function hasScope(id: AgentToolId): boolean {
  return id !== 'chapters' && id !== 'stale';
}

// ---- Settings items ----

/** Finding cut points: each of the three kinds of cut points can be checked individually; unchecked ones fold into one sentence “…不找 (do not look for…)”. */
export const CLEANUP_OPTIONS = CLEANUP_KEYS.map((key) => ({
  key,
  get label() {
    return M.cleanup[key].label;
  },
  get sub() {
    return M.cleanup[key].sub;
  },
  get off() {
    return M.cleanup[key].off;
  },
}));

export function cleanupExtra(picked: Readonly<Record<CleanupKey, boolean>>): string[] {
  const off = CLEANUP_OPTIONS.filter((o) => !picked[o.key]).map((o) => o.off);
  return off.length ? [M.cleanupOff(off)] : [];
}

const options = <K extends string>(keys: readonly K[], labels: () => Record<K, string>) =>
  keys.map((key) => ({
    key,
    get label() {
      return labels()[key];
    },
  }));

export const LENGTHS = options(LENGTH_KEYS, () => M.lengths);
export const STYLES = options(STYLE_KEYS, () => M.styles);
export const VIEWS = options(VIEW_KEYS, () => M.views);

export const TITLE_COUNT = { min: 3, max: 12, initial: 6 } as const;
export const COVER_COUNT = { min: 2, max: 4, initial: 3 } as const;

export const COVER_RATIOS = ['project', '16:9', '9:16', '1:1', '4:3'] as const;
export type CoverRatio = (typeof COVER_RATIOS)[number];

export const COVER_TEXT = options(COVER_TEXT_KEYS, () => M.coverText);

/** The canvas aspect ratio (1920×1080 → 16:9), written into the sentence when a cover “跟视频画布 (follows the video canvas)”. */
export function canvasRatio(width: number, height: number): string {
  const w = Math.round(width);
  const h = Math.round(height);
  if (!(w > 0 && h > 0)) return '16:9';
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  const g = gcd(w, h);
  return `${w / g}:${h / g}`;
}

/** The settings state for writing and publishing (the input to prototype model-writing.js `intentExtra`); items that are not given do not go into the sentence. */
export interface WritingSettings {
  /** The chapter chosen for “只看 (only look at)”; null for the whole document. */
  scope?: string | null;
  length?: WriteLength | null;
  style?: WriteStyle | null;
  /** The sentence the user wrote when the style is “自定义… (Custom…)”. */
  customStyle?: string;
  /** The language to write in (already a name, e.g. “英语 (English)”). */
  language?: string | null;
  /** The chosen viewpoint; “自动 (Auto)” is not written, and the Agent decides from the video's source. */
  view?: WriteView | null;
  /** The platform to publish to. */
  platform?: string;
  /** Making a cover: the one thing to say, the aspect ratio, and the text on the cover. */
  idea?: string;
  ratio?: string | null;
  coverText?: CoverText | null;
  /** Writing a blog: where images are needed, takes keyframes from the video and inserts them into the body (only available when handed to the Agent, since only it gets access to the picture). */
  frames?: boolean;
  note?: string;
}

/** The settings state folded into extra requirements, one sentence per item, appended after the intent sentence. */
export function writingExtra(tool: 'summary' | 'blog' | 'title' | 'desc' | 'cover', s: WritingSettings): string[] {
  const out: string[] = [];
  if (s.scope) out.push(M.extraScope(s.scope));
  const length = LENGTHS.find((l) => l.key === s.length);
  if (length && tool !== 'title' && tool !== 'cover') out.push(M.extraLength(length.label));
  const style = s.style === 'custom' ? (s.customStyle ?? '').trim() : (STYLES.find((x) => x.key === s.style)?.label ?? '');
  if (style) out.push(M.extraStyle(style));
  if (s.language) out.push(M.extraLanguage(s.language));
  if ((tool === 'blog' || tool === 'desc') && (s.view === 'author' || s.view === 'viewer')) out.push(M.extraView(M.viewName[s.view]));
  const platform = (s.platform ?? '').trim();
  if ((tool === 'title' || tool === 'desc') && platform) out.push(M.extraPlatform(platform));
  if (tool === 'blog' && s.frames) out.push(M.extraFrames);
  if (tool === 'cover') {
    const idea = (s.idea ?? '').trim();
    if (idea) out.push(M.extraIdea(idea));
    if (s.ratio) out.push(M.extraRatio(s.ratio));
    const text = COVER_TEXT.find((m) => m.key === s.coverText);
    if (text) out.push(M.extraCoverText(text.label));
  }
  const note = (s.note ?? '').trim();
  if (note) out.push(note);
  return out;
}

// ---- Cutting into short videos (prototype panel-aitools-shorts.jsx, model-shorts-cut.js) ----

export const SHORTS_COUNT = { min: 1, max: 10 } as const;
/** The “切几支 (how many clips)” dropdown: Auto first, then 1–10 clips. */
export const SHORTS_COUNTS: readonly { key: ShortsCount; readonly label: string }[] = [
  'auto' as const,
  ...Array.from({ length: SHORTS_COUNT.max - SHORTS_COUNT.min + 1 }, (_, i) => SHORTS_COUNT.min + i),
].map((key) => ({
  key,
  get label() {
    return key === 'auto' ? M.shorts.lengths.auto : M.shorts.countN(key);
  },
}));
/** The lower and upper bounds of a custom length (seconds). */
export const SHORTS_CUSTOM = { min: 1, max: 600 } as const;
const SHORTS_PRESET: Record<Exclude<ShortsLength, 'auto' | 'custom'>, { min: number; max: number }> = {
  short: { min: 15, max: 30 },
  medium: { min: 30, max: 60 },
  long: { min: 60, max: 90 },
  extended: { min: 60, max: 180 },
};

export const SHORTS_LENGTHS = options(SHORTS_LENGTH_KEYS, () => M.shorts.lengths);
export const SHORTS_RATIOS = SHORTS_RATIO_KEYS.map((key) => ({
  key,
  get label() {
    return key === 'source' ? M.shorts.ratioSource : key;
  },
}));
export const SHORTS_FOCUS = SHORTS_FOCUS_KEYS.map((key) => ({
  key,
  get label() {
    return M.shorts.focus[key].label;
  },
  get sub() {
    return M.shorts.focus[key].sub;
  },
  /** The reason this version is not open (“跟着说话的人 (follow the speaker)”: there is not yet a person or speaker model). */
  get off(): string | null {
    return key === 'speaker' ? M.shorts.speakerOff : null;
  },
}));
export const SHORTS_TRACKS = options(SHORTS_TRACK_KEYS, () => M.shorts.tracks);
export const SHORTS_STYLES = SHORTS_STYLE_KEYS.map((key) => ({
  key,
  get label() {
    return M.shorts.styles[key].label;
  },
  get sub() {
    return M.shorts.styles[key].sub;
  },
}));

/** The settings state for cutting into short videos; the defaults are in `SHORTS_DEFAULTS`. */
export interface ShortsSettings {
  count: ShortsCount;
  length: ShortsLength;
  /** The two ends of a custom length (seconds). */
  lenMin: number;
  lenMax: number;
  ratio: ShortsRatio;
  focus: ShortsFocus;
  tracks: ShortsTracks;
  style: ShortsStyle;
  /** Ones already cut are not searched for again. */
  skipDone: boolean;
}

export const SHORTS_DEFAULTS: Readonly<ShortsSettings> = {
  count: 'auto',
  length: 'auto',
  lenMin: 30,
  lenMax: 60,
  ratio: '9:16',
  focus: 'auto',
  tracks: 'both',
  style: 'shorts',
  skipDone: true,
};

const clampSeconds = (n: number, fallback: number) =>
  Number.isFinite(n) ? Math.max(SHORTS_CUSTOM.min, Math.min(SHORTS_CUSTOM.max, Math.round(n))) : fallback;

/** The length range wanted (seconds): a preset tier, or the two ends of a custom range (1–600 seconds; if they are reversed they are swapped; if they are equal, they are spread apart by one second). Null when Auto (the length is decided by the topic). */
export function shortsLengthRange(s: Pick<ShortsSettings, 'length' | 'lenMin' | 'lenMax'>): { min: number; max: number } | null {
  if (s.length === 'auto') return null;
  if (s.length !== 'custom') return { ...SHORTS_PRESET[s.length] };
  let a = clampSeconds(s.lenMin, SHORTS_DEFAULTS.lenMin);
  let b = clampSeconds(s.lenMax, SHORTS_DEFAULTS.lenMax);
  if (a > b) [a, b] = [b, a];
  if (a === b) {
    if (b < SHORTS_CUSTOM.max) b += 1;
    else a -= 1;
  }
  return { min: a, max: b };
}

/** The number of clips: Auto is kept as it is; a number is clamped to 1–10; an unrecognized value falls back to Auto. */
function clampShortsCount(n: ShortsCount): ShortsCount {
  if (n === 'auto' || !Number.isFinite(n)) return 'auto';
  return Math.max(SHORTS_COUNT.min, Math.min(SHORTS_COUNT.max, Math.round(n)));
}

/** The explanation line under “prototype model-shorts-cut.js `autoHint`”: when one item is Auto, it says how that item is decided; null when no item is Auto. */
export function shortsAutoHint(s: Pick<ShortsSettings, 'count' | 'length'>): string | null {
  const count = clampShortsCount(s.count) === 'auto';
  const length = s.length === 'auto';
  if (count && length) return M.shorts.autoHint.both;
  if (count) return M.shorts.autoHint.count;
  if (length) return M.shorts.autoHint.length;
  return null;
}

/**
 * The settings state folded into parameter lines in the prompt (prototype model-shorts-cut.js `agentExtra`), one sentence per line: the number of clips; the length (the Agent decides the Auto half by topic); the aspect ratio and framing; subtitles; and, when “已经切过的不再找 (ones already cut are not searched for again)” is checked, one sentence for it. The last line, “找好就直接创建 (if found, create directly)”, can be deleted on its own.
 * “跟着说话的人 (follow the speaker)” is not open in this version and falls back to Auto. When there is no translation, the subtitles are source-only.
 */
export function shortsLines(s: ShortsSettings, o: { hasTranslation: boolean }): string[] {
  const count = clampShortsCount(s.count);
  const len = shortsLengthRange(s);
  const focus = s.focus === 'manual' ? 'manual' : 'auto';
  const tracks: ShortsTracks = o.hasTranslation ? s.tracks : 'source';
  const out = [
    M.shorts.lineCount(count === 'auto' ? null : count, len),
    M.shorts.lineFrame(s.ratio === 'source' ? null : s.ratio, M.shorts.focusPrompt[focus]),
    M.shorts.lineSubtitles(M.shorts.tracks[tracks], M.shorts.styles[s.style].label),
  ];
  if (s.skipDone) out.push(M.shorts.lineSkipDone);
  out.push(M.shorts.lineDirect);
  return out;
}

// ---- Intent sentence ----

export interface AiIntent {
  tool: AgentToolId;
  /** The video name; when there is none, says “这个视频 (this video)”. */
  title?: string | null;
  /** The scope (“第 2 章 · 开场 (Chapter 2 · Opening)”); not given for the whole document. */
  scope?: string | null;
  /** The two kinds of sources for refreshing stale translations: a number is the sentence count; `true` means it was checked but the count is not known. */
  edited?: number | boolean;
  cut?: number | boolean;
  /** The number of title candidates, and the number of cover images. */
  count?: number | null;
  /** The extra requirements folded in from the settings state, one per sentence; empty ones are skipped. */
  extra?: readonly (string | null | undefined | false)[];
}

const sourceWhy = (value: number | boolean, label: (n: number | null) => string) =>
  typeof value === 'number' ? (value > 0 ? label(value) : '') : value ? label(null) : '';

const INTENTS: Record<AgentToolId, (o: IntentArgs) => string> = {
  stale: (o) =>
    M.intents.stale({
      ...o,
      why: M.sourceJoin([sourceWhy(o.edited, M.sourceEdited), sourceWhy(o.cut, M.sourceCut)].filter(Boolean)),
    }),
  polish: (o) => M.intents.polish(o),
  chapters: (o) => M.intents.chapters(o),
  speakers: (o) => M.intents.speakers(o),
  retranscribe: (o) => M.intents.retranscribe(o),
  cleanup: (o) => M.intents.cleanup(o),
  summary: (o) => M.intents.summary(o),
  blog: (o) => M.intents.blog(o),
  title: (o) => M.intents.title({ ...o, count: o.count || TITLE_COUNT.initial }),
  desc: (o) => M.intents.desc(o),
  cover: (o) => M.intents.cover({ ...o, count: o.count || COVER_COUNT.initial }),
  shortscut: (o) => M.intents.shortscut(o),
};

/** The sentence handed to the Agent: the intent sentence plus the extra requirements, with a full stop added after each. */
export function intentPrompt(intent: AiIntent): string {
  const title = (intent.title ?? '').trim();
  const p = title ? M.titled(title) : M.thisVideo;
  const extra = (intent.extra ?? []).map((x) => String(x || '').trim()).filter(Boolean);
  const head = INTENTS[intent.tool]({
    p,
    scope: intent.scope?.trim() || null,
    edited: intent.edited ?? false,
    cut: intent.cut ?? false,
    count: intent.count ?? null,
  });
  return M.joinPrompt(
    head,
    extra.map((x) => M.endSentence(x)),
  );
}

/**
 * The sentence sent when “交给 Agent 重译 (re-translate with Agent)” is pressed in the translation list (product design §5.10 “sentence-by-sentence and stale translations”; prototype model-agent.js `retranslate`, and `stale` with a count). It states the language and the scope: for one sentence, its timecode and the start of its source text; for a batch, the number of stale or untranslated sentences. It changes only the translations of those sentences.
 */
export function retranslatePrompt(o: {
  title: string | null;
  /** The name of the translation language (as written in the interface language). */
  language: string;
  /** One sentence: its timecode (null if it has been cut) and the start of its source text. */
  scope?: { time: string | null; text: string } | null;
  /** One batch: the number of sentences. */
  count?: number;
}): string {
  const title = (o.title ?? '').trim();
  const p = title ? M.titled(title) : M.thisVideo;
  return o.scope
    ? M.retranslateOne({ p, language: o.language, time: o.scope.time, text: o.scope.text })
    : M.retranslateStale({ p, language: o.language, count: o.count ?? 0 });
}

// ---- AI tools tab: list, templates, built-in skills, session destinations (product design §5.10, §6.9; prototype model-ai-prompt.js) ----

/**
 * The first batch of the list page lists only the three groups that start from the document, plus cutting into short videos in the “画面 (Picture)” group and generating music in the “声音 (Sound)” group (prototype model-ai-prompt.js `GROUPS_NOW`).
 * Translation and smart crop still open from their own panels; the footnote says where they are.
 */
export const LIST_GROUPS: readonly AiToolGroup[] = ['transcript', 'writing', 'publish', 'frame', 'sound'];

/** A group with an allowlist shows only the tools on the allowlist (prototype model-ai-prompt.js `OPEN_IN_GROUP`): for now, the “画面 (Picture)” group opens only cutting into short videos. */
const OPEN_IN_GROUP: Partial<Record<AiToolGroup, readonly AiToolId[]>> = { frame: ['shortscut'] };

/** The tools this group shows on the list page. */
export function listedTools(group: AiToolGroup): AiTool[] {
  const only = OPEN_IN_GROUP[group];
  return AI_TOOLS.filter((t) => t.group === group && (!only || only.includes(t.id)));
}

/** Whether this tool needs a document first. Generating music does not start from a document, so it can be clicked without one. */
export function needsTranscript(id: AiToolId): boolean {
  return id !== 'soundtrack';
}

/** A subtitle under the group; not drawn when there is none. */
export function groupSub(group: AiToolGroup): string | null {
  return M.groupSub[group] ?? null;
}

/** The footnote on the list page. */
export function laterNote(): string {
  return M.laterNote;
}

/**
 * Each tool is paired with one built-in skill (repo root `skills/cuccut/built-in-skills/<id>/`). The tools page's prompt box has it attached by default; it can be removed, and other skills can be attached.
 * Subtitle translation and refreshing stale translations share one; generating titles and writing descriptions share one.
 */
export const TOOL_SKILL: Readonly<Partial<Record<AiToolId, string>>> = {
  retranscribe: 'subtitle-workflow',
  polish: 'polish-transcript',
  chapters: 'video-chapters',
  speakers: 'speaker-labeling',
  cleanup: 'talking-head-cut',
  translate: 'translate-subtitles',
  stale: 'translate-subtitles',
  summary: 'video-summary',
  blog: 'video-blog',
  title: 'titles-and-description',
  desc: 'titles-and-description',
  cover: 'cover-and-title',
  shortscut: 'shorts-segments',
};

/** The built-in skill attached by default when the tools page opens: if this tool's built-in skill is still in the list, it is attached (even when switched off, since picking does not look at the switch, §6.9). */
export function defaultSkillIds(tool: AiToolId, available: readonly { id: string }[]): string[] {
  const id = TOOL_SKILL[tool];
  return id && available.some((s) => s.id === id) ? [id] : [];
}

/** The line on the tools page description card for “会不会改视频 (whether it changes the video)”. */
export function toolEffect(tool: AgentToolId): string {
  return M.effect[tool];
}

/** The fixed constraints under the intent sentence in the template; `language` is the language name (“英语 (English)”); when there is none, the language of the document is followed. */
export function standingLines(tool: AgentToolId, opts: { language?: string | null } = {}): string[] {
  const language = opts.language?.trim() || null;
  const own = [...(M.standing[tool] ?? [])];
  if (tool === 'summary' || tool === 'blog' || tool === 'desc') return [M.standMarkdown(language), ...own];
  if (tool === 'title') return [M.standLanguage(language), ...own];
  return own;
}

/**
 * The template pre-filled into the prompt box: the first line is the intent sentence (the result of `intentPrompt`, with the scope and checked items already folded in), and below it one fixed constraint per line.
 * `lines` are the tool's own parameter lines (`shortsLines` for cutting into short videos), appended at the end, one per sentence, so the user can edit or delete them separately.
 */
export function toolTemplate(tool: AgentToolId, intent: string, opts: { language?: string | null; lines?: readonly string[] } = {}): string {
  return [intent.trim(), ...standingLines(tool, opts), ...(opts.lines ?? [])].filter(Boolean).join('\n');
}

/** The draft key for the tools page prompt box: attachments, images, and edited prompts all hang under it. */
export const toolDraftKey = (videoId: string, tool: AiToolId): string => `aitool:${videoId}:${tool}`;

/** One option in the “会话 (Session)” row. */
export interface SessionOption {
  key: 'new' | 'current';
  label: string;
  sub: string;
  /** The session for “接着 (continue)”. */
  conversationId?: string;
}

/**
 * Which session the handoff goes to (prototype `sessionOptions`). The default is a new session with this video as context. “接着 (continue)” is offered only when this video has a session where something has been said, and the existing message count is shown (no number when it has not been fetched yet). If the video is not in a project, the new session shares the working directory of the session the video lives in (`folderOf`), and sees it too.
 * If the video has no location yet (`canCreate: false`), only continuing is possible.
 */
export function sessionOptions(input: {
  canCreate: boolean;
  current: { id: string; title: string; messages: number | null } | null;
}): { options: SessionOption[]; fallback: 'new' | 'current' | null } {
  const options: SessionOption[] = [];
  if (input.canCreate) options.push({ key: 'new', label: M.sessionNew, sub: M.sessionNewSub });
  const cur = input.current;
  if (cur && cur.messages !== 0) {
    options.push({
      key: 'current',
      conversationId: cur.id,
      label: M.sessionCurrent(cur.title.trim() || M.sessionUntitled),
      sub: M.sessionCurrentSub(cur.messages),
    });
  }
  return { options, fallback: options[0]?.key ?? null };
}

/** The line under the main button: where pressing it will go. */
export function handoffHint(session: 'new' | 'current'): string {
  return session === 'current' ? M.hintCurrent : M.hintNew;
}
