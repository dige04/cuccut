/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type { FileListing, FileListingEntry } from "./read-retries";

/** A design system copied into the project (`designSystems` rows of the deck index), normalized. */
export interface InstalledDesignSystem {
  title: string;
  namespace: string;
  /** The artifact the system was copied from. */
  artifact: string;
  version: string | null;
  copiedAt: string;
  unpinned?: boolean;
}

/** One `designSystems` row as stored in the deck index (untrusted JSON until normalized). */
interface StoredDesignSystemRow {
  title?: unknown;
  artifact?: unknown;
  namespace?: unknown;
  version?: unknown;
  copiedAt?: unknown;
  unpinned?: unknown;
}

/** Cached token file of one installed design system. */
interface DesignSystemFileCacheEntry {
  /** Content hash the text was read at. */
  sha: string;
  text: string | undefined;
}

/** The part of a deck index that lists installed design systems (array or keyed object, as stored). */
export interface DesignSystemIndexLike {
  designSystems?: unknown;
}

/** One design system's tokens as handed to the compiler. */
export interface DesignSystemTokenEntry {
  title?: string;
  tokens: object;
}

/** Tokens of all installed design systems (`v: 1` document). */
export interface InstalledDesignSystemTokens {
  v: 1;
  systems: DesignSystemTokenEntry[];
}

/** Fonts/tokens document the host may already hold; its `systems` are kept when no installed system has the same title. */
export interface AvailableDesignSystemTokens {
  systems?: DesignSystemTokenEntry[];
  color?: unknown;
  type?: unknown;
}

/** A read-only text lookup for already loaded files. */
export type DesignSystemTextReader = (path: string) => string | undefined;

/** What the tracker reads from the files port. */
export interface InstalledDesignSystemTrackerPort {
  list(): Promise<FileListing>;
  readText(path: string): Promise<{ text: string }>;
}

export interface InstalledDesignSystemTracker {
  /** Tokens from the last completed refresh. */
  current(): InstalledDesignSystemTokens | undefined;
  /** Re-reads the installed systems' token files when the index or the files version changed. */
  refresh(index: DesignSystemIndexLike | null | undefined): void;
}

/** Error for a design system path or namespace that is not allowed. */
export interface DesignSystemPathErrorInstance extends Error {
  code: string;
  subject: unknown;
}
export type DesignSystemPathErrorConstructor = new (
  code: string,
  subject?: unknown,
) => DesignSystemPathErrorInstance;

/** Why an install request is rejected, by rejection kind. */
export type DesignSystemInstallRejectionMessages = Record<
  "kind" | "name" | "react" | "tool" | "disk",
  string
>;

