import { defineMessages, live, type AgentPolicy } from '@cuccut/protocol';
import { revealLabel } from '../../copy.ts';
import { zhHans } from './agent-copy.zh-Hans.ts';
import { zhHant } from './agent-copy.zh-Hant.ts';
import { ja } from './agent-copy.ja.ts';
import { ko } from './agent-copy.ko.ts';
import { es } from './agent-copy.es.ts';
import { fr } from './agent-copy.fr.ts';
import { de } from './agent-copy.de.ts';
import { nl } from './agent-copy.nl.ts';
import { ptBR } from './agent-copy.pt-BR.ts';
import { it } from './agent-copy.it.ts';
import { ru } from './agent-copy.ru.ts';
import { pl } from './agent-copy.pl.ts';
import { tr } from './agent-copy.tr.ts';
import { vi } from './agent-copy.vi.ts';

/**
 * Copy for Agent permissions on the Settings › Agent providers, Skills and Privacy pages (design mock designs/cuccut/app/page-settings-agent.jsx, settings-agent-provider.jsx,
 * page-settings-skills.jsx, data.js `agent.policy`). The names and descriptions of the four access modes are in `copy.ts`, shared with the input box.
 * English is the source of keys and types; translations are in `agent-copy.<language>.ts`. Read the text when rendering or calling.
 */
