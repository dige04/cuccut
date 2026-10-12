/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
} from "../bindings";
import type {
  Frame,
  ImageNode,
  OverlayLayer,
  Slide,
  SlideNode,
} from "../deck-contracts";

/** The clipboard kind of copied frames. */
export type FrameClipboardType = "slides-frame";
/** The clipboard kind of copied slides. */
export type SlideClipboardType = "slides-slide";
/** An asset id and its source, as carried on the clipboard and added to the deck on paste. */
export type ClipboardAssetEntry = [id: string, source: string];
/** Asset sources carried by a clipboard payload, by asset id. */
export type ClipboardAssets = Record<string, string>;
/** The deck origin stamped on a payload that carries video, so a paste elsewhere can drop the clips. */
export interface ClipboardHomeMetadata {
  home?: string;
}
/** What copying frames puts on the clipboard. */
export interface FramesClipboardPayload extends ClipboardHomeMetadata {
  frame: Frame | undefined;
  frames: Frame[];
  assets: ClipboardAssets;
}
/** What copying one slide puts on the clipboard. */
export interface SlideClipboardPayload extends ClipboardHomeMetadata {
  slide: Slide;
  assets: ClipboardAssets;
}
/** What copying several slides puts on the clipboard. */
export interface SlidesClipboardPayload extends ClipboardHomeMetadata {
  slide: Slide | undefined;
  slides: Slide[];
  assets: ClipboardAssets;
}
/** A clipboard payload as parsed from JSON, before any validation. */
export interface ClipboardPayloadRecord {
  frames?: unknown;
  frame?: unknown;
  slides?: unknown;
  slide?: unknown;
  assets?: unknown;
  home?: unknown;
}
/** A paste that is refused, with the message to show. */
export interface PasteRefusal {
  error: string;
}
/** Frames ready to be pasted into a slide. */
export interface PastedFrames {
  frames: Frame[];
  addAssets: ClipboardAssetEntry[];
  /** Video clips were left out because the payload came from another deck. */
  leftClips?: true;
}
/** Slides ready to be pasted into the deck. */
export interface PastedSlides {
  slides: Slide[];
  addAssets: ClipboardAssetEntry[];
  /** Video clips were left out because the payload came from another deck. */
  leftClips?: true;
}
export type PastedFramesResult = PasteRefusal | PastedFrames;
export type PastedSlidesResult = PasteRefusal | PastedSlides;
/** Paint effects and animated styles counted over some nodes. */
export interface EffectCounts {
  effects: number;
  animated: number;
}
/** Maps clipboard asset ids to ids in the destination deck. */
export interface ClipboardAssetImporter {
  /** The destination id for a clipboard asset, or null when it cannot be pasted. */
  map: (asset: string) => string | null;
  /** Assets the destination deck must add, filled as `map` runs. */
  addAssets: ClipboardAssetEntry[];
}
/** The pointer press that started a paste gesture. */
export interface ClipboardPress {
  /** The focused element when the gesture started. */
  from: Element | null;
  presses: number;
}

