/** Restored application module; prepare first, initialize in original order. */
import type { ReactElement } from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";
import type {
  Axis,
  Frame,
  Slide,
  SlideColor,
  SlideNode,
  TextNode,
} from "../deck-contracts";

/** A starter slide offered by the template picker; `make` builds a fresh slide each call. */
export interface SlideTemplate {
  id: string;
  name: string;
  make(): Slide;
}
/** A template with the slide it renders as in the picker. */
export interface SlideTemplateSample {
  t: SlideTemplate;
  sample: Slide;
}
/** Text node fields a template supplies; the kind and the Helvetica style are added. */
export type TemplateTextNodeInput = Omit<TextNode, "kind" | "style">;
export interface SlideTemplatePickerProps {
  open: boolean;
  onClose(): void;
  onPick(slide: Slide): void;
  /** Re-styles the sample slides to the deck's design system. */
  restyle?: (slide: Slide) => Slide;
  /** Returns the element that takes focus back when the picker closes. */
  returnFocus?: () => HTMLElement | null | undefined;
}
export interface SlideTemplatePreviewProps {
  slide: Slide;
  assets: Map<string, string>;
}

declare module "../bindings" {
  interface RuntimeBindings {
    ReactSlideTemplates: ReactNamespace;
    SlideTemplatesJsx: JsxNamespace;
    createTemplateFrame: (node: SlideNode, x: Axis, y: Axis) => Frame;
    createTemplateSlide: (bg: SlideColor, frames: Frame[]) => Slide;
    createTemplateTextNode: (input: TemplateTextNodeInput) => TextNode;
    leadingTemplatePlacement: (margin: number, size?: number) => Axis;
    centeredTemplatePlacement: (offset?: number, size?: number) => Axis;
    SLIDE_TEMPLATES: SlideTemplate[];
    SlideTemplatePicker: (props: SlideTemplatePickerProps) => ReactElement;
    SlideTemplatePreview: (props: SlideTemplatePreviewProps) => ReactElement;
  }
}

