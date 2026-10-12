import type * as Application from "../contracts/application";
import type * as Storage from "../contracts/model-storage";
import type * as Model from "../contracts";
import type * as Host from "../contracts/platform-host";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installModelSystemStore(runtime: RuntimeBindings): () => void {
  var DERIVED_REFRESH_DELAY_MS: number;
  var autosaveInstaller:
    | ((document: Storage.SystemDocument, hold: () => boolean) => void)
    | undefined;
  var documentBootOptions: Partial<
    Host.DocumentOptions<Model.DesignSystemContent>
  >;
  var instanceUsesFilesPublisher: boolean;
  var storedSystemDocumentFactory:
    | ((
        parser: Host.ArtifactParser<Model.DesignSystemContent>,
      ) => Storage.SyncedSystemDocument)
    | undefined;
  var fileSystemDocumentFactory:
    | ((
        parser: Host.ArtifactParser<Model.DesignSystemContent>,
      ) => Storage.SystemDocument)
    | undefined;
  var legacyCleanupGate:
    | (() => Promise<boolean | "later" | null | undefined>)
    | undefined;
  var DesignSystemStore: new (
    document?: Storage.SystemDocument,
    options?: Storage.StoreOptions,
  ) => Storage.DesignSystemStore;
  var commandCapableDocument: (
    document: Storage.SystemDocument,
  ) => Storage.CommandDocument | null;
  function refreshNonemptyManifest(
    content: Model.DesignSystemContent,
    title: string,
  ): Model.DesignSystemContent {
    if (Object.keys(content.files).length === 0) {
      return content;
    }
    return (0, runtime.refreshManifest)(content, title);
  }
  async function isLegacyEnvelopeCurrent(
    convertedAt?: string,
    fetchJson: typeof fetch | undefined = typeof fetch === "function" &&
    typeof location !== "undefined"
      ? fetch
      : undefined,
  ): Promise<null | boolean | undefined> {
    try {
      if (convertedAt === undefined || fetchJson === undefined) {
        return null;
      }
      let value = await fetchJson(runtime.DESIGN_SYSTEM_ENVELOPE_PATH, {
        credentials: "same-origin",
        cache: "no-cache",
      });
      if (!value.ok) {
        if (value.status === 404) {
          return false;
        } else {
          return null;
        }
      }
      let value2: unknown = (
        (await value.json()) as
          | { content?: { files?: Record<string, unknown> } }
          | null
          | undefined
      )?.content?.files?.[runtime.DESIGN_SYSTEM_PATHS.manifest];
      if (
        typeof value2 !== "string" ||
        Object.keys((0, runtime.parseManifest)(value2)).length === 0
      ) {
        return null;
      }
      let value3 = (0, runtime.lastChangeFromManifest)(value2)?.at;
      if (
        value3 === undefined ||
        Date.parse(value3) <= Date.parse(convertedAt)
      ) {
        return true;
      } else {
        return null;
      }
    } catch {
      return null;
    }
  }
  function setAutosaveInstaller(
    install?: (document: Storage.SystemDocument, hold: () => boolean) => void,
  ): void {
    autosaveInstaller = install;
  }
  function setDocumentBootOptions(
    options: Partial<Host.DocumentOptions<Model.DesignSystemContent>>,
    flags: { instance?: boolean } = {},
  ): void {
    documentBootOptions = options;
    instanceUsesFilesPublisher = flags.instance === true;
  }
  function setFileSystemDocumentFactory(
    factory: (
      parser: Host.ArtifactParser<Model.DesignSystemContent>,
    ) => Storage.SystemDocument,
  ): void {
    fileSystemDocumentFactory = factory;
  }
  function documentOptionsForBootMode(
    boot: Storage.SystemBootMode,
    readonlyReason?: string,
  ): Storage.DocumentBootConfiguration {
    let mode: Storage.SystemBootMode =
      readonlyReason !== undefined
        ? {
            mode: "readonly",
            state: boot.state,
            reason: readonlyReason,
          }
        : boot;
    if (mode.mode === "instance") {
      return {
        boot: mode,
        opts: {
          embeddedState: mode.state,
          pageParts: runtime.EMPTY_EMBEDDED_PAGE_PARTS,
        },
        instance: true,
      };
    }
    return {
      boot: mode,
      opts: {
        embeddedState: mode.state,
        pageParts: runtime.EMPTY_EMBEDDED_PAGE_PARTS,
        roFlag: (0, runtime.constantReadOnlyReasonSlot)(mode.reason),
        stash: runtime.unavailableStorageSlot,
        canPublish: true,
      },
      instance: false,
    };
  }
  function hasConfiguredDocumentFactory(): boolean {
    return (
      storedSystemDocumentFactory !== undefined ||
      fileSystemDocumentFactory !== undefined ||
      Object.keys(documentBootOptions).length > 0
    );
  }
  function changedHeldFilePaths(
    beforeFiles: Model.FileTable,
    afterFiles: Model.FileTable,
    isGone: (path: string) => boolean,
  ): string[] {
    if (beforeFiles === afterFiles) {
      return [];
    }
    let changed = [];
    for (let value of Object.keys(beforeFiles)) {
      let value2 = beforeFiles[value];
      if (
        (0, runtime.isHeldFilePointer)(value, value2) &&
        afterFiles[value] !== value2 &&
        !isGone(value)
      ) {
        changed.push(value);
      }
    }
    return changed.sort();
  }
  function introducedHeldFilePaths(
    beforeFiles: Model.FileTable,
    afterFiles: Model.FileTable,
  ): string[] {
    if (beforeFiles === afterFiles) {
      return [];
    }
    let introduced = [];
    for (let value of Object.keys(afterFiles)) {
      let value2 = afterFiles[value];
      if (
        (0, runtime.isHeldFilePointer)(value, value2) &&
        beforeFiles[value] !== value2
      ) {
        introduced.push(value);
      }
    }
    return introduced.sort();
  }
  function createDesignSystemCommands(
    document2: Storage.SystemDocument,
    undoStack: Application.FileEditHistory,
    sharedUndoStack?: Application.FileEditHistory,
    options: { readGivesUpMs?: number } = {},
  ): Storage.SystemCommands {
    let commands = commandCapableDocument(document2);
    if (commands !== null && sharedUndoStack !== undefined) {
      commands.bindUndoStack?.(sharedUndoStack);
    }
    let refresh = (input: Model.DesignSystemContent) =>
        (0, runtime.refreshManifest)(input, document2.title()),
      coalescedStep: Storage.CoalescedEdit | null = null,
      seal = (): void => {
        if (coalescedStep !== null) {
          let value = coalescedStep;
          coalescedStep = null;
          let value2 = document2.content();
          if (value2 === value.latest) {
            let value3 = refresh(value2);
            if (value3 !== value2) {
              value.latest = value3;
              document2.setContent(value3);
            }
          }
        }
      },
      preparedBytes = new Map<string, Storage.PreparedHeldBytes>(),
      preparing: boolean = false,
      notUndoable: string[] = [],
      basename = (input: string) => input.slice(input.lastIndexOf("/") + 1),
      isGone = (input: string): boolean => commands?.heldGone?.(input) === true,
      preparedStillValid = (input: string): boolean => {
        let entry = preparedBytes.get(input);
        if (entry === undefined) {
          return false;
        }
        if (
          !(0, runtime.isHeldFilePointer)(
            input,
            document2.content().files[input] ?? "",
          ) ||
          commands?.heldStillGood?.(input, entry.witness) !== "good"
        ) {
          preparedBytes.delete(input);
          return false;
        }
        return true;
      },
      bytesNeeded = (
        input: Model.DesignSystemContent,
        options2: Storage.ContentMutation,
      ) => {
        if (
          commands?.heldBytes === undefined ||
          !Object.values(input.files).includes("file:")
        ) {
          return [];
        }
        let value = options2(input);
        if (value === input) {
          return [];
        } else {
          return changedHeldFilePaths(
            input.files,
            (0, runtime.finalizeContentChange)(input, value, document2.title())
              .files,
            isGone,
          );
        }
      },
      guardBusy = (): boolean => {
        if (preparing) {
          commands?.tell?.(
            "Still working on your previous change. Try again in a moment.",
          );
        }
        return preparing;
      },
      readTimeoutMs = options.readGivesUpMs ?? 120000,
      maxImagePaths: number = 64,
      maxImageBytes: number = 67108864;
    return {
      content: () => document2.content(),
      seal: seal,
      undo: {
        exec(input: Application.FileEditStep): void {
          seal();
          undoStack.exec(input);
        },
        seed(input: Application.FileEditStep): void {
          seal();
          undoStack.seed(input);
        },
        undo(): void {
          if (guardBusy()) {
            return;
          }
          seal();
          undoStack.undo();
        },
        redo(): void {
          if (guardBusy()) {
            return;
          }
          seal();
          undoStack.redo();
        },
        canUndo: () => undoStack.canUndo(),
        canRedo: () => undoStack.canRedo(),
        redoDepth: () => undoStack.redoDepth(),
        clear(): void {
          seal();
          undoStack.clear();
        },
        subscribe: (input: () => void) => undoStack.subscribe(input),
      },
      needs(input: Storage.ContentMutation): string[] {
        return bytesNeeded(document2.content(), input).filter(
          (input2): boolean => !preparedStillValid(input2),
        );
      },
      busy: (): boolean => preparing,
      lastNotUndoable: () => notUndoable,
      async prepare(
        input: Storage.ContentMutation,
      ): Promise<Storage.PreparedEditResult> {
        if (guardBusy()) {
          return {
            ok: false,
            failed: [],
            tooMany: false,
          };
        }
        let value = bytesNeeded(document2.content(), input);
        for (let value3 of [...preparedBytes.keys()]) {
          if (!value.includes(value3)) {
            preparedBytes.delete(value3);
          }
        }
        let value2 = value.filter(
          (input2): boolean => !preparedStillValid(input2),
        );
        if (value2.length === 0) {
          return {
            ok: true,
          };
        }
        if (
          value2.filter(runtime.isExpensiveHeldImagePath).length > maxImagePaths
        ) {
          return {
            ok: false,
            failed: value2,
            tooMany: true,
          };
        }
        preparing = true;
        commands?.setPreparing?.(true);
        try {
          let items: string[] = [],
            index = 0,
            value3 = Date.now() + readTimeoutMs;
          for (
            let index2 = 0;
            index2 < value2.length && index <= maxImageBytes;
            index2 += 4
          ) {
            if (Date.now() >= value3) {
              items.push(...value2.slice(index2));
              break;
            }
            await Promise.all(
              value2
                .slice(index2, index2 + 4)
                .map(async (input2): Promise<void> => {
                  let value4: ReturnType<typeof setTimeout> | undefined,
                    value5 = await Promise.race([
                      commands?.heldBytes?.(input2).catch((): null => null) ??
                        null,
                      new Promise<Storage.PreparedHeldBytes | null>(
                        (input3): void => {
                          value4 = setTimeout(
                            () => input3(null),
                            Math.max(0, value3 - Date.now()),
                          );
                        },
                      ),
                    ]).finally(() => clearTimeout(value4));
                  if (value5 === null) {
                    items.push(input2);
                  } else if (
                    (preparedBytes.set(input2, value5),
                    (0, runtime.isExpensiveHeldImagePath)(input2))
                  ) {
                    index += value5.value.length;
                  }
                }),
            );
          }
          if (index > maxImageBytes) {
            for (let value4 of value2) {
              preparedBytes.delete(value4);
            }
            return {
              ok: false,
              failed: value2,
              tooMany: true,
            };
          }
          if (items.length === 0) {
            return {
              ok: true,
            };
          } else {
            return {
              ok: false,
              failed: items.sort(),
              tooMany: false,
            };
          }
        } finally {
          preparing = false;
          commands?.setPreparing?.(false);
        }
      },
      set(input: string, options2: Storage.ContentMutation): boolean {
        if (coalescedStep !== null && coalescedStep.key !== input) {
          seal();
        }
        let value = document2.content(),
          value2 = (0, runtime.finalizeContentChange)(
            value,
            options2(value),
            document2.title(),
          );
        if (value2 === value) {
          return false;
        }
        if (
          commands?.heldBytes !== undefined &&
          (changedHeldFilePaths(value.files, value2.files, isGone).length > 0 ||
            introducedHeldFilePaths(value.files, value2.files).length > 0)
        ) {
          return false;
        }
        document2.setContent(value2);
        let value3 = coalescedStep?.step,
          value4 =
            value3?.leavesAlone !== undefined &&
            [
              ...new Set([
                ...Object.keys(value.files),
                ...Object.keys(value2.files),
              ]),
            ].some(
              (input2) =>
                value.files[input2] !== value2.files[input2] &&
                value3.leavesAlone?.(input2) === true,
            );
        if (
          coalescedStep !== null &&
          coalescedStep.key === input &&
          coalescedStep.step?.dropped !== true &&
          !value4
        ) {
          coalescedStep.latest = value2;
          coalescedStep.step?.touch();
        } else {
          let state: Storage.CoalescedEdit = {
            key: input,
            base: value,
            latest: value2,
          };
          coalescedStep = state;
          if (commands !== null) {
            let value5 = commands.stepCommand(
              input,
              () => ({
                before: state.base,
                after: state.latest,
              }),
              {
                applied: true,
              },
            );
            state.step = value5;
            undoStack.seed(value5);
          } else {
            undoStack.seed({
              label: input,
              do: () => document2.setContent(state.latest),
              undo: () => document2.setContent(state.base),
            });
          }
        }
        return true;
      },
      exec(
        input: string,
        options2: Storage.ContentMutation,
        context?: { withoutBytes?: string[] },
      ): boolean {
        notUndoable = [];
        if (guardBusy()) {
          return false;
        }
        seal();
        let value = document2.content(),
          value2 = options2(value);
        if (value2 === value) {
          return false;
        }
        let value3 = value,
          value4 = (0, runtime.finalizeContentChange)(
            value,
            value2,
            document2.title(),
          ),
          value5 =
            commands?.heldBytes !== undefined
              ? changedHeldFilePaths(value.files, value4.files, isGone)
              : [],
          items = [],
          flag: boolean = false;
        if (value5.length > 0) {
          let state: Record<string, string> = {};
          for (let value8 of value5) {
            if (preparedStillValid(value8)) {
              state[value8] = preparedBytes.get(value8)!.value;
            } else if (
              context?.withoutBytes?.includes(value8) === true &&
              !Object.hasOwn(value4.files, value8)
            ) {
              items.push(value8);
            } else {
              commands?.tell?.(
                basename(value8) +
                  " was updated while the page was getting it ready, so nothing was changed. Try again.",
              );
              for (let value9 of value5) {
                preparedBytes.delete(value9);
              }
              return false;
            }
          }
          if (Object.keys(state).length > 0) {
            flag = true;
            value3 = (0, runtime.finalizeContentChange)(
              value,
              {
                ...value,
                files: Object.freeze({
                  ...value.files,
                  ...state,
                }),
              },
              document2.title(),
            );
            let value8 = options2(value3);
            if (value8 === value3) {
              for (let value9 of value5) {
                preparedBytes.delete(value9);
              }
              return false;
            }
            value4 = (0, runtime.finalizeContentChange)(
              value3,
              value8,
              document2.title(),
            );
            if (
              changedHeldFilePaths(value3.files, value4.files, isGone).some(
                (input2): boolean => !items.includes(input2),
              )
            ) {
              for (let value9 of value5) {
                preparedBytes.delete(value9);
              }
              return false;
            }
            for (let [value9, value10] of Object.entries(state)) {
              if (
                !Object.hasOwn(value4.files, value9) &&
                commands?.sendProblem?.(value9, value10) !== undefined
              ) {
                items.push(value9);
              }
            }
          }
        }
        let value6 =
          commands?.heldBytes !== undefined
            ? introducedHeldFilePaths(value.files, value4.files)
            : [];
        if (value6.length > 0) {
          let value8 = Object.keys(value.files).filter(
              (input2) =>
                (0, runtime.isHeldFilePointer)(input2, value.files[input2]) &&
                !Object.hasOwn(value4.files, input2),
            ),
            value9 = value8.find(isGone) ?? value8[0] ?? value6[0];
          commands?.tell?.(
            basename(value9) +
              " is missing from the published system, so it cannot be renamed or moved. Remove it and add the file again.",
          );
          for (let value10 of value5) {
            preparedBytes.delete(value10);
          }
          return false;
        }
        if (commands?.editProblem?.(value3, value4) !== undefined) {
          for (let value8 of value5) {
            preparedBytes.delete(value8);
          }
          return false;
        }
        if (commands?.heldBytes !== undefined) {
          for (let value8 of Object.keys(value.files)) {
            if (
              (0, runtime.isHeldFilePointer)(value8, value.files[value8]) &&
              !Object.hasOwn(value4.files, value8) &&
              isGone(value8)
            ) {
              items.push(value8);
            }
          }
        }
        let value7 = Object.keys({
          ...value3.files,
          ...value4.files,
        }).filter(
          (input2) =>
            input2 !== "manifest.json" &&
            value3.files[input2] !== value4.files[input2],
        );
        if (
          commands !== null &&
          value7.length > 0 &&
          value7.every((input2) => items.includes(input2))
        ) {
          document2.setContent(value4);
          notUndoable = [...new Set(items)].sort();
          for (let value8 of value5) {
            preparedBytes.delete(value8);
          }
          return true;
        }
        if (commands !== null) {
          let value8 = commands.stepCommand(input, () => ({
            before: value3,
            after: value4,
          }));
          if (items.length > 0) {
            value8.dropPaths?.(new Set(items));
          }
          if (flag) {
            let value9 = value8.do.bind(value8),
              value10 = value8.undo.bind(value8);
            value8.do = (): void => {
              commands.carrying?.();
              value9();
            };
            value8.undo = (): void => {
              commands.carrying?.();
              value10();
            };
          }
          undoStack.exec(value8);
          notUndoable = [...new Set(items)].sort();
        } else {
          undoStack.exec({
            label: input,
            do: () => document2.setContent(value4),
            undo: () => document2.setContent(value3),
          });
        }
        for (let value8 of value5) {
          preparedBytes.delete(value8);
        }
        return true;
      },
    };
  }
  bindRuntimeValue(
    runtime,
    "refreshNonemptyManifest",
    () => refreshNonemptyManifest,
  );
  bindRuntimeValue(
    runtime,
    "isLegacyEnvelopeCurrent",
    () => isLegacyEnvelopeCurrent,
  );
  bindRuntimeValue(
    runtime,
    "DERIVED_REFRESH_DELAY_MS",
    () => DERIVED_REFRESH_DELAY_MS,
    (value) => {
      DERIVED_REFRESH_DELAY_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "autosaveInstaller",
    () => autosaveInstaller,
    (value) => {
      autosaveInstaller = value;
    },
  );
  bindRuntimeValue(runtime, "setAutosaveInstaller", () => setAutosaveInstaller);
  bindRuntimeValue(
    runtime,
    "documentBootOptions",
    () => documentBootOptions,
    (value) => {
      documentBootOptions = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "instanceUsesFilesPublisher",
    () => instanceUsesFilesPublisher,
    (value) => {
      instanceUsesFilesPublisher = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "setDocumentBootOptions",
    () => setDocumentBootOptions,
  );
  bindRuntimeValue(
    runtime,
    "storedSystemDocumentFactory",
    () => storedSystemDocumentFactory,
    (value) => {
      storedSystemDocumentFactory = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fileSystemDocumentFactory",
    () => fileSystemDocumentFactory,
    (value) => {
      fileSystemDocumentFactory = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "legacyCleanupGate",
    () => legacyCleanupGate,
    (value) => {
      legacyCleanupGate = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "setFileSystemDocumentFactory",
    () => setFileSystemDocumentFactory,
  );
  bindRuntimeValue(
    runtime,
    "documentOptionsForBootMode",
    () => documentOptionsForBootMode,
  );
  bindRuntimeValue(
    runtime,
    "hasConfiguredDocumentFactory",
    () => hasConfiguredDocumentFactory,
  );
  bindRuntimeValue(
    runtime,
    "DesignSystemStore",
    () => DesignSystemStore,
    (value) => {
      DesignSystemStore = value;
    },
  );
  bindRuntimeValue(runtime, "changedHeldFilePaths", () => changedHeldFilePaths);
  bindRuntimeValue(
    runtime,
    "introducedHeldFilePaths",
    () => introducedHeldFilePaths,
  );
  bindRuntimeValue(
    runtime,
    "commandCapableDocument",
    () => commandCapableDocument,
    (value) => {
      commandCapableDocument = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createDesignSystemCommands",
    () => createDesignSystemCommands,
  );
  return () => {
    DERIVED_REFRESH_DELAY_MS = 4000;
    documentBootOptions = {};
    instanceUsesFilesPublisher = false;
    DesignSystemStore = class DesignSystemStore {
      doc!: Storage.SystemDocument;
      bootReport: Model.ParseReport = {
        dropped: [],
        warnings: [],
      };
      listeners = new Set<() => void>();
      snapshot!: Model.ParsedDesignSystem & { title: string };
      note = "";
      noteFor: Storage.AnnouncedNote | null = null;
      by: Promise<string>;
      holdAutosave = false;
      beforeSave: (() => Promise<unknown>) | null = null;
      constructor(
        providedDocument?: Storage.SystemDocument,
        options?: Storage.StoreOptions,
      ) {
        let parserOptions = {
          parseContent: (input: unknown) =>
            (0, runtime.parseDesignSystemContent)(
              input,
              this.bootReport,
              storedSystemDocumentFactory !== undefined &&
                providedDocument === undefined
                ? {
                    unbounded: true,
                  }
                : undefined,
            ),
          initialContent: (0, runtime.parseDesignSystemContent)(
            runtime.EMPTY_DESIGN_SYSTEM_CONTENT,
          ),
          defaultTitle:
            (typeof document !== "undefined" && document.title) ||
            "Design System",
        };
        if (
          providedDocument === undefined &&
          storedSystemDocumentFactory !== undefined
        ) {
          (0, runtime.setUnboundedFileParsing)(true);
          (0, runtime.setProtectedFilePathPredicate)(
            (input: string): boolean =>
              (0, runtime.remoteTextEntry)(input) !== undefined,
          );
        }
        if (
          providedDocument === undefined &&
          storedSystemDocumentFactory === undefined &&
          fileSystemDocumentFactory !== undefined
        ) {
          (0, runtime.setUnboundedFileParsing)(true);
        }
        let fileSystemDocument =
            providedDocument === undefined &&
            storedSystemDocumentFactory === undefined
              ? fileSystemDocumentFactory?.({
                  ...parserOptions,
                  parseContent: (input: unknown) =>
                    (0, runtime.parseDesignSystemContent)(
                      input,
                      this.bootReport,
                      {
                        unbounded: true,
                      },
                    ),
                })
              : undefined,
          storedDocument =
            providedDocument === undefined
              ? storedSystemDocumentFactory?.(parserOptions)
              : undefined,
          baseDocument =
            providedDocument ??
            fileSystemDocument ??
            storedDocument ??
            (0, runtime.createArtifactDocument)({
              parseContent: (input: unknown) =>
                (0, runtime.parseDesignSystemContent)(input, this.bootReport),
              initialContent: (0, runtime.parseDesignSystemContent)(
                runtime.EMPTY_DESIGN_SYSTEM_CONTENT,
              ),
              defaultTitle:
                (typeof document !== "undefined" && document.title) ||
                "Design System",
              ...((0, runtime.getAutoSavingArtifactRuntime)() === undefined &&
              (0, runtime.selfPublishAvailable)()
                ? {
                    publish: (0, runtime.reportPublisherOutcome)(
                      instanceUsesFilesPublisher
                        ? (0, runtime.createSystemFilesPublisher)({
                            onStale: (input: string) =>
                              console.warn("[design-system] " + input),
                          })
                        : (0, runtime.createPageMirrorPublisher)({
                            onStale: (input: string) =>
                              console.warn(
                                "[design-system] saved the page alone; the files mirrored beside it were NOT updated (" +
                                  input +
                                  ") — the next save from a view that can, or a make.ts build, refreshes what agents read",
                              ),
                          }),
                      (input: string): void => {
                        this.publishEnd = input;
                      },
                    ),
                    publishWrapsFrame: true,
                    publishesPage: !instanceUsesFilesPublisher,
                  }
                : instanceUsesFilesPublisher
                  ? {
                      canPublish: false,
                    }
                  : {}),
              ...documentBootOptions,
            });
        this.by =
          options?.by !== undefined
            ? Promise.resolve(options.by)
            : (0, runtime.getCurrentUserName)().then(
                (input) => input ?? "someone",
              );
        this.by.then((input: string) => (this.byName = input));
        let now = options?.now ?? (() => new Date().toISOString());
        this.stampNow = now;
        this.synced = storedDocument !== undefined;
        if (options?.legacyServed !== undefined) {
          this.legacyProbe = options.legacyServed;
        }
        if (fileSystemDocument !== undefined) {
          this.doc = fileSystemDocument;
          this.snapshot = this.buildSnapshot();
          this.lastTitle = this.doc.title();
          this.doc.subscribe(() => this.bump());
          return;
        }
        if (storedDocument !== undefined) {
          (0, runtime.setRemoteTextHydrator)({
            hydrate: (input: string, options2: string, context?: boolean) =>
              this.update(
                (input2) =>
                  context === true && Object.hasOwn(input2.files, input)
                    ? input2
                    : {
                        ...input2,
                        files: Object.freeze({
                          ...input2.files,
                          [input]: options2,
                        }),
                      },
                {
                  auto: true,
                },
              ),
          });
          (0, runtime.setRemoteTextUploadedCallback)(() =>
            this.doc.updateContent(
              (input) => ({
                ...input,
                files: Object.freeze({
                  ...input.files,
                }),
              }),
              {
                auto: true,
              },
            ),
          );
          this.doc = storedDocument;
          this.snapshot = this.buildSnapshot();
          this.lastTitle = this.doc.title();
          this.doc.subscribe(() => this.bump());
          this.doc.subscribeSave((state) => this.scheduleDerived(state.status));
          this.doc.subscribe(() => void this.publishOwed(now));
          return;
        }
        queueMicrotask((): void => {
          try {
            autosaveInstaller?.(this.doc, () => this.holdAutosave);
          } catch {}
        });
        this.doc = (0, runtime.withAutomaticSave)(
          {
            ...baseDocument,
            save: async (): Promise<void> => {
              let value = await this.by;
              if (
                baseDocument.readOnly() ||
                !baseDocument.dirty() ||
                baseDocument.saveState().status === "saving"
              ) {
                return baseDocument.save();
              }
              if (this.beforeSave !== null) {
                await this.beforeSave().catch((): void => {
                  return;
                });
                if (
                  !baseDocument.dirty() ||
                  baseDocument.saveState().status === "saving"
                ) {
                  return baseDocument.save();
                }
              }
              let value2 = this.saveNote().trim();
              this.update(
                (input) =>
                  (0, runtime.removeMissingStorageDigests)(
                    input,
                    (0, runtime.missingStoredBlobIds)(input.files),
                  ),
                {
                  auto: true,
                },
              );
              this.update(
                (input) =>
                  (0, runtime.setLastChange)(input, {
                    by: value,
                    via: "page",
                    at: now(),
                    ...(value2 !== ""
                      ? {
                          note: value2,
                        }
                      : {}),
                  }),
                {
                  auto: true,
                },
              );
              this.publishEnd = undefined;
              await baseDocument.save();
              let value3: Storage.HealthEvent | null = (0,
              runtime.saveHealthOutcome)(
                baseDocument.saveState().status,
                this.publishEnd,
              );
              if (value3 !== null) {
                runtime.artifactHealth.report(...value3);
              }
              if (
                baseDocument.saveState().status !== "error" &&
                (value2 !== "" || this.noteFor === null)
              ) {
                this.setNote("");
              }
            },
          },
          {
            hold: () => this.holdAutosave,
          },
        );
        this.snapshot = this.buildSnapshot();
        this.lastTitle = this.doc.title();
        this.doc.subscribe(() => this.bump());
      }
      lastTitle = "";
      owedRunning = false;
      owedGaveUp = false;
      legacyServed: Promise<boolean | null | undefined> | undefined;
      legacyProbe = isLegacyEnvelopeCurrent;
      synced = false;
      byName = "someone";
      stampNow = () => new Date().toISOString();
      stampBy(): string {
        return this.byName;
      }
      episodeStamped = false;
      async publishOwed(now?: () => string): Promise<void> {
        let status = (0, runtime.getStoredSystemStatus)(),
          isLive = "loadState" in this.doc && this.doc.loadState() === "live";
        if (
          typeof location !== "undefined" &&
          (0, runtime.isMigrationExemptHost)(location.hostname)
        ) {
          return;
        }
        if (
          this.owedRunning ||
          this.owedGaveUp ||
          !isLive ||
          !status.loaded ||
          this.doc.readOnly() ||
          (0, runtime.hasUnhydratedRemoteText)()
        ) {
          return;
        }
        this.legacyServed ??= this.legacyProbe(status.convertedAt);
        if ((await this.legacyServed) !== true) {
          return;
        }
        this.owedRunning = true;
        try {
          let value = await (0, runtime.getSelfPublishCapability)();
          if (value === null) {
            return;
          }
          if (legacyCleanupGate !== undefined) {
            let value2 = await legacyCleanupGate();
            if (value2 === "later") {
              return;
            }
            if (!value2) {
              this.owedGaveUp = true;
              return;
            }
            if ((await this.legacyProbe(status.convertedAt)) !== true) {
              this.legacyServed = Promise.resolve(false);
              return;
            }
          }
          for (let value2 of (0, runtime.chunkPublishChanges)(
            (0, runtime.obsoleteMirrorDeletions)(this.doc.content().files),
          )) {
            await value.publish(value2);
          }
          this.legacyServed = Promise.resolve(false);
        } catch (value: unknown) {
          this.owedGaveUp = true;
          console.warn(
            "[design-system] could not remove this system’s old files after its move to the store; a later open retries: " +
              String(
                (value as { message?: unknown } | null | undefined)?.message ??
                  value,
              ),
          );
        } finally {
          this.owedRunning = false;
        }
      }
      derivedTimer: ReturnType<typeof setTimeout> | undefined;
      sawDirty = false;
      scheduleDerived(status: Host.SaveState["status"]): void {
        if (status === "dirty" || status === "saving") {
          clearTimeout(this.derivedTimer);
          this.derivedTimer = undefined;
          return;
        }
        if (
          !this.sawDirty ||
          this.derivedTimer !== undefined ||
          this.doc.readOnly()
        ) {
          return;
        }
        this.derivedTimer = setTimeout((): void => {
          this.derivedTimer = undefined;
          if (this.doc.readOnly() || this.doc.saveState().status !== "ready") {
            return;
          }
          if (
            (0, runtime.hasUnhydratedRemoteText)() ||
            (0, runtime.hasPendingRemoteTextUploads)()
          ) {
            this.scheduleDerived("ready");
            return;
          }
          this.sawDirty = false;
          this.episodeStamped = false;
          (0, runtime.requestStoredDerivedRegeneration)();
          this.doc.updateContent(
            (input) => ({
              ...input,
              files: Object.freeze({
                ...input.files,
              }),
            }),
            {
              auto: true,
            },
          );
        }, DERIVED_REFRESH_DELAY_MS);
      }
      publishEnd: string | undefined;
      saveNote(): string {
        if (this.noteFor === null || this.noteFor.present) {
          return this.note;
        } else {
          return "";
        }
      }
      setNote(note: string, announcedFiles?: Model.FileTable): void {
        let oldSaveNote = this.saveNote(),
          paths =
            note !== "" && announcedFiles !== undefined
              ? Object.keys(announcedFiles)
              : [],
          files = this.doc.content().files;
        this.noteFor =
          paths.length > 0 && announcedFiles !== undefined
            ? {
                paths: new Set(paths),
                values: new Set(Object.values(announcedFiles)),
                asOf: files,
                present: paths.some((input): boolean => input in files),
              }
            : null;
        this.note = note;
        if (this.saveNote() !== oldSaveNote) {
          for (let value of this.listeners) {
            value();
          }
        }
      }
      followAnnounced(): void {
        let announcement = this.noteFor;
        if (announcement === null) {
          return;
        }
        let files = this.doc.content().files;
        if (files === announcement.asOf) {
          return;
        }
        for (let [value, value2] of Object.entries(files)) {
          if (announcement.paths.has(value)) {
            announcement.values.add(value2);
          } else if (
            announcement.values.has(value2) &&
            !(value in announcement.asOf)
          ) {
            announcement.paths.add(value);
          }
        }
        announcement.asOf = files;
        announcement.present = false;
        for (let value of announcement.paths) {
          if (value in files) {
            announcement.present = true;
          }
        }
      }
      getSnapshot(): Model.ParsedDesignSystem & { title: string } {
        return this.snapshot;
      }
      subscribe(subscriber: () => void): () => void {
        this.listeners.add(subscriber);
        return () => this.listeners.delete(subscriber);
      }
      content(): Model.DesignSystemContent {
        return this.doc.content();
      }
      update(
        mutate: Storage.ContentMutation,
        options?: { auto?: boolean },
      ): void {
        let before = this.doc.content(),
          after = (0, runtime.finalizeContentChange)(
            before,
            mutate(before),
            this.doc.title(),
          );
        if (after === before) {
          return;
        }
        if (options?.auto !== true) {
          this.sawDirty = true;
          if (this.synced && !this.episodeStamped) {
            this.episodeStamped = true;
            (0, runtime.stampLocalSystemLastChange)({
              by: this.stampBy(),
              via: "page",
              at: this.stampNow(),
            });
          }
        }
        this.doc.updateContent(() => after, options);
      }
      buildSnapshot(): Model.ParsedDesignSystem & { title: string } {
        let system = (0, runtime.parsedDesignSystem)(this.doc.content()),
          title = this.doc.title(),
          previousSnapshot = this.snapshot;
        if (
          previousSnapshot !== undefined &&
          previousSnapshot.files === system.files &&
          previousSnapshot.title === title
        ) {
          return previousSnapshot;
        }
        return {
          ...system,
          title: title,
        };
      }
      bump(): void {
        this.followAnnounced();
        let title = this.doc.title();
        if (title !== this.lastTitle) {
          this.lastTitle = title;
          if (!this.doc.readOnly()) {
            let value = this.doc.content(),
              value2 = refreshNonemptyManifest(value, title);
            if (value2 !== value) {
              this.doc.updateContent(() => value2, {
                auto: true,
              });
              return;
            }
          }
        }
        let snapshot = this.buildSnapshot();
        if (snapshot === this.snapshot) {
          for (let value of this.listeners) {
            value();
          }
          return;
        }
        this.snapshot = snapshot;
        for (let value of this.listeners) {
          value();
        }
      }
    };
    commandCapableDocument = (document2: Storage.SystemDocument) =>
      typeof (document2 as Partial<Storage.CommandDocument>)?.stepCommand ===
      "function"
        ? (document2 as Storage.CommandDocument)
        : null;
  };
}
