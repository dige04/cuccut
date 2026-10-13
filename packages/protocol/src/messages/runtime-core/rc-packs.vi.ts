import type { RcPacksMessages } from './rc-packs.ts';

/** English until this language is translated. */
export const vi: RcPacksMessages = {
  // One per error code
  packNotFound: (p: { id: string }) => `Nothing installed is called "${p.id}"`,
  sourceNotFound: (p: { source: string }) => `There's nothing to read at ${p.source}`,
  urlInvalid: (p: { issue: string }) => `That isn't an address a pack can be read from: ${p.issue}`,
  invalid: (p: { issue: string }) => `This isn't a pack that can be installed: ${p.issue}`,
  unsupportedSchema: (p: { issue: string }) => `This pack was written for a newer version of CucCut: ${p.issue}`,
  foreignFormat: (p: { issue: string }) => `This pack can't be read here: ${p.issue}`,
  unsupportedField: (p: { issue: string }) => `This pack can't be installed: ${p.issue}`,
  tooLarge: (p: { files: number; bytes: number; maxFiles: number; maxBytes: number }) =>
    `This pack has ${p.files} files totalling ${p.bytes} bytes; a pack holds at most ${p.maxFiles} files and ${p.maxBytes} bytes`,
  idReserved: (p: { issue: string }) => `This pack can't be installed: ${p.issue}`,
  blocked: (p: { file: string; line: number; why: string; text: string }) =>
    `This pack will not install: line ${p.line} of ${p.file} ${p.why} ("${p.text}")`,
  styleTooLong: (p: { length: number; limit: number }) => `The style guide is ${p.length} characters long; it holds at most ${p.limit}`,
  previewExpired: 'This preview is more than 30 minutes old. Read it again',
  restoreConflict: (p: { id: string }) => `"${p.id}" was installed again in the meantime, so the deleted copy can't come back`,
  trashExpired: 'The deleted pack is no longer kept, so it can\'t come back',
  exportTargetNotEmpty: 'That folder has other files in it. Choose an empty folder',
  styleChanged: 'The style guide changed since you opened it. Open it again and redo your change',
  offlineStrict: "Packs aren't read from the network in strict offline mode",
  network: (p: { issue: string }) => `Couldn't read the pack: ${p.issue}`,

  // Where a pack is read from (pack-source)
  sourceEmpty: 'Give a folder, a GitHub address or an https:// address',
  sourceRelative: 'Give the full path of the folder',
  urlNotHttps: 'A web address must start with https://',
  urlCredentials: "A web address can't carry a user name or a password",
  urlBadForm: "That web address can't be read",
  folderNotFound: (p: { path: string }) => `Folder not found: ${p.path}`,
  noManifest: (p: { source: string }) => `${p.source} has no pack.json, so it isn't a pack`,
  folderOverlapsPacks: "This folder is inside CucCut's packs folder (or holds it), so it can't be read as a pack",
  noSymlinks: (p: { path: string }) => `Symbolic links aren't allowed: ${p.path}`,
  notRegularFile: (p: { path: string }) => `Not a regular file: ${p.path}`,
  pathTooLong: (p: { path: string }) => `Path too long: ${p.path}…`,
  cannotRead: (p: { path: string; code: string }) => `Can't read ${p.path} (${p.code})`,
  manifestTooLarge: (p: { limit: number }) => `pack.json is larger than ${p.limit} bytes`,
  manifestNotUtf8: "pack.json isn't valid UTF-8",
  manifestNotJson: "pack.json isn't valid JSON",
  manifestIssue: (p: { path: string; message: string }) => `${p.path}: ${p.message}`,
  filesIndexRequired: 'A pack served from a web address lists every file in pack.json ("files"); export writes that list',
  fileUnnamed: (p: { path: string }) => `${p.path} isn't named by pack.json; remove it or name it there`,
  fileMissing: (p: { path: string }) => `${p.path} is named by pack.json but isn't in the pack`,
  fileMismatch: (p: { path: string }) => `${p.path} doesn't match the files list in pack.json (its size or sha256 differs)`,
  fileUnlisted: (p: { path: string }) => `${p.path} isn't in the files list of pack.json`,
  itemDirMissing: (p: { path: string }) => `${p.path}/ is named by pack.json but isn't in the pack`,

  // Downloads (https:// and GitHub)
  whatManifest: 'pack.json',
  httpUnreachable: (p: { url: string }) => `Couldn't connect to ${p.url}`,
  httpTimeout: (p: { url: string }) => `Timed out reading ${p.url}`,
  httpStatus: (p: { url: string; status: number }) => `${p.url} returned HTTP ${p.status}`,
  httpNotFound: (p: { url: string }) => `${p.url} doesn't exist (HTTP 404)`,
  httpRedirectedAway: (p: { url: string }) => `${p.url} redirected to an address that isn't https://`,
  httpConnectionLost: (p: { url: string }) => `The connection dropped while reading ${p.url}`,
  httpTooLarge: (p: { url: string; limit: number }) => `${p.url} is larger than ${p.limit} bytes`,
  githubNotPack: (p: { issue: string }) => `This GitHub folder isn't a pack that can be installed: ${p.issue}`,
  githubTooLarge: (p: { files: number; bytes: number; maxFiles: number; maxBytes: number }) =>
    `This GitHub folder has ${p.files} files totalling ${p.bytes} bytes; a pack holds at most ${p.maxFiles} files and ${p.maxBytes} bytes`,
  githubTruncated: (p: { limit: number }) => `This folder has too many entries for GitHub to list in full; a pack holds at most ${p.limit} files`,
  githubDownloadTooLarge: (p: { what: string; limit: number }) =>
    `${p.what} is larger than ${p.limit} bytes (larger than GitHub listed, or the pack is over its size limit)`,

  // Inspect (pack-inspect)
  itemInvalid: (p: { path: string; issue: string }) => `${p.path}: ${p.issue}`,
  skillIdMismatch: (p: { id: string; normalized: string }) => `The skill folder "${p.id}" would be read as "${p.normalized}"; name it with its id`,
  skillTooLarge: (p: { bytes: number; limit: number }) => `The skill holds ${p.bytes} bytes; a skill holds at most ${p.limit}`,
  libraryUnreadable: (p: { path: string; issue: string }) => `${p.path} can't go into the library: ${p.issue}`,
  libraryVoice: (p: { path: string }) => `${p.path} is a voice; a voice needs its owner's consent, which can't travel in a pack`,
  styleNotText: (p: { file: string }) => `${p.file} isn't UTF-8 text`,

  // Installed packs (pack-registry)
  recordUnreadable: "This pack folder can't be read, so it isn't listed",
  recordMissing: (p: { file: string }) => `${p.file} is missing`,
  recordNotJson: (p: { file: string }) => `${p.file} can't be read as JSON`,
  recordIdMismatch: (p: { id: string; dir: string }) => `The record names the pack "${p.id}", but its folder is called "${p.dir}"`,

  // Style guides (pack-style)
  chooseStyleSummary: (p: { pack: string }) => `Use the style guide of the pack "${p.pack}" in this project`,
  chooseStyleNone: 'Use no style guide in this project',
  chooseStyleAuto: 'Let CucCut decide which style guide this project uses',

  // Export (pack-export)
  exportBuiltinTemplate: (p: { id: string }) => `"${p.id}" is a built-in template; built-in templates are on every computer already`,
  exportBuiltinSkill: (p: { id: string }) => `"${p.id}" is a built-in skill; built-in skills are on every computer already`,
  exportTargetInHome: "That folder is inside CucCut's own templates, skills or packs folder. Choose a folder outside it",

  // Reference files (pack-examples)
  exampleNotFound: (p: { file: string; pack: string }) => `The pack "${p.pack}" has no reference file ${p.file}`,
  exampleUnsupported: (p: { file: string; extensions: string }) => `${p.file} isn't an image or a video a pack can carry (${p.extensions})`,
  exampleLimit: (p: { limit: number }) => `A pack holds at most ${p.limit} reference files; remove one first`,
  exampleTooLarge: (p: { bytes: number; limit: number }) => `With this file the pack would hold ${p.bytes} bytes; a pack holds at most ${p.limit}`,
  exampleNameTaken: (p: { file: string }) => `${p.file} was added again in the meantime, so the removed copy can't come back`,
};