declare module "../bindings" {
  interface RuntimeBindings {
    DESIGN_SYSTEM_NAMESPACE_PATTERN: RegExp;
    isValidDesignSystemNamespace: (namespace: unknown) => namespace is string;
    DesignSystemPathError: DesignSystemPathErrorConstructor;
    designSystemDirectory: (namespace: string) => string;
    MAX_INSTALLED_DESIGN_SYSTEMS: number;
    DESIGN_SYSTEM_NAME_MAX_CHARS: number;
    DESIGN_SYSTEM_DESCRIPTION_MAX_CHARS: number;
    DESIGN_SYSTEM_REFERENCE_MAX_CHARS: number;
    DESIGN_SYSTEM_TOKENS_MAX_CHARS: number;
    /** Regular-expression source (not a RegExp) matching one path segment. */
    DESIGN_SYSTEM_PATH_SEGMENT_PATTERN: string;
    DESIGN_SYSTEM_PATH_PATTERN: RegExp;
    DESIGN_SYSTEM_UNSAFE_CONTROL_PATTERN: RegExp;
    DESIGN_SYSTEM_DESCRIPTION_CONTROL_PATTERN: RegExp;
    normalizeDesignSystemText: (
      value: unknown,
      maxChars: number,
      forbiddenPattern?: RegExp,
    ) => string | undefined;
    readInstalledDesignSystems: (
      index: DesignSystemIndexLike | null | undefined,
    ) => InstalledDesignSystem[];
    designSystemTokensPath: (namespace: string) => string;
    readInstalledDesignSystemTokens: (
      index: DesignSystemIndexLike | null | undefined,
      readText: DesignSystemTextReader,
      availableFonts?: AvailableDesignSystemTokens | null,
    ) => InstalledDesignSystemTokens | undefined;
    /** Regular-expression sources (not RegExps) for artifact ids. */
    ARTIFACT_UUID_PATTERN: string;
    ARTIFACT_SHORT_ID_PATTERN: string;
    ARTIFACT_ID_PATTERN: RegExp;
    DESIGN_SYSTEM_ARTIFACT_URL_PATTERN: RegExp;
    /** Hosts a design system may be installed from by URL (none in CucCut). */
    DESIGN_SYSTEM_ALLOWED_HOSTS: Record<string, unknown>;
    DESIGN_SYSTEM_UNKNOWN_HOST_MESSAGE: string;
    ARTIFACT_REFERENCE_URL_PATTERN: RegExp;
    DESIGN_SYSTEM_INSTALL_REJECTION_MESSAGES: DesignSystemInstallRejectionMessages;
    DESIGN_SYSTEM_INSTALL_REQUEST_FILENAME: string;
    DESIGN_SYSTEM_INSTALL_COMMAND_HELP: string;
    DESIGN_SYSTEM_INSTALL_DETAILS: string;
    createInstalledDesignSystemTracker: (
      port: InstalledDesignSystemTrackerPort,
      getVersion: () => string,
      onChange: () => void,
    ) => InstalledDesignSystemTracker;
  }
}

