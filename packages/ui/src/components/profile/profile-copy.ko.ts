import type { ProfileMessages } from './profile-copy.ts';

/** English for now: the translation stage fills this file. */
export const ko: ProfileMessages = {
  blurb: 'What you make, who it is for, and how you like it done. Every agent reads this before it decides anything.',
  loading: 'Loading your profile',
  about: {
    title: 'About you',
  },
  interview: {
    line: {
      pending: 'Five questions about what you make and who it is for. The answers become preferences the agent follows.',
      skipped: 'Skipped. Whatever you typed is kept below; finish it whenever.',
      doneWithSection: 'Answered. The lines it wrote are below; rewriting them replaces that section and leaves your own lines alone.',
      doneRemoved: 'Answered, and the section it wrote has since been removed. Rewrite it from the answers below whenever you like.',
    },
  },
  question: {
    who: {
      label: 'What do you make, and who is it for?',
      placeholder: 'Coding streams on Twitch; clips for TikTok and Shorts aimed at junior devs.',
    },
    record: {
      label: 'What do you usually record?',
      placeholder: 'Two-hour streams with a webcam in the corner; sometimes a talking-head explainer.',
    },
    platforms: {
      label: 'Where does it go, and how long should it be?',
      placeholder: 'TikTok and Shorts, 30 to 60 seconds; the odd 16:9 for YouTube.',
    },
    annoys: {
      label: 'What annoys you about your videos today?',
      placeholder: 'Captions misspell names, hooks are too long, music drowns the voice.',
    },
    names: {
      label: 'Names that must be spelled right',
      placeholder: 'Deska, Claude, Next.js, my handle @pasho',
    },
    optional: '(optional)',
  },
  answers: {
    save: 'Save answers',
    rewrite: 'Rewrite my preferences',
    count: (n: number, total: number) => `${n === 1 ? '1 answer' : `${n} answers`} of ${total}. Rewriting turns them into the section below.`,
    writing: 'The agent is reading your answers. This takes a moment.',
    needWho: 'Answer the first question to rewrite.',
    noAgent: 'No agent is connected, so your answers will be kept as typed.',
    busy: 'Your preferences are being written. Wait for it to finish.',
    saved: 'Answers saved',
    saveFailed: (message: string) => `Couldn’t save your answers: ${message}`,
    written: 'Preferences written from your answers. They are in the section below.',
    writeFailed: (message: string) => `Couldn’t write your preferences: ${message}`,
    namesAdded: (names: string) => `Names added to the glossary: ${names}`,
  },
  /** Why a write kept the answers as typed (`ProfileWriteResult.fallbackReason`). */
  fallback: {
    'no-agent': 'No agent was available, so your answers were kept as typed.',
    'agent-failed': 'The agent couldn’t finish, so your answers were kept as typed.',
    'bad-output': 'The agent’s reply couldn’t be used, so your answers were kept as typed.',
  },
  own: {
    title: 'In your words',
    blurb: 'Markdown, one preference a line reads best. The agent follows them unless what you ask for in the moment says otherwise.',
    label: 'Preferences in your words',
    placeholder: 'Short hooks, under three seconds.\nNever emojis in captions.\nTwo words a line.\nMusic always under the voice.',
    save: 'Save preferences',
    discard: 'Discard',
    unchanged: 'Nothing to save: the text is as it was.',
    saved: 'Preferences saved',
    saveFailed: (message: string) => `Couldn’t save your preferences: ${message}`,
  },
  interviewSection: {
    title: 'What the interview wrote',
    blurb: 'Lines the agent drew from your answers. They sit apart from your own, so rewriting them never touches what you typed.',
    regionLabel: 'Preferences written by the interview',
    remove: 'Remove this section',
    removed: 'Removed the section the interview wrote',
    removeFailed: (message: string) => `Couldn’t remove the section: ${message}`,
  },
  common: {
    undo: 'Undo',
    undoFailed: (message: string) => `Couldn’t undo: ${message}`,
    desktopOnly: 'Change this in the desktop app.',
    readOnly: 'This profile was saved by a newer version of CucCut, so it can only be read here.',
    disconnected: 'The Runtime is not connected.',
  },
  note: {
    sessions: 'Agents read this when a session starts. Sessions already open keep what they had.',
  },
};
