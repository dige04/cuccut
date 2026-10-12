/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPlatformProjectPaths(
  runtime: RuntimeBindings,
): () => void {
  var projectMetadataPaths: Dynamic;
  var legacyMetadataPaths: Dynamic;
  var projectPathPrefix: Dynamic;
  var migrationMetadataPath: Dynamic;
  var projectReservedPaths: Dynamic;
  var isReservedProjectPath: Dynamic;
  var toProjectContentPath: Dynamic;
  var isApplicationCodeFile: Dynamic;
  var fromProjectContentPath: Dynamic;
  var isProjectMetadataFile: Dynamic;

  bindRuntimeValue(
    runtime,
    "projectMetadataPaths",
    () => projectMetadataPaths,
    (value) => {
      projectMetadataPaths = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "legacyMetadataPaths",
    () => legacyMetadataPaths,
    (value) => {
      legacyMetadataPaths = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "projectPathPrefix",
    () => projectPathPrefix,
    (value) => {
      projectPathPrefix = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "migrationMetadataPath",
    () => migrationMetadataPath,
    (value) => {
      migrationMetadataPath = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "projectReservedPaths",
    () => projectReservedPaths,
    (value) => {
      projectReservedPaths = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isReservedProjectPath",
    () => isReservedProjectPath,
    (value) => {
      isReservedProjectPath = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "toProjectContentPath",
    () => toProjectContentPath,
    (value) => {
      toProjectContentPath = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isApplicationCodeFile",
    () => isApplicationCodeFile,
    (value) => {
      isApplicationCodeFile = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fromProjectContentPath",
    () => fromProjectContentPath,
    (value) => {
      fromProjectContentPath = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isProjectMetadataFile",
    () => isProjectMetadataFile,
    (value) => {
      isProjectMetadataFile = value;
    },
  );
  return () => {
    projectMetadataPaths = {
      design: "project/canvas.json",
      slides: "project/deck.json",
      designSystem: "project/design-system.json",
    };
    legacyMetadataPaths = {
      designSystem: "design-system.json",
    };
    projectPathPrefix = "project/";
    migrationMetadataPath = "project/migration.json";
    projectReservedPaths = {
      design: ["canvas.json", "migration.json"],
      slides: ["deck.json", "migration.json", "store-meta.json"],
      design_system: [
        "design-system.json",
        "migration.json",
        "design-system.before-files.json",
        "publish-progress.json",
        "migration-map.json",
      ],
      migrated_design: ["compat.json", "publish-progress.json"],
    };
    isReservedProjectPath = (input?: Dynamic, options?: Dynamic): Dynamic =>
      options.startsWith(projectPathPrefix) &&
      projectReservedPaths[input].includes(
        options.slice(projectPathPrefix.length),
      );
    toProjectContentPath = (input?: Dynamic, options?: Dynamic): Dynamic => {
      let value: Dynamic = projectPathPrefix + input;
      if (options !== undefined && isReservedProjectPath(options, value))
        throw new Error(
          "not a content path: " +
            JSON.stringify(value) +
            " is the page's own file",
        );
      return value;
    };
    isApplicationCodeFile = (input?: Dynamic): Dynamic =>
      input === "index.html" ||
      input === "SKILL.md" ||
      input.startsWith("artifact-type/");
    fromProjectContentPath = (input?: Dynamic, options?: Dynamic): Dynamic =>
      !input.startsWith(projectPathPrefix) ||
      (options !== undefined && isReservedProjectPath(options, input))
        ? undefined
        : input.slice(projectPathPrefix.length);
    isProjectMetadataFile = (input?: Dynamic): Dynamic =>
      input === projectMetadataPaths.design ||
      input === projectMetadataPaths.slides ||
      input === projectMetadataPaths.designSystem ||
      input === legacyMetadataPaths.designSystem;
  };
}
