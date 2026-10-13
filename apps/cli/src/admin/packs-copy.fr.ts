import type { PacksMessages } from './packs-copy.ts';

/** English until this language is translated. */
export const fr: PacksMessages = {
  packsHelp: `Usage:
  cuccut packs inspect <source>    Read a pack and show everything it carries, without installing it.
                                   <source>: a folder, a GitHub address (owner/repo, a repository URL or
                                   …/tree/<branch>/<folder>) or an https:// address that serves pack.json
  cuccut packs install <source>    Read a pack and install its templates, skills, library items, style
                                   guide and quick actions
    --replace                      Replace your own templates and skills with the same ids (they go to
                                   the trash); without it they are kept and skipped
  cuccut packs remove <id>         Delete a pack: it and the templates and skills it brought go to the
                                   trash for 24 hours; library items and what you changed stay
  cuccut packs restore <trashId>   Undo a removal, within 24 hours
  cuccut packs style <id> [<file>|-]
                                   Print the pack's style guide; with a file (or - for standard input),
                                   save the file as the guide (an empty file removes it)
  cuccut packs export <folder> --name <name>
                                   Write a pack folder from your own templates, skills and library items,
                                   with the files index, to send as it is, push to GitHub or serve from any
                                   static host. The folder must be empty or an earlier export of the pack
    --id <id>                      The pack's id (default: made from the name)
    --version <version>            Default 1.0.0
    --author <name>, --description <text>
    --template <id>                A template of your own (repeatable)
    --skill <id>                   A skill that isn't built in (repeatable)
    --library <glossaries|brand>:<entryId>
                                   A library item (repeatable); voices stay
    --quick-actions <packId>       The quick actions of an installed pack (repeatable)
    --style-from <packId>          The style guide and reference files of an installed pack`,

  // Inspect
  title: (name: string, id: string, version: string, author: string) => `${name} (${id}) v${version}${author ? `, by ${author}` : ''}`,
  notInstalled: 'Not installed: read it first.',
  installedVersion: (version: string) =>
    `Version ${version} is installed. Installing again updates what the pack owns and keeps what you changed.`,
  contents: (templates: number, skills: number, library: number, style: boolean, quickActions: number) => {
    const parts = [
      templates ? `${templates} ${templates === 1 ? 'template' : 'templates'}` : '',
      skills ? `${skills} ${skills === 1 ? 'skill' : 'skills'}` : '',
      library ? `${library} library ${library === 1 ? 'item' : 'items'}` : '',
      style ? 'a style guide' : '',
      quickActions ? `${quickActions} quick ${quickActions === 1 ? 'action' : 'actions'}` : '',
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : 'Nothing of its own';
  },
  sectionTemplates: 'Templates',
  sectionSkills: 'Skills',
  sectionLibrary: 'Library',
  sectionStyle: 'Style guide: agents read this before choosing and editing',
  sectionExamples: 'Reference files',
  sectionQuick: 'Quick actions: messages sent to the agent with one click',
  sectionReserved: 'Rules and review standard: kept with the pack; CucCut does not use them yet',
  sectionWarnings: 'Warnings',
  agentReads: 'Text an agent will follow. Read it.',
  stateNew: 'new',
  stateUpdate: 'updates the copy this pack installed',
  stateChanged: 'you changed it since it was installed: kept unless --replace',
  stateExists: 'you already have one with this id: yours is kept unless --replace',
  stateBuiltin: 'a built-in one has this id, so this one is not installed',
  skillFiles: (files: number) => `${files} ${files === 1 ? 'file' : 'files'}`,
  duplicate: 'already in your library; not added again',
  bytes: (bytes: number) => `${bytes} bytes`,
  missingSkill: (template: string, skill: string) =>
    `${template} recommends the skill "${skill}", which is neither on this computer nor in the pack`,
  scanHit: (file: string, line: number, why: string, text: string) => `${file}, line ${line}: ${why}${text ? ` ("${text}")` : ''}`,
  blocked: (file: string, line: number, why: string, text: string) =>
    `This pack will not install: line ${line} of ${file} ${why}${text ? ` ("${text}")` : ''}`,
  installHint: (source: string) => `Install it with: cuccut packs install ${source}`,
  replaceHint: 'Add --replace to replace your own items that have the same ids.',

  // Install, remove, restore
  installed: (name: string, version: string, contents: string) => `Installed ${name} v${version}: ${contents}`,
  skipped: (kind: 'template' | 'skill' | 'library', id: string, reason: 'builtin' | 'exists' | 'changed') =>
    `Skipped the ${kind === 'template' ? 'template' : kind === 'skill' ? 'skill' : 'library item'} ${id}: ${
      reason === 'builtin'
        ? 'a built-in one has this id'
        : reason === 'exists'
          ? 'you have your own with this id (add --replace)'
          : 'you changed it since it was installed (add --replace)'
    }`,
  removed: (name: string, templates: number, skills: number) =>
    `Deleted ${name}: ${templates} ${templates === 1 ? 'template' : 'templates'} and ${skills} ${skills === 1 ? 'skill' : 'skills'} went with it. Library items stay.`,
  kept: (count: number, ids: string) => `${count} you changed ${count === 1 ? 'stays' : 'stay'}: ${ids}`,
  undo: (trashId: string) => `Undo within 24 hours: cuccut packs restore ${trashId}`,
  restored: (name: string, version: string) => `Restored ${name} v${version}`,

  // Style guide
  noStyle: (name: string, id: string) => `${name} has no style guide. Save one with cuccut packs style ${id} <file>`,
  styleSaved: (name: string, chars: number, limit: number) => `Saved the style guide of ${name} (${chars} / ${limit} characters)`,
  styleRemoved: (name: string) => `Removed the style guide of ${name}`,
  takesEffect: 'Takes effect from the next new agent session.',
  idFormat: (value: string) => `Not a pack id (lowercase letters, digits and single dashes): ${value}`,

  // Export
  exportNeedsName: 'Give the pack a name with --name.',
  exportNoId: (name: string) => `Can't make an id from "${name}"; give one with --id.`,
  libraryFormat: (value: string) => `Not a library item (glossaries:<entryId> or brand:<entryId>): ${value}`,
  exported: (dir: string, files: number, bytes: number) =>
    `Wrote ${dir}: ${files} ${files === 1 ? 'file' : 'files'}, ${bytes} bytes. Send the folder as it is, push it to GitHub, or serve it from any static host.`,
  exportedCheck: (dir: string) => `Read it back with: cuccut packs inspect ${dir}`,
  fileUnreadable: (file: string, reason: string) => `Can't read ${file}: ${reason}`,
};
