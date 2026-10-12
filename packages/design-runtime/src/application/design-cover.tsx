/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installApplicationDesignCover(
  runtime: RuntimeBindings,
): () => void {
  var ReactCover: Dynamic;
  var MAX_COVER_ARTBOARDS: Dynamic;
  var COVER_VIEWPORT_PADDING: Dynamic;
  var COVER_ASPECT_LIMITS: Dynamic;
  var coverJsxRuntime: Dynamic;
  var ignoreCoverCallback: Dynamic;
  var COVER_PAINT_TIMEOUT_MS: Dynamic;
  function computeCoverBounds(
    boards?: Dynamic,
    viewportWidth?: Dynamic,
    viewportHeight?: Dynamic,
  ): Dynamic {
    let left: Dynamic = Math.min(
        ...boards.map((input?: Dynamic): Dynamic => input.x),
      ),
      top: Dynamic = Math.min(
        ...boards.map((input?: Dynamic): Dynamic => input.y),
      ),
      width: Dynamic =
        Math.max(
          ...boards.map((input?: Dynamic): Dynamic => input.x + input.w),
        ) - left,
      height: Dynamic =
        Math.max(
          ...boards.map((input?: Dynamic): Dynamic => input.y + input.h),
        ) - top,
      availableWidth: Dynamic = Math.min(
        viewportWidth - 2 * COVER_VIEWPORT_PADDING,
        viewportHeight * COVER_ASPECT_LIMITS.narrow,
      ),
      availableHeight: Dynamic = Math.min(
        viewportHeight - 2 * COVER_VIEWPORT_PADDING,
        viewportWidth / COVER_ASPECT_LIMITS.wide,
      );
    return {
      left: left,
      top: top,
      w: width,
      h: height,
      scale:
        availableWidth > 0 && availableHeight > 0 && width > 0 && height > 0
          ? Math.min(availableWidth / width, availableHeight / height)
          : 0,
    };
  }
  function selectCoverArtboard(content?: Dynamic): Dynamic {
    let manifest: Dynamic = (0, runtime.parseCanvasMetadata)(
        content.files[runtime.canvasMetadataFile] ?? null,
        content.files,
      ),
      hasContent: Dynamic = (input?: Dynamic): Dynamic =>
        !(0, runtime.isLoadingArtboardHtml)(content.files[input.file] ?? ""),
      coverBoard: Dynamic = manifest.artboards.find(
        (input?: Dynamic): Dynamic => input.file === manifest.cover,
      );
    return coverBoard !== undefined && hasContent(coverBoard)
      ? coverBoard
      : (manifest.artboards.find(
          (input?: Dynamic): Dynamic => !input.frameless && hasContent(input),
        ) ?? manifest.artboards.find(hasContent));
  }
  function selectCoverSnapshotBoards(content?: Dynamic): Dynamic {
    let manifest: Dynamic = (0, runtime.parseCanvasMetadata)(
      content.files[runtime.canvasMetadataFile] ?? null,
      content.files,
    );
    if (manifest.cover !== undefined) return;
    let isSnapshotBoard: Dynamic = (input?: Dynamic): Dynamic =>
        !input.frameless &&
        !(0, runtime.isLoadingArtboardHtml)(content.files[input.file] ?? ""),
      firstBoard: Dynamic = manifest.artboards.find(isSnapshotBoard);
    if (firstBoard === undefined) return;
    let boardsForPage: Dynamic = (input?: Dynamic): Dynamic =>
        (0, runtime.designPageContents)(manifest, input)
          .artboards.filter(isSnapshotBoard)
          .slice(0, MAX_COVER_ARTBOARDS),
      launchFile: Dynamic =
        manifest.launch?.view === "focused"
          ? manifest.launch.file
          : (0, runtime.primaryDesignFile)(content),
      launchBoard: Dynamic = manifest.artboards.find(
        (input?: Dynamic): Dynamic => input.file === launchFile,
      ),
      launchPage: Dynamic =
        manifest.launch?.view === "canvas" && manifest.launch.page !== undefined
          ? manifest.launch.page
          : launchBoard !== undefined
            ? (0, runtime.designPageId)(launchBoard, manifest.pages)
            : undefined,
      pageBoards: Dynamic =
        launchPage !== undefined ? boardsForPage(launchPage) : [];
    return pageBoards.length > 0
      ? pageBoards
      : boardsForPage((0, runtime.designPageId)(firstBoard, manifest.pages));
  }
  function selectDesignCover(
    content?: Dynamic,
    allowSnapshot: Dynamic = true,
  ): Dynamic {
    let snapshotBoards: Dynamic = allowSnapshot
      ? selectCoverSnapshotBoards(content)
      : undefined;
    if (snapshotBoards !== undefined)
      return {
        boards: snapshotBoards,
        snapshot: true,
      };
    let coverBoard: Dynamic = selectCoverArtboard(content);
    return coverBoard !== undefined
      ? {
          boards: [coverBoard],
          snapshot: false,
        }
      : undefined;
  }
  function DesignCover({
    doc: doc,
    assets: assets,
    maySnapshot = true,
    Board = runtime.ArtboardFrame,
  }: Dynamic): Dynamic {
    let exitGuardRef: Dynamic = (0, ReactCover.useRef)(null),
      textEditOpenRef: Dynamic = (0, ReactCover.useRef)(null),
      settleSessionRef: Dynamic = (0, ReactCover.useRef)(null),
      actionsRef: Dynamic = (0, ReactCover.useRef)(null),
      content: Dynamic = (0, ReactCover.useSyncExternalStore)(
        (0, ReactCover.useCallback)(
          (input?: Dynamic): Dynamic => doc.subscribe((): Dynamic => input()),
          [doc],
        ),
        (): Dynamic => doc.content(),
      ),
      isLoaded: Dynamic = (0, ReactCover.useSyncExternalStore)(
        (0, ReactCover.useCallback)(
          (input?: Dynamic): Dynamic =>
            "subscribeLoad" in doc
              ? doc.subscribeLoad(input)
              : (): Dynamic => {},
          [doc],
        ),
        (): Dynamic => !("loadState" in doc) || doc.loadState() === "live",
      );
    (0, ReactCover.useEffect)((): Dynamic => {
      let value: Dynamic = doc.title();
      value !== "" &&
        value !== (document as Dynamic).title &&
        ((document as Dynamic).title = value);
    }, [doc, content]);
    let coverRef: Dynamic = (0, ReactCover.useRef)(undefined);
    isLoaded &&
      coverRef.current === undefined &&
      (coverRef.current = selectDesignCover(content, maySnapshot));
    let hasCover: Dynamic = coverRef.current !== undefined,
      boards: Dynamic = coverRef.current?.boards ?? [],
      isSnapshot: Dynamic = coverRef.current?.snapshot ?? false,
      hasArtboards: Dynamic = Object.keys(content.files).some(
        runtime.isArtboardFile,
      ),
      [paintStates, setPaintStates]: Dynamic = (0, ReactCover.useState)(
        (): Dynamic => new Map(),
      ),
      onBoardPainted: Dynamic = (0, ReactCover.useCallback)(
        (input?: Dynamic): Dynamic =>
          setPaintStates(
            (input2?: Dynamic): Dynamic =>
              input2.get(input) === "painted"
                ? input2
                : new Map(input2).set(input, "painted"),
          ),
        [],
      ),
      onBoardBlocked: Dynamic = (0, ReactCover.useCallback)(
        (input?: Dynamic, options?: Dynamic): Dynamic => {
          options &&
            setPaintStates(
              (input2?: Dynamic): Dynamic =>
                input2.get(input) === "failed"
                  ? input2
                  : new Map(input2).set(input, "failed"),
            );
        },
        [],
      ),
      hasPaintedBoard: Dynamic = [...paintStates.values()].includes("painted"),
      [paintTimeoutElapsed, setPaintTimeoutElapsed]: Dynamic = (0,
      ReactCover.useState)(false);
    (0, ReactCover.useEffect)((): Dynamic => {
      if (!hasCover) return;
      let value: Dynamic = setTimeout(
        (): Dynamic => setPaintTimeoutElapsed(true),
        COVER_PAINT_TIMEOUT_MS,
      );
      return (): Dynamic => clearTimeout(value);
    }, [hasCover]);
    let thumbnailReady: Dynamic = hasCover
      ? paintStates.size >= boards.length ||
        (paintTimeoutElapsed && hasPaintedBoard)
      : isLoaded && !hasArtboards;
    (0, ReactCover.useEffect)((): Dynamic => {
      thumbnailReady &&
        requestAnimationFrame(
          (): Dynamic => (0, runtime.markCaptureFramesReady)(),
        );
    }, [thumbnailReady]);
    let renderBoard: Dynamic = (input?: Dynamic): Dynamic =>
        (() => {
          const _Component = Board;
          const _props = {
            file: input.file,
            displayTitle: input.title ?? input.file,
            assets: assets,
            doc: doc,
            focused: false,
            editable: false,
            panelMounted: false,
            frameArmed: true,
            expanded: true,
            onReadyGen: onBoardPainted,
            onBlockedChange: onBoardBlocked,
            onHandle: ignoreCoverCallback,
            onPreviewDropNotice: ignoreCoverCallback,
            onSessionDirtyChange: ignoreCoverCallback,
            onUndoStack: ignoreCoverCallback,
            exitGuardRef: exitGuardRef,
            textEditOpenRef: textEditOpenRef,
            settleSessionRef: settleSessionRef,
            actionsRef: actionsRef,
          } as const;
          const _key = input.file;
          return <_Component key={_key} {..._props} />;
        })(),
      firstBoard: Dynamic = boards[0];
    return (
      <runtime.EditorChromeRoot>
        <runtime.EditorToastProvider>
          {isSnapshot ? (
            <CanvasSnapshotCover
              boards={boards}
              veiled={!hasPaintedBoard}
              empty={(input?: Dynamic): Dynamic =>
                paintStates.get(input.file) !== "painted"
              }
            >
              {renderBoard}
            </CanvasSnapshotCover>
          ) : (
            <SingleArtboardCover
              w={firstBoard?.w}
              h={firstBoard?.h}
              veiled={firstBoard !== undefined && !hasPaintedBoard}
            >
              {firstBoard !== undefined ? renderBoard(firstBoard) : null}
            </SingleArtboardCover>
          )}
        </runtime.EditorToastProvider>
      </runtime.EditorChromeRoot>
    );
  }
  function SingleArtboardCover({
    w: width,
    h: height,
    veiled: veiled,
    children: children,
  }: Dynamic): Dynamic {
    let containerRef: Dynamic = (0, ReactCover.useRef)(null),
      [scale, setScale]: Dynamic = (0, ReactCover.useState)(1);
    (0, ReactCover.useLayoutEffect)((): Dynamic => {
      let current: Dynamic = containerRef.current;
      if (!current || width === undefined || height === undefined) return;
      let callback: Dynamic = (): Dynamic =>
        setScale(
          Math.max(
            current.clientWidth / width,
            current.clientHeight / height,
          ) || 1,
        );
      callback();
      let observer: Dynamic = new ResizeObserver(callback);
      observer.observe(current);
      return (): Dynamic => observer.disconnect();
    }, [width, height]);
    return (
      <div
        ref={containerRef}
        data-design-cover={""}
        className={
          "fixed inset-0 flex items-start justify-center overflow-clip bg-om-bg-canvas"
        }
      >
        {width === undefined || height === undefined ? (
          children
        ) : (
          <div
            style={{
              width: width * scale,
              height: height * scale,
              flex: "none",
            }}
          >
            <div
              className={"relative flex flex-col overflow-hidden bg-white"}
              style={{
                width: width,
                height: height,
                transform: "scale(" + String(scale) + ")",
                transformOrigin: "top left",
              }}
            >
              {children}
            </div>
          </div>
        )}
        {veiled ? (
          <div
            data-design-cover-veil={""}
            className={"absolute inset-0 bg-om-bg-canvas"}
          />
        ) : null}
      </div>
    );
  }
  function CanvasSnapshotCover({
    boards: boards,
    veiled: veiled,
    empty: isEmptyBoard,
    children: renderBoard,
  }: Dynamic): Dynamic {
    let containerRef: Dynamic = (0, ReactCover.useRef)(null),
      [viewport, setViewport]: Dynamic = (0, ReactCover.useState)({
        w: 0,
        h: 0,
      });
    (0, ReactCover.useLayoutEffect)((): Dynamic => {
      let current: Dynamic = containerRef.current;
      if (!current) return;
      let callback: Dynamic = (): Dynamic =>
        setViewport({
          w: current.clientWidth,
          h: current.clientHeight,
        });
      callback();
      let observer: Dynamic = new ResizeObserver(callback);
      observer.observe(current);
      return (): Dynamic => observer.disconnect();
    }, []);
    let {
        left: left,
        top: top,
        w: width,
        h: height,
        scale: scale,
      }: Dynamic = computeCoverBounds(boards, viewport.w, viewport.h),
      borderShadow: Dynamic =
        "0 0 0 " + String(scale > 0 ? 1 / scale : 0) + "px var(--cds-border)";
    return (
      <div
        ref={containerRef}
        data-design-cover={""}
        className={
          "fixed inset-0 flex items-center justify-center overflow-clip bg-om-bg-canvas"
        }
      >
        <div
          style={{
            width: width * scale,
            height: height * scale,
            flex: "none",
          }}
        >
          <div
            className={"relative"}
            style={{
              width: width,
              height: height,
              transform: "scale(" + String(scale) + ")",
              transformOrigin: "top left",
            }}
          >
            {boards.map(
              (input?: Dynamic): Dynamic =>
                (() => {
                  const _Component2 = "div";
                  const _props2 = {
                    className:
                      "absolute isolate flex flex-col overflow-hidden bg-white",
                    style: {
                      left: input.x - left,
                      top: input.y - top,
                      width: input.w,
                      height: input.h,
                      boxShadow: borderShadow,
                      borderRadius: (0, runtime.artboardRadiusCss)(
                        input.radius,
                      ),
                    },
                    children: [
                      renderBoard(input),
                      isEmptyBoard(input) ? (
                        <div
                          data-design-cover-empty={""}
                          className={"absolute inset-0 z-20 bg-om-bg-canvas"}
                        />
                      ) : null,
                    ],
                  } as const;
                  const _key2 = input.file;
                  return <_Component2 key={_key2} {..._props2} />;
                })(),
            )}
          </div>
        </div>
        {veiled ? (
          <div
            data-design-cover-veil={""}
            className={"absolute inset-0 bg-om-bg-canvas"}
          />
        ) : null}
      </div>
    );
  }
  bindRuntimeValue(
    runtime,
    "ReactCover",
    () => ReactCover,
    (value) => {
      ReactCover = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_COVER_ARTBOARDS",
    () => MAX_COVER_ARTBOARDS,
    (value) => {
      MAX_COVER_ARTBOARDS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COVER_VIEWPORT_PADDING",
    () => COVER_VIEWPORT_PADDING,
    (value) => {
      COVER_VIEWPORT_PADDING = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COVER_ASPECT_LIMITS",
    () => COVER_ASPECT_LIMITS,
    (value) => {
      COVER_ASPECT_LIMITS = value;
    },
  );
  bindRuntimeValue(runtime, "computeCoverBounds", () => computeCoverBounds);
  bindRuntimeValue(runtime, "selectCoverArtboard", () => selectCoverArtboard);
  bindRuntimeValue(
    runtime,
    "selectCoverSnapshotBoards",
    () => selectCoverSnapshotBoards,
  );
  bindRuntimeValue(runtime, "selectDesignCover", () => selectDesignCover);
  bindRuntimeValue(
    runtime,
    "coverJsxRuntime",
    () => coverJsxRuntime,
    (value) => {
      coverJsxRuntime = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ignoreCoverCallback",
    () => ignoreCoverCallback,
    (value) => {
      ignoreCoverCallback = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COVER_PAINT_TIMEOUT_MS",
    () => COVER_PAINT_TIMEOUT_MS,
    (value) => {
      COVER_PAINT_TIMEOUT_MS = value;
    },
  );
  bindRuntimeValue(runtime, "DesignCover", () => DesignCover);
  bindRuntimeValue(runtime, "SingleArtboardCover", () => SingleArtboardCover);
  bindRuntimeValue(runtime, "CanvasSnapshotCover", () => CanvasSnapshotCover);
  return () => {
    ReactCover = (0, runtime.toModuleNamespace)((0, runtime.load_react)(), 1);
    MAX_COVER_ARTBOARDS = 24;
    COVER_VIEWPORT_PADDING = 24;
    COVER_ASPECT_LIMITS = {
      narrow: 1.5,
      wide: 2.5,
    };
    coverJsxRuntime = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    ignoreCoverCallback = (): Dynamic => {};
    COVER_PAINT_TIMEOUT_MS = 6e3;
  };
}
