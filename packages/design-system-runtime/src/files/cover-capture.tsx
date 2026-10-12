import type * as Boot from "../contracts/boot";
import type * as Model from "../contracts";
import type * as Storage from "../contracts/model-storage";
import type * as Dom from "../contracts/dom";
import type * as Host from "../contracts/platform-host";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installFilesCoverCapture(runtime: RuntimeBindings): () => void {
  var reactCoverCapture: typeof React;
  var reactDomCoverCapture: typeof import("react-dom/client");
  var jsxCoverCapture: typeof import("react/jsx-runtime");
  var COVER_COMPONENT_DIRECTORY: string;
  var COVER_CAPTURE_REQUIRED_PATHS: string[];
  var COVER_CAPTURE_FETCH_TIMEOUT_MS: number;
  var COVER_CAPTURE_FONT_LIMITS: Boot.CoverFontLimits;
  var COVER_CAPTURE_TIMEOUT_MS: number;
  var COVER_CAPTURE_PAGE_WIDTH: number;
  var COVER_CAPTURE_VIEWPORT_RATIO: {
    width: number;
    height: number;
  };
  var defaultCoverCaptureReader: Boot.CoverCaptureReader;
  async function fetchCoverCaptureFile(url: string): Promise<Response | null> {
    let response = await fetch(url, {
      signal: AbortSignal.timeout(COVER_CAPTURE_FETCH_TIMEOUT_MS),
    });
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw Error(url + " answered " + String(response.status));
    }
    return response;
  }
  function coverHtmlContainsScript(html: string): boolean {
    return /<script[\s/>]/i.test(html);
  }
  function coverFontDataUri(bytes: Uint8Array, mime: string): string {
    let base64 = "";
    for (let index = 0; index < bytes.length; index += 32768) {
      base64 += String.fromCharCode(...bytes.subarray(index, index + 32768));
    }
    return "data:" + mime + ";base64," + btoa(base64);
  }
  async function readCoverCaptureFonts(
    paths: string[],
    reader: Boot.CoverCaptureReader,
    limits: Boot.CoverFontLimits,
  ): Promise<Record<string, string>> {
    let fonts: Record<string, string> = {},
      remainingBytes = limits.bytes,
      done: boolean = false,
      reads = [...new Set(paths)]
        .filter(
          (input) =>
            (0, runtime.assetKindForPath)(input) === "font" &&
            !COVER_CAPTURE_REQUIRED_PATHS.includes(input) &&
            !/[%?#]/.test(input),
        )
        .slice(0, limits.files)
        .map(async (input): Promise<void> => {
          try {
            let value = await reader.bytes(
                (0, runtime.projectFilePath)(
                  (0, runtime.encodeRelativeUrlPath)(input),
                ),
              ),
              value2 =
                value === null
                  ? 0
                  : value.length *
                    paths.filter((input2): boolean => input2 === input).length;
            if (done || value === null || value2 > remainingBytes) {
              return;
            }
            remainingBytes -= value2;
            fonts[input] = coverFontDataUri(
              value,
              (0, runtime.mimeTypeForPath)(input),
            );
          } catch {}
        });
    await Promise.race([
      Promise.all(reads),
      new Promise((input) => setTimeout(input, limits.deadlineMs)),
    ]);
    done = true;
    return {
      ...fonts,
    };
  }
  async function readCoverCaptureSystem(
    reader: Boot.CoverCaptureReader = defaultCoverCaptureReader,
    limits: Boot.CoverFontLimits = COVER_CAPTURE_FONT_LIMITS,
  ): Promise<Boot.CapturedCover | null> {
    let textFiles = await Promise.all(
        COVER_CAPTURE_REQUIRED_PATHS.map((input) =>
          reader.text((0, runtime.projectFilePath)(input)),
        ),
      ),
      files: Record<string, string> = {};
    COVER_CAPTURE_REQUIRED_PATHS.forEach((input, options): void => {
      let value = textFiles[options];
      if (typeof value === "string") {
        files[input] = value;
      }
    });
    let system = (0, runtime.parseDesignSystemFiles)(files);
    if (
      system.cover === null ||
      system.cover.previewHtml.trim() === "" ||
      coverHtmlContainsScript(system.cover.previewHtml)
    ) {
      return null;
    }
    let fontFiles = await readCoverCaptureFonts(
        system.tokens.type.fonts.map((input) => input.file),
        reader,
        limits,
      ),
      fontPaths = Object.keys(fontFiles),
      capturedSystem =
        fontPaths.length === 0
          ? system
          : (0, runtime.parseDesignSystemFiles)({
              ...files,
              ...fontFiles,
            });
    if (capturedSystem.cover === null) {
      return null;
    } else {
      return {
        system: capturedSystem,
        fonts: fontPaths,
      };
    }
  }
  function loadCoverCaptureFontFaces({
    system,
    fonts,
  }: Boot.CapturedCover): Promise<void | PromiseSettledResult<FontFace>[]> {
    if (typeof FontFace === "undefined") {
      return Promise.resolve();
    }
    let loads = system.tokens.type.fonts
      .filter((input) => fonts.includes(input.file))
      .map((input) =>
        new FontFace(
          input.family,
          'url("' + (system.files[input.file] ?? "") + '")',
          {
            weight: input.weight,
            style: input.style,
          },
        ).load(),
      );
    return Promise.allSettled(loads);
  }
  function coverCaptureFitWidth(
    viewportWidth: number,
    viewportHeight: number,
    pageHeight: number,
  ): number {
    return Math.floor(
      Math.min(
        viewportWidth * COVER_CAPTURE_VIEWPORT_RATIO.width,
        (viewportHeight *
          COVER_CAPTURE_VIEWPORT_RATIO.height *
          COVER_CAPTURE_PAGE_WIDTH) /
          pageHeight,
      ),
    );
  }
  function CapturedDesignSystemCover({
    captured,
    onPainted,
  }: {
    captured: Boot.CapturedCover;
    onPainted(): void;
  }): React.ReactElement | null {
    let { system: value } = captured,
      ref = reactCoverCapture.useRef<HTMLDivElement | null>(null),
      value2 = (0, runtime.useHostThemeMode)(),
      { hostThemeId: value3, hostThemeMode: value4 } = (0,
      runtime.resolvePreviewTheme)(value.tokens.color.themes, value2, null),
      head = (0, runtime.createPreviewHead)(
        value,
        value4,
        value3,
        false,
        undefined,
        !(
          runtime.preferLivePreviewUrls &&
          (0, runtime.supportsLivePreviewUrls)()
        ),
      ).head,
      memo = reactCoverCapture.useMemo(
        () => ({
          ...head,
          tokensCss:
            (head.fontsCss ?? "") +
            head.tokensCss +
            "html{overflow:hidden!important}",
        }),
        [head],
      ),
      memo2 = reactCoverCapture.useMemo(
        () => loadCoverCaptureFontFaces(captured),
        [captured],
      );
    reactCoverCapture.useLayoutEffect(() => {
      let value7 = ref.current?.querySelector("iframe");
      if (value7 == null) {
        return;
      }
      let flag: boolean = true,
        callback = (input: () => void) =>
          void requestAnimationFrame(() => requestAnimationFrame(input)),
        callback2 = () =>
          void memo2.then((): void => {
            if (flag) {
              callback((): void => {
                if (flag) {
                  onPainted();
                }
              });
            }
          });
      value7.addEventListener("load", callback2, {
        once: true,
      });
      return (): void => {
        flag = false;
        value7.removeEventListener("load", callback2);
      };
    }, [memo, memo2, onPainted]);
    if (value.cover === null) {
      return null;
    }
    let value5 = (0, runtime.clampComponentStageHeight)(value.cover.height),
      value6 = coverCaptureFitWidth(
        document.documentElement.clientWidth,
        document.documentElement.clientHeight,
        value5,
      );
    return (
      <div
        className={"flex h-screen items-center justify-center"}
        data-testid={"ds-capture-cover"}
      >
        <div
          ref={ref}
          className={
            "ds-comp-preview-box overflow-hidden rounded-lg border border-border-line"
          }
        >
          <runtime.StaticPreviewFrame
            html={value.cover.previewHtml}
            head={memo}
            pageW={COVER_CAPTURE_PAGE_WIDTH}
            pageH={value5}
            fitWidth={value6}
            title={"Cover"}
          />
        </div>
      </div>
    );
  }
  async function renderDesignSystemCoverCapture(
    root: HTMLElement | null = document.getElementById("root"),
    reader: Boot.CoverCaptureReader = defaultCoverCaptureReader,
    timeoutMs: number = COVER_CAPTURE_TIMEOUT_MS,
  ): Promise<void> {
    let fallbackTimer = setTimeout(
        () => (0, runtime.prepareDesignSystemThumbnailCapture)(),
        timeoutMs,
      ),
      captured = await readCoverCaptureSystem(reader).catch((): null => null);
    if (captured === null || root === null) {
      clearTimeout(fallbackTimer);
      return (0, runtime.prepareDesignSystemThumbnailCapture)();
    }
    let painted = (): void => {
      clearTimeout(fallbackTimer);
      (0, runtime.markThumbnailReady)();
    };
    reactDomCoverCapture
      .createRoot(root)
      .render(
        <CapturedDesignSystemCover captured={captured} onPainted={painted} />,
      );
  }
  async function captureDesignSystemAndHoldBoot(): Promise<void> {
    await renderDesignSystemCoverCapture().catch(() =>
      (0, runtime.prepareDesignSystemThumbnailCapture)(),
    );
    return new Promise((): void => {
      return;
    });
  }
  bindRuntimeValue(
    runtime,
    "reactCoverCapture",
    () => reactCoverCapture,
    (value) => {
      reactCoverCapture = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactDomCoverCapture",
    () => reactDomCoverCapture,
    (value) => {
      reactDomCoverCapture = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxCoverCapture",
    () => jsxCoverCapture,
    (value) => {
      jsxCoverCapture = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COVER_COMPONENT_DIRECTORY",
    () => COVER_COMPONENT_DIRECTORY,
    (value) => {
      COVER_COMPONENT_DIRECTORY = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COVER_CAPTURE_REQUIRED_PATHS",
    () => COVER_CAPTURE_REQUIRED_PATHS,
    (value) => {
      COVER_CAPTURE_REQUIRED_PATHS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COVER_CAPTURE_FETCH_TIMEOUT_MS",
    () => COVER_CAPTURE_FETCH_TIMEOUT_MS,
    (value) => {
      COVER_CAPTURE_FETCH_TIMEOUT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COVER_CAPTURE_FONT_LIMITS",
    () => COVER_CAPTURE_FONT_LIMITS,
    (value) => {
      COVER_CAPTURE_FONT_LIMITS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COVER_CAPTURE_TIMEOUT_MS",
    () => COVER_CAPTURE_TIMEOUT_MS,
    (value) => {
      COVER_CAPTURE_TIMEOUT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COVER_CAPTURE_PAGE_WIDTH",
    () => COVER_CAPTURE_PAGE_WIDTH,
    (value) => {
      COVER_CAPTURE_PAGE_WIDTH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COVER_CAPTURE_VIEWPORT_RATIO",
    () => COVER_CAPTURE_VIEWPORT_RATIO,
    (value) => {
      COVER_CAPTURE_VIEWPORT_RATIO = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fetchCoverCaptureFile",
    () => fetchCoverCaptureFile,
  );
  bindRuntimeValue(
    runtime,
    "defaultCoverCaptureReader",
    () => defaultCoverCaptureReader,
    (value) => {
      defaultCoverCaptureReader = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "coverHtmlContainsScript",
    () => coverHtmlContainsScript,
  );
  bindRuntimeValue(runtime, "coverFontDataUri", () => coverFontDataUri);
  bindRuntimeValue(
    runtime,
    "readCoverCaptureFonts",
    () => readCoverCaptureFonts,
  );
  bindRuntimeValue(
    runtime,
    "readCoverCaptureSystem",
    () => readCoverCaptureSystem,
  );
  bindRuntimeValue(
    runtime,
    "loadCoverCaptureFontFaces",
    () => loadCoverCaptureFontFaces,
  );
  bindRuntimeValue(runtime, "coverCaptureFitWidth", () => coverCaptureFitWidth);
  bindRuntimeValue(
    runtime,
    "CapturedDesignSystemCover",
    () => CapturedDesignSystemCover,
  );
  bindRuntimeValue(
    runtime,
    "renderDesignSystemCoverCapture",
    () => renderDesignSystemCoverCapture,
  );
  bindRuntimeValue(
    runtime,
    "captureDesignSystemAndHoldBoot",
    () => captureDesignSystemAndHoldBoot,
  );
  return () => {
    reactCoverCapture = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    reactDomCoverCapture = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactDomClientNamespace)(),
      1,
    );
    jsxCoverCapture = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    COVER_COMPONENT_DIRECTORY =
      runtime.DESIGN_SYSTEM_PATHS.componentsDir +
      runtime.COVER_COMPONENT_NAME +
      "/";
    COVER_CAPTURE_REQUIRED_PATHS = [
      COVER_COMPONENT_DIRECTORY + runtime.COMPONENT_FILENAMES.preview,
      runtime.DESIGN_SYSTEM_PATHS.tokens,
      runtime.DESIGN_SYSTEM_PATHS.bundleCss,
      COVER_COMPONENT_DIRECTORY + runtime.COMPONENT_FILENAMES.readme,
      COVER_COMPONENT_DIRECTORY + runtime.COVER_COMPONENT_NAME + ".d.ts",
      runtime.DESIGN_SYSTEM_PATHS.bundleJs,
    ];
    COVER_CAPTURE_FETCH_TIMEOUT_MS = 3000;
    COVER_CAPTURE_FONT_LIMITS = {
      files: 12,
      bytes: 4194304,
      deadlineMs: 2500,
    };
    COVER_CAPTURE_TIMEOUT_MS = 6000;
    COVER_CAPTURE_PAGE_WIDTH = 960;
    COVER_CAPTURE_VIEWPORT_RATIO = {
      width: 0.78,
      height: 0.76,
    };
    defaultCoverCaptureReader = {
      text: async (input) =>
        (await fetchCoverCaptureFile(input))?.text() ?? null,
      bytes: async (input) => {
        let value = await fetchCoverCaptureFile(input);
        if (value === null) {
          return null;
        } else {
          return new Uint8Array(await value.arrayBuffer());
        }
      },
    };
  };
}
