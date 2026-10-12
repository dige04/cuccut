/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorFeedbackAttachments(
  runtime: RuntimeBindings,
): () => void {
  var feedbackControlCharacterPattern: Dynamic;
  var FeedbackAttachmentsCache: Dynamic;
  function escapeFeedbackHtml(input?: Dynamic): Dynamic {
    return String(input ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
  function normalizeFeedbackText(input?: Dynamic): Dynamic {
    return String(input ?? "").replace(feedbackControlCharacterPattern, "?");
  }
  function rememberFeedbackLabel(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    if (context.delegated) return;
    let value: Dynamic = normalizeFeedbackText(input.trim());
    value && FeedbackAttachmentsCache.set(options ?? value, value);
  }
  function sendEditorAttachments(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    (0, runtime.emitEditorEvent)("autosend-attachments", {
      label: input,
      attachments: options,
      kind: context,
      via: value.via,
      queueOnly: value.queueOnly,
    });
  }
  bindRuntimeValue(runtime, "escapeFeedbackHtml", () => escapeFeedbackHtml);
  bindRuntimeValue(
    runtime,
    "feedbackControlCharacterPattern",
    () => feedbackControlCharacterPattern,
    (value) => {
      feedbackControlCharacterPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizeFeedbackText",
    () => normalizeFeedbackText,
  );
  bindRuntimeValue(
    runtime,
    "FeedbackAttachmentsCache",
    () => FeedbackAttachmentsCache,
    (value) => {
      FeedbackAttachmentsCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "rememberFeedbackLabel",
    () => rememberFeedbackLabel,
  );
  bindRuntimeValue(
    runtime,
    "sendEditorAttachments",
    () => sendEditorAttachments,
  );
  return () => {
    feedbackControlCharacterPattern = new RegExp(
      `[<>\r
\x85\u2028\u2029]`,
      "g",
    );
    FeedbackAttachmentsCache = new Map();
  };
}
