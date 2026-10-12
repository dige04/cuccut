/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type ReactDomNamespace,
  type ReactNamespace,
} from "../bindings";
import type { FindBarProps, FindStatus, FindStep } from "./find-bar";

/** An occurrence located by a find adapter; `key` identifies it across searches. */
export interface FindableMatch {
  key: unknown;
}
/** What the find controller needs from the content it searches. */
export interface FindAdapter {
  search(
    query: string,
    signal: AbortSignal,
  ): FindableMatch[] | Promise<FindableMatch[]>;
  /** Brings the match into view; resolves to `false` when it no longer exists. */
  reveal(
    match: FindableMatch,
    signal: AbortSignal,
  ): boolean | void | Promise<boolean | void>;
  paint(matches: readonly FindableMatch[], current: number): void;
  clear(): void;
  /** Where the match is, for screen readers. */
  describe?(match: FindableMatch): string | undefined;
  /** Subscribes to changes of the searched content; returns the unsubscribe. */
  subscribe?(listener: () => void): () => void;
}
/** Tuning for the find controller. */
export interface FindControllerOptions {
  /** Delay before a query is searched, in milliseconds. */
  debounceMs?: number;
}
/** Runs a search over an adapter and tracks the current match. */
export interface FindController {
  setQuery: (query: string) => void;
  step: (direction: FindStep) => void;
  clear: () => void;
  status: () => FindStatus;
  subscribe: (listener: (status: FindStatus) => void) => () => void;
  dispose: () => void;
}
/** Options of `useArtifactFind`. */
export interface ArtifactFindOptions {
  adapter: FindAdapter;
  enabled: boolean;
  /** Whether a keyboard target belongs to this find instance. */
  isOurs?: (target: EventTarget | null) => boolean;
  /** Whether the editor owns a step chord for itself. */
  ownsStepChord?: (event: KeyboardEvent) => boolean;
  /** Counts how often the view moved, to decide whether to restore focus. */
  viewMoves?: () => number;
  restoreFocus?: () => void;
  /** Captures where focus should return to when the bar closes. */
  returnTo?: (element: HTMLElement) => () => HTMLElement | null;
}
/** The options as last rendered, plus whether the bar is open. */
type ArtifactFindLiveState = ArtifactFindOptions & { isOpen: boolean };
/** Wraps a step so the caller can run it in its own context. */
export type FindStepWrapper = (run: () => void, event: KeyboardEvent) => void;
/** Relays adapter change notifications to the controller. */
interface FindChangeRelay {
  notify?: () => void;
}
/** The find bar state and commands handed to the editor. */
export interface ArtifactFind {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  step: (direction: FindStep) => void;
  /** Handles find shortcuts on a target; returns the detach function. */
  attach: (
    target: EventTarget,
    enabled?: () => boolean,
    wrap?: FindStepWrapper,
  ) => () => void;
  bar: FindBarProps;
}

declare module "../bindings" {
  interface RuntimeBindings {
    react_6: ReactNamespace;
    reactDOMSo0: ReactDomNamespace;
    EMPTY_FIND_STATUS: FindStatus;
    createFindController: (
      adapter: FindAdapter,
      options?: FindControllerOptions,
    ) => FindController;
    FIND_MODAL_SELECTOR: string;
    hasFindBlockingModal: (page: Document) => boolean;
    isEditingLink: (page: Document) => boolean;
    isArtifactRootInert: (page: Document) => boolean;
    dismissLinkEditorForFind: (page: Document) => void;
    useArtifactFind: (options: ArtifactFindOptions) => ArtifactFind;
  }
}

