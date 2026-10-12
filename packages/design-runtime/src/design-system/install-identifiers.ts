/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installDesignSystemInstallIdentifiers(
  runtime: RuntimeBindings,
): () => void {
  var uuidPatternSource: Dynamic;
  var base58ArtifactIdPatternSource: Dynamic;
  var artifactIdPattern: Dynamic;
  var artifactUrlPattern: Dynamic;
  var DesignSystemInstallIdentifiersClaudeAiClaudeComPreviewClaudeAiConfig: Dynamic;
  var DesignSystemInstallIdentifiersResolvedValue: Dynamic;
  var standaloneArtifactUrlPattern: Dynamic;
  var DesignSystemInstallIdentifiersKindNameReactConfig: Dynamic;
  var DsInstallJsonValue: Dynamic;
  var DesignSystemInstallIdentifiersResolvedValue_2: Dynamic;
  var DesignSystemInstallIdentifiersResolvedValue_3: Dynamic;
  var DesignSystemInstallIdentifiersResolvedValue_4: Dynamic;
  var DesignSystemInstallIdentifiersResolvedValue_5: Dynamic;

  bindRuntimeValue(
    runtime,
    "uuidPatternSource",
    () => uuidPatternSource,
    (value) => {
      uuidPatternSource = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "base58ArtifactIdPatternSource",
    () => base58ArtifactIdPatternSource,
    (value) => {
      base58ArtifactIdPatternSource = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "artifactIdPattern",
    () => artifactIdPattern,
    (value) => {
      artifactIdPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "artifactUrlPattern",
    () => artifactUrlPattern,
    (value) => {
      artifactUrlPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemInstallIdentifiersClaudeAiClaudeComPreviewClaudeAiConfig",
    () => DesignSystemInstallIdentifiersClaudeAiClaudeComPreviewClaudeAiConfig,
    (value) => {
      DesignSystemInstallIdentifiersClaudeAiClaudeComPreviewClaudeAiConfig =
        value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemInstallIdentifiersResolvedValue",
    () => DesignSystemInstallIdentifiersResolvedValue,
    (value) => {
      DesignSystemInstallIdentifiersResolvedValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "standaloneArtifactUrlPattern",
    () => standaloneArtifactUrlPattern,
    (value) => {
      standaloneArtifactUrlPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemInstallIdentifiersKindNameReactConfig",
    () => DesignSystemInstallIdentifiersKindNameReactConfig,
    (value) => {
      DesignSystemInstallIdentifiersKindNameReactConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DsInstallJsonValue",
    () => DsInstallJsonValue,
    (value) => {
      DsInstallJsonValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemInstallIdentifiersResolvedValue_2",
    () => DesignSystemInstallIdentifiersResolvedValue_2,
    (value) => {
      DesignSystemInstallIdentifiersResolvedValue_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemInstallIdentifiersResolvedValue_3",
    () => DesignSystemInstallIdentifiersResolvedValue_3,
    (value) => {
      DesignSystemInstallIdentifiersResolvedValue_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemInstallIdentifiersResolvedValue_4",
    () => DesignSystemInstallIdentifiersResolvedValue_4,
    (value) => {
      DesignSystemInstallIdentifiersResolvedValue_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemInstallIdentifiersResolvedValue_5",
    () => DesignSystemInstallIdentifiersResolvedValue_5,
    (value) => {
      DesignSystemInstallIdentifiersResolvedValue_5 = value;
    },
  );
  return () => {
    uuidPatternSource =
      "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
    base58ArtifactIdPatternSource = "[1-9A-HJ-NP-Za-km-z]{22}";
    artifactIdPattern = new RegExp(
      "^(" + uuidPatternSource + "|" + base58ArtifactIdPatternSource + ")$",
    );
    artifactUrlPattern = new RegExp(
      "^[hH][tT][tT][pP][sS]://([A-Za-z0-9.-]{1,253})(/code/artifact/|/artifact/|/code/frame/)(?:[A-Za-z0-9_-]*-)?(" +
        uuidPatternSource +
        "|" +
        base58ArtifactIdPatternSource +
        ")/*$",
    );
    // CucCut: design systems are not installed from hosted artifact addresses; only bare ids reach the install.
    DesignSystemInstallIdentifiersClaudeAiClaudeComPreviewClaudeAiConfig = {};
    DesignSystemInstallIdentifiersResolvedValue =
      "The address given for the design system is on a host this tool does not know (it knows " +
      Object.keys(
        DesignSystemInstallIdentifiersClaudeAiClaudeComPreviewClaudeAiConfig,
      ).join(", ") +
      ", over https, with no port): on a local or a staging stack give the design system's bare id instead.";
    standaloneArtifactUrlPattern = new RegExp(
      "^[hH][tT][tT][pP][sS]?://[^/?#\\s]{1,260}(?:/code/artifact/|/artifact/|/code/frame/)(?:[A-Za-z0-9_-]*-)?(?:" +
        uuidPatternSource +
        "|" +
        base58ArtifactIdPatternSource +
        ")/*$",
    );
    DesignSystemInstallIdentifiersKindNameReactConfig = {
      kind: "Not a kind of file an install copies yet (it copies .js, .css, .json, .d.ts and font files)",
      name:
        'A folder or file name in its path that an install does not take (a name is letters, digits, ".", "_", "-" and single spaces, each space straight before a letter, a digit or "_"; it begins with a letter, a digit or "_" and does not end in "."), or ".." in it, a device name such as "con", or more than ' +
        String(runtime.DesignSystemPathsConstant_4) +
        " characters",
      react: "A copy of React, which the page already has",
      tool: "A name a build tool or a test runner looks for, such as package.json or x.test.js",
      disk:
        'A path this install does not save to disk when the bytes are sent: a space in it, a name that begins with "_" and then anything but a letter or a digit, or, for a font that is not directly under fonts/, "..", a device name such as "con" or more than ' +
        String(runtime.DesignSystemPathsConstant_4) +
        " characters",
    };
    DsInstallJsonValue = "ds-install.json";
    DesignSystemInstallIdentifiersResolvedValue_2 = 4 * 1024 * 1024;
    DesignSystemInstallIdentifiersResolvedValue_3 =
      "install-design-system --request " +
      DsInstallJsonValue +
      ` (a JSON file you wrote in the working directory with your file-writing tool)
The file holds exactly these keys: {"artifact": "<the system's url>", "namespace": "<its bundle global, else a plain name>", "title": "<its title>", "version": "<its version id>" or null, "files": [{"path": "<path in the system>", "size": <bytes>}, ...], "index": "<the project/canvas.json or project/deck.json you read with read_file right before this, at the path it was saved>", "held": {"files": <n>, "bytes": <n>} (what the project holds outside this system's folder), "has": ["<a path the project holds>", ...]}; artifact, namespace, title, files and index are required, and held too when a canvas is brought more than four scripts, stylesheets and JSON files, at least one of them new. Add "fromStore": true ONLY for a system that serves no files to copy, whose bytes you send.
(values that come from the design system go in that file, written with your file-writing tool, never on the command line: nothing of theirs is read by the shell)`;
    DesignSystemInstallIdentifiersResolvedValue_4 =
      `install-design-system takes nothing on the command line but --request <file>. A title, a name, a version or a path that comes from the design system is another artifact's text and must never be part of a command: write the values to a JSON file with your file-writing tool (not echo, printf or a heredoc) and pass only that file's path.
usage: ` + DesignSystemInstallIdentifiersResolvedValue_3;
    DesignSystemInstallIdentifiersResolvedValue_5 = 256 * 1024;
  };
}