declare module "../bindings" {
  interface RuntimeBindings {
    FRAME_CLIPBOARD_TYPE: FrameClipboardType;
    SLIDE_CLIPBOARD_TYPE: SlideClipboardType;
    CLIPBOARD_TEXT_LINE_BREAK_PATTERN: RegExp;
    CLIPBOARD_TEXT_CONTROL_BREAK_PATTERN: RegExp;
    CLIPBOARD_UNSAFE_TEXT_CHARACTERS_PATTERN: RegExp;
    CLIPBOARD_TEXT_LEADING_SPACE_PATTERN: RegExp;
    CLIPBOARD_LEADING_JOINER_PATTERN: RegExp;
    MAX_PASTED_FRAMES: number;
    getClipboardHomeOrigin: () => string;
    nodeContainsVideo: (node: SlideNode) => boolean;
    videoClipboardHomeMetadata: (
      frames: readonly Frame[],
    ) => ClipboardHomeMetadata;
    escapeSpreadsheetFormula: (text: string) => string;
    sanitizeClipboardText: (text: string) => string;
    sanitizeClipboardTableCell: (text: string) => string;
    nodeContainsTable: (node: SlideNode) => boolean;
    collectFrameClipboardText: (frame: Frame, tabular: boolean) => string[];
    framesClipboardText: (frames: readonly Frame[]) => string;
    slideClipboardText: (slide: Slide) => string;
    slidesClipboardText: (slides: readonly Slide[]) => string;
    collectClipboardAssets: (
      node: SlideNode,
      assets: ReadonlyMap<string, string>,
      collected: ClipboardAssets,
    ) => void;
    createFramesClipboardPayload: (
      frames: readonly Frame[],
      assets: ReadonlyMap<string, string>,
    ) => FramesClipboardPayload;
    createSlideClipboardPayload: (
      slide: Slide,
      assets: ReadonlyMap<string, string>,
    ) => SlideClipboardPayload;
    createSlidesClipboardPayload: (
      slides: readonly Slide[],
      assets: ReadonlyMap<string, string>,
    ) => SlidesClipboardPayload;
    sanitizePastedNode: (node: SlideNode, foreignHome: boolean) => SlideNode;
    remapNodeAssets: (
      node: SlideNode,
      mapAsset: (asset: string) => string | null,
    ) => SlideNode;
    createClipboardAssetImporter: (
      clipboardAssets: Record<string, unknown>,
      existingAssets: ReadonlyMap<string, string>,
    ) => ClipboardAssetImporter;
    parsePastedFrames: (
      payload: unknown,
      slide: Slide,
      assets: ReadonlyMap<string, string>,
    ) => PastedFramesResult;
    countNodeEffects: (node: SlideNode) => EffectCounts;
    countSlideEffects: (slides: readonly Slide[]) => EffectCounts;
    parsePastedSlides: (
      payload: unknown,
      slides: readonly Slide[],
      assets: ReadonlyMap<string, string>,
    ) => PastedSlidesResult;
    clipboardPressTargetMatches: (
      press: ClipboardPress,
      pressCount: number,
      target: Element | null,
    ) => boolean;
  }
}

