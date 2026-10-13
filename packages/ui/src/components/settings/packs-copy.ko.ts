import type { PacksMessages } from './packs-copy.ts';

/** English until this language is translated. */
export const ko: PacksMessages = {
  list: {
    /** For screen readers while the skeleton rows show. */
    loading: 'Loading your packs',
    loadFailed: (raw: string) => `Couldn’t load the packs: ${raw}`,
    retry: 'Try again',
    disconnected: 'The Runtime isn’t connected, so the installed packs can’t be listed.',
    emptyTitle: 'No packs installed',
    emptyBody:
      'A pack is how a way of making videos moves to another computer, or how somebody else’s reaches yours. Import one to try it; export yours once your templates and skills are worth sharing.',
    webNote: 'Packs are installed and removed in the desktop app, or on the command line with cuccut packs.',
    /** `v1.0.0 · author` under a pack's name. */
    versionLine: (version: string, author: string) => (author ? `v${version} · ${author}` : `v${version}`),
    /** The contents line: the parts that are there, joined with " · ". */
    templates: (n: number) => (n === 1 ? '1 template' : `${n} templates`),
    skills: (n: number) => (n === 1 ? '1 skill' : `${n} skills`),
    library: (n: number) => (n === 1 ? '1 library item' : `${n} library items`),
    styleGuide: 'a style guide',
    quickActions: (n: number) => (n === 1 ? '1 quick action' : `${n} quick actions`),
    nothing: 'Nothing of its own',
    /** What the origin icon stands for (screen readers). */
    origin: { local: 'From a folder', github: 'From GitHub', url: 'From a web address' },
    diagnostics: 'Packs that can’t be read',
    diagnosticsHint: 'These folders in the packs folder have no readable record. Import the pack again from where it came from.',
    /** Notice line after install or export. */
    installed: (name: string) => `Installed ${name}.`,
    exported: (dir: string) => `Written to ${dir}. Send the folder as it is, push it to GitHub, or serve it from any static host.`,
  },
  import: {
    title: 'Import a pack',
  },
  export: {
    title: 'Export a pack',
  },
  pack: {
    /** Item states on the pack page; a present item says nothing. */
    changed: '(changed since)',
    deleted: '(deleted since)',
  },
  style: {
    auto: 'Decide on its own',
    none: 'None',
    using: (name: string, reason: string) => `Using ${name}. ${reason}`,
    noneUsed: (reason: string) => `No style guide. ${reason}`,
    reason: {
      chosen: 'This project chose it.',
      'chosen-none': 'This project chose to use none.',
      'chosen-missing': 'The pack this project chose is no longer installed.',
      template: 'This conversation used one of its templates.',
      only: 'It is the only installed pack with a style guide.',
      ambiguous: 'Several installed packs have a style guide, so choose one.',
      'no-guide': 'No installed pack has a style guide.',
    },
  },
  quick: {
    /** What `{selection}` becomes when nothing on the timeline is selected. */
    thisVideo: 'this video',
    /** What `{selection}` becomes for a selected timeline item. */
    selection: (name: string) => `“${name}”`,
    from: (name: string) => `From the pack ${name}`,
  },
  errors: {
    action: {
      load: 'load the packs',
      read: 'read the pack',
      install: 'install the pack',
      remove: 'delete the pack',
      restore: 'bring the pack back',
      choose: 'choose the style guide',
      saveStyle: 'save the guide',
    },
    failed: (action: string, raw: string) => `Couldn’t ${action}: ${raw}`,
    notFound: (id: string) => `Nothing installed is called “${id}”. The list has what is here now.`,
    sourceNotFound: 'There’s no pack there: no pack.json in that folder or at that address.',
    urlInvalid: 'That address wasn’t recognized. Use a folder, owner/repo, a GitHub address, or an https:// address that serves pack.json.',
    invalid: (issue: string) => `This isn’t a pack that can be installed: ${issue}`,
    unsupportedSchema: 'This pack was written for a newer version of CucCut. Update CucCut, then read it again.',
    foreignFormat: 'This isn’t a CucCut pack. Packs made for other editors can’t be installed here.',
    unsupportedField: (issue: string) => `This pack carries something CucCut doesn’t install: ${issue}`,
    tooLarge: (files: number, size: string) => `This pack is too large: a pack holds at most ${files} files and ${size} in all.`,
    idReserved: 'A pack can’t be called “import” or “export”: those are pages in Settings. Give the pack another id.',
    blocked: (line: number, why: string, text: string) => `This pack will not install: line ${line} ${why} (“${text}”).`,
    blockedWhole: (why: string) => `This pack will not install: ${why}.`,
    styleTooLong: (length: number, limit: number) => `The guide is ${length} characters long; it holds at most ${limit}.`,
    previewExpired: 'This preview is more than 30 minutes old. Read it again.',
    restoreConflict: (id: string) => `“${id}” was installed again in the meantime, so the deleted copy can’t come back.`,
    trashExpired: 'It was deleted more than 24 hours ago, so it can’t come back. Import it again.',
    exportTargetNotEmpty: 'That folder has other files in it. Choose an empty folder.',
    styleChanged: 'The guide was changed somewhere else after you opened it. Reload the page to see the newer text, then save again.',
    network: 'Can’t reach the pack’s address. Check your network and try again.',
    offline: 'Strict offline mode is on, so packs can only be read from a folder on this computer.',
    projectNotFound: 'This project is gone; it may have just been deleted.',
    webNotAllowed: 'This can’t be done in the browser. Use the CucCut desktop app, or cuccut packs on the command line.',
    webReadOnly: 'This browser session is read-only, so nothing can be changed.',
  },
};
