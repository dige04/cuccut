/** Restored application module; prepare first, initialize in original order. */
import type { Slide, SlideNode } from "../deck-contracts";
import {
  bindRuntimeValue,
  type RuntimeBindings,
} from "../bindings";

/** One occurrence of the find query inside a slide's text or table node. */
export interface FindMatch {
  key: string;
  slideId: string;
  frameId: string;
  /** Dotted child-index path of the node inside its frame; empty for the frame node. */
  path: string;
  /** Zero-based index of the occurrence inside that node. */
  nth: number;
}
/** What the highlight painter needs from the editor view. */
export interface FindHighlightHost {
  slides(): readonly Slide[];
  subscribe(listener: () => void): () => void;
  inGrid(): boolean;
  currentId(): string | null | undefined;
  showSlide(slideId: string): void;
  panGridTo(slideId: string): void;
  returnToFit(): void;
  viewport(): Element | null | undefined;
  /** The elements that currently render the given slide. */
  surfaces(slideId: string): Element[];
}
/** Find-in-deck adapter that paints matches with the CSS Custom Highlight API. */
export interface FindHighlightPainter {
  search(query: string): FindMatch[];
  reveal(match: FindMatch, signal: { aborted: boolean }): Promise<void>;
  paint(matches: readonly FindMatch[], current: number): void;
  clear(): void;
  subscribe(listener: () => void): () => void;
  describe(match: FindMatch): string | undefined;
}

declare module "../bindings" {
  interface RuntimeBindings {
    countNodeFindMatches: (node: SlideNode, query: string) => number;
    collectPresentationFindMatches: (
      slides: readonly Slide[],
      query: string,
    ) => FindMatch[];
    SLIDES_FIND_SCOPE_SELECTOR: string;
    isSlidesFindScopeTarget: (element: Element) => boolean;
    lastInteractionWasInSlidesFindScope: boolean;
    trackSlidesFindScope: (document: EventTarget) => () => void;
    canHandleSlidesFindShortcut: (target: EventTarget | null) => boolean;
    waitForFindHighlightFrame: () => Promise<void>;
    createFindHighlightPainter: (
      host: FindHighlightHost,
    ) => FindHighlightPainter;
  }
}

