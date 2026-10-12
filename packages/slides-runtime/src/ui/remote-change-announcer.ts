/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type ReactNamespace,
} from "../bindings";
import type { ArtifactChange } from "../documents/artifact-document";
import type { PresentationChangeAnnouncements } from "../editor/change-announcements";

/** The slice of the artifact document whose remote changes are announced. */
export interface RemoteChangeDocument {
  loadState?: () => string;
  subscribe: (listener: (change?: ArtifactChange) => void) => () => void;
}
/** Fingerprints of the deck's parts, keyed by slide id (or the deck key). */
export type RemoteChangeItems = () => Map<string, string>;
/** Timings the host may override. */
export interface RemoteChangeTimings {
  /** Grace period before the change is announced, in milliseconds. */
  graceMs?: number;
}
/** What the announcer needs from its environment. */
export interface RemoteChangeAnnouncerOptions {
  words: PresentationChangeAnnouncements;
  /** Runs `callback` after `ms` milliseconds; returns a function that cancels it. */
  after: (ms: number, callback: () => void) => () => void;
  /**
   * Announces `message`. `ifIdle` skips it while another announcement is
   * pending; `stillBusy` is asked just before it is spoken.
   */
  say: (message: string, ifIdle: boolean, stillBusy?: () => boolean) => void;
  /** Clears a pending announcement. */
  hush: () => void;
  onBusy: (busy: boolean) => void;
}
/** Announces what other writers (and the agent) change in the deck. */
export interface RemoteChangeAnnouncer {
  busy: () => boolean;
  /** Reports the agent's activity and whether the deck is empty. */
  set(working: boolean, empty: boolean, items: RemoteChangeItems): void;
  /** Reports a document change; `remote` tells whether another writer made it. */
  changed(remote: boolean, items: RemoteChangeItems): void;
  stop(): void;
}
export interface RemoteChangeAnnouncerProps {
  doc: RemoteChangeDocument;
  /** Whether the empty-deck creation flow is showing. */
  empty: boolean;
  items: RemoteChangeItems;
  words: PresentationChangeAnnouncements;
  onBusy: (busy: boolean) => void;
}

declare module "../bindings" {
  interface RuntimeBindings {
    reactsH: ReactNamespace;
    REMOTE_CHANGE_WORD_SEPARATOR: string;
    REMOTE_CHANGE_HOLD_MS: number;
    REMOTE_CHANGE_DELAY_MS: number;
    createRemoteChangeAnnouncer: (
      options: RemoteChangeAnnouncerOptions,
    ) => RemoteChangeAnnouncer;
    subscribeRemoteDocumentChanges: (
      doc: RemoteChangeDocument,
      onChange: (remote: boolean) => void,
    ) => () => void;
    EMPTY_REMOTE_WORDS: RemoteChangeTimings;
    useRemoteChangeAnnouncer: (props: RemoteChangeAnnouncerProps) => null;
  }
}