export function installUiArtifactFind(runtime: RuntimeBindings): () => void {
  var react_6: ReactNamespace;
  var reactDOMSo0: ReactDomNamespace;
  var EMPTY_FIND_STATUS: FindStatus;
  var FIND_MODAL_SELECTOR: string;
  function createFindController(
    adapter: FindAdapter,
    options: FindControllerOptions = {},
  ): FindController {
    let value = options.debounceMs ?? 120,
      values = new Set<(status: FindStatus) => void>(),
      value2: FindStatus = EMPTY_FIND_STATUS,
      items: FindableMatch[] = [],
      value3: number = -1,
      value4: ReturnType<typeof setTimeout> | undefined,
      text = "",
      value5: unknown,
      value6: AbortController | undefined,
      value7: AbortController | undefined,
      flag: boolean = false,
      callback = (input: FindStatus): void => {
        value2 = input;
        for (let value9 of [...values]) value9(value2);
      },
      callback2 = (input: FindableMatch | undefined): string | undefined =>
        input === undefined ? undefined : adapter.describe?.(input),
      callback3 = () => {
        if (value4 !== undefined) {
          clearTimeout(value4);
        }
        value4 = undefined;
      },
      callback4 = async (input: FindStep = 1): Promise<void> => {
        value7?.abort();
        let controller = new AbortController();
        value7 = controller;
        let values2 = new Set<unknown>();
        while (!controller.signal.aborted && !flag) {
          let value9 = items[value3];
          if (value9 === undefined || values2.has(value9.key)) {
            return;
          }
          values2.add(value9.key);
          value5 = value9.key;
          let value10: boolean | void;
          try {
            value10 = await adapter.reveal(value9, controller.signal);
          } catch {
            return;
          }
          if (
            controller.signal.aborted ||
            flag ||
            items[value3]?.key !== value9.key
          ) {
            return;
          }
          if (value10 !== false) {
            adapter.paint(items, value3);
            return;
          }
          items = items.filter(
            (input2: FindableMatch): boolean => input2.key !== value9.key,
          );
          value3 =
            items.length === 0
              ? -1
              : input === 1
                ? value3 % items.length
                : (value3 - 1 + items.length) % items.length;
          callback({
            ...value2,
            total: items.length,
            current: value3 + 1,
            place: callback2(items[value3]),
          });
          adapter.paint(items, value3);
        }
      },
      callback5 = async (): Promise<void> => {
        callback3();
        value6?.abort();
        let controller = new AbortController();
        value6 = controller;
        let query = value2.query,
          value9: FindableMatch[];
        try {
          value9 = await adapter.search(query, controller.signal);
        } catch {
          value9 = [];
        }
        if (controller.signal.aborted || flag || query !== value2.query) {
          return;
        }
        let value10 = query !== text,
          value11 = value10 ? undefined : items[value3]?.key,
          value12 = value9.length > 1000;
        items = value12 ? value9.slice(0, 1000) : value9;
        if (value10 || items.length === 0) {
          value5 = undefined;
        }
        text = query;
        let value13 =
          value11 === undefined
            ? -1
            : items.findIndex(
                (input: FindableMatch): boolean => input.key === value11,
              );
        value3 =
          items.length === 0
            ? -1
            : value13 !== -1
              ? value13
              : value10
                ? 0
                : Math.min(Math.max(value3, 0), items.length - 1);
        callback({
          query: query,
          total: items.length,
          current: value3 + 1,
          capped: value12,
          searching: false,
          place: callback2(items[value3]),
        });
        adapter.paint(items, value3);
        if (value10) {
          callback4();
        }
      },
      callback6 = () => {
        callback3();
        if (value <= 0) {
          callback5();
          return;
        }
        value4 = setTimeout(() => void callback5(), value);
      },
      callback7 = () => {
        callback3();
        text = "";
        value6?.abort();
        value7?.abort();
        items = [];
        value3 = -1;
        adapter.clear();
      },
      value8 = adapter.subscribe?.(() => {
        if (!flag && value2.query !== "") {
          callback6();
        }
      });
    return {
      setQuery(input: string) {
        if (flag || input === value2.query) {
          return;
        }
        if (input === "") {
          callback7();
          callback(EMPTY_FIND_STATUS);
          return;
        }
        value6?.abort();
        value7?.abort();
        callback({
          ...value2,
          query: input,
          searching: true,
        });
        callback6();
      },
      step(input: FindStep) {
        if (flag || value2.query === "") {
          return;
        }
        if (value2.query !== text) {
          if (value4 !== undefined) {
            callback5();
          }
          return;
        }
        if (items.length === 0) {
          return;
        }
        if (items[value3]?.key === value5) {
          value3 = (value3 + input + items.length) % items.length;
        }
        callback({
          ...value2,
          current: value3 + 1,
          place: callback2(items[value3]),
        });
        adapter.paint(items, value3);
        callback4(input);
      },
      clear() {
        if (flag) {
          return;
        }
        callback7();
        if (value2 !== EMPTY_FIND_STATUS) {
          callback(EMPTY_FIND_STATUS);
        }
      },
      status: () => value2,
      subscribe(input: (status: FindStatus) => void) {
        values.add(input);
        return () => void values.delete(input);
      },
      dispose() {
        if (flag) {
          return;
        }
        callback7();
        flag = true;
        value8?.();
        values.clear();
      },
    };
  }
  function hasFindBlockingModal(page: Document): boolean {
    return (
      Boolean(page.fullscreenElement) ||
      [...page.querySelectorAll(FIND_MODAL_SELECTOR)].some(
        (input) => !(0, runtime.isOverlayClosed)(input),
      )
    );
  }
  function isEditingLink(page: Document): boolean {
    return page.activeElement?.closest("[data-link-mode]") != null;
  }
  function isArtifactRootInert(page: Document): boolean {
    return page.getElementById("root")?.hasAttribute("inert") === true;
  }
  function dismissLinkEditorForFind(page: Document): void {
    let value = page.defaultView?.KeyboardEvent;
    if (value === undefined) {
      return;
    }
    let value2 = new value("keydown", {
        key: "Escape",
        code: "Escape",
        bubbles: true,
        cancelable: true,
      }),
      activeElement = page.activeElement as HTMLElement | null,
      value3 =
        activeElement?.closest(runtime.OPEN_OVERLAY_SELECTOR) ?? null;
    if (
      activeElement !== null &&
      value3 !== null &&
      value3 !== activeElement &&
      (0, runtime.isTextEditingElement)(activeElement)
    ) {
      activeElement.blur();
    }
    (value3 !== null && page.activeElement !== activeElement
      ? value3
      : (activeElement ?? page.body)
    ).dispatchEvent(value2);
    value2.preventDefault();
  }
  function useArtifactFind({
    adapter: options,
    enabled: enabled,
    isOurs: isOurs,
    ownsStepChord: ownsStepChord,
    viewMoves: viewMoves,
    restoreFocus: restoreFocus,
    returnTo: returnTo,
  }: ArtifactFindOptions): ArtifactFind {
    let [value, value2] = react_6.useState(false),
      [value3, value4] = react_6.useState(false),
      ref = react_6.useRef<HTMLInputElement>(null),
      ref2 = react_6.useRef<HTMLElement>(null),
      ref3 = react_6.useRef<() => HTMLElement | null>(null),
      ref4 = react_6.useRef(0),
      ref5 = react_6.useRef(0),
      ref6 = react_6.useRef<ArtifactFindLiveState>({
        adapter: options,
        isOpen: value,
        enabled: enabled,
        isOurs: isOurs,
        ownsStepChord: ownsStepChord,
        viewMoves: viewMoves,
        restoreFocus: restoreFocus,
        returnTo: returnTo,
      });
    react_6.useEffect(() => {
      ref6.current = {
        adapter: options,
        isOpen: value,
        enabled: enabled,
        isOurs: isOurs,
        ownsStepChord: ownsStepChord,
        viewMoves: viewMoves,
        restoreFocus: restoreFocus,
        returnTo: returnTo,
      };
    });
    let [{ controller: value5, changes: value6 }] = react_6.useState(
      () => {
        (0, runtime.installFindBarEventGuards)(window);
        let state: FindChangeRelay = {};
        return {
          controller: createFindController({
            search: (input: string, options2: AbortSignal) =>
              ref6.current.adapter.search(input, options2),
            reveal: (input: FindableMatch, options2: AbortSignal) =>
              ref6.current.adapter.reveal(input, options2),
            paint: (input: readonly FindableMatch[], options2: number): void =>
              ref6.current.adapter.paint(input, options2),
            clear: () => ref6.current.adapter.clear(),
            describe: (input: FindableMatch) =>
              ref6.current.adapter.describe?.(input),
            subscribe: (input: () => void): (() => void) => {
              state.notify = input;
              return (): void => void (state.notify = undefined);
            },
          }),
          changes: state,
        };
      },
    );
    react_6.useEffect(
      (): (() => void) | undefined =>
        options.subscribe?.((): void => value6.notify?.()),
      [options, value6],
    );
    react_6.useEffect(
      () => () => {
        ref4.current++;
        value5.clear();
      },
      [value5],
    );
    let callback = react_6.useCallback(() => {
        let current = ref6.current,
          isOpen = current.isOpen,
          activeElement = document.activeElement as HTMLElement | null;
        try {
          if (
            !(
              typeof activeElement?.closest === "function" &&
              activeElement.closest("[" + runtime.FIND_BAR_ATTRIBUTE + "]") !==
                null
            )
          ) {
            ref2.current =
              typeof activeElement?.focus === "function" ? activeElement : null;
            ref3.current =
              ref2.current === null
                ? null
                : (current.returnTo?.(ref2.current) ?? null);
            ref5.current = current.viewMoves?.() ?? 0;
          }
          if (!isOpen) {
            reactDOMSo0.flushSync(() => value2(true));
          }
          let current2 = ref.current;
          if (current2 !== null && activeElement?.tagName === "IFRAME") {
            activeElement.blur();
            window.focus();
          }
          current2?.focus();
          if (
            current2 !== null &&
            document.activeElement === current2
          ) {
            current2.select();
            return true;
          }
        } catch {}
        if (!isOpen) {
          value2(false);
        }
        return false;
      }, []),
      callback2 = react_6.useCallback(
        () => ref6.current.enabled && !hasFindBlockingModal(document),
        [],
      ),
      callback3 = react_6.useCallback(
        (input: EventTarget | null): boolean => {
          if (ref6.current.isOurs?.(input) === false) {
            return false;
          }
          let value7 = ++ref4.current;
          if (!callback2()) {
            return true;
          }
          if (isEditingLink(document)) {
            return true;
          }
          if ((0, runtime.hasOpenOverlay)(document)) {
            let index = 0,
              callback10 = (): void => {
                if (value7 !== ref4.current || !callback2()) {
                  return;
                }
                let flag = false;
                try {
                  if ((0, runtime.hasOpenOverlay)(document)) {
                    if (index > 0 && index % 6 === 0 && index <= 18) {
                      dismissLinkEditorForFind(document);
                    }
                  } else if (!isArtifactRootInert(document)) {
                    flag = callback();
                  }
                } catch {
                  flag = false;
                }
                if (!flag && ++index < 40) {
                  window.requestAnimationFrame(callback10);
                }
              };
            dismissLinkEditorForFind(document);
            window.requestAnimationFrame(callback10);
            return true;
          }
          if (isArtifactRootInert(document)) {
            return true;
          }
          return callback();
        },
        [callback, callback2],
      ),
      callback4 = react_6.useCallback(
        (input: FindStep): void => {
          if (
            !hasFindBlockingModal(document) &&
            !isArtifactRootInert(document) &&
            !isEditingLink(document)
          ) {
            value5.step(input);
          }
        },
        [value5],
      ),
      callback5 = react_6.useCallback(
        (event: KeyboardEvent): void => {
          let value7 = event.defaultPrevented
            ? undefined
            : (0, runtime.findStepShortcut)(event);
          if (
            value7 === undefined ||
            ref6.current.isOurs?.(event.target) === false
          ) {
            return;
          }
          if (
            event.key !== "F3" &&
            ref6.current.ownsStepChord?.(event) === true
          ) {
            return;
          }
          if (!ref6.current.isOpen) {
            if (callback3(event.target)) {
              event.preventDefault();
            }
            return;
          }
          event.preventDefault();
          callback4(value7);
        },
        [callback3, callback4],
      ),
      callback6 = react_6.useCallback(
        (input: boolean): void => {
          let current = ref6.current;
          if (!current.isOpen) {
            return;
          }
          value5.clear();
          let current2 = ref2.current,
            current3 = ref3.current;
          ref2.current = null;
          ref3.current = null;
          let activeElement = document.activeElement,
            value7 =
              input &&
              (activeElement === null ||
                activeElement === document.body ||
                activeElement.closest(
                  "[" + runtime.FIND_BAR_ATTRIBUTE + "]",
                ) !== null),
            value8 = value7 ? (current3?.() ?? null) : null,
            value9 =
              value8 ?? (value7 && current3 === null ? current2 : null),
            value10 = (current.viewMoves?.() ?? 0) !== ref5.current,
            value11 =
              value7 && value9?.isConnected === true && !value10
                ? value9
                : null;
          value11?.focus(
            value11 === value8
              ? {
                  preventScroll: true,
                }
              : undefined,
          );
          let activeElement2 = document.activeElement,
            value12 =
              value11 !== null &&
              activeElement2 !== null &&
              activeElement2 !== document.body &&
              activeElement2.closest("[" + runtime.FIND_BAR_ATTRIBUTE + "]") ===
                null;
          value2(false);
          if (value7 && !value12) {
            current.restoreFocus?.();
          }
        },
        [value5],
      ),
      callback7 = react_6.useCallback(
        () => callback6(true),
        [callback6],
      ),
      callback8 = react_6.useCallback(
        () => void callback3(null),
        [callback3],
      );
    (0, runtime.useHostFindCommand)(value3, callback8);
    react_6.useEffect(() => {
      if (!enabled) {
        callback6(false);
      }
    }, [enabled, callback6]);
    react_6.useEffect(() => {
      let callback10 = (event: KeyboardEvent): void => {
        try {
          if (event.isComposing) {
            if (
              ((0, runtime.isFindShortcut)(event) ||
                (0, runtime.findStepShortcut)(event) !== undefined) &&
              ref6.current.isOurs?.(event.target) !== false
            ) {
              event.preventDefault();
            }
            return;
          }
          if ((0, runtime.isFindShortcut)(event)) {
            if (callback3(event.target)) {
              event.preventDefault();
            }
          } else {
            callback5(event);
          }
        } catch {
          return;
        }
      };
      window.addEventListener("keydown", callback10, true);
      return () =>
        window.removeEventListener("keydown", callback10, true);
    }, [callback3, callback5]);
    let callback9 = react_6.useCallback(
      (
        input: EventTarget,
        options2?: () => boolean,
        context: FindStepWrapper = (input2: () => void): void => input2(),
      ): (() => void) => {
        let value7 = (0, runtime.createFindKeyHandler)(
            {
              findKey: (): boolean => callback3(null),
              isOpen: (): boolean => ref6.current.isOpen,
              step: (input2: FindStep, options3: KeyboardEvent): void =>
                context((): void => callback4(input2), options3),
              ownsStepChord: (input2: KeyboardEvent): boolean =>
                ref6.current.ownsStepChord?.(input2) === true,
            },
            undefined,
            options2,
          ),
          items = [
            (0, runtime.addUnpatchedEventListener)(
              input,
              "keydown",
              value7,
              true,
            ),
            (0, runtime.addUnpatchedEventListener)(
              input,
              "keydown",
              value7,
              false,
            ),
          ];
        return () =>
          items.forEach((input2) => input2());
      },
      [callback3, callback4],
    );
    return react_6.useMemo(
      () => ({
        isOpen: value,
        open: callback8,
        close: callback7,
        step: callback4,
        attach: callback9,
        bar: {
          open: value,
          subscribe: value5.subscribe,
          getStatus: value5.status,
          fieldRef: ref,
          onQuery: value5.setQuery,
          onStep: callback4,
          onClose: callback7,
          onMounted: value4,
        },
      }),
      [value, callback8, callback7, callback4, callback9, value5],
    );
  }
  bindRuntimeValue(
    runtime,
    "react_6",
    () => react_6,
    (value) => {
      react_6 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactDOMSo0",
    () => reactDOMSo0,
    (value) => {
      reactDOMSo0 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "EMPTY_FIND_STATUS",
    () => EMPTY_FIND_STATUS,
    (value) => {
      EMPTY_FIND_STATUS = value;
    },
  );
  bindRuntimeValue(runtime, "createFindController", () => createFindController);
  bindRuntimeValue(
    runtime,
    "FIND_MODAL_SELECTOR",
    () => FIND_MODAL_SELECTOR,
    (value) => {
      FIND_MODAL_SELECTOR = value;
    },
  );
  bindRuntimeValue(runtime, "hasFindBlockingModal", () => hasFindBlockingModal);
  bindRuntimeValue(runtime, "isEditingLink", () => isEditingLink);
  bindRuntimeValue(runtime, "isArtifactRootInert", () => isArtifactRootInert);
  bindRuntimeValue(
    runtime,
    "dismissLinkEditorForFind",
    () => dismissLinkEditorForFind,
  );
  bindRuntimeValue(runtime, "useArtifactFind", () => useArtifactFind);
  return () => {
    react_6 = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    reactDOMSo0 = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactDomNamespace)(),
      1,
    );
    (0, runtime.initializeUiPropertyFocus)();
    EMPTY_FIND_STATUS = {
      query: "",
      total: 0,
      current: 0,
      capped: false,
      searching: false,
    };
    FIND_MODAL_SELECTOR =
      '[data-cds="Dialog"], [role="alertdialog"]:not([aria-modal="false"]), [role="dialog"][aria-modal="true"]';
  };
}