export function installEditorClipboard(runtime: RuntimeBindings): () => void {
  var FRAME_CLIPBOARD_TYPE: RuntimeBindings["FRAME_CLIPBOARD_TYPE"];
  var SLIDE_CLIPBOARD_TYPE: RuntimeBindings["SLIDE_CLIPBOARD_TYPE"];
  var videoClipboardHomeMetadata: RuntimeBindings["videoClipboardHomeMetadata"];
  var CLIPBOARD_TEXT_LINE_BREAK_PATTERN: RuntimeBindings["CLIPBOARD_TEXT_LINE_BREAK_PATTERN"];
  var CLIPBOARD_TEXT_CONTROL_BREAK_PATTERN: RuntimeBindings["CLIPBOARD_TEXT_CONTROL_BREAK_PATTERN"];
  var CLIPBOARD_UNSAFE_TEXT_CHARACTERS_PATTERN: RuntimeBindings["CLIPBOARD_UNSAFE_TEXT_CHARACTERS_PATTERN"];
  var CLIPBOARD_TEXT_LEADING_SPACE_PATTERN: RuntimeBindings["CLIPBOARD_TEXT_LEADING_SPACE_PATTERN"];
  var CLIPBOARD_LEADING_JOINER_PATTERN: RuntimeBindings["CLIPBOARD_LEADING_JOINER_PATTERN"];
  var MAX_PASTED_FRAMES: RuntimeBindings["MAX_PASTED_FRAMES"];
  function getClipboardHomeOrigin(): string {
    if (typeof location === "undefined") {
      return "";
    } else {
      return location.origin;
    }
  }
  function nodeContainsVideo(node: SlideNode): boolean {
    if (node.kind === "img") {
      return node.video !== undefined;
    }
    return (0, runtime.nodeChildren)(node)?.some(nodeContainsVideo) === true;
  }
  function escapeSpreadsheetFormula(text: string): string {
    if (/^[\s"]*[=+@-]/.test(text)) {
      return "'" + text;
    } else {
      return text;
    }
  }
  function sanitizeClipboardText(text: string): string {
    return text
      .replace(CLIPBOARD_UNSAFE_TEXT_CHARACTERS_PATTERN, "")
      .replace(
        CLIPBOARD_TEXT_LEADING_SPACE_PATTERN,
        (input: string): string =>
          input.replace(CLIPBOARD_LEADING_JOINER_PATTERN, ""),
      );
  }
  function sanitizeClipboardTableCell(text: string): string {
    return escapeSpreadsheetFormula(
      sanitizeClipboardText(
        text.replace(CLIPBOARD_TEXT_LINE_BREAK_PATTERN, " "),
      ),
    );
  }
  function nodeContainsTable(node: SlideNode): boolean {
    if (node.kind === "table") {
      return true;
    }
    return (0, runtime.nodeChildren)(node)?.some(nodeContainsTable) ?? false;
  }
  function collectFrameClipboardText(
    frame: Frame,
    tabular: boolean,
  ): string[] {
    let parts: string[] = [],
      cleanText = (input: string): string =>
        tabular
          ? input
              .split(
                `
`,
              )
              .map(
                (input2: string): string =>
                  escapeSpreadsheetFormula(
                    sanitizeClipboardText(
                      input2.replace(CLIPBOARD_TEXT_CONTROL_BREAK_PATTERN, " "),
                    ),
                  ),
              ).join(`
`)
          : input,
      visit = (source: SlideNode): void => {
        if (source.kind === "text" && source.text !== "") {
          parts.push(cleanText(source.text));
        } else if (source.kind === "img" && source.alt !== "") {
          parts.push(cleanText(source.alt));
        } else if (source.kind === "icon") {
          parts.push(cleanText(source.icon));
        } else if (source.kind === "table") {
          if (
            source.rows.some(
              (input: string[]): boolean =>
                input.some((input2: string): boolean => input2 !== ""),
            )
          ) {
            for (let value of source.rows)
              parts.push(value.map(sanitizeClipboardTableCell).join("\t"));
          }
        } else {
          let value = (0, runtime.nodeChildren)(source);
          if (value !== undefined) {
            for (let value2 of value) visit(value2);
          }
        }
      };
    visit(frame.node);
    return parts;
  }
  function framesClipboardText(frames: readonly Frame[]): string {
    let tabular: boolean = frames.some(
        (input: Frame): boolean => nodeContainsTable(input.node),
      ),
      parts: string[] = [];
    for (let value of frames)
      parts.push(...collectFrameClipboardText(value, tabular));
    return parts.join(`
`);
  }
  function slideClipboardText(slide: Slide): string {
    return slidesClipboardText([slide]);
  }
  function slidesClipboardText(slides: readonly Slide[]): string {
    let tabular: boolean = slides.some(
      (input: Slide): boolean =>
        input.frames.some(
          (input2: Frame): boolean => nodeContainsTable(input2.node),
        ),
    );
    return slides.map((input: Slide): string => {
      let items: string[] = [];
      for (let value of input.frames)
        items.push(...collectFrameClipboardText(value, tabular));
      return items.join(`
`);
    }).join(`

`);
  }
  function collectClipboardAssets(
    node: SlideNode,
    assets: ReadonlyMap<string, string>,
    collected: ClipboardAssets,
  ): void {
    if (node.kind === "img" && node.asset !== undefined) {
      let entry = assets.get(node.asset);
      if (entry !== undefined) {
        collected[node.asset] = entry;
      }
    }
    let children = (0, runtime.nodeChildren)(node);
    if (children !== undefined) {
      for (let value of children)
        collectClipboardAssets(value, assets, collected);
    }
  }
  function createFramesClipboardPayload(
    frames: readonly Frame[],
    assets: ReadonlyMap<string, string>,
  ): FramesClipboardPayload {
    let collected: ClipboardAssets = {};
    for (let value of frames)
      collectClipboardAssets(value.node, assets, collected);
    return {
      frame: frames[0],
      frames: [...frames],
      assets: collected,
      ...videoClipboardHomeMetadata(frames),
    };
  }
  function createSlideClipboardPayload(
    slide: Slide,
    assets: ReadonlyMap<string, string>,
  ): SlideClipboardPayload {
    let collected: ClipboardAssets = {};
    for (let value of slide.frames)
      collectClipboardAssets(value.node, assets, collected);
    return {
      slide: slide,
      assets: collected,
      ...videoClipboardHomeMetadata(slide.frames),
    };
  }
  function createSlidesClipboardPayload(
    slides: readonly Slide[],
    assets: ReadonlyMap<string, string>,
  ): SlidesClipboardPayload {
    let collected: ClipboardAssets = {};
    for (let value of slides)
      for (let value2 of value.frames)
        collectClipboardAssets(value2.node, assets, collected);
    return {
      slide: slides[0],
      slides: [...slides],
      assets: collected,
      ...videoClipboardHomeMetadata(
        slides.flatMap((input: Slide): Frame[] => input.frames),
      ),
    };
  }
  function sanitizePastedNode(node: SlideNode, foreignHome: boolean): SlideNode {
    if (node.kind === "img") {
      let value: boolean =
          node.src !== undefined &&
          node.src.length > runtime.maxInlineImageBytes,
        value2: boolean = foreignHome && node.video !== undefined;
      if (!value && !value2) {
        return node;
      }
      let state: ImageNode = {
        ...node,
      };
      if (value) {
        delete state.src;
        delete state.crop;
      }
      if (value2) {
        delete state.video;
        delete state.videoStart;
        delete state.videoDelay;
        delete state.videoSound;
      }
      return state;
    }
    if (
      node.kind === "text" &&
      node.fill?.kind === "image" &&
      node.fill.src.length > runtime.maxInlineImageBytes
    ) {
      let { fill: value, ...value2 } = node;
      return value2;
    }
    if ((0, runtime.isFlowContainer)(node)) {
      let value = node.children.map(
        (input: SlideNode): SlideNode => sanitizePastedNode(input, foreignHome),
      );
      if (
        value.some(
          (input: SlideNode, options: number): boolean =>
            input !== node.children[options],
        )
      ) {
        return {
          ...node,
          children: value,
        };
      } else {
        return node;
      }
    }
    if ((0, runtime.isOverlayNode)(node)) {
      let value = sanitizePastedNode(node.base, foreignHome),
        value2 = node.layers.map((input: OverlayLayer): OverlayLayer => {
          let value3 = sanitizePastedNode(input.node, foreignHome);
          if (value3 !== input.node) {
            return {
              ...input,
              node: value3,
            };
          } else {
            return input;
          }
        });
      if (
        value !== node.base ||
        value2.some(
          (input: OverlayLayer, options: number): boolean =>
            input !== node.layers[options],
        )
      ) {
        return {
          ...node,
          base: value,
          layers: value2,
        };
      } else {
        return node;
      }
    }
    return node;
  }
  function remapNodeAssets(
    node: SlideNode,
    mapAsset: (asset: string) => string | null,
  ): SlideNode {
    if (node.kind === "img" && node.asset !== undefined) {
      let value = mapAsset(node.asset);
      if (value === node.asset) {
        return node;
      }
      let state: ImageNode = {
        ...node,
      };
      if (value === null) {
        delete state.asset;
        delete state.crop;
      } else {
        state.asset = value;
      }
      return state;
    }
    if ((0, runtime.isFlowContainer)(node)) {
      let value = node.children.map(
        (input: SlideNode): SlideNode => remapNodeAssets(input, mapAsset),
      );
      if (
        value.some(
          (input: SlideNode, options: number): boolean =>
            input !== node.children[options],
        )
      ) {
        return {
          ...node,
          children: value,
        };
      } else {
        return node;
      }
    }
    if ((0, runtime.isOverlayNode)(node)) {
      let value = remapNodeAssets(node.base, mapAsset),
        value2 = node.layers.map((input: OverlayLayer): OverlayLayer => {
          let value3 = remapNodeAssets(input.node, mapAsset);
          if (value3 !== input.node) {
            return {
              ...input,
              node: value3,
            };
          } else {
            return input;
          }
        });
      if (
        value !== node.base ||
        value2.some(
          (input: OverlayLayer, options: number): boolean =>
            input !== node.layers[options],
        )
      ) {
        return {
          ...node,
          base: value,
          layers: value2,
        };
      } else {
        return node;
      }
    }
    return node;
  }
  function createClipboardAssetImporter(
    clipboardAssets: Record<string, unknown>,
    existingAssets: ReadonlyMap<string, string>,
  ): ClipboardAssetImporter {
    let assetsBySource = new Map<string, string>();
    for (let [value, value2] of existingAssets)
      assetsBySource.set(value2, value);
    let addedAssets: ClipboardAssetEntry[] = [],
      remappedIds = new Map<string, string>();
    return {
      map: (input: string): string | null => {
        let entry = remappedIds.get(input);
        if (entry !== undefined) {
          return entry;
        }
        let value: unknown = Object.hasOwn(clipboardAssets, input)
          ? clipboardAssets[input]
          : undefined;
        if (
          typeof value === "string" &&
          value.length <= runtime.maxInlineImageBytes &&
          (0, runtime.isAllowedImageSource)(value)
        ) {
          let entry2 = assetsBySource.get(value);
          if (entry2 !== undefined) {
            remappedIds.set(input, entry2);
            return entry2;
          }
          let value2 = (0, runtime.createModelId)();
          remappedIds.set(input, value2);
          assetsBySource.set(value, value2);
          addedAssets.push([value2, value]);
          return value2;
        }
        if (existingAssets.has(input)) {
          return input;
        } else {
          return null;
        }
      },
      addAssets: addedAssets,
    };
  }
  function parsePastedFrames(
    payload: unknown,
    slide: Slide,
    assets: ReadonlyMap<string, string>,
  ): PastedFramesResult {
    let record: ClipboardPayloadRecord =
        typeof payload === "object" && payload !== null ? payload : {},
      frames: unknown[] = Array.isArray(record.frames)
        ? record.frames.slice(0, MAX_PASTED_FRAMES)
        : record.frame !== undefined
          ? [record.frame]
          : [];
    if (frames.length === 0) {
      return {
        error: "Nothing to paste.",
      };
    }
    if (slide.frames.length + frames.length > runtime.maxSlideFrames) {
      return {
        error: "This slide is full — remove an element first.",
      };
    }
    let value: Record<string, unknown> =
        typeof record.assets === "object" && record.assets !== null
          ? (record.assets as Record<string, unknown>)
          : {},
      value2: Frame[] = frames.map(
        (input: unknown): Frame => (0, runtime.normalizeSlideFrame)(input),
      ),
      value3: number = value2.reduce(
        (input: number, options: Frame): number =>
          input + (0, runtime.countNodeTableCells)(options.node),
        0,
      );
    if (
      value3 > 0 &&
      (0, runtime.countSlideTableCells)(slide) + value3 >
        runtime.maxSlideTableCells
    ) {
      return {
        error:
          "This slide can’t hold this table’s cells — " + "remove some first.",
      };
    }
    let value4: number = value2.reduce(
      (input: number, options: Frame): number =>
        input + (0, runtime.countNodeEmbeds)(options.node),
      0,
    );
    if (
      value4 > 0 &&
      (0, runtime.countSlideEmbeds)(slide) + value4 > runtime.maxSlideHtmlEmbeds
    ) {
      return {
        error:
          "This slide can’t hold more web embeds (" +
          String(runtime.maxSlideHtmlEmbeds) +
          " max) — remove one first.",
      };
    }
    let value5 = createClipboardAssetImporter(value, assets),
      value6: boolean = record.home !== getClipboardHomeOrigin(),
      value7: boolean = value2.some(
        (input: Frame): boolean => nodeContainsVideo(input.node),
      ),
      value8: Frame[] = value2.map(
        (input: Frame): Frame => ({
          ...input,
          id: (0, runtime.createModelId)(),
          node: sanitizePastedNode(
            remapNodeAssets(input.node, value5.map),
            value6,
          ),
        }),
      ),
      addAssets = value5.addAssets;
    if (assets.size + addAssets.length > runtime.maxDeckAssets) {
      return {
        error:
          "The presentation’s image store is full (" +
          String(runtime.maxDeckAssets) +
          ") — remove an image first.",
      };
    }
    let callback = (input: Frame): boolean =>
        slide.frames.some(
          (input2: Frame): boolean =>
            JSON.stringify(input2.x) === JSON.stringify(input.x) &&
            JSON.stringify(input2.y) === JSON.stringify(input.y),
        ),
      callback2 = (input: Frame[]): boolean => input.some(callback);
    for (let index = 0; index < 20 && callback2(value8); index++)
      value8 = value8.map(
        (input: Frame): Frame => ({
          ...input,
          x: (0, runtime.moveAxisSpec)(input.x, 24),
          y: (0, runtime.moveAxisSpec)(input.y, 24),
        }),
      );
    return {
      frames: value8,
      addAssets: addAssets,
      ...(value6 && value7
        ? {
            leftClips: true,
          }
        : {}),
    };
  }
  function countNodeEffects(node: SlideNode): EffectCounts {
    let effects = 0,
      animated = 0,
      visit = (input: SlideNode): void => {
        let style = input.style;
        if (style !== undefined) {
          effects += (0, runtime.paintEffectCost)(style);
          if (style.animation !== undefined) {
            animated += 1;
          }
        }
        let value = (0, runtime.nodeChildren)(input);
        if (value !== undefined) {
          for (let value2 of value) visit(value2);
        }
      };
    visit(node);
    return {
      effects: effects,
      animated: animated,
    };
  }
  function countSlideEffects(slides: readonly Slide[]): EffectCounts {
    let effects = 0,
      animated = 0;
    for (let value of slides)
      for (let value2 of value.frames) {
        let value3 = countNodeEffects(value2.node);
        effects += value3.effects;
        animated += value3.animated;
      }
    return {
      effects: effects,
      animated: animated,
    };
  }
  function parsePastedSlides(
    payload: unknown,
    slides: readonly Slide[],
    assets: ReadonlyMap<string, string>,
  ): PastedSlidesResult {
    let record: ClipboardPayloadRecord =
        typeof payload === "object" && payload !== null ? payload : {},
      count: number =
        Array.isArray(record.slides) && record.slides.length > 0
          ? record.slides.length
          : 1;
    if (slides.length + count > runtime.maxDeckSlides) {
      return {
        error:
          count > 1 && slides.length < runtime.maxDeckSlides
            ? "This presentation can’t hold " +
              String(count) +
              " more slides (" +
              String(runtime.maxDeckSlides) +
              " at most). Remove some first."
            : "This presentation is full (" +
              String(runtime.maxDeckSlides) +
              " slides) — remove one first.",
      };
    }
    let value: unknown[] =
        Array.isArray(record.slides) && record.slides.length > 0
          ? record.slides
          : [record.slide],
      value2: Record<string, unknown> =
        typeof record.assets === "object" && record.assets !== null
          ? (record.assets as Record<string, unknown>)
          : {},
      value3: Slide[] = value.map(
        (input: unknown): Slide =>
          (0, runtime.normalizeSlide)(input, (0, runtime.createModelId)()),
      ),
      value4: number = (0, runtime.countDeckTableCells)(value3);
    if (
      value4 > 0 &&
      (0, runtime.countDeckTableCells)(slides) + value4 >
        runtime.maxDeckTableCells
    ) {
      return {
        error:
          "This presentation can't hold more table cells — remove some first.",
      };
    }
    let value5 = countSlideEffects(value3);
    if (value5.effects > 0 || value5.animated > 0) {
      let value9 = countSlideEffects(slides);
      if (
        value5.effects > 0 &&
        value5.effects + value9.effects > runtime.maxSlidePaintCost
      ) {
        return {
          error:
            "This presentation can't hold more visual effects — remove some first.",
        };
      }
      if (
        value5.animated > 0 &&
        value5.animated + value9.animated > runtime.maxSlideAnimations
      ) {
        return {
          error:
            "This presentation can't hold more animations — remove some first.",
        };
      }
    }
    let value6 = createClipboardAssetImporter(value2, assets),
      value7: boolean = record.home !== getClipboardHomeOrigin(),
      entries = new Map<string, string>(),
      callback = (input: string): string =>
        entries.get(input) ??
        (entries.set(input, (0, runtime.createModelId)()), entries.get(input)!),
      value8: Slide[] = value3.map(
        (input: Slide): Slide => ({
          ...input,
          id: (0, runtime.createModelId)(),
          frames: input.frames.map(
            (input2: Frame): Frame => ({
              ...input2,
              id: callback(input2.id),
              node: sanitizePastedNode(
                remapNodeAssets(input2.node, value6.map),
                value7,
              ),
            }),
          ),
        }),
      );
    if (assets.size + value6.addAssets.length > runtime.maxDeckAssets) {
      return {
        error:
          "The presentation’s image store is full (" +
          String(runtime.maxDeckAssets) +
          ") — remove an image first.",
      };
    }
    return {
      slides: value8,
      addAssets: value6.addAssets,
      ...(value7 &&
      value3.some(
        (input: Slide): boolean =>
          input.frames.some(
            (input2: Frame): boolean => nodeContainsVideo(input2.node),
          ),
      )
        ? {
            leftClips: true,
          }
        : {}),
    };
  }
  function clipboardPressTargetMatches(
    press: ClipboardPress,
    pressCount: number,
    target: Element | null,
  ): boolean {
    return (
      pressCount === press.presses &&
      (target === press.from ||
        target === null ||
        target === target.ownerDocument.body)
    );
  }
  bindRuntimeValue(
    runtime,
    "FRAME_CLIPBOARD_TYPE",
    () => FRAME_CLIPBOARD_TYPE,
    (value) => {
      FRAME_CLIPBOARD_TYPE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SLIDE_CLIPBOARD_TYPE",
    () => SLIDE_CLIPBOARD_TYPE,
    (value) => {
      SLIDE_CLIPBOARD_TYPE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getClipboardHomeOrigin",
    () => getClipboardHomeOrigin,
  );
  bindRuntimeValue(runtime, "nodeContainsVideo", () => nodeContainsVideo);
  bindRuntimeValue(
    runtime,
    "videoClipboardHomeMetadata",
    () => videoClipboardHomeMetadata,
    (value) => {
      videoClipboardHomeMetadata = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "escapeSpreadsheetFormula",
    () => escapeSpreadsheetFormula,
  );
  bindRuntimeValue(
    runtime,
    "CLIPBOARD_TEXT_LINE_BREAK_PATTERN",
    () => CLIPBOARD_TEXT_LINE_BREAK_PATTERN,
    (value) => {
      CLIPBOARD_TEXT_LINE_BREAK_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CLIPBOARD_TEXT_CONTROL_BREAK_PATTERN",
    () => CLIPBOARD_TEXT_CONTROL_BREAK_PATTERN,
    (value) => {
      CLIPBOARD_TEXT_CONTROL_BREAK_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CLIPBOARD_UNSAFE_TEXT_CHARACTERS_PATTERN",
    () => CLIPBOARD_UNSAFE_TEXT_CHARACTERS_PATTERN,
    (value) => {
      CLIPBOARD_UNSAFE_TEXT_CHARACTERS_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CLIPBOARD_TEXT_LEADING_SPACE_PATTERN",
    () => CLIPBOARD_TEXT_LEADING_SPACE_PATTERN,
    (value) => {
      CLIPBOARD_TEXT_LEADING_SPACE_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CLIPBOARD_LEADING_JOINER_PATTERN",
    () => CLIPBOARD_LEADING_JOINER_PATTERN,
    (value) => {
      CLIPBOARD_LEADING_JOINER_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "sanitizeClipboardText",
    () => sanitizeClipboardText,
  );
  bindRuntimeValue(
    runtime,
    "sanitizeClipboardTableCell",
    () => sanitizeClipboardTableCell,
  );
  bindRuntimeValue(runtime, "nodeContainsTable", () => nodeContainsTable);
  bindRuntimeValue(
    runtime,
    "collectFrameClipboardText",
    () => collectFrameClipboardText,
  );
  bindRuntimeValue(runtime, "framesClipboardText", () => framesClipboardText);
  bindRuntimeValue(runtime, "slideClipboardText", () => slideClipboardText);
  bindRuntimeValue(runtime, "slidesClipboardText", () => slidesClipboardText);
  bindRuntimeValue(
    runtime,
    "collectClipboardAssets",
    () => collectClipboardAssets,
  );
  bindRuntimeValue(
    runtime,
    "createFramesClipboardPayload",
    () => createFramesClipboardPayload,
  );
  bindRuntimeValue(
    runtime,
    "createSlideClipboardPayload",
    () => createSlideClipboardPayload,
  );
  bindRuntimeValue(
    runtime,
    "createSlidesClipboardPayload",
    () => createSlidesClipboardPayload,
  );
  bindRuntimeValue(runtime, "sanitizePastedNode", () => sanitizePastedNode);
  bindRuntimeValue(runtime, "remapNodeAssets", () => remapNodeAssets);
  bindRuntimeValue(
    runtime,
    "createClipboardAssetImporter",
    () => createClipboardAssetImporter,
  );
  bindRuntimeValue(
    runtime,
    "MAX_PASTED_FRAMES",
    () => MAX_PASTED_FRAMES,
    (value) => {
      MAX_PASTED_FRAMES = value;
    },
  );
  bindRuntimeValue(runtime, "parsePastedFrames", () => parsePastedFrames);
  bindRuntimeValue(runtime, "countNodeEffects", () => countNodeEffects);
  bindRuntimeValue(runtime, "countSlideEffects", () => countSlideEffects);
  bindRuntimeValue(runtime, "parsePastedSlides", () => parsePastedSlides);
  bindRuntimeValue(
    runtime,
    "clipboardPressTargetMatches",
    () => clipboardPressTargetMatches,
  );
  return () => {
    (0, runtime.initializeSlideModel)();
    (0, runtime.initializeStyleSchema)();
    (0, runtime.initializeModelGeometry)();
    (0, runtime.initializeModelEditing)();
    FRAME_CLIPBOARD_TYPE = "slides-frame";
    SLIDE_CLIPBOARD_TYPE = "slides-slide";
    videoClipboardHomeMetadata = (
      frames: readonly Frame[],
    ): ClipboardHomeMetadata =>
      frames.some((input: Frame): boolean => nodeContainsVideo(input.node))
        ? {
            home: getClipboardHomeOrigin(),
          }
        : {};
    CLIPBOARD_TEXT_LINE_BREAK_PATTERN = /[\t\v\f\r\n\u0085\u2028\u2029]/g;
    CLIPBOARD_TEXT_CONTROL_BREAK_PATTERN = /[\t\v\f\r\u0085\u2028\u2029]/g;
    CLIPBOARD_UNSAFE_TEXT_CHARACTERS_PATTERN =
      /[\p{Cc}\u00ad\u061c\u200b\u200e\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff]/gu;
    CLIPBOARD_TEXT_LEADING_SPACE_PATTERN = /^[\s"\u200c\u200d]+/;
    CLIPBOARD_LEADING_JOINER_PATTERN = /[\u200c\u200d]/g;
    MAX_PASTED_FRAMES = runtime.maxSlideFrames;
  };
}
