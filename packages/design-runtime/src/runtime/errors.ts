/**
 * Reconstructed errors subsystem of the Design Component runtime.
 * Source declarations: dc-runtime.js offsets 166769..167221.
 * Semantic names are inferred from the shipped behavior; see runtime-map.json.
 */

import type {
  RuntimeValue,
  Keyframe,
  PropsMetadata,
  ParsedDesignComponent,
  ComponentRegistry,
  StreamingTracker,
  RenderValues,
  TemplateContext,
  CompiledTemplate,
  DesignRuntime,
  RuntimeOptions,
} from "./types";
export var MAX_REPORTED_ERRORS = 10,
  MAX_ERROR_MESSAGE_LENGTH = 300,
  truncateErrorMessage: RuntimeValue = (message?: RuntimeValue): RuntimeValue =>
    message.length > MAX_ERROR_MESSAGE_LENGTH
      ? message.slice(0, MAX_ERROR_MESSAGE_LENGTH - 1) + "\u2026"
      : message;
export function createErrorReporter(
  notify?: RuntimeValue,
  schedule?: RuntimeValue,
  isStreaming?: RuntimeValue,
): RuntimeValue {
  const messages: RuntimeValue = new Map();
  let lastSerialized: RuntimeValue = null,
    scheduled = false;
  const flush: RuntimeValue = (): RuntimeValue => {
      if (isStreaming()) {
        schedule(flush);
        return;
      }
      scheduled = false;
      const errors: RuntimeValue = [...new Set(messages.values())]
          .slice(0, MAX_REPORTED_ERRORS)
          .map(
            (message?: RuntimeValue): RuntimeValue => ({
              message: truncateErrorMessage(message),
            }),
          ),
        serialized: RuntimeValue = JSON.stringify(errors);
      serialized !== lastSerialized && ((lastSerialized = serialized), notify(errors));
    },
    requestFlush: RuntimeValue = (): RuntimeValue => {
      scheduled || ((scheduled = true), schedule(flush));
    };
  return {
    show(message?: RuntimeValue): RuntimeValue {
      const token: RuntimeValue = {};
      messages.set(token, message);
      requestFlush();
      return (): RuntimeValue => {
        messages.delete(token);
        requestFlush();
      };
    },
    begin: requestFlush,
  };
}
export var errorReporter: RuntimeValue = null;
export function setErrorReporter(reporter?: RuntimeValue): RuntimeValue {
  errorReporter = reporter;
}
export function reportError(message?: RuntimeValue): RuntimeValue {
  return errorReporter?.show(message);
}
export function beginErrorReporting(): RuntimeValue {
  errorReporter?.begin();
}