export function installEditorTemplates(runtime: RuntimeBindings): () => void {
  var ReactSlideTemplates: ReactNamespace;
  var leadingTemplatePlacement: RuntimeBindings["leadingTemplatePlacement"];
  var centeredTemplatePlacement: RuntimeBindings["centeredTemplatePlacement"];
  var SLIDE_TEMPLATES: RuntimeBindings["SLIDE_TEMPLATES"];
  var SlideTemplatesJsx: JsxNamespace;
  function createTemplateFrame(input: SlideNode, options: Axis, context: Axis): Frame {
    return {
      id: (0, runtime.createModelId)(),
      x: options,
      y: context,
      node: input,
    };
  }
  function createTemplateSlide(input: SlideColor, options: Frame[]): Slide {
    return {
      v: 1,
      id: (0, runtime.createModelId)(),
      bg: input,
      frames: options,
    };
  }
  function createTemplateTextNode(input: TemplateTextNodeInput): TextNode {
    return {
      kind: "text",
      ...input,
      style: {
        fontFamily: "helvetica",
      },
    };
  }
  function SlideTemplatePicker({
    open: open,
    onClose: onClose,
    onPick: onPick,
    restyle: restyle,
    returnFocus: returnFocus,
  }: SlideTemplatePickerProps): ReactElement {
    let memo = ReactSlideTemplates.useMemo(
        (): SlideTemplateSample[] | undefined =>
          restyle
            ? SLIDE_TEMPLATES.map(
                (input: SlideTemplate): SlideTemplateSample => ({
                  t: input,
                  sample: restyle(input.make()),
                }),
              )
            : undefined,
        [restyle],
      ),
      memo2 = ReactSlideTemplates.useMemo(
        (): SlideTemplateSample[] =>
          SLIDE_TEMPLATES.map(
            (input: SlideTemplate): SlideTemplateSample => ({
              t: input,
              sample: input.make(),
            }),
          ),
        [],
      ),
      ref = ReactSlideTemplates.useRef(memo ?? memo2);
    if (memo !== undefined) {
      ref.current = memo;
    }
    let current = ref.current,
      memo3 = ReactSlideTemplates.useMemo(
        (): Map<string, string> => new Map(),
        [],
      );
    return SlideTemplatesJsx.jsx(runtime.DialogComponents.Root, {
      open: open,
      onOpenChange: (input: boolean): void => {
        if (!input) {
          onClose();
        }
      },
      children: SlideTemplatesJsx.jsxs(runtime.DialogComponents.Popup, {
        size: "md",
        finalFocus: returnFocus
          ? (): HTMLElement | false => returnFocus() ?? false
          : undefined,
        children: [
          SlideTemplatesJsx.jsx(runtime.DialogComponents.Header, {
            showClose: true,
            children: "New slide",
          }),
          SlideTemplatesJsx.jsx("div", {
            className:
              "mt-3 grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto pb-1 text-sm [scrollbar-gutter:stable]",
            children: current.map(
              ({ t: t, sample: sample }: SlideTemplateSample): ReactElement =>
                SlideTemplatesJsx.jsxs(
                  "button",
                  {
                    type: "button",
                    className:
                      "group flex flex-col gap-1 rounded-md p-1 text-left hover:bg-bg-warm",
                    onClick: (): void => {
                      onPick(t.make());
                      onClose();
                    },
                    children: [
                      SlideTemplatesJsx.jsx(SlideTemplatePreview, {
                        slide: sample,
                        assets: memo3,
                      }),
                      SlideTemplatesJsx.jsx("span", {
                        className: "px-0.5 text-xs text-fg-secondary",
                        children: t.name,
                      }),
                    ],
                  },
                  t.id,
                ),
            ),
          }),
        ],
      }),
    });
  }
  function SlideTemplatePreview({
    slide: slide,
    assets: assets,
  }: SlideTemplatePreviewProps): ReactElement {
    let ref = ReactSlideTemplates.useRef<HTMLSpanElement>(null),
      [value, value2] = ReactSlideTemplates.useState(176);
    ReactSlideTemplates.useLayoutEffect((): (() => void) | undefined => {
      let current = ref.current;
      if (!current) {
        return;
      }
      if (current.clientWidth > 0) {
        value2(current.clientWidth);
      }
      if (typeof ResizeObserver === "undefined") {
        return;
      }
      let observer = new ResizeObserver(
        ([input]: ResizeObserverEntry[]): void => {
          if (input && input.contentRect.width > 0) {
            value2(input.contentRect.width);
          }
        },
      );
      observer.observe(current);
      return (): void => observer.disconnect();
    }, []);
    return SlideTemplatesJsx.jsx("span", {
      ref: ref,
      "aria-hidden": "true",
      "data-appifact-content": "",
      className:
        "block overflow-hidden rounded-sm border border-border-line group-hover:border-border-strong",
      children: SlideTemplatesJsx.jsx(runtime.SlideCanvas, {
        slide: slide,
        assets: assets,
        width: value,
        animate: false,
        editorChrome: true,
        structure: false,
      }),
    });
  }
  bindRuntimeValue(
    runtime,
    "ReactSlideTemplates",
    () => ReactSlideTemplates,
    (value) => {
      ReactSlideTemplates = value;
    },
  );
  bindRuntimeValue(runtime, "createTemplateFrame", () => createTemplateFrame);
  bindRuntimeValue(runtime, "createTemplateSlide", () => createTemplateSlide);
  bindRuntimeValue(
    runtime,
    "createTemplateTextNode",
    () => createTemplateTextNode,
  );
  bindRuntimeValue(
    runtime,
    "leadingTemplatePlacement",
    () => leadingTemplatePlacement,
    (value) => {
      leadingTemplatePlacement = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "centeredTemplatePlacement",
    () => centeredTemplatePlacement,
    (value) => {
      centeredTemplatePlacement = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SLIDE_TEMPLATES",
    () => SLIDE_TEMPLATES,
    (value) => {
      SLIDE_TEMPLATES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SlideTemplatesJsx",
    () => SlideTemplatesJsx,
    (value) => {
      SlideTemplatesJsx = value;
    },
  );
  bindRuntimeValue(runtime, "SlideTemplatePicker", () => SlideTemplatePicker);
  bindRuntimeValue(runtime, "SlideTemplatePreview", () => SlideTemplatePreview);
  return () => {
    (0, runtime.initializeRenderingTheme)();
    (0, runtime.initializeDesignSystemsStore)();
    (0, runtime.initializeTypographyInference)();
    (0, runtime.initializeUiInputs210)();
    ReactSlideTemplates = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    (0, runtime.initializeSlideModel)();
    leadingTemplatePlacement = (input: number, options?: number): Axis => ({
      anchor: "leading",
      margin: input,
      offset: 0,
      ...(options !== undefined
        ? {
            size: options,
          }
        : {}),
    });
    centeredTemplatePlacement = (input: number = 0, options?: number): Axis => ({
      anchor: "center",
      margin: 0,
      offset: input,
      ...(options !== undefined
        ? {
            size: options,
          }
        : {}),
    });
    SLIDE_TEMPLATES = [
      {
        id: "blank",
        name: "Blank",
        make: (): Slide => createTemplateSlide("white", []),
      },
      {
        id: "title",
        name: "Title",
        make: (): Slide =>
          createTemplateSlide("white", [
            createTemplateFrame(
              {
                kind: "stack",
                dir: "v",
                align: "stretch",
                gap: 40,
                children: [
                  createTemplateTextNode({
                    role: "display",
                    text: "Presentation title",
                  }),
                  createTemplateTextNode({
                    role: "lead",
                    text: "A one-line subtitle for the presentation.",
                    color: "text-secondary",
                  }),
                ],
              },
              leadingTemplatePlacement(128, 1500),
              centeredTemplatePlacement(),
            ),
          ]),
      },
      {
        id: "section",
        name: "Section",
        make: (): Slide =>
          createTemplateSlide("white", [
            createTemplateFrame(
              {
                kind: "stack",
                dir: "v",
                align: "stretch",
                gap: 32,
                children: [
                  createTemplateTextNode({
                    role: "eyebrow",
                    text: "SECTION 01",
                    color: "text-tertiary",
                  }),
                  createTemplateTextNode({
                    role: "h1",
                    text: "Section title",
                  }),
                ],
              },
              leadingTemplatePlacement(128, 1500),
              centeredTemplatePlacement(),
            ),
          ]),
      },
      {
        id: "title-body",
        name: "Title + body",
        make: (): Slide =>
          createTemplateSlide("white", [
            createTemplateFrame(
              createTemplateTextNode({
                role: "h2",
                text: "Heading",
              }),
              leadingTemplatePlacement(128, 1664),
              leadingTemplatePlacement(112),
            ),
            createTemplateFrame(
              createTemplateTextNode({
                role: "body",
                text: "Body copy goes here. Double-click any text to edit it in place.",
              }),
              leadingTemplatePlacement(128, 1200),
              leadingTemplatePlacement(340),
            ),
          ]),
      },
      {
        id: "bullets",
        name: "Bullets",
        make: (): Slide =>
          createTemplateSlide("white", [
            createTemplateFrame(
              createTemplateTextNode({
                role: "h2",
                text: "Key points",
              }),
              leadingTemplatePlacement(128, 1664),
              leadingTemplatePlacement(112),
            ),
            createTemplateFrame(
              {
                kind: "stack",
                dir: "v",
                align: "stretch",
                gap: 48,
                children: [
                  createTemplateTextNode({
                    role: "lead",
                    text: "•  First point",
                  }),
                  createTemplateTextNode({
                    role: "lead",
                    text: "•  Second point",
                  }),
                  createTemplateTextNode({
                    role: "lead",
                    text: "•  Third point",
                  }),
                ],
              },
              leadingTemplatePlacement(128, 1400),
              leadingTemplatePlacement(360),
            ),
          ]),
      },
      {
        id: "two-col",
        name: "Two columns",
        make: (): Slide =>
          createTemplateSlide("white", [
            createTemplateFrame(
              createTemplateTextNode({
                role: "h2",
                text: "Compare",
              }),
              leadingTemplatePlacement(128, 1664),
              leadingTemplatePlacement(112),
            ),
            createTemplateFrame(
              {
                kind: "stack",
                dir: "v",
                align: "stretch",
                gap: 24,
                children: [
                  createTemplateTextNode({
                    role: "h3",
                    text: "Left",
                  }),
                  createTemplateTextNode({
                    role: "body",
                    text: "Left column copy.",
                  }),
                ],
              },
              leadingTemplatePlacement(128, 760),
              leadingTemplatePlacement(360),
            ),
            createTemplateFrame(
              {
                kind: "stack",
                dir: "v",
                align: "stretch",
                gap: 24,
                children: [
                  createTemplateTextNode({
                    role: "h3",
                    text: "Right",
                  }),
                  createTemplateTextNode({
                    role: "body",
                    text: "Right column copy.",
                  }),
                ],
              },
              {
                anchor: "trailing",
                margin: 128,
                offset: 0,
                size: 760,
              },
              leadingTemplatePlacement(360),
            ),
          ]),
      },
      {
        id: "table",
        name: "Table",
        make: (): Slide =>
          createTemplateSlide("white", [
            createTemplateFrame(
              createTemplateTextNode({
                role: "h2",
                text: "Summary",
              }),
              leadingTemplatePlacement(128, 1664),
              leadingTemplatePlacement(112),
            ),
            createTemplateFrame(
              {
                kind: "table",
                cols: 3,
                header: true,
                rows: [
                  ["Item", "Status", "Owner"],
                  ["", "", ""],
                  ["", "", ""],
                  ["", "", ""],
                ],
              },
              leadingTemplatePlacement(128, 1664),
              leadingTemplatePlacement(320),
            ),
          ]),
      },
      {
        id: "quote",
        name: "Quote",
        make: (): Slide =>
          createTemplateSlide("white", [
            createTemplateFrame(
              createTemplateTextNode({
                role: "h2",
                text: "“A memorable line worth a whole slide.”",
                align: "center",
              }),
              centeredTemplatePlacement(0, 1500),
              centeredTemplatePlacement(-40),
            ),
            createTemplateFrame(
              createTemplateTextNode({
                role: "caption",
                text: "— Attribution",
                align: "center",
                color: "text-secondary",
              }),
              centeredTemplatePlacement(0, 800),
              centeredTemplatePlacement(220),
            ),
          ]),
      },
      {
        id: "image-caption",
        name: "Image + caption",
        make: (): Slide =>
          createTemplateSlide("white", [
            createTemplateFrame(
              {
                kind: "img",
                alt: "Drop an image here",
                fit: "cover",
                style: {
                  borderRadius: 16,
                },
              },
              centeredTemplatePlacement(0, 1100),
              leadingTemplatePlacement(120, 700),
            ),
            createTemplateFrame(
              createTemplateTextNode({
                role: "caption",
                text: "Caption for the image.",
                align: "center",
                color: "text-tertiary",
              }),
              centeredTemplatePlacement(0, 1100),
              leadingTemplatePlacement(860),
            ),
          ]),
      },
      {
        id: "closing",
        name: "Closing",
        make: (): Slide =>
          createTemplateSlide("white", [
            createTemplateFrame(
              createTemplateTextNode({
                role: "display",
                text: "Thank you",
              }),
              leadingTemplatePlacement(128, 1500),
              centeredTemplatePlacement(-40),
            ),
          ]),
      },
    ];
    (0, runtime.initializeSlideRenderer)();
    SlideTemplatesJsx = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
  };
}
