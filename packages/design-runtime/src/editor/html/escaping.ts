/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorHtmlEscaping(
  runtime: RuntimeBindings,
): () => void {
  var HtmlEscapingConfig: Dynamic;
  function escapeHtml(text?: Dynamic): Dynamic {
    return text.replace(
      /[&<>"']/g,
      (input?: Dynamic): Dynamic => HtmlEscapingConfig[input],
    );
  }
  function escapeHtmlAttributeValue(value?: Dynamic): Dynamic {
    return value
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
  bindRuntimeValue(
    runtime,
    "HtmlEscapingConfig",
    () => HtmlEscapingConfig,
    (value) => {
      HtmlEscapingConfig = value;
    },
  );
  bindRuntimeValue(runtime, "escapeHtml", () => escapeHtml);
  bindRuntimeValue(
    runtime,
    "escapeHtmlAttributeValue",
    () => escapeHtmlAttributeValue,
  );
  return () => {
    HtmlEscapingConfig = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
  };
}