const en = {
  /** Page title (design mock page-settings-agent.jsx, h1). */
  pageTitle: 'Agent providers',
  /** Accessible name for the column of three facts under the page title. */
  factsLabel: 'How Agents work',
  /** The “Agent permissions” subheading on the Privacy page (page-settings.jsx `setpage__perm`). */
  permissionsTitle: 'Agent permissions',
  lede: 'An Agent is an AI coding assistant installed on your computer, such as Claude Code or Codex. CucCut calls it directly, so a single sentence can get transcribing, translating and editing done.',
  /** The three facts (page-settings-agent.jsx:12-16). */
  facts: [
    { key: 'cli', title: 'Uses what you already have', body: "CucCut calls the command-line Agent on this computer instead of installing its own." },
    { key: 'plan', title: 'Uses your own subscription', body: 'No extra payment to CucCut, and no API key to fill in.' },
    { key: 'ask', title: 'Asks before changing anything', body: 'It stops and waits for your OK before writing to a video, and you can undo at any time.' },
  ] as readonly { key: 'cli' | 'plan' | 'ask'; title: string; body: string }[],

  providersHeading: 'Agents on this computer',
  providersHint:
    "CucCut finds the ones already installed. One working Agent is enough; you don't need them all. If unsure, pick Claude Code or Codex. Built-in ones can only be disabled; ones you added can be removed.",
  /** The line under the list: when it was last checked, how many built-in ones, how many added, and how many detected (page-settings-agent.jsx `agset-meta`). */
  providersMeta: (checked: string | null, builtin: number, added: number, found: number) =>
    `${checked ? `Checked ${checked} · ` : ''}CucCut has ${builtin} built-in ${builtin === 1 ? 'Agent' : 'Agents'}${added ? `, you added ${added}` : ''}; ${found} detected on this computer`,
  /** Accessible name for the status area. */
  statusLabel: 'Agent status',
  scanDone: (n: number) => (n ? `Check complete · ${n} ${n === 1 ? 'Agent' : 'Agents'} on this computer` : 'Check complete · No installed Agents found'),
  scanFailed: (message: string) => `Couldn't check again: ${message}`,
  enableFailed: (message: string) => `Couldn't enable: ${message}`,
  scanning: 'Checking…',
  rescan: 'Check again',
  emptyDisconnected: 'Connect to the Runtime to check for Agents on this computer.',
  emptyNoDrivers: "This version of the Runtime doesn't include any Agents.",
  emptyNoneFound: 'No Agents detected on this computer; the common ones are listed below.',
  scanProgress: 'Checking for Agents',
  faqLabel: 'FAQ',
  goCloudModels: 'Go to cloud models',
  goSkills: 'Go to Skills',

  /** The “More” collapsible section (page-settings-agent.jsx): the four ACP agents that were not detected are collapsed here. */
  moreProviders: {
    title: (count: number) => `Other supported Agents · ${count}`,
    sub: (names: string) => `${names} · None detected on this computer`,
    expand: 'Show',
    collapse: 'Hide',
  },

  /** The agents with “no per-action approval channel” (data.js `FULL_ONLY`): `capabilities.approvals` is false. */
  fullAccessOnly:
    "It has no way to ask for approval step by step, so CucCut can only run it in Full access mode: it won't ask you before running commands or changing files.",

  /** Agents with `tested` set to false: a session can be opened, but a full session has not been run end to end on a real machine in CucCut. */
  untested: {
    badge: 'Not tested in CucCut',
    body: "This one hasn't completed a full session in CucCut on a real machine. Detection, sign-in and the model list work as usual; for problems during a session, follow its own documentation.",
  },

  /** Add more Agents (settings-agent-catalog.jsx, product design §7.6). */
  catalog: {
    heading: 'Add more Agents',
    hint: "Other command-line Agents that support ACP (Agent Client Protocol) can be added too. CucCut hasn't verified them one by one; whether they work depends on the check result.",
    custom: 'Custom command…',
    search: 'Search Agents to add',
    searchPlaceholder: 'Search by name, description or command',
    count: (total: number) => `${total} in the catalog`,
    found: (n: number) => `${n} found`,
    list: 'Agents you can add',
    add: 'Add',
    addTo: (name: string) => `Add ${name}`,
    added: 'Added',
    empty: (query: string) => `Nothing in the catalog matches “${query}”. For an Agent that isn't listed, add it by entering its launch command.`,
    landed: (name: string, custom: boolean) => `Added ${name}${custom ? ' (custom command)' : ''} · Once detected, it can be used in sessions`,
    addFailed: (message: string) => `Couldn't add: ${message}`,
    webNote:
      "Agents can't be added or removed in the browser because this decides which commands run on this computer. Use the CucCut desktop app instead.",
  },

  /** Custom command dialog (settings-agent-catalog.jsx `AgentCustomDialog`). */
  customDialog: {
    title: 'Add an Agent with a custom command',
    lede: 'Enter the command that starts it in ACP mode in a terminal. CucCut starts the program directly, without a terminal.',
    name: 'Name',
    namePlaceholder: 'e.g. My Agent',
    id: 'id',
    idPlaceholder: 'my-agent',
    idHint: 'Identifies this Agent in settings and diagnostics: start with a lowercase letter and use only lowercase letters, digits and hyphens.',
    command: 'Command',
    commandPlaceholder: 'my-agent --acp',
    commandHint: 'Split into a program and arguments at spaces; quote arguments that contain spaces.',
    commandParts: (exe: string, args: string[]) => `Will start as: program ${exe}, arguments ${args.join(' · ')}`,
    env: 'Environment variables (optional)',
    envPlaceholder: 'MY_AGENT_TOKEN_FILE=~/.config/my-agent/token\nMY_AGENT_LOG=0',
    envHint: 'One KEY=VALUE per line, added only when CucCut starts it.',
    note: "After adding it, CucCut checks whether it starts, whether it needs signing in, and which models it has. It appears in sessions once it's detected.",
    cancel: 'Cancel',
    submit: 'Add',
    exists: (id: string) => `An Agent already uses “${id}”. Choose another id.`,
  },

  /** Card for the provider the user added (settings-agent-provider.jsx `AddedInstallPanel` and detail). */
  added: {
    chip: 'Added by you',
    detect: 'Check',
    detecting: 'Checking…',
    remove: 'Remove',
    subFound: (version: string | null) => ['Detected', version ? `v${version}` : null, 'Connected via ACP'].filter(Boolean).join(' · '),
    subLauncher: (launcher: string, needs: string) => `Not checked yet · ${launcher} downloads it at launch; requires ${needs}`,
    subMissing: (command: string) => `Not checked yet · ${command} not found on this computer`,
    note: (name: string) =>
      `${name} connects via ACP (Agent Client Protocol). CucCut hasn't verified it: for how to install it and which account to sign in with, follow its own documentation.`,
    noInstall: 'No separate install needed',
    noInstallBody: (launcher: string, spec: string, needs: string) =>
      `When CucCut starts it, ${launcher} downloads ${spec} automatically. Requires ${needs} on this computer.`,
    install: 'Install it on this computer following the official instructions',
    installBody: (command: string) => `Once installed, ${command} should run in a terminal.`,
    docs: 'Open official instructions',
    launch: 'CucCut starts it with this command',
    launchCopy: 'launch command',
    envNote: (keys: string[]) => `Adds the environment variables ${keys.join(', ')} at launch (values aren't shown here).`,
    login: 'If it needs signing in, sign in through it',
    loginBody: 'Follow its instructions in a terminal. Signing in happens in its own window; CucCut never handles your account or password.',
    detectStep: 'Check',
    detectBody: 'CucCut starts it once to confirm it connects, see whether it needs signing in, and get its model list.',
    launchRow: 'Launch command',
    launchRowHint: 'CucCut starts it with this command via ACP (Agent Client Protocol).',
    versionPinned: (spec: string) => `The launch command pins ${spec}. To change versions, remove it and add it again with a custom command.`,
    versionOwn: 'To upgrade, follow its own instructions, then check again here.',
    account: (name: string, signedOut: boolean) =>
      `${signedOut ? 'Not signed in, or the sign-in has expired. ' : ''}Sign-in and billing both happen in ${name}; CucCut never handles your account and doesn't charge extra.`,
    removeTitle: (name: string) => `Remove ${name}?`,
    removeBody: (name: string) =>
      `${name} will be removed from CucCut's Agent list, along with its enabled state and default model. If new sessions use it by default, another available Agent takes over. Tasks using it will end. The program installed on this computer isn't affected, and you can add it again later.`,
    removed: (name: string) => `Removed ${name}`,
    removeFailed: (message: string) => `Couldn't remove: ${message}`,
  },

  /**
   * The “Draw images with Codex” row (settings-agent-provider.jsx:103-119). The design mock says that once opened, the “Image” tab, the tools page and `ccut image` gain one “Draw images with Codex”.
   * Now it appears in `ccut image` and in the Agent's image generation tool within sessions. The name in the menu is the Provider's own “Codex”, stated as it is.
   */
  codexImage: {
    title: 'Draw with Codex',
    body: "No key needed; uses your Codex subscription. One image at a time, ignores size and quality, and 5–10× slower than the API. Once on, both ccut image and Agents in sessions can choose it (named “Codex”). It's never picked for you; to use it by default, set it as the default under Models › Image generation › Cloud models.",
    checking: 'Checking whether Codex on this computer can draw…',
    on: 'On',
    /** The full stop appended after the reason the Provider gives (not appended if the reason already ends with one). */
    period: '.',
    probeFailed: "Couldn't check whether Codex can draw · Click “Check again” to try again.",
    outdated: 'Codex is too old · Upgrade Codex CLI, then turn this on',
    signedOut: "Codex isn't signed in yet · Drawing uses your Codex account; sign in before turning this on.",
    notInstalled: "Codex wasn't found · Install Codex CLI and sign in before drawing.",
    unavailable: (detail: string | null) =>
      detail ? `Codex can't draw right now · ${detail}` : "Codex can't draw right now · Click “Check again” to try again.",
    turnedOn: 'Turned on Draw with Codex · Codex is now in the image generation model menu',
    turnedOff: 'Turned off Draw with Codex',
    toggleFailed: (enabled: boolean, message: string) =>
      enabled ? `Couldn't turn on Draw with Codex: ${message}` : `Couldn't turn off Draw with Codex: ${message}`,
  },

  /** Common questions (page-settings-agent.jsx:142-157). `link` is the button under the answer. */
  faq: [
    {
      key: 'cost',
      title: 'Do I need to pay or subscribe to CucCut separately?',
      body: "No. Agents use the Claude or ChatGPT subscription you already have, and cost and quota are counted there. CucCut ships no model of its own, collects no keys and relays nothing through the cloud. Without such a subscription you can skip Agents; the rest of CucCut works as usual.",
    },
    {
      key: 'account',
      title: 'Can CucCut see my account and password?',
      body: 'No. Signing in happens in the Agent’s own window. CucCut only starts that program on your computer and hands it the video. It asks you before changing a video; the rules are in Settings › Privacy & permissions.',
    },
    {
      key: 'cloud',
      title: 'How is an Agent different from cloud models?',
      body: 'An Agent uses the coding assistant on your computer with its own subscription and can carry out multi-step tasks. Cloud models run single tools directly with an API key and are billed by usage. The two are set up separately.',
      link: 'models',
    },
    {
      key: 'terminal',
      title: 'Want to drive CucCut with these Agents from a terminal?',
      body: 'Sessions in CucCut need no extra setup. To use them in a terminal or other apps, install the CucCut skill for them; see Settings › Skills.',
      link: 'skills',
    },
  ] as readonly { key: string; title: string; body: string; link?: 'models' | 'skills' }[],

  // ---- Agent permissions (Settings › Privacy & permissions; page-settings-agent.jsx:166-185) ----
  permissionsHeading: 'You decide when it asks first',
  policyHeading: 'Fewer repeated prompts',
  policyHint: 'These rules allow the matching actions automatically; the access mode also affects whether it asks.',
  /**
   * Copy for the three release policies. The design mock page renders `policyCopy` from page-settings-agent.jsx:20-24 (used at :158).
   * The label and desc in data.js `agent.policy` are not shown on screen; they only provide keys and defaults.
   */
  policy: {
    read: { label: 'Read video content', desc: 'Lets the assistant view transcripts and video settings without asking each time.' },
    ccutro: { label: 'Query videos and progress', desc: "Lets it check information and progress. These commands don't change the video." },
    loop: { label: 'Respond to running AI tasks', desc: 'Lets it receive tasks and submit answers, with fewer interruptions in multi-step work.' },
  } as Record<keyof AgentPolicy, { label: string; desc: string }>,
  accessModes: 'Access modes',
  firstDefault: 'Default at first',
  alwaysAllowed: 'Always-allowed commands',
  saveFailed: (message: string) => `Couldn't save: ${message}`,
  ruleRemoved: (rule: string) => `Removed rule ${rule}`,
  ruleRemoveFailed: (message: string) => `Couldn't remove the rule: ${message}`,
  /** Description for the access mode row: which tier is the default on first use, and which tier was chosen most recently. */
  modeHint: (firstDefault: string, last: string | null) =>
    `Choose the access mode below the input box of each session. The first time it defaults to “${firstDefault}”; after that, new sessions keep your latest choice${last ? ` (currently “${last}”)` : ''}.`,

  // ---- Advanced (page-settings-agent.jsx:167-183) ----
  advancedHeading: 'Advanced & troubleshooting',
  advancedHint: 'When the connection works, nothing here needs changing.',
  modelAutoUpdate: {
    label: 'Automatically update model lists',
    desc: "At launch and while running, regularly update each enabled Agent's own model list. When off, you can still refresh by hand in each Agent's details.",
  },
  executableHint:
    "CucCut looks in PATH and common install locations (Homebrew, npm's global folder, ~/.local/bin). Ones installed with a version manager (nvm, asdf, mise) are sometimes elsewhere; enter the executable's full path here. Leave it empty to go back to automatic lookup.",
  techPanel: 'Technical info and locations',
  techTitle: 'Agent technical info',
  techSubtitle: 'Versions, paths and available models',
  techEmpty: 'No check results yet.',
  techNotInstalled: '· Not installed',
  techNoModels: 'No model list reported',
  /** The noun in the copy button and the “Copied” hint. */
  pathLabel: 'path',
  diagnosticsLabel: 'diagnostics',
  copyDiagnostics: 'Copy diagnostics',
  locateTitle: "Set an Agent's location by hand",
  locateSubtitle: "For when automatic detection can't find it",

  /** Command block, in-app run, and manual location setting (agent-command-block.tsx). */
  command: {
    copied: (label: string) => `Copied ${label}`,
    copyFailed: "Couldn't copy. Select the text and copy it yourself.",
    copy: (label: string) => `Copy ${label}`,
    stop: 'Stop',
    run: 'Run this command',
    output: 'Command output',
    running: 'Running',
    runningText: 'Running…',
    done: 'Done',
    stopped: "Stopped. What already ran isn't rolled back; you can run it again.",
    failed: (reason: string) => `Didn't succeed (${reason}). The output above says why; if it needs a password, run it in a terminal.`,
    runInTerminal: 'Run in terminal',
    exitCode: (code: number) => `exit code ${code}`,
    startFailed: (error: string) => `couldn't start: ${error}`,
    killed: 'the process was terminated',
    confirmInstall: (name: string) => `Run the install command for ${name}?`,
    confirmUpgrade: (name: string) => `Run the upgrade command for ${name}?`,
    confirmRun: 'Run',
    cancel: 'Cancel',
    confirmBefore: 'CucCut will run the command below on this computer. Its output appears under the command, and you can stop it at any time.',
    confirmAfter: 'Commands that need a password fail here; run those in a terminal instead.',
    restored: (name: string) => `${name} is back to automatic lookup`,
    switched: (path: string) => `Now using ${path}`,
    notFoundAt: (path: string, command: string) => `No runnable ${command} found at ${path}`,
    saveFailed: (message: string) => `Couldn't save the location: ${message}`,
    locationLabel: (name: string) => `${name} location`,
    locationPlaceholder: (command: string) => `/full/path/${command}`,
    locationSaved: 'Set by hand. Clear it and save to go back to automatic lookup.',
    locationAuto: 'Empty = automatic lookup',
    save: 'Save',
    restoreAuto: 'Use automatic lookup',
  },

  // ---- Skills (product design §6.9; prototype settings-agent-skills.jsx, settings-agent-skill-detail.jsx) ----
  skills: {
    lede: "A skill is a folder (a SKILL.md, plus optional reference files) that teaches the Agents in CucCut to do things a certain way. With the switch on, an Agent uses it on its own when it seems relevant to the task; with it off, it's used only when you pick it from “+” in the input box. Turning skills on or off, adding or removing them takes effect from the next new Agent session.",
    search: 'Search skills',
    filter: 'Filter by source',
    tab: (label: string, count: number) => `${label} ${count}`,
    tabLabel: (label: string, count: number) => `${label}, ${count}`,
    add: 'Add skill',
    addFolder: 'Add from local folder',
    addGithub: 'Import from GitHub',
    loading: 'Loading skills…',
    loadFailed: (message: string) => `Couldn't load skills: ${message}`,
    retry: 'Try again',
    disconnected: 'Not connected to the CucCut Runtime. Skills are listed once connected.',
    emptyTitle: 'No skills yet',
    emptyBody:
      'There are no skills available here yet. Add a skill folder you wrote, or import one someone shared on GitHub. Third-party skills are off after import; look through them before turning them on.',
    emptyWeb: 'There are no skills available here yet. In the browser you can only view and toggle them; add and import them in the CucCut desktop app.',
    noMatch: (query: string) => `No skills found for “${query}”`,
    noMatchHint: 'Try another word, or switch to “All”.',
    noneInTab: (label: string) => `No ${label} skills yet`,
    webNote: 'In the browser you can view and toggle skills; add, import and remove them in the CucCut desktop app.',
    view: (name: string) => `View ${name}`,
    enable: (name: string) => `Enable ${name}`,
    toggledOn: (name: string) => `Turned on “${name}”: from the next new session, the Agent uses it on its own when relevant`,
    toggledOff: (name: string) => `Turned off “${name}”: from now on it's used only when you pick it from “+” in the input box`,
    added: (name: string) => `Added “${name}”`,
    imported: (name: string) => `Imported “${name}”, off by default`,
    removed: (name: string) => `Removed “${name}”`,
    diagnosticsTitle: (count: number) => `${count} ${count === 1 ? 'folder' : 'folders'} couldn't be loaded`,
    diagnosticsHint: "These folders aren't usable skills and were skipped. Fix them and come back to this page to reload.",
    diagnosticCode: { invalid: 'Invalid format', 'duplicate-id': 'Duplicate name', 'builtin-conflict': 'Same name as a built-in skill' } as Record<string, string>,
    /** The row for a skill that failed to load: folder · reason: the first problem. */
    diagnosticLine: (dir: string, reason: string, issue: string) => `${dir} · ${reason}: ${issue}`,
    externalTitle: 'Use CucCut from Agents in a terminal or other apps',
    externalBody:
      "The skills above are for the Agents inside CucCut. To teach Claude Code or Codex in a terminal to transcribe, translate, edit and export with CucCut, install the CucCut skill for them. One-click install to these Agents' global locations, plus seeing where it's installed and whether it needs updating, is coming in a later version.",
  },

  skillDetail: {
    close: 'Close',
    stateOn: 'On: the Agent uses it on its own when relevant.',
    stateOff: "Off: used only when you pick it from “+” in the input box.",
    thirdPartyNote:
      "Third-party skills come from repositories other people share: look through one before turning it on. CucCut never runs any file in a skill, and a skill can't widen an Agent's permissions.",
    source: 'Source',
    location: 'Location',
    version: 'Version',
    noVersion: 'Not specified',
    get reveal() {
      return revealLabel();
    },
    body: 'SKILL.md',
    emptyBody: 'Apart from the name and description at the top, SKILL.md has no other content.',
    files: (count: number) => `Files (${count})`,
    back: 'Back',
    notText: "Not a text file; not shown here",
    tooLarge: 'File too large; not shown here',
    loading: 'Loading…',
    loadFailed: (message: string) => `Couldn't load: ${message}`,
    remove: 'Remove',
    removeBuiltin: "Built-in skills can't be removed, but you can turn them off.",
    removeTitle: (name: string) => `Remove “${name}”?`,
    removeBody: (path: string) => `This deletes the folder ${path} and every file in it, and can't be undone. Sessions already running aren't affected.`,
    cancel: 'Cancel',
  },

  skillGithub: {
    title: 'Import from GitHub',
    label: 'Repository URL',
    placeholder: 'owner/repo',
    description: 'You can also paste a full URL, e.g. https://github.com/owner/repo/tree/main/skills/name',
    note: "Only downloads the files in the folder this URL points to, and never runs any of them. Imported skills count as “Third-party” and are off by default: they're used only when you pick them from “+” in the input box. Look through the content before deciding to turn one on.",
    submit: 'Import',
    pending: 'Downloading from GitHub…',
    cancel: 'Cancel',
  },
};

export type AgentMessages = typeof en;

/** This page's copy catalog: read it when rendering or calling (`AGENT_COPY.lede`). */
export const AGENT_COPY = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
const M = AGENT_COPY;

export const AGENT_FACTS = live(() => M.facts);
export const providersMeta = (checked: string | null, builtin: number, added: number, found: number) => M.providersMeta(checked, builtin, added, found);
export const MORE_PROVIDERS = live(() => M.moreProviders);
export const UNTESTED = live(() => M.untested);
export const CATALOG_COPY = live(() => M.catalog);
export const CUSTOM_DIALOG_COPY = live(() => M.customDialog);
export const ADDED_COPY = live(() => M.added);
export const CODEX_IMAGE_COPY = live(() => M.codexImage);
export const AGENT_FAQ = live(() => M.faq);
export const POLICY_COPY = live(() => M.policy);
export const POLICY_KEYS: readonly (keyof AgentPolicy)[] = ['read', 'ccutro', 'loop'];
export const MODEL_AUTO_UPDATE = live(() => M.modelAutoUpdate);
export const SKILLS_COPY = live(() => M.skills);
export const SKILL_DETAIL_COPY = live(() => M.skillDetail);
export const SKILL_GITHUB_COPY = live(() => M.skillGithub);
