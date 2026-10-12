/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorTextPlaceholder(
  runtime: RuntimeBindings,
): () => void {
  var TextPlaceholderLabel: Dynamic;
  function placeholderTextElement(input?: Dynamic, options?: Dynamic): Dynamic {
    return options !== null && input?.text(options) === TextPlaceholderLabel
      ? options
      : null;
  }
  bindRuntimeValue(
    runtime,
    "TextPlaceholderLabel",
    () => TextPlaceholderLabel,
    (value) => {
      TextPlaceholderLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "placeholderTextElement",
    () => placeholderTextElement,
  );
  return () => {
    TextPlaceholderLabel = "Your text here";
  };
}
