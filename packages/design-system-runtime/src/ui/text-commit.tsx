/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
import type * as React from "react";
import type {
  ReactNamespace,
  TextCommitKey,
  TextCommitOptions,
  TextCommitController,
  UseTextCommitOptions,
  TextEditorElement,
} from "../contracts/composition";
export function installUiTextCommit(runtime: RuntimeBindings): () => void {
  var reactTextCommitController: ReactNamespace;
  var reactTextCommit: ReactNamespace;
  var observedAutoResizeTextareas: WeakSet<Element>;
  function createTextCommitController(
    options: TextCommitOptions,
  ): TextCommitController {
    let errorRef = options.error ?? {
        current: null,
      },
      isEditing = false,
      validateDraft = (input: string) =>
        options.validate !== undefined && input !== options.value()
          ? options.validate(input)
          : null,
      commitDraft = () => {
        let value = isEditing ? options.draft.current : null;
        options.draft.current = null;
        isEditing = false;
        errorRef.current = null;
        if (value === null || value === options.value()) {
          return;
        }
        if (value.trim() === "" && options.allowEmpty !== true) {
          return;
        }
        if (validateDraft(value) !== null) {
          return;
        }
        options.commit(value);
      },
      finishEditing = (input: boolean) => {
        if (options.escaped.current) {
          options.escaped.current = false;
          options.draft.current = null;
          isEditing = false;
          errorRef.current = null;
        } else if (
          input &&
          isEditing &&
          (options.draft.current ?? "").trim() === ""
        ) {
          options.draft.current = null;
          isEditing = false;
          errorRef.current = null;
        } else {
          commitDraft();
        }
        options.rerender();
      };
    return {
      display: () => options.draft.current ?? options.value(),
      onFocus() {
        options.draft.current = options.value();
        options.escaped.current = false;
        isEditing = false;
        errorRef.current = null;
        options.rerender();
      },
      onChange(input: string) {
        options.draft.current = input;
        isEditing = true;
        if (errorRef.current !== null) {
          errorRef.current = validateDraft(input);
        }
        options.rerender();
      },
      onBlur() {
        finishEditing(false);
      },
      onForcedExit() {
        finishEditing(true);
      },
      onKeyDown(input: TextCommitKey) {
        if (input.key === "Enter") {
          let current = options.draft.current,
            value = current === null ? null : validateDraft(current);
          if (value !== null) {
            errorRef.current = value;
            options.rerender();
            return {};
          }
          return {
            blur: true,
          };
        }
        if (input.key === "Escape") {
          options.escaped.current = true;
          return {
            blur: true,
          };
        }
        if (
          (input.metaKey || input.ctrlKey) &&
          input.key.toLowerCase() === "s"
        ) {
          let current = options.draft.current,
            value = current === null ? null : validateDraft(current);
          if (value !== null) {
            errorRef.current = value;
          } else {
            commitDraft();
          }
          options.rerender();
        }
        return {};
      },
    };
  }
  function resizeTextareaToContent(textarea: TextEditorElement) {
    textarea.style.height = "";
    textarea.style.height = String(textarea.scrollHeight) + "px";
  }
  function observeAutoResizeTextarea(element: TextEditorElement | null) {
    if (
      element === null ||
      element.tagName !== "TEXTAREA" ||
      (typeof CSS !== "undefined" && CSS.supports("field-sizing", "content"))
    ) {
      return;
    }
    resizeTextareaToContent(element);
    if (
      typeof ResizeObserver === "undefined" ||
      observedAutoResizeTextareas.has(element)
    ) {
      return;
    }
    observedAutoResizeTextareas.add(element);
    new ResizeObserver(() =>
      requestAnimationFrame(() => resizeTextareaToContent(element)),
    ).observe(element);
  }
  function useTextCommit({
    value: value,
    commit: commit,
    fold: fold,
    allowEmpty: allowEmpty,
    validate: validate,
    readOnly: readOnly,
  }: UseTextCommitOptions) {
    let [, rerender] = reactTextCommit.useState(0),
      draftRef = reactTextCommit.useRef<string | null>(null),
      escapedRef = reactTextCommit.useRef(false),
      errorRef = reactTextCommit.useRef<string | null>(null),
      valueRef = reactTextCommit.useRef(value);
    valueRef.current = value;
    let commitRef = reactTextCommit.useRef(commit);
    commitRef.current = commit;
    let validateRef = reactTextCommit.useRef(validate);
    validateRef.current = validate;
    let foldRef = reactTextCommit.useRef(fold);
    foldRef.current = fold;
    let normalizeDraft = (input: string) =>
        foldRef.current === true ? input.replace(/\s+/g, " ").trim() : input,
      controllerOptionsRef = reactTextCommit.useRef<TextCommitOptions | null>(
        null,
      );
    controllerOptionsRef.current ??= {
      value: () => valueRef.current,
      commit: (input: string) => {
        if (normalizeDraft(input) !== valueRef.current) {
          commitRef.current(normalizeDraft(input));
        }
      },
      validate: (input: string) =>
        validateRef.current?.(normalizeDraft(input)) ?? null,
      draft: draftRef,
      escaped: escapedRef,
      error: errorRef,
      rerender: () => rerender((input: number) => input + 1),
    };
    controllerOptionsRef.current.allowEmpty = allowEmpty;
    let controllerRef = reactTextCommit.useRef<TextCommitController | null>(
      null,
    );
    controllerRef.current ??= createTextCommitController(
      controllerOptionsRef.current,
    );
    let controller = controllerRef.current;
    reactTextCommit.useEffect(() => {
      if (readOnly === true && draftRef.current !== null) {
        controller.onForcedExit();
      }
    }, [readOnly === true]);
    reactTextCommit.useEffect(
      () => () => {
        if (draftRef.current !== null) {
          controller.onForcedExit();
        }
      },
      [],
    );
    return {
      props: {
        ref: (input: TextEditorElement | null) =>
          observeAutoResizeTextarea(input),
        value: controller.display(),
        onFocus: () => {
          if (readOnly === true || draftRef.current !== null) {
            return;
          }
          controller.onFocus();
        },
        onChange: (event: React.ChangeEvent<TextEditorElement>) => {
          if (readOnly === true) {
            return;
          }
          controller.onChange(
            foldRef.current === true
              ? event.target.value.replace(/[\r\n]+/g, " ")
              : event.target.value,
          );
        },
        onBlur: () => {
          if (draftRef.current !== null) {
            controller.onBlur();
          }
        },
        onKeyDown: (event: React.KeyboardEvent<TextEditorElement>) => {
          if (
            readOnly === true ||
            event.nativeEvent.isComposing ||
            event.keyCode === 229
          ) {
            return;
          }
          if (event.key === "Escape" && draftRef.current === null) {
            return;
          }
          let value2 = controller.onKeyDown(event);
          if (event.key === "Enter" || event.key === "Escape") {
            event.preventDefault();
          }
          if (value2.blur === true) {
            controller.onBlur();
          }
        },
      },
      error: errorRef.current,
    };
  }
  bindRuntimeValue(
    runtime,
    "reactTextCommitController",
    () => reactTextCommitController,
    (value) => {
      reactTextCommitController = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactTextCommit",
    () => reactTextCommit,
    (value) => {
      reactTextCommit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createTextCommitController",
    () => createTextCommitController,
  );
  bindRuntimeValue(
    runtime,
    "observedAutoResizeTextareas",
    () => observedAutoResizeTextareas,
    (value) => {
      observedAutoResizeTextareas = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "resizeTextareaToContent",
    () => resizeTextareaToContent,
  );
  bindRuntimeValue(
    runtime,
    "observeAutoResizeTextarea",
    () => observeAutoResizeTextarea,
  );
  bindRuntimeValue(runtime, "useTextCommit", () => useTextCommit);
  return () => {
    reactTextCommitController = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    reactTextCommit = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    observedAutoResizeTextareas = new WeakSet();
  };
}