export function installEditorFind(runtime: RuntimeBindings): () => void {
  var SLIDES_FIND_SCOPE_SELECTOR: RuntimeBindings["SLIDES_FIND_SCOPE_SELECTOR"];
  var isSlidesFindScopeTarget: RuntimeBindings["isSlidesFindScopeTarget"];
  var lastInteractionWasInSlidesFindScope: RuntimeBindings["lastInteractionWasInSlidesFindScope"];
  var waitForFindHighlightFrame: RuntimeBindings["waitForFindHighlightFrame"];
  function countNodeFindMatches(node: SlideNode, query: string): number {
    if (node.kind === "text") {
      return node.text
        .split(
          `
`,
        )
        .reduce(
          (input: number, options: string): number =>
            input + (0, runtime.findTextOffsets)(options, query).length,
          0,
        );
    }
    if (node.kind === "table") {
      return node.rows.reduce(
        (input: number, options: string[]): number =>
          input +
          options.reduce(
            (input2: number, options2: string): number =>
              input2 + (0, runtime.findTextOffsets)(options2, query).length,
            0,
          ),
        0,
      );
    }
    return 0;
  }
  function collectPresentationFindMatches(
    slides: readonly Slide[],
    query: string,
  ): FindMatch[] {
    let matches: FindMatch[] = [];
    if (query === "") {
      return matches;
    }
    let addNodeMatches = (
      input: string,
      options: string,
      context: SlideNode,
      value: string,
    ): void => {
      let value2 = countNodeFindMatches(context, query);
      for (let index = 0; index < value2; index++)
        matches.push({
          key: [input, options, value, index].join("|"),
          slideId: input,
          frameId: options,
          path: value,
          nth: index,
        });
      (0, runtime.nodeChildren)(context)?.forEach(
        (input2: SlideNode, options2: number): void =>
          addNodeMatches(
            input,
            options,
            input2,
            value === "" ? String(options2) : value + "." + String(options2),
          ),
      );
    };
    for (let value of slides)
      for (let value2 of value.frames)
        addNodeMatches(value.id, value2.id, value2.node, "");
    return matches;
  }
  function trackSlidesFindScope(document2: EventTarget): () => void {
    let listener = (event: Event): void => {
      let target = event.target as Element | null;
      if (
        target === null ||
        typeof target.closest !== "function" ||
        target.closest(runtime.OPEN_OVERLAY_SELECTOR) !== null
      ) {
        return;
      }
      lastInteractionWasInSlidesFindScope = isSlidesFindScopeTarget(target);
    };
    document2.addEventListener("pointerdown", listener, true);
    document2.addEventListener("keydown", listener, true);
    return (): void => {
      document2.removeEventListener("pointerdown", listener, true);
      document2.removeEventListener("keydown", listener, true);
    };
  }
  function canHandleSlidesFindShortcut(target: EventTarget | null): boolean {
    let element = target as Element | null;
    if (
      element === null ||
      typeof element.closest !== "function" ||
      isSlidesFindScopeTarget(element)
    ) {
      return true;
    }
    return (
      element.closest(runtime.OPEN_OVERLAY_SELECTOR) !== null &&
      lastInteractionWasInSlidesFindScope
    );
  }
  function createFindHighlightPainter(
    host: FindHighlightHost,
  ): FindHighlightPainter {
    let text = "",
      callback = (
        element: Element,
        options: FindMatch,
        context: Map<string, AbstractRange[]>,
      ): AbstractRange[] => {
        let value = options.frameId + "|" + options.path,
          entry = context.get(value);
        if (entry === undefined) {
          let element2 = element.querySelector(
              '[data-frame-id="' + CSS.escape(options.frameId) + '"]',
            ),
            value2 = element2?.matches(
              '[data-node-path="' + options.path + '"]',
            )
              ? element2
              : element2?.querySelector(
                  '[data-node-path="' + options.path + '"]',
                );
          entry = value2 ? (0, runtime.findDomTextRanges)(value2, text) : [];
          context.set(value, entry);
        }
        return entry;
      },
      callback2 = (input: FindMatch): AbstractRange | undefined => {
        for (let value of host.surfaces(input.slideId)) {
          let value2 = callback(value, input, new Map())[input.nth];
          if (value2 !== undefined) {
            return value2;
          }
        }
        return;
      };
    return {
      search(input: string): FindMatch[] {
        text = input;
        return collectPresentationFindMatches(host.slides(), input);
      },
      async reveal(
        input: FindMatch,
        options: { aborted: boolean },
      ): Promise<void> {
        if (host.inGrid()) {
          host.panGridTo(input.slideId);
        } else if (host.currentId() !== input.slideId) {
          host.showSlide(input.slideId);
        }
        await waitForFindHighlightFrame();
        await waitForFindHighlightFrame();
        if (options.aborted || host.inGrid()) {
          return;
        }
        let value = callback2(input),
          value2 =
            value === undefined ? null : (0, runtime.findRangeRectangle)(value),
          value3 = host.viewport()?.getBoundingClientRect();
        if (!value2 || !value3) {
          return;
        }
        if (
          !(
            value2.right < value3.left ||
            value2.left > value3.right ||
            value2.bottom < value3.top ||
            value2.top > value3.bottom
          )
        ) {
          return;
        }
        host.returnToFit();
        await waitForFindHighlightFrame();
      },
      paint(input: readonly FindMatch[], options: number): void {
        let items: AbstractRange[] = [],
          value: AbstractRange | null = null,
          entries = new Map<Element, Map<string, AbstractRange[]>>();
        input.forEach((input2: FindMatch, options2: number): void => {
          for (let value2 of host.surfaces(input2.slideId)) {
            let entry = entries.get(value2);
            if (entry === undefined) {
              entries.set(value2, (entry = new Map()));
            }
            let value3 = callback(value2, input2, entry)[input2.nth];
            if (value3 === undefined) {
              continue;
            }
            items.push(value3);
            if (options2 === options && value === null) {
              value = value3;
            }
          }
        });
        (0, runtime.setFindHighlights)(
          document,
          items as Range[],
          value as Range | null,
        );
      },
      clear(): void {
        text = "";
        (0, runtime.clearFindHighlights)(document);
      },
      subscribe: (input: () => void): (() => void) => host.subscribe(input),
      describe(input: FindMatch): string | undefined {
        let value = host
          .slides()
          .findIndex((input2: Slide): boolean => input2.id === input.slideId);
        if (value === -1) {
          return undefined;
        } else {
          return "Slide " + String(value + 1);
        }
      },
    };
  }
  bindRuntimeValue(runtime, "countNodeFindMatches", () => countNodeFindMatches);
  bindRuntimeValue(
    runtime,
    "collectPresentationFindMatches",
    () => collectPresentationFindMatches,
  );
  bindRuntimeValue(
    runtime,
    "SLIDES_FIND_SCOPE_SELECTOR",
    () => SLIDES_FIND_SCOPE_SELECTOR,
    (value) => {
      SLIDES_FIND_SCOPE_SELECTOR = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isSlidesFindScopeTarget",
    () => isSlidesFindScopeTarget,
    (value) => {
      isSlidesFindScopeTarget = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "lastInteractionWasInSlidesFindScope",
    () => lastInteractionWasInSlidesFindScope,
    (value) => {
      lastInteractionWasInSlidesFindScope = value;
    },
  );
  bindRuntimeValue(runtime, "trackSlidesFindScope", () => trackSlidesFindScope);
  bindRuntimeValue(
    runtime,
    "canHandleSlidesFindShortcut",
    () => canHandleSlidesFindShortcut,
  );
  bindRuntimeValue(
    runtime,
    "waitForFindHighlightFrame",
    () => waitForFindHighlightFrame,
    (value) => {
      waitForFindHighlightFrame = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createFindHighlightPainter",
    () => createFindHighlightPainter,
  );
  return () => {
    (0, runtime.initializeSections)();
    (0, runtime.initializeUiPropertyFocus)();
    (0, runtime.initializeSlideModel)();
    SLIDES_FIND_SCOPE_SELECTOR =
      '[data-appifact-content], .tb-root, [role="complementary"]';
    isSlidesFindScopeTarget = (element: Element): boolean =>
      element === element.ownerDocument.body ||
      element.closest(SLIDES_FIND_SCOPE_SELECTOR) !== null;
    lastInteractionWasInSlidesFindScope = true;
    waitForFindHighlightFrame = (): Promise<void> =>
      new Promise<void>((input) => requestAnimationFrame((): void => input()));
  };
}
