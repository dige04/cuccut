/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPlatformFilesFallback(
  runtime: RuntimeBindings,
): () => void {
  var escapeErrorHtml: Dynamic;
  var CANVAS_LOAD_ERROR_TITLE: Dynamic;
  var SKIPPED_FILE_NAME_PATTERN: Dynamic;
  var EMPTY_FILES_FALLBACK_CONTENT: Dynamic;
  var unavailableFilesCache: Dynamic;
  var SHARED_RUNTIME_SAVE_REASON: Dynamic;
  function createCanvasErrorState(
    input?: Dynamic,
    options: Dynamic = "The canvas could not be opened",
  ): Dynamic {
    return createErrorDocumentState(
      CANVAS_LOAD_ERROR_TITLE,
      options + " (" + input + ").",
    );
  }
  function createErrorDocumentState(
    title?: Dynamic,
    message?: Dynamic,
  ): Dynamic {
    let html: Dynamic =
      `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<script src="./support.js"><\/script>
</head>
<body>
<x-dc>
<helmet>
<style>body { margin: 0; background: #faf9f5; font-family: system-ui, sans-serif; color: #141413; }</style>
</helmet>
<div style="padding: 56px 64px; max-width: 720px">
<h1 style="margin: 0 0 16px 0; font-size: 32px; font-weight: 600">` +
      escapeErrorHtml(title) +
      `</h1>
<p style="margin: 0; font-size: 16px; line-height: 1.55; color: #5e5d59">` +
      escapeErrorHtml(message) +
      `</p>
</div>
</x-dc>
</body>
</html>
`;
    return {
      title: title,
      content: {
        files: {
          "Main.dc.html": html,
          "canvas.json": JSON.stringify({
            artboards: [
              {
                file: "Main.dc.html",
                x: 0,
                y: 0,
                w: 880,
                h: 360,
              },
            ],
          }),
        },
      },
      comments: [],
    };
  }
  function readBootstrapTitle(input?: Dynamic): Dynamic {
    let title: Dynamic = input.title;
    return typeof title == "string" && title.length > 0
      ? (0, runtime.truncateUtf16Safely)(title, 200)
      : undefined;
  }
  function createStaticWritableCache(input?: Dynamic): Dynamic {
    return {
      read: (): Dynamic => input,
      write: (): Dynamic => true,
      clear(): Dynamic {},
    };
  }
  function createFilesFallbackDocument(bootResult?: Dynamic): Dynamic {
    let state: Dynamic =
        bootResult.origin === "failed"
          ? createCanvasErrorState(bootResult.error ?? "")
          : bootResult.state,
      skipped: Dynamic = bootResult.skipped ?? [],
      displayedSkippedFiles: Dynamic = skipped
        .filter(
          (input?: Dynamic): Dynamic => SKIPPED_FILE_NAME_PATTERN.test(input),
        )
        .slice(0, 5),
      value: Dynamic =
        bootResult.origin === "failed"
          ? "This canvas couldn\u2019t be loaded."
          : (bootResult.origin === "demo" && bootResult.indexFound === true
              ? SHARED_RUNTIME_SAVE_REASON +
                " This is the demo canvas: the canvas\u2019s own design.json couldn\u2019t be used (" +
                (0, runtime.truncateUtf16Safely)(bootResult.error ?? "", 300) +
                ")."
              : SHARED_RUNTIME_SAVE_REASON) +
            (skipped.length > 0
              ? " " +
                String(skipped.length) +
                " listed file" +
                (skipped.length > 1 ? "s" : "") +
                " couldn\u2019t be loaded" +
                (displayedSkippedFiles.length > 0
                  ? " (" +
                    displayedSkippedFiles.join(", ") +
                    (skipped.length > displayedSkippedFiles.length
                      ? ", \u2026"
                      : "") +
                    ")"
                  : "") +
                "."
              : "");
    return {
      options: {
        embeddedState: state,
        pageParts: EMPTY_FILES_FALLBACK_CONTENT,
        roFlag: createStaticWritableCache(value),
        stash: unavailableFilesCache,
        canPublish: true,
      },
      title: readBootstrapTitle(state),
    };
  }
  function logFilesBootstrapError(input?: Dynamic): Dynamic {
    input.error !== undefined &&
      (input.origin === "failed" || input.indexFound === true) &&
      console.warn("design (files mode): " + input.error);
    let { options: value, title: value2 }: Dynamic =
      createFilesFallbackDocument(input);
    value2 !== undefined && ((document as Dynamic).title = value2);
    return value;
  }
  bindRuntimeValue(
    runtime,
    "escapeErrorHtml",
    () => escapeErrorHtml,
    (value) => {
      escapeErrorHtml = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CANVAS_LOAD_ERROR_TITLE",
    () => CANVAS_LOAD_ERROR_TITLE,
    (value) => {
      CANVAS_LOAD_ERROR_TITLE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createCanvasErrorState",
    () => createCanvasErrorState,
  );
  bindRuntimeValue(
    runtime,
    "createErrorDocumentState",
    () => createErrorDocumentState,
  );
  bindRuntimeValue(
    runtime,
    "SKIPPED_FILE_NAME_PATTERN",
    () => SKIPPED_FILE_NAME_PATTERN,
    (value) => {
      SKIPPED_FILE_NAME_PATTERN = value;
    },
  );
  bindRuntimeValue(runtime, "readBootstrapTitle", () => readBootstrapTitle);
  bindRuntimeValue(
    runtime,
    "EMPTY_FILES_FALLBACK_CONTENT",
    () => EMPTY_FILES_FALLBACK_CONTENT,
    (value) => {
      EMPTY_FILES_FALLBACK_CONTENT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createStaticWritableCache",
    () => createStaticWritableCache,
  );
  bindRuntimeValue(
    runtime,
    "unavailableFilesCache",
    () => unavailableFilesCache,
    (value) => {
      unavailableFilesCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SHARED_RUNTIME_SAVE_REASON",
    () => SHARED_RUNTIME_SAVE_REASON,
    (value) => {
      SHARED_RUNTIME_SAVE_REASON = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createFilesFallbackDocument",
    () => createFilesFallbackDocument,
  );
  bindRuntimeValue(
    runtime,
    "logFilesBootstrapError",
    () => logFilesBootstrapError,
  );
  return () => {
    escapeErrorHtml = (input?: Dynamic): Dynamic =>
      input.replace(
        /[&<>"'{]/g,
        (input2?: Dynamic): Dynamic =>
          "&#" + String(input2.charCodeAt(0)) + ";",
      );
    CANVAS_LOAD_ERROR_TITLE = "Couldn\u2019t load this canvas";
    SKIPPED_FILE_NAME_PATTERN = /^[A-Za-z0-9._-]{1,40}$/;
    EMPTY_FILES_FALLBACK_CONTENT = {
      title: "",
      readme: "",
      readmeMeta: "",
      css: "",
      js: "",
      emulator: false,
    };
    unavailableFilesCache = {
      read: (): Dynamic => null,
      write: (): Dynamic => false,
      clear(): Dynamic {},
    };
    SHARED_RUNTIME_SAVE_REASON =
      "This canvas is served from the shared Design runtime. Saving from the page isn\u2019t available yet; it opens here for viewing only.";
  };
}
