import type * as Boot from "../contracts/boot";
import type * as Model from "../contracts";
import type * as Storage from "../contracts/model-storage";
import type * as Dom from "../contracts/dom";
import type * as Host from "../contracts/platform-host";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installFilesLegacyStateReader(
  runtime: RuntimeBindings,
): () => void {
  var LegacyStateReadFailure: Boot.LegacyFailureConstructor;
  var LEGACY_STATE_AMBIGUOUS_RETRY_MS: number;
  async function readLegacyStateFile(
    fetchFile: NonNullable<Boot.LegacyReadOptions["fetch"]>,
    path: string,
    read: Boot.LegacyReadOptions["read"],
    readPath: string = path,
  ): Promise<Boot.LegacyReadAnswer> {
    try {
      let value = await fetchFile(path);
      if (!value.ok) {
        return new LegacyStateReadFailure(
          path + ": HTTP " + String(value.status),
          "fetch",
          value.status === 404,
          true,
          value.status,
        );
      }
      let value2 = await value.text(),
        value3: Boot.LegacyReadSuccess | string;
      try {
        value3 = read(value2, readPath);
      } catch {
        return new LegacyStateReadFailure(path + ": unreadable", "read");
      }
      if (typeof value3 === "string") {
        return new LegacyStateReadFailure(path + ": " + value3, "read");
      } else {
        return value3;
      }
    } catch (value: unknown) {
      return new LegacyStateReadFailure(
        path + ": " + (value instanceof Error ? value.message : String(value)),
        "fetch",
        false,
        false,
      );
    }
  }
  async function readLegacyDesignSystemState(
    options: Boot.LegacyReadOptions,
  ): Promise<Boot.LegacyInitialState> {
    let fetchFile = options.fetch ?? ((input) => fetch(input)),
      statePaths =
        options.stateFiles ??
        (options.stateFile !== undefined ? [options.stateFile] : []),
      answers = await Promise.all(
        statePaths.map((input) =>
          readLegacyStateFile(fetchFile, input, options.read),
        ),
      ),
      answerKind = (input: Boot.LegacyReadAnswer): Boot.LegacyAnswerKind =>
        !(input instanceof LegacyStateReadFailure)
          ? "accepted"
          : input.missing
            ? "missing"
            : input.at === "read"
              ? "refused"
              : "unread",
      isAccessDenied = (
        state: Boot.LegacyReadAnswer,
      ): state is Boot.LegacyFailure =>
        state instanceof LegacyStateReadFailure &&
        (state.status === 401 || state.status === 403);
    if (
      options.mayWrite !== undefined &&
      answers.some(isAccessDenied) &&
      answers.some(
        (input): boolean => !(input instanceof LegacyStateReadFailure),
      )
    ) {
      let value =
          options.wait ??
          ((input) => new Promise((input2) => void setTimeout(input2, input))),
        value2 = await Promise.resolve()
          .then(() => options.mayWrite!())
          .catch((): void => {
            return;
          });
      if (value2 === true) {
        for (let value3 of options.refusedWaits ?? []) {
          if (!answers.some(isAccessDenied)) {
            break;
          }
          await value(value3);
          await Promise.all(
            answers.map(async (input, options2): Promise<void> => {
              if (isAccessDenied(input)) {
                answers[options2] = await readLegacyStateFile(
                  fetchFile,
                  statePaths[options2],
                  options.read,
                );
              }
            }),
          );
        }
      } else if (value2 === false) {
        answers.forEach((state, options2): void => {
          if (isAccessDenied(state)) {
            answers[options2] = new LegacyStateReadFailure(
              state.fail,
              "fetch",
              true,
              true,
              state.status,
            );
          }
        });
      }
    }
    if (
      statePaths.length > 1 &&
      answers.some((input): boolean => answerKind(input) === "unread")
    ) {
      await (
        options.wait ??
        ((input) => new Promise((input2) => void setTimeout(input2, input)))
      )(LEGACY_STATE_AMBIGUOUS_RETRY_MS);
      await Promise.all(
        answers.map(async (input, options2): Promise<void> => {
          if (answerKind(input) === "unread") {
            answers[options2] = await readLegacyStateFile(
              fetchFile,
              statePaths[options2],
              options.read,
            );
          }
        }),
      );
    }
    let stateFileAnswers = Object.fromEntries(
        statePaths.map((input, options2) => [
          input,
          answerKind(answers[options2]),
        ]),
      ),
      acceptedIndex = answers.findIndex(
        (input): boolean => !(input instanceof LegacyStateReadFailure),
      ),
      hasUnread = answers.some(
        (input) =>
          input instanceof LegacyStateReadFailure &&
          answerKind(input) === "unread",
      ),
      accepted =
        acceptedIndex >= 0 && !hasUnread
          ? (answers[acceptedIndex] as Boot.LegacyReadSuccess)
          : undefined,
      failures = answers.filter(
        (input): input is Boot.LegacyFailure =>
          input instanceof LegacyStateReadFailure,
      ),
      allMissing =
        failures.length === answers.length &&
        failures.every((input) => input.missing);
    options.onOwn?.(
      accepted !== undefined
        ? accepted.envelope
        : allMissing
          ? "missing"
          : "unreadable",
      stateFileAnswers,
    );
    if (accepted !== undefined) {
      return {
        state: accepted.envelope,
        origin: "instance",
        note: accepted.note,
        stateFileAt: statePaths[acceptedIndex],
        stateFileAnswers: stateFileAnswers,
      };
    }
    let failure =
        failures.find((input): boolean => !input.missing) ??
        failures[0] ??
        new LegacyStateReadFailure("no state file named", "fetch", true),
      demo = await readLegacyStateFile(
        fetchFile,
        options.demoFile,
        options.read,
        "demo",
      ),
      stateFileFound: boolean | undefined | boolean =
        failures.some((input) => input.answered && !input.missing) ||
        acceptedIndex >= 0
          ? true
          : failures.some((input): boolean => !input.answered)
            ? undefined
            : false;
    if (!(demo instanceof LegacyStateReadFailure)) {
      return {
        state: demo.envelope,
        origin: "demo",
        error: failure.fail,
        stateFileFound: stateFileFound,
        errorAt: failure.at,
        note: demo.note,
        stateFileAnswers: stateFileAnswers,
      };
    }
    let errorAt = failure.missing ? demo.at : failure.at;
    return {
      state: {},
      origin: "failed",
      error: failure.fail + "; " + demo.fail,
      stateFileFound: stateFileFound,
      errorAt: errorAt,
      stateFileAnswers: stateFileAnswers,
    };
  }
  bindRuntimeValue(
    runtime,
    "LegacyStateReadFailure",
    () => LegacyStateReadFailure,
    (value) => {
      LegacyStateReadFailure = value;
    },
  );
  bindRuntimeValue(runtime, "readLegacyStateFile", () => readLegacyStateFile);
  bindRuntimeValue(
    runtime,
    "LEGACY_STATE_AMBIGUOUS_RETRY_MS",
    () => LEGACY_STATE_AMBIGUOUS_RETRY_MS,
    (value) => {
      LEGACY_STATE_AMBIGUOUS_RETRY_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "readLegacyDesignSystemState",
    () => readLegacyDesignSystemState,
  );
  return () => {
    LegacyStateReadFailure = class LegacyStateReadFailure {
      fail: string;
      at: "fetch" | "read";
      missing: boolean;
      answered: boolean;
      status: number | undefined;
      constructor(
        input: string,
        options: Boot.LegacyFailure["at"],
        context: boolean = false,
        value: boolean = true,
        extra?: number,
      ) {
        this.fail = input;
        this.at = options;
        this.missing = context;
        this.answered = value;
        this.status = extra;
      }
    };
    LEGACY_STATE_AMBIGUOUS_RETRY_MS = 700;
  };
}
