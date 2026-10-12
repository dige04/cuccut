import type * as Storage from "../contracts/model-storage";
import type * as Model from "../contracts";
import type * as Host from "../contracts/platform-host";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installModelBoot(runtime: RuntimeBindings): () => void {
  var EMPTY_DESIGN_SYSTEM_CONTENT: Model.DesignSystemContent;
  var DESIGN_SYSTEM_TYPE_HOST_IDS: Set<string>;
  var MIGRATION_EXEMPT_HOST_IDS: Set<string>;
  var TYPE_READONLY_REASON: string;
  var EMPTY_SYSTEM_READONLY_REASON: string;
  var UNKNOWN_EDITABILITY_REASON: string;
  var SYSTEM_LOAD_FAILURE_REASON: string;
  var EMPTY_INSTANCE_STATE: Storage.RawDocumentSeed;
  var DESIGN_SYSTEM_TYPE_DEMO_STATE: Storage.RawDocumentSeed;
  function normalizeSaveHome(home: unknown): "page" | "files" {
    if (home === "page") {
      return "page";
    } else {
      return "files";
    }
  }
  function isDesignSystemTypeHostModelBoot(hostname: string): boolean {
    return DESIGN_SYSTEM_TYPE_HOST_IDS.has(
      hostname.split(".")[0].toLowerCase(),
    );
  }
  function isMigrationExemptHost(hostname: string): boolean {
    return MIGRATION_EXEMPT_HOST_IDS.has(hostname.split(".")[0].toLowerCase());
  }
  function makeLoadFailureState(error: string): Storage.RawDocumentSeed {
    return {
      title: "Couldn’t load this design system",
      content: {
        v: 2,
        files: {
          "README.md":
            `# Couldn’t load this design system

Its files could not be read (` +
            error +
            `).
`,
        },
      },
    };
  }
  function chooseDesignSystemBootModeModelBoot(
    bootResult: Storage.SystemBootResult,
    editable: boolean | null | undefined,
    isTypePage: boolean = false,
  ): Storage.SystemBootMode {
    if (isTypePage) {
      return {
        mode: "readonly",
        state:
          bootResult.origin === "instance"
            ? bootResult.state
            : DESIGN_SYSTEM_TYPE_DEMO_STATE,
        reason: TYPE_READONLY_REASON,
      };
    }
    if (bootResult.origin === "instance") {
      return {
        mode: "instance",
        state: bootResult.state,
      };
    }
    if (bootResult.origin === "demo" && bootResult.stateFileFound === false) {
      if (editable === true) {
        return {
          mode: "instance",
          state: EMPTY_INSTANCE_STATE,
        };
      } else {
        return {
          mode: "readonly",
          state: EMPTY_INSTANCE_STATE,
          reason:
            editable === false
              ? EMPTY_SYSTEM_READONLY_REASON
              : UNKNOWN_EDITABILITY_REASON,
        };
      }
    }
    return {
      mode: "readonly",
      state: makeLoadFailureState(bootResult.error ?? ""),
      reason: SYSTEM_LOAD_FAILURE_REASON,
    };
  }
  bindRuntimeValue(
    runtime,
    "EMPTY_DESIGN_SYSTEM_CONTENT",
    () => EMPTY_DESIGN_SYSTEM_CONTENT,
    (value) => {
      EMPTY_DESIGN_SYSTEM_CONTENT = value;
    },
  );
  bindRuntimeValue(runtime, "normalizeSaveHome", () => normalizeSaveHome);
  bindRuntimeValue(
    runtime,
    "DESIGN_SYSTEM_TYPE_HOST_IDS",
    () => DESIGN_SYSTEM_TYPE_HOST_IDS,
    (value) => {
      DESIGN_SYSTEM_TYPE_HOST_IDS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isDesignSystemTypeHostModelBoot",
    () => isDesignSystemTypeHostModelBoot,
  );
  bindRuntimeValue(
    runtime,
    "MIGRATION_EXEMPT_HOST_IDS",
    () => MIGRATION_EXEMPT_HOST_IDS,
    (value) => {
      MIGRATION_EXEMPT_HOST_IDS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isMigrationExemptHost",
    () => isMigrationExemptHost,
  );
  bindRuntimeValue(
    runtime,
    "TYPE_READONLY_REASON",
    () => TYPE_READONLY_REASON,
    (value) => {
      TYPE_READONLY_REASON = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "EMPTY_SYSTEM_READONLY_REASON",
    () => EMPTY_SYSTEM_READONLY_REASON,
    (value) => {
      EMPTY_SYSTEM_READONLY_REASON = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "UNKNOWN_EDITABILITY_REASON",
    () => UNKNOWN_EDITABILITY_REASON,
    (value) => {
      UNKNOWN_EDITABILITY_REASON = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SYSTEM_LOAD_FAILURE_REASON",
    () => SYSTEM_LOAD_FAILURE_REASON,
    (value) => {
      SYSTEM_LOAD_FAILURE_REASON = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "EMPTY_INSTANCE_STATE",
    () => EMPTY_INSTANCE_STATE,
    (value) => {
      EMPTY_INSTANCE_STATE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DESIGN_SYSTEM_TYPE_DEMO_STATE",
    () => DESIGN_SYSTEM_TYPE_DEMO_STATE,
    (value) => {
      DESIGN_SYSTEM_TYPE_DEMO_STATE = value;
    },
  );
  bindRuntimeValue(runtime, "makeLoadFailureState", () => makeLoadFailureState);
  bindRuntimeValue(
    runtime,
    "chooseDesignSystemBootModeModelBoot",
    () => chooseDesignSystemBootModeModelBoot,
  );
  return () => {
    EMPTY_DESIGN_SYSTEM_CONTENT = {
      v: 2,
      files: {},
    };
    DESIGN_SYSTEM_TYPE_HOST_IDS = new Set([
      "23336be2-ea67-47fa-abc1-ead8c645a326",
      "1e573998-cfe9-4209-be31-18596f11217d",
    ]);
    MIGRATION_EXEMPT_HOST_IDS = new Set([
      "a283fe26-c6ed-4bf0-bd86-47e6aca1f1ba",
      "928bc197-cd4e-407b-be55-afcbebc88ed5",
    ]);
    TYPE_READONLY_REASON =
      "This is the Design System type itself, not a design system.";
    EMPTY_SYSTEM_READONLY_REASON =
      "Nothing is published in this design system yet.";
    UNKNOWN_EDITABILITY_REASON =
      "The artifact runtime here didn’t say whether you can edit, so this design system is read-only.";
    SYSTEM_LOAD_FAILURE_REASON = "This design system couldn’t be loaded.";
    EMPTY_INSTANCE_STATE = {
      content: EMPTY_DESIGN_SYSTEM_CONTENT,
    };
    DESIGN_SYSTEM_TYPE_DEMO_STATE = {
      title: "Design System",
      content: {
        v: 2,
        files: {
          "README.md": `# Design System type

Create a design system from this type to start one of your own.
`,
        },
      },
    };
  };
}
