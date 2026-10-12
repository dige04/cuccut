/** Restored application module; prepare first, initialize in original order. */
import type { CSSProperties } from "react";
import type {
  FontFace as DeckFontFace,
  FontFamilyFallback,
  FontFamilyValue,
  Slide,
  SlideNode,
} from "../deck-contracts";
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";

/** Faces are matched by family only. */
type FontFaceFamily = Pick<DeckFontFace, "family">;
/** A typeface the font menu offers without it being carried in the deck. */
export interface BuiltinFontFaceChoice {
  family: string;
  fallback: FontFamilyFallback;
  /** True for a Google font, which must be carried as a web font face. */
  google: boolean;
}
/** A generic font family entry of the font menu. */
export interface FontFallbackOption {
  value: FontFamilyFallback;
  label: string;
}
/** One entry of the font family menu. */
export interface FontFamilyOption {
  value: string;
  label: string;
  labelStyle: CSSProperties;
  disabled?: boolean;
  title?: string;
}
/** The style patch a font menu choice applies. */
export interface FontFamilyPatch {
  /** Undefined clears the override. */
  fontFamily: FontFamilyValue | undefined;
  /** The web font face the deck must carry for the chosen typeface. */
  face?: DeckFontFace;
}

declare module "../bindings" {
  interface RuntimeBindings {
    DECK_FONT_LIMIT_MESSAGE: string;
    FONT_FALLBACK_OPTIONS: FontFallbackOption[];
    BUILTIN_FONT_FACE_CHOICES: BuiltinFontFaceChoice[];
    findCarriedFontFace: (
      faces: readonly DeckFontFace[],
      family: string,
    ) => DeckFontFace | undefined;
    fontFaceMenuLabel: (
      faces: readonly DeckFontFace[] | null | undefined,
      face: FontFaceFamily,
    ) => boolean;
    usedDeckFontFamilies: (slides: readonly Slide[]) => Set<string>;
    canCarryAnotherFontFace: (
      faces: readonly DeckFontFace[] | null | undefined,
      usedFamilies: ReadonlySet<string>,
    ) => boolean;
    sameStoredFontFace: (left: FontFaceFamily, right: FontFaceFamily) => boolean;
    removableCarriedFontFaces: (
      faces: readonly DeckFontFace[] | null | undefined,
      usedFamilies: ReadonlySet<string>,
    ) => DeckFontFace[] | null;
    addCarriedFontFace: (
      faces: readonly DeckFontFace[],
      added: DeckFontFace,
      removable: readonly DeckFontFace[],
      usedFamilies: ReadonlySet<string>,
    ) => DeckFontFace[] | null;
    restoreCarriedFontFaces: (
      faces: readonly DeckFontFace[],
      removed: DeckFontFace,
      restored: readonly DeckFontFace[],
      usedFamilies: ReadonlySet<string>,
    ) => DeckFontFace[];
    fontFamilyOptions: (
      faces: readonly DeckFontFace[] | null | undefined,
      value: FontFamilyValue | undefined,
      includeAuto?: boolean,
    ) => FontFamilyOption[];
    fontFamilyPatchFromChoice: (
      value: string,
      faces: readonly DeckFontFace[] | null | undefined,
      current: FontFamilyValue | undefined,
    ) => FontFamilyPatch;
    fontFamilyChoiceValue: (
      family: FontFamilyValue | undefined,
      faces: readonly DeckFontFace[] | null | undefined,
    ) => string;
  }
}

