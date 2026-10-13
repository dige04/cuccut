import type { ProtocolPacksMessages } from './protocol-packs.ts';

/** English until this language is translated. */
export const ko: ProtocolPacksMessages = {
  // Manifest (pack.json)
  notObject: 'pack.json must hold one JSON object',
  formatMissing: 'pack.json has no "format": "cuccut.pack", so it is not a CucCut pack',
  foreignFormat: 'This is an agentcut pack: its pack.json has no "format" field. CucCut reads only cuccut.pack folders',
  otherFormat: (p: { format: string }) => `pack.json says its format is "${p.format}", not "cuccut.pack"`,
  unsupportedSchema: (p: { schema: string }) => `Pack schema ${p.schema} isn't supported; this version of CucCut reads schema 1`,
  unsupportedField: (p: { field: string }) => `"${p.field}" isn't supported: packs carry no code in this version of CucCut`,
  idChars: 'A pack id is lowercase letters, digits and single dashes, and starts with a letter',
  idReserved: (p: { id: string }) => `"${p.id}" is a reserved name and can't be a pack id`,
  versionChars: 'A version is letters, digits, dots, dashes and plus signs',
  templateIdChars: 'A template id is lowercase letters, digits and single dashes, and starts with a letter',
  ruleIdChars: 'A rule id is lowercase letters, digits and single dashes',
  duplicateTemplates: 'The same template is named twice',
  duplicateSkills: 'The same skill is named twice',
  duplicateLibrary: 'The same library file is named twice',
  duplicateExamples: 'The same reference file is named twice',
  duplicateQuickActions: 'Two quick actions have the same label',
  duplicateRules: 'The same rule is named twice',
  duplicateFiles: 'The same file is listed twice in files',
  libraryDir: (p: { dir: string }) => `Library files are under ${p.dir}/`,
  libraryVoice: "Voices can't travel in a pack: a voice needs its owner's consent",
  examplesDir: (p: { dir: string }) => `Reference files are under ${p.dir}/`,
  exampleExtension: (p: { kind: string; extensions: string }) => `A ${p.kind} reference is one of ${p.extensions}`,
  stillExtension: (p: { extensions: string }) => `A still is an image: ${p.extensions}`,
  styleFile: 'The style guide is a Markdown file (.md) in the root of the pack',
  reviewFile: 'The review standard is a JSON file in the root of the pack',
  sha256Hex: 'sha256 is 64 lowercase hexadecimal digits',

  // Paths inside a pack
  pathRelative: 'The path must be relative to the pack folder',
  pathHidden: "Pack paths can't name hidden files or folders (starting with a dot)",
  fileNotNamed: (p: { path: string }) => `${p.path} isn't named by pack.json`,

  // Reasons of the text scan (pack-scan.ts): what a line does that a style guide, a reference note or a quick action has no business doing
  whyTooLong: (p: { length: number; limit: number }) => `It is ${p.length} characters long; a style guide holds at most ${p.limit}`,
  whyIgnoreInstructions: 'tells the agent to ignore its instructions',
  whyChangeIdentity: 'tries to change who the agent is',
  whyRevealSecrets: 'asks for secrets or for the prompt',
  whyCredential: 'contains a credential',
  whyCommand: 'contains a command to run',
  whyDeleteWork: 'asks the agent to delete work',
  whySendUrl: 'asks the agent to send something to a web address',
  whyPromptBoundary: 'imitates a prompt boundary',
};
