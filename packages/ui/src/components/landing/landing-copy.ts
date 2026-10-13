import { defineMessages } from '@cuccut/protocol';
import { zhHans } from './landing-copy.zh-Hans.ts';
import { zhHant } from './landing-copy.zh-Hant.ts';
import { ja } from './landing-copy.ja.ts';
import { ko } from './landing-copy.ko.ts';
import { es } from './landing-copy.es.ts';
import { fr } from './landing-copy.fr.ts';
import { de } from './landing-copy.de.ts';
import { nl } from './landing-copy.nl.ts';
import { ptBR } from './landing-copy.pt-BR.ts';
import { it } from './landing-copy.it.ts';
import { ru } from './landing-copy.ru.ts';
import { pl } from './landing-copy.pl.ts';
import { tr } from './landing-copy.tr.ts';
import { vi } from './landing-copy.vi.ts';

/**
 * Copy for the landing page and the start page (agentcut home): the two ways in, the composer heading, the blank
 * canvas shapes, the clip-a-long-video card and the recent list. English is the source; translations live in
 * `landing-copy.<locale>.ts`.
 */
const en = {
  tabs: 'Start a video',
  create: 'Create a video',
  clip: 'Clip a long video',
  heading: 'What video will you make?',
  lede: 'Describe your video, attach footage, or start from a template.',
  composerLabel: 'Describe your video',
  blank: {
    toggle: 'Blank canvas',
    hint: 'Pick a shape to open an empty video in the editor',
    group: 'Blank canvas shapes',
    shapes: { wide: 'Widescreen', vertical: 'Vertical', portrait: 'Portrait', square: 'Square' },
    create: (shape: string, ratio: string) => `New blank video: ${shape} ${ratio}`,
  },
  quickStartBlurb: 'Fills in the prompt for a common job. Nothing is sent until you press Send.',
  templatesBlurb: 'Choose a look for the agent to follow, or reuse a finished example’s prompt.',
  clips: {
    title: 'Turn a long video into clips',
    dropTitle: 'Drop your video here',
    body: 'Paste a video link or a path on this computer, or choose a file. The agent finds the strongest moments and shows you the candidates before it cuts anything.',
    field: 'Video link or local path',
    placeholder: 'https://youtube.com/watch?v=… or a file path',
    add: 'Add video',
    or: 'or',
    choose: 'Choose from this computer',
    note: 'Links are fetched with the download tool. Local files stay where they are; nothing is uploaded.',
    starting: 'Starting a session…',
    empty: 'Paste a video link or a local path, or choose a file from this computer.',
    notVideo: 'Choose a video file to find clips in.',
    needsAgent: 'Finding clips needs an agent. Set one up first.',
    prompt:
      'Find the best short clips in this long video. List the candidates with their timestamps and why each one works, and wait for my go-ahead before cutting anything.',
  },
  recent: {
    title: 'Recent',
    blurb: 'Pick up where you left off.',
    search: 'Search sessions and projects',
    noMatch: (query: string) => `Nothing matches “${query}”.`,
    clear: 'Clear search',
    found: (count: number) => (count === 1 ? '1 result' : `${count} results`),
    emptyTitle: 'Your first video starts above',
    emptyBody: 'Describe an idea or add footage. Your sessions and projects will appear here.',
    list: 'Recent sessions and projects',
    sessions: (count: number) => (count === 1 ? '1 session' : `${count} sessions`),
    project: 'Project',
    more: (count: number) => `Show ${count} more`,
    less: 'Show fewer',
    pinned: 'Pinned',
    archiveProject: 'Archive project',
  },
};

export type LandingMessages = typeof en;

export const LANDING_COPY = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
