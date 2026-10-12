/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type { CommandHistory, HistoryCommand } from "./command-history";

/** What a history step touched in the document, as reported by `takeTouched()`. */
export interface TouchedSummary {
  paths: string[];
  index: boolean;
  structural: boolean;
}
/** The slice of the document the deck history needs to detect remote changes that an undo would run over. */
export interface HistoryRevisionTokens {
  takeTouched(): TouchedSummary;
  structureRev(): number;
  slideRev(id: string): number;
  clashLocal(id: string): boolean;
}
/** Detail passed to the feedback callback of the deck history. */
export interface DeckHistoryFeedback {
  label: string | undefined;
  paths?: string[];
  index?: boolean;
  structural?: boolean;
  parked?: string[];
  declined?: string;
}
export type DeckHistoryEvent = "do" | "undo" | "redo" | "declined";
export interface DeckCommandHistoryOptions {
  /** Revision tokens of the live document, when it can supply them. */
  tokens?: () => HistoryRevisionTokens | undefined;
  /** Shows a message to the user. */
  tell?: (message: string) => void;
}

/** One recorded deck step: the wrapped command plus what it touched. */
interface DeckHistoryEntry {
  cmd: HistoryCommand;
  last(): DeckHistoryFeedback;
  didRun(): boolean;
}

declare module "../bindings" {
  interface RuntimeBindings {
    createDeckCommandHistory: (
      store: CommandHistory,
      readSlides: (reason: "undo" | "redo") => void,
      onFeedback?: (event: DeckHistoryEvent, detail: DeckHistoryFeedback) => void,
      options?: DeckCommandHistoryOptions,
    ) => CommandHistory;
  }
}

export function installEditorDeckCommandHistory(
  runtime: RuntimeBindings,
): () => void {
  function createDeckCommandHistory(
    store: CommandHistory,
    readSlides: (reason: "undo" | "redo") => void,
    onFeedback?: (event: DeckHistoryEvent, detail: DeckHistoryFeedback) => void,
    options: DeckCommandHistoryOptions = {},
  ): CommandHistory {
    let callback = (
        input: DeckHistoryEvent,
        options2: DeckHistoryFeedback,
      ): void => {
        try {
          onFeedback?.(input, options2);
        } catch {}
      },
      callback2 = (): HistoryRevisionTokens | undefined => {
        try {
          return options.tokens?.();
        } catch {
          return;
        }
      };
    function value(input: HistoryCommand, options2: boolean): DeckHistoryEntry {
      let flag = false,
        flag2 = false,
        index = 0,
        entries = new Map<string, number>(),
        value2: string | null = null,
        state: DeckHistoryFeedback = {
          label: input.label,
        },
        callback3 = (): void => {
          let value3 = callback2();
          flag = true;
          value2 = null;
          if (value3 === undefined) {
            return void (state = {
              label: input.label,
            });
          }
          let value4 = value3.takeTouched(),
            value5: string[] = value4.paths.flatMap(
              (input2: string): string | never[] =>
                (0, runtime.slideIdFromFilePath)(input2) ?? [],
            ),
            value6: string[] = value4.structural
              ? []
              : value5.filter(
                  (input2: string): boolean =>
                    entries.has(input2) &&
                    value3.slideRev(input2) !== entries.get(input2) &&
                    value3.clashLocal(input2),
                );
          for (let value7 of value5)
            entries.set(value7, value3.slideRev(value7));
          flag2 = flag2 || value4.structural;
          index = value3.structureRev();
          state = {
            label: input.label,
            paths: value4.paths,
            index: value4.index,
            structural: value4.structural,
            ...(value6.length > 0
              ? {
                  parked: value6,
                }
              : {}),
          };
        },
        callback4 = (input2: string): boolean => {
          let value3 = callback2();
          if (value3 === undefined || !flag || !flag2) {
            return true;
          }
          let value4 = [...entries]
              .filter(
                ([input3, input4]): boolean =>
                  value3.slideRev(input3) !== input4,
              )
              .map(([input3]): string => input3),
            value5 = value3.structureRev();
          if (value5 === index && value4.length === 0) {
            return true;
          }
          let value6 =
            String(value5) +
            "|" +
            value4
              .map(
                (input3: string): string =>
                  input3 + ":" + String(value3.slideRev(input3)),
              )
              .join(",");
          if (value2 === value6) {
            return true;
          }
          value2 = value6;
          let value7 =
            (value5 !== index
              ? "the slide list changed remotely (structure rev " +
                String(index) +
                " → " +
                String(value5) +
                ")"
              : "") +
            (value4.length > 0
              ? (value5 !== index ? "; " : "") +
                "slides changed remotely: " +
                value4.join(", ")
              : "");
          callback("declined", {
            label: input.label,
            declined: input2 + " would run over " + value7,
          });
          options.tell?.((0, runtime.conflictingUndoMessage)(input2));
          return false;
        },
        state2: HistoryCommand = {
          ...(input.label !== undefined
            ? {
                label: input.label,
              }
            : {}),
          canDo: (): boolean =>
            input.canDo?.() !== false && callback4("redo"),
          canUndo: (): boolean =>
            input.canUndo?.() !== false && callback4("undo"),
          do(): void {
            callback2()?.takeTouched();
            input.do();
            callback3();
          },
          undo(): void {
            callback2()?.takeTouched();
            input.undo();
            callback3();
          },
        };
      if (options2) {
        callback3();
      }
      return {
        cmd: state2,
        last: (): DeckHistoryFeedback => state,
        didRun: (): boolean => flag,
      };
    }
    let items: DeckHistoryEntry[] = [],
      items2: DeckHistoryEntry[] = [];
    return {
      exec(input: HistoryCommand): void {
        let value2 = value(input, false);
        store.exec(value2.cmd);
        if (!value2.didRun()) {
          return;
        }
        items.push(value2);
        items2.length = 0;
        callback("do", value2.last());
      },
      seed(input: HistoryCommand): void {
        let value2 = value(input, true);
        store.seed(value2.cmd);
        items.push(value2);
        items2.length = 0;
      },
      undo(): void {
        let value2 = store.redoDepth();
        store.undo();
        if (store.redoDepth() === value2) {
          return;
        }
        let value3 = items.pop();
        if (value3 !== undefined) {
          items2.push(value3);
        }
        readSlides("undo");
        callback(
          "undo",
          value3?.last() ?? {
            label: undefined,
          },
        );
      },
      redo(): void {
        let value2 = store.redoDepth();
        store.redo();
        if (store.redoDepth() === value2) {
          return;
        }
        let value3 = items2.pop();
        if (value3 !== undefined) {
          items.push(value3);
        }
        readSlides("redo");
        callback(
          "redo",
          value3?.last() ?? {
            label: undefined,
          },
        );
      },
      canUndo: (): boolean => store.canUndo(),
      canRedo: (): boolean => store.canRedo(),
      redoDepth: (): number => store.redoDepth(),
      clear(): void {
        store.clear();
        items.length = 0;
        items2.length = 0;
      },
      subscribe: (input: () => void): (() => boolean) => store.subscribe(input),
    };
  }
  bindRuntimeValue(
    runtime,
    "createDeckCommandHistory",
    () => createDeckCommandHistory,
  );
  return () => {};
}