export function installFilesDesignSystems(
  runtime: RuntimeBindings,
): () => void {
  var DESIGN_SYSTEM_NAMESPACE_PATTERN: RegExp;
  var DesignSystemPathError: DesignSystemPathErrorConstructor;
  var MAX_INSTALLED_DESIGN_SYSTEMS: number;
  var DESIGN_SYSTEM_NAME_MAX_CHARS: number;
  var DESIGN_SYSTEM_DESCRIPTION_MAX_CHARS: number;
  var DESIGN_SYSTEM_REFERENCE_MAX_CHARS: number;
  var DESIGN_SYSTEM_TOKENS_MAX_CHARS: number;
  var DESIGN_SYSTEM_PATH_SEGMENT_PATTERN: string;
  var DESIGN_SYSTEM_PATH_PATTERN: RegExp;
  var DESIGN_SYSTEM_UNSAFE_CONTROL_PATTERN: RegExp;
  var DESIGN_SYSTEM_DESCRIPTION_CONTROL_PATTERN: RegExp;
  var normalizeDesignSystemText: (
    value: unknown,
    maxChars: number,
    forbiddenPattern?: RegExp,
  ) => string | undefined;
  var ARTIFACT_UUID_PATTERN: string;
  var ARTIFACT_SHORT_ID_PATTERN: string;
  var ARTIFACT_ID_PATTERN: RegExp;
  var DESIGN_SYSTEM_ARTIFACT_URL_PATTERN: RegExp;
  var DESIGN_SYSTEM_ALLOWED_HOSTS: Record<string, unknown>;
  var DESIGN_SYSTEM_UNKNOWN_HOST_MESSAGE: string;
  var ARTIFACT_REFERENCE_URL_PATTERN: RegExp;
  var DESIGN_SYSTEM_INSTALL_REJECTION_MESSAGES: DesignSystemInstallRejectionMessages;
  var DESIGN_SYSTEM_INSTALL_REQUEST_FILENAME: string;
  var DESIGN_SYSTEM_INSTALL_COMMAND_HELP: string;
  var DESIGN_SYSTEM_INSTALL_DETAILS: string;
  function isValidDesignSystemNamespace(namespace: unknown): namespace is string {
    return (
      typeof namespace === "string" &&
      DESIGN_SYSTEM_NAMESPACE_PATTERN.test(namespace)
    );
  }
  function designSystemDirectory(namespace: string): string {
    if (!isValidDesignSystemNamespace(namespace)) {
      throw new DesignSystemPathError("bad_namespace", String(namespace));
    }
    return "project/ds/" + namespace + "/";
  }
  function readInstalledDesignSystems(
    index: DesignSystemIndexLike | null | undefined,
  ): InstalledDesignSystem[] {
    let designSystems = index?.designSystems,
      entries: unknown[] = Array.isArray(designSystems)
        ? designSystems
        : typeof designSystems === "object" && designSystems !== null
          ? Object.values(designSystems)
          : [],
      systemsByNamespace = new Map<string, InstalledDesignSystem>();
    for (let value of entries) {
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        continue;
      }
      let value2 = value as StoredDesignSystemRow,
        value3 = normalizeDesignSystemText(
          value2.title,
          DESIGN_SYSTEM_NAME_MAX_CHARS,
          DESIGN_SYSTEM_DESCRIPTION_CONTROL_PATTERN,
        ),
        value4 = normalizeDesignSystemText(
          value2.artifact,
          DESIGN_SYSTEM_DESCRIPTION_MAX_CHARS,
        );
      if (
        !isValidDesignSystemNamespace(value2.namespace) ||
        value3 === undefined ||
        value4 === undefined
      ) {
        continue;
      }
      systemsByNamespace.set(value2.namespace, {
        title: value3,
        namespace: value2.namespace,
        artifact: value4,
        version:
          normalizeDesignSystemText(
            value2.version,
            DESIGN_SYSTEM_NAME_MAX_CHARS,
          ) ?? null,
        copiedAt: normalizeDesignSystemText(value2.copiedAt, 40) ?? "",
        ...(value2.unpinned === true
          ? {
              unpinned: true,
            }
          : {}),
      });
    }
    return [...systemsByNamespace.values()].slice(
      0,
      MAX_INSTALLED_DESIGN_SYSTEMS,
    );
  }
  function designSystemTokensPath(namespace: string): string {
    return designSystemDirectory(namespace) + "tokens.json";
  }
  function readInstalledDesignSystemTokens(
    index: DesignSystemIndexLike | null | undefined,
    readText: DesignSystemTextReader,
    availableFonts?: AvailableDesignSystemTokens | null,
  ): InstalledDesignSystemTokens | undefined {
    let systems: DesignSystemTokenEntry[] = [];
    for (let value4 of readInstalledDesignSystems(index)) {
      let value5 = readText(designSystemTokensPath(value4.namespace));
      if (
        value5 === undefined ||
        value5.length > DESIGN_SYSTEM_TOKENS_MAX_CHARS
      ) {
        continue;
      }
      try {
        let value6: unknown = JSON.parse(value5);
        if (typeof value6 === "object" && value6 !== null) {
          systems.push({
            title: value4.title,
            tokens: value6,
          });
        }
      } catch {
        continue;
      }
    }
    if (systems.length === 0) {
      return;
    }
    let value: AvailableDesignSystemTokens =
        typeof availableFonts === "object" && availableFonts !== null
          ? availableFonts
          : {},
      callback = (input: unknown): boolean =>
        typeof input === "object" && input !== null,
      value2: DesignSystemTokenEntry[] | undefined = Array.isArray(
        value.systems,
      )
        ? value.systems
        : value.systems === undefined &&
            (callback(value.color) || callback(value.type))
          ? [
              {
                tokens: availableFonts as AvailableDesignSystemTokens,
              },
            ]
          : undefined,
      value3 = Array.isArray(value2)
        ? value2.filter(
            (input) =>
              !systems.some((input2) => input2.title === input?.title),
          )
        : [];
    return {
      v: 1,
      systems: [...systems, ...value3],
    };
  }
  function createInstalledDesignSystemTracker(
    port: InstalledDesignSystemTrackerPort,
    getVersion: () => string,
    onChange: () => void,
  ): InstalledDesignSystemTracker {
    let refreshVersion = "",
      generation = 0,
      systems: InstalledDesignSystemTokens | undefined,
      currentFingerprint = "",
      fileCache = new Map<string, DesignSystemFileCacheEntry>(),
      updateSystems = (
        input: DesignSystemIndexLike | null | undefined,
        options: string,
      ): void => {
        if (options === currentFingerprint) {
          return;
        }
        currentFingerprint = options;
        systems = readInstalledDesignSystemTokens(
          input,
          (input2) => fileCache.get(input2)?.text,
        );
        onChange();
      };
    return {
      current: () => systems,
      refresh(input: DesignSystemIndexLike | null | undefined): void {
        let value = readInstalledDesignSystems(input),
          value2 = JSON.stringify(value),
          value3 =
            (value.length === 0 ? "" : getVersion()) + "|" + value2;
        if (value3 === refreshVersion) {
          return;
        }
        refreshVersion = value3;
        let value4 = ++generation;
        if (value.length === 0) {
          fileCache.clear();
          if (systems !== undefined) {
            updateSystems(input, value2);
          }
          return;
        }
        let value5 = value.map((input2) =>
          designSystemTokensPath(input2.namespace),
        );
        port
          .list()
          .then(async (input2) => {
            if (value4 !== generation) {
              return;
            }
            let entries = new Map<string, FileListingEntry>(
                input2.map((input3): [string, FileListingEntry] => [
                  input3.path,
                  input3,
                ]),
              ),
              flag = false;
            for (let value6 of value5) {
              let entry = entries.get(value6),
                entry2 = fileCache.get(value6);
              if (
                entry === undefined ||
                entry.size > DESIGN_SYSTEM_TOKENS_MAX_CHARS
              ) {
                fileCache.set(value6, {
                  sha: entry?.sha256 ?? "",
                  text: undefined,
                });
              } else if (
                entry2 === undefined ||
                entry2.sha !== entry.sha256 ||
                entry2.text === undefined
              ) {
                let value7 = await port.readText(value6).then(
                  (input3) => input3.text,
                  () => {
                    return;
                  },
                );
                if (value4 !== generation) {
                  return;
                }
                if (value7 !== undefined) {
                  fileCache.set(value6, {
                    sha: entry.sha256,
                    text: value7,
                  });
                } else if (((flag = true), entry2 === undefined)) {
                  fileCache.set(value6, {
                    sha: "",
                    text: undefined,
                  });
                }
              }
            }
            for (let value6 of [...fileCache.keys()])
              if (!value5.includes(value6)) {
                fileCache.delete(value6);
              }
            if (value4 !== generation) {
              return;
            }
            if (flag) {
              refreshVersion = "";
            }
            updateSystems(
              input,
              value2 +
                "|" +
                value5
                  .map(
                    (input3) =>
                      (fileCache.get(input3)?.text === undefined ? "!" : "") +
                      (fileCache.get(input3)?.sha ?? ""),
                  )
                  .join(","),
            );
          })
          .catch(() => {
            if (value4 === generation) {
              refreshVersion = "";
            }
          });
      },
    };
  }
  bindRuntimeValue(
    runtime,
    "DESIGN_SYSTEM_NAMESPACE_PATTERN",
    () => DESIGN_SYSTEM_NAMESPACE_PATTERN,
    (value) => {
      DESIGN_SYSTEM_NAMESPACE_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isValidDesignSystemNamespace",
    () => isValidDesignSystemNamespace,
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemPathError",
    () => DesignSystemPathError,
    (value) => {
      DesignSystemPathError = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "designSystemDirectory",
    () => designSystemDirectory,
  );
  bindRuntimeValue(
    runtime,
    "MAX_INSTALLED_DESIGN_SYSTEMS",
    () => MAX_INSTALLED_DESIGN_SYSTEMS,
    (value) => {
      MAX_INSTALLED_DESIGN_SYSTEMS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DESIGN_SYSTEM_NAME_MAX_CHARS",
    () => DESIGN_SYSTEM_NAME_MAX_CHARS,
    (value) => {
      DESIGN_SYSTEM_NAME_MAX_CHARS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DESIGN_SYSTEM_DESCRIPTION_MAX_CHARS",
    () => DESIGN_SYSTEM_DESCRIPTION_MAX_CHARS,
    (value) => {
      DESIGN_SYSTEM_DESCRIPTION_MAX_CHARS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DESIGN_SYSTEM_REFERENCE_MAX_CHARS",
    () => DESIGN_SYSTEM_REFERENCE_MAX_CHARS,
    (value) => {
      DESIGN_SYSTEM_REFERENCE_MAX_CHARS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DESIGN_SYSTEM_TOKENS_MAX_CHARS",
    () => DESIGN_SYSTEM_TOKENS_MAX_CHARS,
    (value) => {
      DESIGN_SYSTEM_TOKENS_MAX_CHARS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DESIGN_SYSTEM_PATH_SEGMENT_PATTERN",
    () => DESIGN_SYSTEM_PATH_SEGMENT_PATTERN,
    (value) => {
      DESIGN_SYSTEM_PATH_SEGMENT_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DESIGN_SYSTEM_PATH_PATTERN",
    () => DESIGN_SYSTEM_PATH_PATTERN,
    (value) => {
      DESIGN_SYSTEM_PATH_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DESIGN_SYSTEM_UNSAFE_CONTROL_PATTERN",
    () => DESIGN_SYSTEM_UNSAFE_CONTROL_PATTERN,
    (value) => {
      DESIGN_SYSTEM_UNSAFE_CONTROL_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DESIGN_SYSTEM_DESCRIPTION_CONTROL_PATTERN",
    () => DESIGN_SYSTEM_DESCRIPTION_CONTROL_PATTERN,
    (value) => {
      DESIGN_SYSTEM_DESCRIPTION_CONTROL_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizeDesignSystemText",
    () => normalizeDesignSystemText,
    (value) => {
      normalizeDesignSystemText = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "readInstalledDesignSystems",
    () => readInstalledDesignSystems,
  );
  bindRuntimeValue(
    runtime,
    "designSystemTokensPath",
    () => designSystemTokensPath,
  );
  bindRuntimeValue(
    runtime,
    "readInstalledDesignSystemTokens",
    () => readInstalledDesignSystemTokens,
  );
  bindRuntimeValue(
    runtime,
    "ARTIFACT_UUID_PATTERN",
    () => ARTIFACT_UUID_PATTERN,
    (value) => {
      ARTIFACT_UUID_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ARTIFACT_SHORT_ID_PATTERN",
    () => ARTIFACT_SHORT_ID_PATTERN,
    (value) => {
      ARTIFACT_SHORT_ID_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ARTIFACT_ID_PATTERN",
    () => ARTIFACT_ID_PATTERN,
    (value) => {
      ARTIFACT_ID_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DESIGN_SYSTEM_ARTIFACT_URL_PATTERN",
    () => DESIGN_SYSTEM_ARTIFACT_URL_PATTERN,
    (value) => {
      DESIGN_SYSTEM_ARTIFACT_URL_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DESIGN_SYSTEM_ALLOWED_HOSTS",
    () => DESIGN_SYSTEM_ALLOWED_HOSTS,
    (value) => {
      DESIGN_SYSTEM_ALLOWED_HOSTS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DESIGN_SYSTEM_UNKNOWN_HOST_MESSAGE",
    () => DESIGN_SYSTEM_UNKNOWN_HOST_MESSAGE,
    (value) => {
      DESIGN_SYSTEM_UNKNOWN_HOST_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ARTIFACT_REFERENCE_URL_PATTERN",
    () => ARTIFACT_REFERENCE_URL_PATTERN,
    (value) => {
      ARTIFACT_REFERENCE_URL_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DESIGN_SYSTEM_INSTALL_REJECTION_MESSAGES",
    () => DESIGN_SYSTEM_INSTALL_REJECTION_MESSAGES,
    (value) => {
      DESIGN_SYSTEM_INSTALL_REJECTION_MESSAGES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DESIGN_SYSTEM_INSTALL_REQUEST_FILENAME",
    () => DESIGN_SYSTEM_INSTALL_REQUEST_FILENAME,
    (value) => {
      DESIGN_SYSTEM_INSTALL_REQUEST_FILENAME = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DESIGN_SYSTEM_INSTALL_COMMAND_HELP",
    () => DESIGN_SYSTEM_INSTALL_COMMAND_HELP,
    (value) => {
      DESIGN_SYSTEM_INSTALL_COMMAND_HELP = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DESIGN_SYSTEM_INSTALL_DETAILS",
    () => DESIGN_SYSTEM_INSTALL_DETAILS,
    (value) => {
      DESIGN_SYSTEM_INSTALL_DETAILS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createInstalledDesignSystemTracker",
    () => createInstalledDesignSystemTracker,
  );
  return () => {
    DESIGN_SYSTEM_NAMESPACE_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
    DesignSystemPathError = class DesignSystemPathError extends Error {
      declare name: string;
      code: string;
      subject: unknown;
      constructor(input: string, options?: unknown) {
        super(input + ": " + JSON.stringify(options));
        this.code = input;
        this.subject = options;
        this.name = "PathCheckError";
      }
    };
    MAX_INSTALLED_DESIGN_SYSTEMS = 4;
    DESIGN_SYSTEM_NAME_MAX_CHARS = 200;
    DESIGN_SYSTEM_DESCRIPTION_MAX_CHARS = 2000;
    DESIGN_SYSTEM_REFERENCE_MAX_CHARS = 224;
    DESIGN_SYSTEM_TOKENS_MAX_CHARS = 1048576;
    DESIGN_SYSTEM_PATH_SEGMENT_PATTERN =
      "[A-Za-z0-9_](?:(?:[A-Za-z0-9._-]| (?=[A-Za-z0-9_]))*[A-Za-z0-9_-])?";
    DESIGN_SYSTEM_PATH_PATTERN = new RegExp(
      "^" +
        DESIGN_SYSTEM_PATH_SEGMENT_PATTERN +
        "(?:/" +
        DESIGN_SYSTEM_PATH_SEGMENT_PATTERN +
        ")*$",
    );
    DESIGN_SYSTEM_UNSAFE_CONTROL_PATTERN =
      /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069\u{e0000}-\u{e007f}]/u;
    DESIGN_SYSTEM_DESCRIPTION_CONTROL_PATTERN =
      /[\u0000-\u001f\u007f-\u009f\u061c\u2028\u2029\u202a-\u202e\u2066-\u2069\u{e0000}-\u{e007f}]/u;
    normalizeDesignSystemText = (
      value: unknown,
      maxChars: number,
      forbiddenPattern: RegExp = DESIGN_SYSTEM_UNSAFE_CONTROL_PATTERN,
    ): string | undefined =>
      typeof value === "string" &&
      value.trim() !== "" &&
      value.length <= maxChars &&
      !forbiddenPattern.test(value)
        ? value.trim()
        : undefined;
    ARTIFACT_UUID_PATTERN =
      "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
    ARTIFACT_SHORT_ID_PATTERN = "[1-9A-HJ-NP-Za-km-z]{22}";
    ARTIFACT_ID_PATTERN = new RegExp(
      "^(" + ARTIFACT_UUID_PATTERN + "|" + ARTIFACT_SHORT_ID_PATTERN + ")$",
    );
    DESIGN_SYSTEM_ARTIFACT_URL_PATTERN = new RegExp(
      "^[hH][tT][tT][pP][sS]://([A-Za-z0-9.-]{1,253})(/code/artifact/|/artifact/|/code/frame/)(?:[A-Za-z0-9_-]*-)?(" +
        ARTIFACT_UUID_PATTERN +
        "|" +
        ARTIFACT_SHORT_ID_PATTERN +
        ")/*$",
    );
    // CucCut: design systems are not installed from hosted artifact addresses; only bare ids reach the install.
    DESIGN_SYSTEM_ALLOWED_HOSTS = {};
    DESIGN_SYSTEM_UNKNOWN_HOST_MESSAGE =
      "The address given for the design system is on a host this tool does not know (it knows " +
      Object.keys(DESIGN_SYSTEM_ALLOWED_HOSTS).join(", ") +
      ", over https, with no port): on a local or a staging stack give the design system's bare id instead.";
    ARTIFACT_REFERENCE_URL_PATTERN = new RegExp(
      "^[hH][tT][tT][pP][sS]?://[^/?#\\s]{1,260}(?:/code/artifact/|/artifact/|/code/frame/)(?:[A-Za-z0-9_-]*-)?(?:" +
        ARTIFACT_UUID_PATTERN +
        "|" +
        ARTIFACT_SHORT_ID_PATTERN +
        ")/*$",
    );
    DESIGN_SYSTEM_INSTALL_REJECTION_MESSAGES = {
      kind: "Not a kind of file an install copies yet (it copies .js, .css, .json, .d.ts and font files)",
      name:
        'A folder or file name in its path that an install does not take (a name is letters, digits, ".", "_", "-" and single spaces, each space straight before a letter, a digit or "_"; it begins with a letter, a digit or "_" and does not end in "."), or ".." in it, a device name such as "con", or more than ' +
        String(DESIGN_SYSTEM_REFERENCE_MAX_CHARS) +
        " characters",
      react: "A copy of React, which the page already has",
      tool: "A name a build tool or a test runner looks for, such as package.json or x.test.js",
      disk:
        'A path this install does not save to disk when the bytes are sent: a space in it, a name that begins with "_" and then anything but a letter or a digit, or, for a font that is not directly under fonts/, "..", a device name such as "con" or more than ' +
        String(DESIGN_SYSTEM_REFERENCE_MAX_CHARS) +
        " characters",
    };
    DESIGN_SYSTEM_INSTALL_REQUEST_FILENAME = "ds-install.json";
    DESIGN_SYSTEM_INSTALL_COMMAND_HELP =
      "install-design-system --request " +
      DESIGN_SYSTEM_INSTALL_REQUEST_FILENAME +
      ` (a JSON file you wrote in the working directory with your file-writing tool)
The file holds exactly these keys: {"artifact": "<the system's url>", "namespace": "<its bundle global, else a plain name>", "title": "<its title>", "version": "<its version id>" or null, "files": [{"path": "<path in the system>", "size": <bytes>}, ...], "index": "<the project/canvas.json or project/deck.json you read with read_file right before this, at the path it was saved>", "held": {"files": <n>, "bytes": <n>} (what the project holds outside this system's folder), "has": ["<a path the project holds>", ...]}; artifact, namespace, title, files and index are required, and held too when a canvas is brought more than four scripts, stylesheets and JSON files, at least one of them new. Add "fromStore": true ONLY for a system that serves no files to copy, whose bytes you send.
(values that come from the design system go in that file, written with your file-writing tool, never on the command line: nothing of theirs is read by the shell)`;
    DESIGN_SYSTEM_INSTALL_DETAILS =
      `install-design-system takes nothing on the command line but --request <file>. A title, a name, a version or a path that comes from the design system is another artifact's text and must never be part of a command: write the values to a JSON file with your file-writing tool (not echo, printf or a heredoc) and pass only that file's path.
usage: ` + DESIGN_SYSTEM_INSTALL_COMMAND_HELP;
  };
}
