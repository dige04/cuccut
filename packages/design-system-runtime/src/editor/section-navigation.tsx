import type * as React from "react";
import type * as Core from "../contracts";
import type * as M from "../contracts/documentation";
import type * as Files from "../contracts/file-browser";
import type * as Application from "../contracts/application";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installEditorSectionNavigation(
  runtime: RuntimeBindings,
): () => void {
  var reactSectionNavigationEditorSectionNavigation: typeof React;
  var editorCardKey: (kind: string, key: string) => string;
  var CARD_FLASH_DURATION_MS: number;
  var CARD_RETRY_TIMEOUT_MS: number;
  var SECTION_SCROLL_CANCEL_TIMEOUT_MS: number;
  var SECTION_SCROLL_TARGET_TIMEOUT_MS: number;
  var USER_SCROLL_INTERRUPTION_EVENTS: string[];
  var SECTION_SCROLL_MARGIN_PX: number;
  function findEditorCard(
    root: ParentNode | null,
    target: M.EditorCardTarget,
  ): HTMLElement | null {
    let value = editorCardKey(target.kind, target.key);
    for (let value2 of root?.querySelectorAll("[data-card-key]") ?? []) {
      if (
        value2 instanceof HTMLElement &&
        value2.getAttribute("data-card-key") === value
      ) {
        return value2;
      }
    }
    return null;
  }
  function scrollEditorCardIntoView(
    element: HTMLElement,
    immediate: boolean | "title" = false,
  ): void {
    if (typeof element.scrollIntoView === "function") {
      element.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
    element.classList.add("ds-flash");
    if (immediate === "title") {
      let element2 = element.querySelector(".ds-rn-title.kit-rn-editable");
      if (element2 instanceof HTMLElement) {
        element2.click();
      }
    } else if (immediate) {
      let element2 = element.querySelector(
        'textarea, [contenteditable="true"]',
      );
      if (element2 instanceof HTMLElement) {
        element2.focus({
          preventScroll: true,
        });
      }
    }
    window.setTimeout(
      () => element.classList.remove("ds-flash"),
      CARD_FLASH_DURATION_MS,
    );
  }
  function useEditorCardFlash(
    root: React.RefObject<HTMLElement | null>,
  ): M.EditorCardFlashState {
    let [value, value2] =
      reactSectionNavigationEditorSectionNavigation.useState<M.EditorCardTarget | null>(
        null,
      );
    reactSectionNavigationEditorSectionNavigation.useLayoutEffect(() => {
      if (value === null) {
        return;
      }
      let value3 = findEditorCard(root.current, value);
      if (value3 === null) {
        let value4 = window.setTimeout(
          () =>
            value2((input: M.EditorCardTarget | null) =>
              input === value ? null : input,
            ),
          CARD_RETRY_TIMEOUT_MS,
        );
        return () => window.clearTimeout(value4);
      }
      scrollEditorCardIntoView(value3, value.focus ?? false);
      value2(null);
    });
    return {
      reveal: value2,
      pending: value,
    };
  }
  function findCommentTarget(
    root: ParentNode | null | undefined,
    id: string,
  ): HTMLElement | null {
    for (let value of root?.querySelectorAll("[data-id]") ?? []) {
      if (
        value instanceof HTMLElement &&
        value.getAttribute("data-id") === id
      ) {
        return value;
      }
    }
    return null;
  }
  function useEditorSectionNavigation({
    sections: sections,
    port: port,
    shown: shown,
    miss: miss,
  }: M.SectionNavigationProps) {
    let [value, value2] =
        reactSectionNavigationEditorSectionNavigation.useState<M.SectionNavigationTarget | null>(
          null,
        ),
      [, value3] = reactSectionNavigationEditorSectionNavigation.useState(0),
      ref = reactSectionNavigationEditorSectionNavigation.useRef<
        (() => void) | null
      >(null),
      ref2 =
        reactSectionNavigationEditorSectionNavigation.useRef<M.SectionFlash | null>(
          null,
        ),
      callback =
        reactSectionNavigationEditorSectionNavigation.useCallback((): void => {
          ref.current?.();
          value2(null);
        }, []),
      ref3 = reactSectionNavigationEditorSectionNavigation.useRef({
        shown: shown,
        miss: miss,
      });
    ref3.current = {
      shown: shown,
      miss: miss,
    };
    reactSectionNavigationEditorSectionNavigation.useEffect(
      () => () => ref.current?.(),
      [],
    );
    reactSectionNavigationEditorSectionNavigation.useLayoutEffect(() => {
      if (value === null) {
        return;
      }
      let value4 = findCommentTarget(
        sections.current[value.section],
        value.target,
      );
      if (value4 === null) {
        let value7 = window.setTimeout(
            (): void => {
              value2((input: M.SectionNavigationTarget | null) =>
                input === value ? null : input,
              );
              ref3.current.miss(value);
            },
            Math.max(0, value.until - Date.now()),
          ),
          value8 = sections.current[value.section],
          value9 =
            value8 !== null &&
            value8 !== undefined &&
            typeof window.MutationObserver === "function"
              ? new window.MutationObserver((): void => {
                  if (findCommentTarget(value8, value.target) !== null) {
                    value3((input: number) => input + 1);
                  }
                })
              : null;
        if (value8 !== null && value8 !== undefined) {
          value9?.observe(value8, {
            childList: true,
            subtree: true,
          });
        }
        let callback4 = () => value2(null);
        for (let value10 of USER_SCROLL_INTERRUPTION_EVENTS) {
          port?.addEventListener(value10, callback4, {
            passive: true,
          });
        }
        return (): void => {
          window.clearTimeout(value7);
          value9?.disconnect();
          for (let value10 of USER_SCROLL_INTERRUPTION_EVENTS) {
            port?.removeEventListener(value10, callback4);
          }
        };
      }
      value2(null);
      ref.current?.();
      if (port !== null && value4.getClientRects().length === 0) {
        ref3.current.miss(value);
        return;
      }
      let callback2 = (): void => {
        if (port === null) {
          value4.scrollIntoView?.({
            behavior: "instant",
            block: "center",
          });
          return;
        }
        if (!value4.isConnected || value4.getClientRects().length === 0) {
          ref.current?.();
          return;
        }
        let bounds = value4.getBoundingClientRect(),
          value7: number =
            bounds.height > port.clientHeight - SECTION_SCROLL_MARGIN_PX
              ? SECTION_SCROLL_MARGIN_PX
              : (port.clientHeight - bounds.height) / 2,
          value8: number = Math.max(
            0,
            port.scrollTop +
              bounds.top -
              port.getBoundingClientRect().top -
              value7,
          );
        if (Math.abs(value8 - port.scrollTop) >= 1) {
          port.scrollTo({
            top: value8,
            behavior: "instant",
          });
        }
      };
      callback2();
      ref3.current.shown(value);
      if (
        document.activeElement === null ||
        document.activeElement === document.body
      ) {
        sections.current[value.section]?.focus({
          preventScroll: true,
        });
      }
      if (ref2.current !== null) {
        window.clearTimeout(ref2.current.timer);
        ref2.current.el.classList.remove("ds-flash");
      }
      value4.offsetWidth;
      value4.classList.add("ds-flash");
      ref2.current = {
        el: value4,
        timer: window.setTimeout(
          () => value4.classList.remove("ds-flash"),
          CARD_FLASH_DURATION_MS,
        ),
      };
      let value5 =
        port !== null && typeof ResizeObserver === "function"
          ? new ResizeObserver(callback2)
          : null;
      if (value5 !== null && port !== null) {
        for (let value7 of Array.from<Element>(port.children)) {
          value5.observe(value7);
        }
      }
      let callback3 = (): void => {
          ref.current = null;
          value5?.disconnect();
          window.clearTimeout(value6);
          for (let value7 of USER_SCROLL_INTERRUPTION_EVENTS) {
            port?.removeEventListener(value7, callback3);
          }
        },
        value6 = window.setTimeout(callback3, SECTION_SCROLL_CANCEL_TIMEOUT_MS);
      ref.current = callback3;
      for (let value7 of USER_SCROLL_INTERRUPTION_EVENTS) {
        port?.addEventListener(value7, callback3, {
          passive: true,
        });
      }
    });
    return {
      reveal: reactSectionNavigationEditorSectionNavigation.useCallback(
        (input: Application.EditorSectionReveal) =>
          value2({
            ...input,
            until: Date.now() + SECTION_SCROLL_TARGET_TIMEOUT_MS,
          }),
        [],
      ),
      release: callback,
    };
  }
  function createEditorSectionNavigationActions({
    sectionLabel: sectionLabel,
    show: show,
    mark: mark,
    sectionEl: sectionEl,
    say: say,
  }: Application.EditorSectionNavigationActionOptions): Application.EditorSectionNavigationActions {
    return {
      shown: (input: Application.EditorSectionReveal): void => {
        mark(input.section);
        say(
          "In view: " +
            input.label +
            ", in " +
            (sectionLabel(input.section) ?? "this page") +
            ".",
        );
      },
      miss: (input: Application.EditorSectionReveal): void => {
        let value = sectionLabel(input.section);
        if (value === undefined) {
          return;
        }
        let activeElement = document.activeElement;
        show(input.section);
        if (
          document.activeElement === activeElement ||
          document.activeElement !== sectionEl(input.section)
        ) {
          say("In view: " + value + ".");
        }
      },
    };
  }
  bindRuntimeValue(
    runtime,
    "reactSectionNavigationEditorSectionNavigation",
    () => reactSectionNavigationEditorSectionNavigation,
    (value) => {
      reactSectionNavigationEditorSectionNavigation = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "editorCardKey",
    () => editorCardKey,
    (value) => {
      editorCardKey = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CARD_FLASH_DURATION_MS",
    () => CARD_FLASH_DURATION_MS,
    (value) => {
      CARD_FLASH_DURATION_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CARD_RETRY_TIMEOUT_MS",
    () => CARD_RETRY_TIMEOUT_MS,
    (value) => {
      CARD_RETRY_TIMEOUT_MS = value;
    },
  );
  bindRuntimeValue(runtime, "findEditorCard", () => findEditorCard);
  bindRuntimeValue(
    runtime,
    "scrollEditorCardIntoView",
    () => scrollEditorCardIntoView,
  );
  bindRuntimeValue(runtime, "useEditorCardFlash", () => useEditorCardFlash);
  bindRuntimeValue(runtime, "findCommentTarget", () => findCommentTarget);
  bindRuntimeValue(
    runtime,
    "SECTION_SCROLL_CANCEL_TIMEOUT_MS",
    () => SECTION_SCROLL_CANCEL_TIMEOUT_MS,
    (value) => {
      SECTION_SCROLL_CANCEL_TIMEOUT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SECTION_SCROLL_TARGET_TIMEOUT_MS",
    () => SECTION_SCROLL_TARGET_TIMEOUT_MS,
    (value) => {
      SECTION_SCROLL_TARGET_TIMEOUT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "USER_SCROLL_INTERRUPTION_EVENTS",
    () => USER_SCROLL_INTERRUPTION_EVENTS,
    (value) => {
      USER_SCROLL_INTERRUPTION_EVENTS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SECTION_SCROLL_MARGIN_PX",
    () => SECTION_SCROLL_MARGIN_PX,
    (value) => {
      SECTION_SCROLL_MARGIN_PX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "useEditorSectionNavigation",
    () => useEditorSectionNavigation,
  );
  bindRuntimeValue(
    runtime,
    "createEditorSectionNavigationActions",
    () => createEditorSectionNavigationActions,
  );
  return () => {
    reactSectionNavigationEditorSectionNavigation = (0,
    runtime.toModuleNamespace)((0, runtime.loadReactNamespace)(), 1);
    editorCardKey = (kind: string, key: string): string => kind + ":" + key;
    CARD_FLASH_DURATION_MS = 1500;
    CARD_RETRY_TIMEOUT_MS = 15000;
    SECTION_SCROLL_CANCEL_TIMEOUT_MS = 1200;
    SECTION_SCROLL_TARGET_TIMEOUT_MS = 3000;
    USER_SCROLL_INTERRUPTION_EVENTS = [
      "wheel",
      "touchstart",
      "pointerdown",
      "keydown",
    ];
    SECTION_SCROLL_MARGIN_PX = 56;
  };
}
