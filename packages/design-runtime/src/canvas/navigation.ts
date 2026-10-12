/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installCanvasNavigation(runtime: RuntimeBindings): () => void {
  var artboardFragmentPrefix: Dynamic;
  var prototypeFragmentPrefix: Dynamic;
  var canvasPageFragmentPrefix: Dynamic;
  var artboardPlaceFragment: Dynamic;
  var prototypePlaceFragment: Dynamic;
  var canvasPagePlaceFragment: Dynamic;
  var artboardPlaybackPlaceFragment: Dynamic;
  var artboardNavigationGroupLabels: Dynamic;
  function defaultPageArtboard(manifest?: Dynamic, pageId?: Dynamic): Dynamic {
    let value: Dynamic = manifest.artboards.filter(
        (input?: Dynamic): Dynamic =>
          (0, runtime.designPageId)(input, manifest.pages) === pageId,
      ),
      value2: Dynamic =
        manifest.launch?.view === "focused" ? manifest.launch.file : undefined;
    return (
      value.find((input?: Dynamic): Dynamic => input.file === value2) ??
      value.find((input?: Dynamic): Dynamic => !input.frameless) ??
      value[0]
    );
  }
  function phoneCanvasFallbackArtboard(
    manifest?: Dynamic,
    pageId?: Dynamic,
    entryFile?: Dynamic,
    laidOut?: Dynamic,
  ): Dynamic {
    let value: Dynamic = manifest.artboards.find(
        (input?: Dynamic): Dynamic =>
          input.file === entryFile &&
          !input.frameless &&
          (0, runtime.designPageId)(input, manifest.pages) === pageId,
      ),
      value2: Dynamic =
        (laidOut ? undefined : value) ?? defaultPageArtboard(manifest, pageId);
    return value2?.frameless
      ? (value ??
          manifest.artboards.find(
            (input?: Dynamic): Dynamic =>
              !input.frameless &&
              (0, runtime.designPageId)(input, manifest.pages) === pageId,
          ))
      : value2;
  }
  function oversizedPhoneCanvasFallbackArtboard(
    manifest?: Dynamic,
    pageId?: Dynamic,
    entryFile?: Dynamic,
    areaBudget?: Dynamic,
  ): Dynamic {
    let value: Dynamic = manifest.artboards.filter(
      (input?: Dynamic): Dynamic =>
        !input.frameless &&
        (0, runtime.designPageId)(input, manifest.pages) === pageId,
    );
    if (
      !value.some((input?: Dynamic): Dynamic => input.w * input.h <= areaBudget)
    )
      return (
        value.find((input?: Dynamic): Dynamic => input.file === entryFile) ??
        value[0]
      );
  }
  function initialFocusedArtboard(options?: Dynamic): Dynamic {
    let {
        manifest: value,
        pageId: value2,
        entryFile: value3,
      }: Dynamic = options,
      value4: Dynamic = options.laidOut && value.launch?.view === "focused";
    if (options.phoneCanvas && options.killedBefore)
      return (
        phoneCanvasFallbackArtboard(value, value2, value3, value4)?.file ?? null
      );
    let value5: Dynamic = options.phoneCanvas
      ? (oversizedPhoneCanvasFallbackArtboard(
          value,
          value2,
          value3,
          options.budget,
        )?.file ?? null)
      : null;
    if (options.embedded) return value5;
    let value6: Dynamic =
      (
        value.artboards.find(
          (input?: Dynamic): Dynamic => input.file === value3,
        ) ?? value.artboards[0]
      )?.file ?? null;
    return options.laidOut
      ? value.launch?.view === "focused"
        ? value.launch.file
        : options.phoneCanvas
          ? value5
          : options.migrated
            ? value6
            : null
      : value6;
  }
  function parseCanvasPlaceFragment(
    fragment?: Dynamic,
    manifest?: Dynamic,
  ): Dynamic {
    let [value = ""]: Dynamic = fragment.split(".", 1),
      value2: Dynamic = [artboardFragmentPrefix, prototypeFragmentPrefix].find(
        (input?: Dynamic): Dynamic => value.startsWith(input),
      );
    if (value2 !== undefined) {
      let value3: Dynamic = value.slice(value2.length),
        value4: Dynamic = manifest.artboards.find(
          (input?: Dynamic): Dynamic =>
            (0, runtime.stableAnchorHash)(input.file) === value3,
        );
      return value4
        ? {
            kind: "artboard",
            file: value4.file,
            play: value2 === prototypeFragmentPrefix,
          }
        : undefined;
    }
    if (value.startsWith(canvasPageFragmentPrefix)) {
      let value3: Dynamic = value.slice(canvasPageFragmentPrefix.length),
        value4: Dynamic = [
          "",
          ...(manifest.pages ?? []).map((input?: Dynamic): Dynamic => input.id),
        ].find(
          (input?: Dynamic): Dynamic =>
            (0, runtime.stableAnchorHash)(input) === value3,
        );
      return value4 === undefined
        ? undefined
        : {
            kind: "page",
            id: value4,
          };
    }
  }
  function currentCanvasPlaceFragment(
    selection?: Dynamic,
    focusedFile?: Dynamic,
    pageId?: Dynamic,
    playing?: Dynamic,
  ): Dynamic {
    if (focusedFile !== null)
      return artboardPlaybackPlaceFragment(focusedFile, playing);
    let values: Dynamic = new Set([
        ...selection.artboards,
        ...selection.elements.keys(),
      ]),
      value: Dynamic =
        values.size === 1 && selection.notes.size === 0
          ? [...values][0]
          : undefined;
    return value !== undefined
      ? artboardPlaceFragment(value)
      : canvasPagePlaceFragment(pageId);
  }
  function resolveCanvasPlaceAction(
    fragment?: Dynamic,
    manifest?: Dynamic,
    state?: Dynamic,
  ): Dynamic {
    let value: Dynamic = parseCanvasPlaceFragment(fragment, manifest);
    if (value === undefined) return null;
    let value2: Dynamic =
        value.kind === "artboard"
          ? manifest.artboards.find(
              (input?: Dynamic): Dynamic => input.file === value.file,
            )
          : undefined,
      value3: Dynamic = state.restoring !== true;
    if (
      value2 &&
      state.filling === null &&
      state.plays &&
      value.kind === "artboard" &&
      value.play &&
      value2.frameless !== true
    )
      return {
        do: "play",
        file: value2.file,
        page: (0, runtime.designPageId)(value2, manifest.pages),
        lands: prototypePlaceFragment(value2.file),
      };
    if (value2 && state.filling === null)
      return {
        do: "artboard",
        file: value2.file,
        page: (0, runtime.designPageId)(value2, manifest.pages),
        focus: state.mayFocus && value2.frameless !== true,
        camera: value3,
        lands: artboardPlaceFragment(value2.file),
      };
    if (value2 && value2.frameless !== true) {
      let value6: Dynamic = artboardPlaybackPlaceFragment(
        value2.file,
        state.plays,
      );
      return value2.file === state.filling
        ? {
            do: "nothing",
            lands: value6,
          }
        : {
            do: "window",
            file: value2.file,
            page: (0, runtime.designPageId)(value2, manifest.pages),
            lands: value6,
          };
    }
    let value4: Dynamic = value2
      ? (0, runtime.designPageId)(value2, manifest.pages)
      : value.kind === "page" && value.id !== ""
        ? value.id
        : (manifest.pages?.[0]?.id ?? "");
    if (state.filling === null)
      return {
        do: "page",
        id: value4,
        camera: value3,
        lands: canvasPagePlaceFragment(value4),
      };
    if (value4 === state.pageId)
      return {
        do: "nothing",
        lands: artboardPlaybackPlaceFragment(state.filling, state.plays),
      };
    let value5: Dynamic = defaultPageArtboard(manifest, value4);
    return {
      do: "page",
      id: value4,
      camera: value3,
      lands: value5
        ? artboardPlaybackPlaceFragment(value5.file, state.plays)
        : canvasPagePlaceFragment(value4),
    };
  }
  function prototypeFileFromPlaceFragment(
    fragment?: Dynamic,
    manifest?: Dynamic,
  ): Dynamic {
    let value: Dynamic = parseCanvasPlaceFragment(fragment, manifest);
    return value?.kind !== "artboard" ||
      !value.play ||
      manifest.artboards.find(
        (input?: Dynamic): Dynamic => input.file === value.file,
      )?.frameless === true
      ? null
      : value.file;
  }
  function sortArtboardsInReadingOrder(artboards?: Dynamic): Dynamic {
    let value: Dynamic = [...artboards].sort(
        (input?: Dynamic, options?: Dynamic): Dynamic =>
          input.y - options.y || input.x - options.x,
      ),
      items: Dynamic = [],
      items2: Dynamic = [];
    for (let value2 of value as Dynamic) {
      let value3: Dynamic = items2[0];
      value3 !== undefined &&
        value2.y >= value3.y + value3.h / 2 &&
        (items.push(
          ...items2.sort(
            (input?: Dynamic, options?: Dynamic): Dynamic =>
              input.x - options.x,
          ),
        ),
        (items2 = []));
      items2.push(value2);
    }
    items.push(
      ...items2.sort(
        (input?: Dynamic, options?: Dynamic): Dynamic => input.x - options.x,
      ),
    );
    return items;
  }
  function groupNavigableArtboards(artboards?: Dynamic): Dynamic {
    let value: Dynamic = sortArtboardsInReadingOrder(
      artboards.filter((input?: Dynamic): Dynamic => input.frameless !== true),
    );
    return {
      prototypes: value.filter(
        (input?: Dynamic): Dynamic => input.is_interactive === true,
      ),
      others: value.filter(
        (input?: Dynamic): Dynamic => input.is_interactive !== true,
      ),
    };
  }
  bindRuntimeValue(runtime, "defaultPageArtboard", () => defaultPageArtboard);
  bindRuntimeValue(
    runtime,
    "phoneCanvasFallbackArtboard",
    () => phoneCanvasFallbackArtboard,
  );
  bindRuntimeValue(
    runtime,
    "oversizedPhoneCanvasFallbackArtboard",
    () => oversizedPhoneCanvasFallbackArtboard,
  );
  bindRuntimeValue(
    runtime,
    "initialFocusedArtboard",
    () => initialFocusedArtboard,
  );
  bindRuntimeValue(
    runtime,
    "artboardFragmentPrefix",
    () => artboardFragmentPrefix,
    (value) => {
      artboardFragmentPrefix = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "prototypeFragmentPrefix",
    () => prototypeFragmentPrefix,
    (value) => {
      prototypeFragmentPrefix = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "canvasPageFragmentPrefix",
    () => canvasPageFragmentPrefix,
    (value) => {
      canvasPageFragmentPrefix = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "artboardPlaceFragment",
    () => artboardPlaceFragment,
    (value) => {
      artboardPlaceFragment = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "prototypePlaceFragment",
    () => prototypePlaceFragment,
    (value) => {
      prototypePlaceFragment = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "canvasPagePlaceFragment",
    () => canvasPagePlaceFragment,
    (value) => {
      canvasPagePlaceFragment = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "parseCanvasPlaceFragment",
    () => parseCanvasPlaceFragment,
  );
  bindRuntimeValue(
    runtime,
    "artboardPlaybackPlaceFragment",
    () => artboardPlaybackPlaceFragment,
    (value) => {
      artboardPlaybackPlaceFragment = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "currentCanvasPlaceFragment",
    () => currentCanvasPlaceFragment,
  );
  bindRuntimeValue(
    runtime,
    "resolveCanvasPlaceAction",
    () => resolveCanvasPlaceAction,
  );
  bindRuntimeValue(
    runtime,
    "prototypeFileFromPlaceFragment",
    () => prototypeFileFromPlaceFragment,
  );
  bindRuntimeValue(
    runtime,
    "sortArtboardsInReadingOrder",
    () => sortArtboardsInReadingOrder,
  );
  bindRuntimeValue(
    runtime,
    "artboardNavigationGroupLabels",
    () => artboardNavigationGroupLabels,
    (value) => {
      artboardNavigationGroupLabels = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "groupNavigableArtboards",
    () => groupNavigableArtboards,
  );
  return () => {
    artboardFragmentPrefix = "artboard-";
    prototypeFragmentPrefix = "play-";
    canvasPageFragmentPrefix = "page-";
    artboardPlaceFragment = (input?: Dynamic): Dynamic =>
      artboardFragmentPrefix + (0, runtime.stableAnchorHash)(input);
    prototypePlaceFragment = (input?: Dynamic): Dynamic =>
      prototypeFragmentPrefix + (0, runtime.stableAnchorHash)(input);
    canvasPagePlaceFragment = (input?: Dynamic): Dynamic =>
      canvasPageFragmentPrefix + (0, runtime.stableAnchorHash)(input);
    artboardPlaybackPlaceFragment = (
      input?: Dynamic,
      options?: Dynamic,
    ): Dynamic =>
      options ? prototypePlaceFragment(input) : artboardPlaceFragment(input);
    artboardNavigationGroupLabels = {
      prototypes: "Prototypes",
      others: "Static artboards",
    };
  };
}