export function installUiRemoteChangeAnnouncer(
  runtime: RuntimeBindings,
): () => void {
  var reactsH: ReactNamespace;
  var REMOTE_CHANGE_WORD_SEPARATOR: string;
  var REMOTE_CHANGE_HOLD_MS: number;
  var REMOTE_CHANGE_DELAY_MS: number;
  var EMPTY_REMOTE_WORDS: RemoteChangeTimings;
  function createRemoteChangeAnnouncer(
    options: RemoteChangeAnnouncerOptions,
  ): RemoteChangeAnnouncer {
    let flag = false,
      flag2 = false,
      value: (() => void) | undefined,
      callback: RemoteChangeItems = () => new Map<string, string>(),
      flag3 = false,
      flag4 = false,
      flag5 = false,
      flag6 = false,
      flag7 = false,
      flag8 = false,
      flag9 = false,
      entries = new Map<string, string>(),
      values = new Set<string>(),
      callback2 = () => {
        flag7 = false;
        flag5 = flag4;
        if (!flag4) {
          flag6 = false;
        }
        return flag4;
      },
      callback3 = (input: boolean): void => {
        let value2 = (flag && flag3) || (flag2 && flag8);
        if (value2 !== flag4) {
          flag4 = value2;
          options.onBusy(value2);
        }
        if (!flag4 || flag5 || flag7 || (input && flag6)) {
          return;
        }
        if (input) {
          flag6 = true;
        } else {
          flag7 = true;
          options.after(REMOTE_CHANGE_DELAY_MS, () => (flag7 = false));
        }
        options.say(runtime.CLAUDE_WORKING_LABEL, input, callback2);
      },
      callback4 = () => {
        value = undefined;
        let value2 = callback7(callback);
        flag2 = false;
        entries = value2;
        callback3(true);
        if (!flag8 || (flag9 && callback6(value2) === 0)) {
          if (flag5 || flag6) {
            options.hush();
          }
          return;
        }
        let index = 0;
        for (let value3 of values)
          if (value2.has(value3)) {
            index++;
          }
        options.say(
          flag9
            ? options.words.ready(callback6(value2))
            : index > 0
              ? options.words.updated(index)
              : options.words.changed(callback6(value2)),
          false,
        );
      },
      callback5 = (input: string): boolean =>
        input.startsWith(REMOTE_CHANGE_WORD_SEPARATOR),
      callback6 = (input: Map<string, string>): number => {
        let index = 0;
        for (let value2 of input.keys())
          if (!callback5(value2)) {
            index++;
          }
        return index;
      },
      callback7 = (input: RemoteChangeItems): Map<string, string> => {
        try {
          return input();
        } catch {
          return entries;
        }
      };
    return {
      busy: () => flag4,
      set(input: boolean, options2: boolean, context: RemoteChangeItems) {
        callback = context;
        let value2 = input && value !== undefined;
        if (value2) {
          value!();
        }
        if (value2) {
          value = undefined;
        }
        let value3 = input && !flag2,
          value4 = input || flag2 ? callback7(callback) : entries;
        if (value3) {
          flag5 = false;
          flag6 = false;
          flag7 = false;
          flag8 = false;
          values.clear();
          flag9 = callback6(value4) === 0;
        }
        flag = input;
        if (input) {
          flag2 = true;
        }
        flag3 = options2;
        entries = value4;
        callback3(!value3);
        if (!input && flag2 && value === undefined) {
          value = options.after(REMOTE_CHANGE_HOLD_MS, callback4);
        }
      },
      changed(input: boolean, options2: RemoteChangeItems) {
        if (!flag2) {
          return;
        }
        callback = options2;
        let value2 = callback7(callback),
          flag10 = false;
        if (input) {
          for (let [value3, value4] of value2)
            if (
              !entries.has(value3) ||
              !Object.is(entries.get(value3), value4)
            ) {
              flag10 = true;
              if (!callback5(value3)) {
                values.add(value3);
              }
            }
          for (let value3 of entries.keys())
            if (!value2.has(value3)) {
              flag10 = true;
            }
          if (flag10) {
            flag8 = true;
          }
        }
        entries = value2;
        if (flag10) {
          callback3(false);
        }
      },
      stop() {
        value?.();
        value = undefined;
        flag = false;
        flag2 = false;
        flag4 = false;
      },
    };
  }
  function subscribeRemoteDocumentChanges(
    doc: RemoteChangeDocument,
    onChange: (remote: boolean) => void,
  ): () => void {
    let value = doc.loadState?.();
    return doc.subscribe((input?: ArtifactChange): void => {
      let value2 = doc.loadState?.(),
        value3 = value2 !== value;
      value = value2;
      onChange(input?.remote === true && !value3);
    });
  }
  function useRemoteChangeAnnouncer(
    options: RemoteChangeAnnouncerProps,
  ): null {
    let ref = reactsH.useRef(options);
    ref.current = options;
    let ref2 = reactsH.useRef<RemoteChangeAnnouncer | null>(null);
    ref2.current ??= createRemoteChangeAnnouncer({
      words: {
        ready: (input: number): string => ref.current.words.ready(input),
        updated: (input: number): string => ref.current.words.updated(input),
        changed: (input: number): string => ref.current.words.changed(input),
      },
      after: (input: number, options2: () => void): (() => void) => {
        let value = setTimeout(
          options2,
          input === REMOTE_CHANGE_HOLD_MS
            ? (EMPTY_REMOTE_WORDS.graceMs ?? input)
            : input,
        );
        return (): void => clearTimeout(value);
      },
      say: (
        input: string,
        options2: boolean,
        context?: () => boolean,
      ): void =>
        (0, runtime.announceLiveMessage)(
          context ? (): string | null => (context() ? input : null) : input,
          options2
            ? {
                ifIdle: true,
              }
            : {},
        ),
      hush: (): void =>
        (0, runtime.announceLiveMessage)("", {
          ifIdle: true,
        }),
      onBusy: (input: boolean): void => ref.current.onBusy(input),
    });
    let current = ref2.current,
      { doc: doc, empty: empty } = options,
      callback: RemoteChangeItems = (): Map<string, string> =>
        ref.current.items();
    reactsH.useEffect(
      (): (() => void) =>
        subscribeRemoteDocumentChanges(
          doc,
          (input: boolean): void => current.changed(input, callback),
        ),
      [doc, current],
    );
    reactsH.useEffect(
      (): (() => void) =>
        runtime.agentActivityStore.subscribe(
          (): void =>
            current.set(
              runtime.agentActivityStore.get() === "working",
              ref.current.empty,
              callback,
            ),
        ),
      [current],
    );
    reactsH.useEffect(
      (): void =>
        current.set(
          runtime.agentActivityStore.get() === "working",
          empty,
          callback,
        ),
      [current, empty],
    );
    reactsH.useEffect(() => {
      ref.current.onBusy(current.busy());
      return () => {
        current.stop();
        ref.current.onBusy(false);
      };
    }, [current]);
    return null;
  }
  bindRuntimeValue(
    runtime,
    "reactsH",
    () => reactsH,
    (value) => {
      reactsH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "REMOTE_CHANGE_WORD_SEPARATOR",
    () => REMOTE_CHANGE_WORD_SEPARATOR,
    (value) => {
      REMOTE_CHANGE_WORD_SEPARATOR = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "REMOTE_CHANGE_HOLD_MS",
    () => REMOTE_CHANGE_HOLD_MS,
    (value) => {
      REMOTE_CHANGE_HOLD_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "REMOTE_CHANGE_DELAY_MS",
    () => REMOTE_CHANGE_DELAY_MS,
    (value) => {
      REMOTE_CHANGE_DELAY_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createRemoteChangeAnnouncer",
    () => createRemoteChangeAnnouncer,
  );
  bindRuntimeValue(
    runtime,
    "subscribeRemoteDocumentChanges",
    () => subscribeRemoteDocumentChanges,
  );
  bindRuntimeValue(
    runtime,
    "EMPTY_REMOTE_WORDS",
    () => EMPTY_REMOTE_WORDS,
    (value) => {
      EMPTY_REMOTE_WORDS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "useRemoteChangeAnnouncer",
    () => useRemoteChangeAnnouncer,
  );
  return () => {
    (0, runtime.initializeAssetStorage)();
    (0, runtime.initializeUiAnnouncements)();
    reactsH = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    REMOTE_CHANGE_WORD_SEPARATOR = "\x00";
    REMOTE_CHANGE_HOLD_MS = 2000;
    REMOTE_CHANGE_DELAY_MS = 500;
    EMPTY_REMOTE_WORDS = {};
  };
}
