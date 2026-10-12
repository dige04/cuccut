/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";

/** Well-known project index file paths inside a design's file tree. */
export interface ProjectIndexPaths {
  design: string;
  slides: string;
  designSystem: string;
}

/** Index file path kept for projects saved before the `project/` folder existed. */
export interface LegacyProjectIndexPaths {
  designSystem: string;
}

declare module "../bindings" {
  interface RuntimeBindings {
    PROJECT_INDEX_PATHS: ProjectIndexPaths;
    LEGACY_PROJECT_INDEX_PATHS: LegacyProjectIndexPaths;
    isRuntimeInternalFilePath: (input: string) => boolean;
    isProjectIndexFilePath: (input: string) => boolean;
  }
}

export function installFilesProjectPaths(runtime: RuntimeBindings): () => void {
  var PROJECT_INDEX_PATHS: ProjectIndexPaths;
  var LEGACY_PROJECT_INDEX_PATHS: LegacyProjectIndexPaths;
  var isRuntimeInternalFilePath: (input: string) => boolean;
  var isProjectIndexFilePath: (input: string) => boolean;

  bindRuntimeValue(
    runtime,
    "PROJECT_INDEX_PATHS",
    () => PROJECT_INDEX_PATHS,
    (value) => {
      PROJECT_INDEX_PATHS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LEGACY_PROJECT_INDEX_PATHS",
    () => LEGACY_PROJECT_INDEX_PATHS,
    (value) => {
      LEGACY_PROJECT_INDEX_PATHS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isRuntimeInternalFilePath",
    () => isRuntimeInternalFilePath,
    (value) => {
      isRuntimeInternalFilePath = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isProjectIndexFilePath",
    () => isProjectIndexFilePath,
    (value) => {
      isProjectIndexFilePath = value;
    },
  );
  return () => {
    PROJECT_INDEX_PATHS = {
      design: "project/canvas.json",
      slides: "project/deck.json",
      designSystem: "project/design-system.json",
    };
    LEGACY_PROJECT_INDEX_PATHS = {
      designSystem: "design-system.json",
    };
    isRuntimeInternalFilePath = (input: string): boolean =>
      input === "index.html" ||
      input === "SKILL.md" ||
      input.startsWith("artifact-type/");
    isProjectIndexFilePath = (input: string): boolean =>
      input === PROJECT_INDEX_PATHS.design ||
      input === PROJECT_INDEX_PATHS.slides ||
      input === PROJECT_INDEX_PATHS.designSystem ||
      input === LEGACY_PROJECT_INDEX_PATHS.designSystem;
  };
}
