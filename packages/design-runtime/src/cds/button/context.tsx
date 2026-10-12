import type { ButtonGroupState } from "../../contracts/ui";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";
export function installCdsButtonContext(runtime: RuntimeBindings): () => void {
  var reactButtonContext: typeof React;
  var ButtonGroupContext: React.Context<ButtonGroupState>;
  var CdsCompactableAttribute: string;
  var initializeButtonContext: () => void;
  var reactButtonContext_2: typeof React;
  var initializeButtonContext_2: () => void;
  var ButtonContextClassNames: string;
  var ButtonContextClassNames_2: string;
  var ButtonContextClassNames_3: string;
  var ButtonContextClassNames_4: string;
  var CdsBtnSquishValue: string;
  var ButtonContextClassNames_5: string;
  var ButtonContextClassNames_6: string;
  var ButtonContextClassNames_7: string;
  var ButtonContextClassNames_8: string;
  var initializeButtonContext_3: () => void;
  function useButtonGroup(): ButtonGroupState {
    return (0, reactButtonContext.useContext)(ButtonGroupContext);
  }
  function useButtonAnimation(
    input: React.RefObject<HTMLElement | null>,
    options: "Button" | "SegmentedControl",
  ): void {
    (0, reactButtonContext_2.useEffect)(() => {}, [input, options]);
  }
  function buttonBackgroundClassName(input: {
    joined?: boolean;
    solid?: boolean;
  }): string {
    return `${ButtonContextClassNames} ${!input.joined && input.solid ? ButtonContextClassNames_8 : "inset-0"} ${input.joined ? "" : CdsBtnSquishValue}`;
  }
  bindRuntimeValue(runtime, "useButtonGroup", () => useButtonGroup);
  bindRuntimeValue(
    runtime,
    "reactButtonContext",
    () => reactButtonContext,
    (value) => {
      reactButtonContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ButtonGroupContext",
    () => ButtonGroupContext,
    (value) => {
      ButtonGroupContext = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CdsCompactableAttribute",
    () => CdsCompactableAttribute,
    (value) => {
      CdsCompactableAttribute = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeButtonContext",
    () => initializeButtonContext,
    (value) => {
      initializeButtonContext = value;
    },
  );
  bindRuntimeValue(runtime, "useButtonAnimation", () => useButtonAnimation);
  bindRuntimeValue(
    runtime,
    "reactButtonContext_2",
    () => reactButtonContext_2,
    (value) => {
      reactButtonContext_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeButtonContext_2",
    () => initializeButtonContext_2,
    (value) => {
      initializeButtonContext_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "buttonBackgroundClassName",
    () => buttonBackgroundClassName,
  );
  bindRuntimeValue(
    runtime,
    "ButtonContextClassNames",
    () => ButtonContextClassNames,
    (value) => {
      ButtonContextClassNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ButtonContextClassNames_2",
    () => ButtonContextClassNames_2,
    (value) => {
      ButtonContextClassNames_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ButtonContextClassNames_3",
    () => ButtonContextClassNames_3,
    (value) => {
      ButtonContextClassNames_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ButtonContextClassNames_4",
    () => ButtonContextClassNames_4,
    (value) => {
      ButtonContextClassNames_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CdsBtnSquishValue",
    () => CdsBtnSquishValue,
    (value) => {
      CdsBtnSquishValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ButtonContextClassNames_5",
    () => ButtonContextClassNames_5,
    (value) => {
      ButtonContextClassNames_5 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ButtonContextClassNames_6",
    () => ButtonContextClassNames_6,
    (value) => {
      ButtonContextClassNames_6 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ButtonContextClassNames_7",
    () => ButtonContextClassNames_7,
    (value) => {
      ButtonContextClassNames_7 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ButtonContextClassNames_8",
    () => ButtonContextClassNames_8,
    (value) => {
      ButtonContextClassNames_8 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeButtonContext_3",
    () => initializeButtonContext_3,
    (value) => {
      initializeButtonContext_3 = value;
    },
  );
  return () => {
    initializeButtonContext = (0, runtime.initializeOnce)(() => {
      "use client";

      reactButtonContext = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
      ButtonGroupContext = (0,
      reactButtonContext.createContext)<ButtonGroupState>({
        compact: false,
      });
      CdsCompactableAttribute = "data-cds-compactable";
    });
    initializeButtonContext_2 = (0, runtime.initializeOnce)(() => {
      reactButtonContext_2 = (0, runtime.toModuleNamespace)(
        (0, runtime.load_react)(),
      );
    });
    initializeButtonContext_3 = (0, runtime.initializeOnce)(() => {
      ButtonContextClassNames = "absolute -z-[1] rounded-[inherit]";
      ButtonContextClassNames_2 =
        "focus-visible:shadow-focus [&[data-initial-focus]:focus]:shadow-focus";
      ButtonContextClassNames_3 =
        "focus-visible:shadow-focus-danger [&[data-initial-focus]:focus]:shadow-focus-danger";
      ButtonContextClassNames_4 =
        "absolute inset-0 rounded-[inherit] transition-[background-color,box-shadow,color] duration-fast ease-out group-focus-visible/btn:shadow-[inset_0_0_0_1px_var(--cds-page-bg)] group-[[data-initial-focus]:focus]/btn:shadow-[inset_0_0_0_1px_var(--cds-page-bg)]";
      CdsBtnSquishValue = "cds-btn-squish";
      ButtonContextClassNames_5 =
        "shadow-field group-aria-pressed/btn:shadow-field-pressed group-focus-visible/btn:group-aria-pressed/btn:shadow-[inset_0_0_0_1px_var(--cds-page-bg)]";
      ButtonContextClassNames_6 =
        "group-aria-pressed/btn:bg-accent group-hover/btn:group-aria-pressed/btn:bg-accent";
      ButtonContextClassNames_7 =
        "bg-fill-secondary group-hover/btn:bg-fill-secondary-hover group-[[aria-haspopup][aria-expanded=true]]/btn:bg-fill-secondary-hover";
      ButtonContextClassNames_8 = "inset-[0.5px]";
    });
  };
}