export function installEditorFontFaceChoices(
  runtime: RuntimeBindings,
): () => void {
  var DECK_FONT_LIMIT_MESSAGE: RuntimeBindings["DECK_FONT_LIMIT_MESSAGE"];
  var FONT_FALLBACK_OPTIONS: RuntimeBindings["FONT_FALLBACK_OPTIONS"];
  var BUILTIN_FONT_FACE_CHOICES: RuntimeBindings["BUILTIN_FONT_FACE_CHOICES"];
  var findCarriedFontFace: RuntimeBindings["findCarriedFontFace"];
  var fontFaceMenuLabel: RuntimeBindings["fontFaceMenuLabel"];
  var sameStoredFontFace: RuntimeBindings["sameStoredFontFace"];
  function usedDeckFontFamilies(slides: readonly Slide[]): Set<string> {
    let values = new Set<string>(),
      callback = (input: SlideNode): void => {
        let value = input.style?.fontFamily;
        if (typeof value === "object") {
          values.add(value.family.toLowerCase());
        }
        for (let value2 of (0, runtime.nodeChildren)(input) ?? [])
          callback(value2);
      };
    for (let value of slides)
      for (let value2 of value.frames) callback(value2.node);
    return values;
  }
  function canCarryAnotherFontFace(
    faces: readonly DeckFontFace[] | null | undefined,
    usedFamilies: ReadonlySet<string>,
  ): boolean {
    return removableCarriedFontFaces(faces, usedFamilies) !== null;
  }
  function removableCarriedFontFaces(
    faces: readonly DeckFontFace[] | null | undefined,
    usedFamilies: ReadonlySet<string>,
  ): DeckFontFace[] | null {
    let value = faces ?? [];
    if (value.length < runtime.maxDeckFontFaces) {
      return [];
    }
    let value2 = value.filter(
      (input: DeckFontFace): boolean =>
        !usedFamilies.has(input.family.toLowerCase()),
    );
    if (value.length - value2.length < runtime.maxDeckFontFaces) {
      return value2;
    } else {
      return null;
    }
  }
  function addCarriedFontFace(
    faces: readonly DeckFontFace[],
    added: DeckFontFace,
    removable: readonly DeckFontFace[],
    usedFamilies: ReadonlySet<string>,
  ): DeckFontFace[] | null {
    let value = faces.filter(
      (input: DeckFontFace): boolean =>
        !(
          removable.some((input2: DeckFontFace): boolean =>
            sameStoredFontFace(input2, input),
          ) && !usedFamilies.has(input.family.toLowerCase())
        ),
    );
    if (
      !value.some((input: DeckFontFace): boolean =>
        sameStoredFontFace(input, added),
      )
    ) {
      value.push(added);
    }
    if (value.length <= runtime.maxDeckFontFaces) {
      return value;
    } else {
      return null;
    }
  }
  function restoreCarriedFontFaces(
    faces: readonly DeckFontFace[],
    removed: DeckFontFace,
    restored: readonly DeckFontFace[],
    usedFamilies: ReadonlySet<string>,
  ): DeckFontFace[] {
    let value = usedFamilies.has(removed.family.toLowerCase())
      ? [...faces]
      : faces.filter(
          (input: DeckFontFace): boolean => !sameStoredFontFace(input, removed),
        );
    for (let value2 of restored)
      if (
        value.length < runtime.maxDeckFontFaces &&
        !value.some((input: DeckFontFace): boolean =>
          sameStoredFontFace(input, value2),
        )
      ) {
        value.push(value2);
      }
    return value;
  }
  function fontFamilyOptions(
    faces: readonly DeckFontFace[] | null | undefined,
    value: FontFamilyValue | undefined,
    includeAuto: boolean = false,
  ): FontFamilyOption[] {
    let value2 = faces ?? [],
      value3: FontFamilyOption[] = value2.map(
        (input: DeckFontFace): FontFamilyOption => ({
          value: "face:" + input.family,
          label: input.family,
          labelStyle: (0, runtime.fontFamilyCss)({
            family: input.family,
            fallback: "sans",
          }),
        }),
      );
    if (
      typeof value === "object" &&
      !findCarriedFontFace(value2, value.family) &&
      !BUILTIN_FONT_FACE_CHOICES.some(
        (input: BuiltinFontFaceChoice): boolean =>
          input.family.toLowerCase() === value.family.toLowerCase(),
      )
    ) {
      value3.push({
        value: "face:" + value.family,
        label: value.family,
        labelStyle: (0, runtime.fontFamilyCss)(value),
      });
    }
    for (let value4 of FONT_FALLBACK_OPTIONS)
      value3.push({
        ...value4,
        labelStyle: (0, runtime.fontFamilyCss)(value4.value),
      });
    for (let value4 of BUILTIN_FONT_FACE_CHOICES) {
      if (findCarriedFontFace(value2, value4.family)) {
        continue;
      }
      value3.push({
        value: "face:" + value4.family,
        label: value4.family,
        labelStyle: (0, runtime.fontFamilyCss)({
          family: value4.family,
          fallback: value4.fallback,
        }),
        ...(value4.google && includeAuto
          ? {
              disabled: true,
              title: DECK_FONT_LIMIT_MESSAGE,
            }
          : {}),
      });
    }
    return value3;
  }
  function fontFamilyPatchFromChoice(
    value: string,
    faces: readonly DeckFontFace[] | null | undefined,
    current: FontFamilyValue | undefined,
  ): FontFamilyPatch {
    if (value === "") {
      return {
        fontFamily: undefined,
      };
    }
    if (!value.startsWith("face:")) {
      return {
        fontFamily: value as FontFamilyFallback,
      };
    }
    let value2 = value.slice(5),
      value3 =
        typeof current === "object" &&
        current.family.toLowerCase() === value2.toLowerCase()
          ? current
          : undefined,
      value4 = value3?.fallback,
      value5 =
        value3?.webSafe !== undefined
          ? {
              webSafe: value3.webSafe,
            }
          : {},
      value6 = findCarriedFontFace(faces ?? [], value2),
      value7 = BUILTIN_FONT_FACE_CHOICES.find(
        (input: BuiltinFontFaceChoice): boolean =>
          input.family.toLowerCase() === value2.toLowerCase(),
      );
    if (value6) {
      return {
        fontFamily: {
          family: value6.family,
          fallback: value4 ?? value7?.fallback ?? "sans",
          ...value5,
        },
      };
    }
    if (value7 === undefined) {
      return {
        fontFamily: {
          family: value2,
          fallback: value4 ?? "sans",
          ...value5,
        },
      };
    }
    return {
      fontFamily: {
        family: value7.family,
        fallback: value4 ?? value7.fallback,
        ...value5,
      },
      ...(value7.google
        ? {
            face: {
              family: value7.family,
              href: (0, runtime.googleFontStylesheetUrl_MG0)(value7.family),
            },
          }
        : {}),
    };
  }
  function fontFamilyChoiceValue(
    family: FontFamilyValue | undefined,
    faces: readonly DeckFontFace[] | null | undefined,
  ): string {
    if (family === undefined || typeof family === "string") {
      return family ?? "";
    }
    return (
      "face:" +
      (findCarriedFontFace(faces ?? [], family.family)?.family ??
        BUILTIN_FONT_FACE_CHOICES.find(
          (input: BuiltinFontFaceChoice): boolean =>
            input.family.toLowerCase() === family.family.toLowerCase(),
        )?.family ??
        family.family)
    );
  }
  bindRuntimeValue(
    runtime,
    "DECK_FONT_LIMIT_MESSAGE",
    () => DECK_FONT_LIMIT_MESSAGE,
    (value) => {
      DECK_FONT_LIMIT_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FONT_FALLBACK_OPTIONS",
    () => FONT_FALLBACK_OPTIONS,
    (value) => {
      FONT_FALLBACK_OPTIONS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BUILTIN_FONT_FACE_CHOICES",
    () => BUILTIN_FONT_FACE_CHOICES,
    (value) => {
      BUILTIN_FONT_FACE_CHOICES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "findCarriedFontFace",
    () => findCarriedFontFace,
    (value) => {
      findCarriedFontFace = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fontFaceMenuLabel",
    () => fontFaceMenuLabel,
    (value) => {
      fontFaceMenuLabel = value;
    },
  );
  bindRuntimeValue(runtime, "usedDeckFontFamilies", () => usedDeckFontFamilies);
  bindRuntimeValue(
    runtime,
    "canCarryAnotherFontFace",
    () => canCarryAnotherFontFace,
  );
  bindRuntimeValue(
    runtime,
    "sameStoredFontFace",
    () => sameStoredFontFace,
    (value) => {
      sameStoredFontFace = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "removableCarriedFontFaces",
    () => removableCarriedFontFaces,
  );
  bindRuntimeValue(runtime, "addCarriedFontFace", () => addCarriedFontFace);
  bindRuntimeValue(
    runtime,
    "restoreCarriedFontFaces",
    () => restoreCarriedFontFaces,
  );
  bindRuntimeValue(runtime, "fontFamilyOptions", () => fontFamilyOptions);
  bindRuntimeValue(
    runtime,
    "fontFamilyPatchFromChoice",
    () => fontFamilyPatchFromChoice,
  );
  bindRuntimeValue(
    runtime,
    "fontFamilyChoiceValue",
    () => fontFamilyChoiceValue,
  );
  return () => {
    (0, runtime.initializeSlideModel)();
    (0, runtime.initializeRenderingTheme)();
    DECK_FONT_LIMIT_MESSAGE =
      "A presentation carries up to " +
      String(runtime.maxDeckFontFaces) +
      " typefaces, and every one is in use";
    FONT_FALLBACK_OPTIONS = [
      {
        value: "sans",
        label: "Sans-serif",
      },
      {
        value: "serif",
        label: "Serif",
      },
      {
        value: "mono",
        label: "Monospace",
      },
      {
        value: "helvetica",
        label: "Helvetica",
      },
    ];
    BUILTIN_FONT_FACE_CHOICES = [
      ...runtime.webSafeFontCatalog.flatMap(
        (input: { family: string }): BuiltinFontFaceChoice[] => {
        let value = (0, runtime.resolveFontFamilyAlias)(input.family);
        if (
          value &&
          !(runtime.fontFamilyFallbackValues as readonly string[]).includes(
            input.family.toLowerCase(),
          )
        ) {
          return [
            {
              family: value.family,
              fallback: value.fallback,
              google: false,
            },
          ];
        } else {
          return [];
        }
      }),
      ...runtime.googleFontCatalog.map(
        (input: {
          family: string;
          generic: FontFamilyFallback;
        }): BuiltinFontFaceChoice => ({
          family: input.family,
          fallback: input.generic,
          google: true,
        }),
      ),
    ].sort(
      (input: BuiltinFontFaceChoice, options: BuiltinFontFaceChoice): number =>
        input.family.localeCompare(options.family),
    );
    findCarriedFontFace = (
      input: readonly DeckFontFace[],
      options: string,
    ): DeckFontFace | undefined =>
      input.find(
        (input2: DeckFontFace): boolean =>
          (0, runtime.fontStoreKey)(input2.family) ===
          (0, runtime.fontStoreKey)(options),
      );
    fontFaceMenuLabel = (
      input: readonly DeckFontFace[] | null | undefined,
      options: FontFaceFamily,
    ): boolean =>
      findCarriedFontFace(input ?? [], options.family) !== undefined;
    sameStoredFontFace = (left: FontFaceFamily, right: FontFaceFamily): boolean =>
      (0, runtime.fontStoreKey)(left.family) ===
      (0, runtime.fontStoreKey)(right.family);
  };
}
