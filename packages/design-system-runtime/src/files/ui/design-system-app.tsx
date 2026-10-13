/** Restored application module; prepare first, initialize in original order. */
import type * as React from "react";
import type * as JsxRuntime from "react/jsx-runtime";
import type {
  ApplicationRuntime,
  ApplicationStore,
  ApplicationDocument,
  ApplicationCommands,
  FileEditHistory,
  ApplicationView,
  ArtifactDownloadOutcome,
  SectionRow,
  TokenDialogState,
  ConfirmationState,
  TokenFlashTarget,
  SectionScroller,
  AssetRevealTarget,
  EditorExtraScale,
  AddedToken,
  WelcomeIntakeSummary,
  IntakeQueueEntry,
  SearchEntry,
  NavigationSearch,
  ApplicationSaveState,
  EditorAsset,
  EditorAssetGroup,
  EditorTypeGroup,
  ScalarScaleGroup,
  AssetUploadSummary,
  AssetIntakeOptions,
  ClaudeRequest,
  ClaudeDeliveryResult,
  RefusedUpload,
  ColorEditActions,
  ScalarEditActions,
  ShadowEditActions,
  TypographyEditActions,
  ComponentEditActions,
  ScalarTokenKind,
  AddTokenKind,
  EditorFont,
  EditorComponent,
} from "../../contracts/application";
import type {
  ColorTheme,
  NormalizedTokens,
  ParsedDesignSystem,
  InferredPropControl,
} from "../../contracts";
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";
export function installFilesUiDesignSystemApp(
  runtime: RuntimeBindings & ApplicationRuntime,
): () => void {
  var reactBootWarnings: typeof React;
  var jsxDesignSystemApp: typeof JsxRuntime;
  var CORE_DESIGN_SYSTEM_SECTIONS: SectionRow[];
  var CONTENT_DESIGN_SYSTEM_SECTIONS: SectionRow[];
  var BUILTIN_DESIGN_SYSTEM_SECTION_IDS: string[];
  var isExtraTokenSection: (section: string) => boolean;
  var isDesignSystemSection: (section: string) => boolean;
  var initialDesignSystemSection: () => string;
  var PENDING_DESIGN_SYSTEM_SECTIONS: SectionRow[];
  var designSystemSections: (extra: EditorExtraScale[]) => SectionRow[];
  var REVEAL_SECTION_BY_KIND: Record<AssetRevealTarget["kind"], string>;
  var CLAUDE_COMMENT_SENT_MESSAGE: string;
  var README_SIZE_EXCEEDED_MESSAGE: string;
  var BACKGROUND_COLOR_TOKEN_PATTERNS: RegExp[];
  var SURFACE_COLOR_TOKEN_PATTERNS: RegExp[];
  function useBootWarnings(context: unknown) {
    let warnedRef = reactBootWarnings.useRef(false);
    reactBootWarnings.useEffect(() => {
      if (context === null || warnedRef.current) {
        return;
      }
      let value = (0, runtime.migrationOpenedAnalyticsEvents)(context);
      if (value.length === 0) {
        return;
      }
      warnedRef.current = true;
      for (let value2 of value) {
        (0, runtime.reportMigrationAnalytics)(value2);
      }
    });
  }
  function useGoogleFontStylesheets(
    familyNames: Record<string, string>,
    fonts: {
      family: string;
    }[],
    typeTokens: NormalizedTokens["type"],
  ) {
    let localFamilies = new Set(
        fonts.map((input) => input.family.toLowerCase()),
      ),
      urls = [
        ...new Set(
          Object.entries(familyNames).flatMap(([input, input2]) => {
            let value = (0, runtime.knownWebFontFamily)(input2);
            if (
              value === undefined ||
              localFamilies.has(input2.toLowerCase())
            ) {
              return [];
            }
            let value2 = (0, runtime.googleFontStylesheetUrl)(value),
              values = new Set(
                (/wght@([\d;]+)/.exec(value2)?.[1] ?? "400")
                  .split(";")
                  .map(Number),
              ),
              value3 = [
                ...new Set(
                  typeTokens.groups.flatMap((input3) =>
                    input3.styles
                      .filter(
                        (input4) =>
                          (input4.family !== ""
                            ? input4.family
                            : input3.family) === input,
                      )
                      .map((input4) => parseInt(String(input4.fontWeight), 10)),
                  ),
                ),
              ]
                .filter(
                  (input3) =>
                    input3 >= 100 && input3 <= 900 && !values.has(input3),
                )
                .sort((input3, options) => input3 - options);
            return [
              value2,
              ...value3.map(
                (input3) =>
                  "https://fonts.googleapis.com/css2?family=" +
                  value.replace(/ +/g, "+") +
                  ":wght@" +
                  String(input3) +
                  "&display=swap",
              ),
            ];
          }),
        ),
      ].sort(),
      fingerprint = urls.join("|");
    (runtime.reactArtifactRoot as typeof React).useEffect(() => {
      let entries = new Map(
        [
          ...document.querySelectorAll<HTMLLinkElement>(
            "link[data-ds-google-font]",
          ),
        ].map((input) => [input.href, input]),
      );
      for (let [value, value2] of entries) {
        if (!urls.includes(value)) {
          value2.remove();
        }
      }
      for (let value of urls) {
        if (entries.has(value)) {
          continue;
        }
        let value2 = [
          ...document.head.querySelectorAll<HTMLLinkElement>(
            'link[rel="stylesheet"]',
          ),
        ].find((input) => input.href === value);
        if (value2 !== undefined) {
          value2.dataset.dsGoogleFont = "1";
          continue;
        }
        let value3 = document.createElement("link");
        value3.rel = "stylesheet";
        value3.dataset.dsGoogleFont = "1";
        value3.href = value;
        document.head.appendChild(value3);
      }
    }, [fingerprint]);
  }
  function previewThemeGroundColors(
    tokens: NormalizedTokens,
    themes: ColorTheme[],
  ) {
    let findColor = (input: RegExp[], options: string) => {
        for (let value of input) {
          let value2 = tokens.color.tokens.find((input2) =>
              value.test(input2.name),
            ),
            value3 =
              value2 !== undefined
                ? (0, runtime.resolveColorTokenValue)(value2, options, tokens)
                : undefined;
          if (value3 !== undefined && (0, runtime.isColorLiteral)(value3)) {
            return value3;
          }
        }
        return;
      },
      grounds: Record<
        string,
        {
          well: string;
          card: string;
        }
      > = {};
    for (let value of themes) {
      let value2 = (0, runtime.isDarkThemeName)(value.name);
      grounds[value.id] = {
        well:
          findColor(BACKGROUND_COLOR_TOKEN_PATTERNS, value.id) ??
          (value2 ? "#1f1e1d" : "#f0eee6"),
        card:
          findColor(SURFACE_COLOR_TOKEN_PATTERNS, value.id) ??
          (value2 ? "#30302e" : "#ffffff"),
      };
    }
    return grounds;
  }
  function artifactDownloadResultMessage(
    name: string,
    result: ArtifactDownloadOutcome,
    suffix = "",
  ): string {
    if (result.outcome === "declined") {
      return "Download cancelled";
    }
    if (result.outcome === "withheld") {
      return runtime.DOWNLOADS_UNAVAILABLE_MESSAGE;
    }
    if (result.outcome === "refused" || result.outcome === "failed") {
      return (0, runtime.unsupportedDownloadMessage)(name, result.shell.code);
    }
    return "Downloaded " + name + suffix;
  }
  function DesignSystemApp(): React.ReactElement {
    let runtime2: FileEditHistory = runtime.reactArtifactRoot.useMemo(
        () => (0, runtime.createFileMutationBatch)(),
        [],
      ),
      documentOptions: FileEditHistory = runtime.reactArtifactRoot.useMemo(
        () => (0, runtime.createAnnouncedHistory)(runtime2),
        [runtime2],
      ),
      system: ApplicationStore = runtime.reactArtifactRoot.useMemo(
        () => new runtime.DesignSystemStore(),
        [],
      ),
      document2: ApplicationDocument = system.doc,
      editor: ApplicationCommands = runtime.reactArtifactRoot.useMemo(
        () =>
          (0, runtime.createDesignSystemCommands)(
            document2,
            documentOptions,
            runtime2,
          ),
        [document2, documentOptions, runtime2],
      ),
      flaggedSections: ReadonlySet<string> = (0, runtime.useConflictedSections)(
        document2,
      ),
      [, forceRender] = runtime.reactArtifactRoot.useState(0),
      restoreCountRef = runtime.reactArtifactRoot.useRef(0);
    runtime.reactArtifactRoot.useEffect(
      () =>
        document2.subscribe(() => {
          forceRender((input) => input + 1);
          if (document2.restoreCount() !== restoreCountRef.current) {
            restoreCountRef.current = document2.restoreCount();
            editor.undo.clear();
          }
        }),
      [document2, editor],
    );
    runtime.reactArtifactRoot.useEffect(
      () => system.subscribe(() => forceRender((input) => input + 1)),
      [system],
    );
    let hostMode = (0, runtime.useHostThemeMode)(),
      scrollerRef = (
        runtime.reactArtifactRoot as typeof React
      ).useRef<HTMLElement | null>(null),
      sectionRefs = (runtime.reactArtifactRoot as typeof React).useRef<
        Record<string, HTMLElement | null | undefined>
      >({}),
      floatingNavigationRef = (
        runtime.reactArtifactRoot as typeof React
      ).useRef<HTMLDivElement | null>(null),
      handoffNoticeRef = (
        runtime.reactArtifactRoot as typeof React
      ).useRef<HTMLDivElement | null>(null),
      stickyHeaderBottom = (): number | undefined => {
        let value = [floatingNavigationRef.current, handoffNoticeRef.current]
          .map((input) =>
            input === null ? undefined : input.getBoundingClientRect(),
          )
          .filter((input) => input !== undefined && input.height > 0)
          .map((input) => input!.bottom);
        if (value.length === 0) {
          return undefined;
        } else {
          return Math.max(...value);
        }
      },
      wideLayout = (0, runtime.useMediaQuery)(runtime.SIDEBAR_MEDIA_QUERY),
      assetReveal = (0, runtime.useEditorCardFlash)(scrollerRef),
      snapshot: ParsedDesignSystem = system.getSnapshot(),
      themes: ColorTheme[] = snapshot.tokens.color.themes,
      [selectedThemeId, setSelectedThemeId] = (
        runtime.reactArtifactRoot as typeof React
      ).useState<string | null>(null),
      {
        hostThemeId: hostThemeId,
        hostThemeMode: hostThemeMode,
        previewThemeId: previewThemeId,
        stageMode: stageMode,
        needsGround: needsGround,
      } = (0, runtime.resolvePreviewTheme)(themes, hostMode, selectedThemeId),
      allFonts = runtime.reactArtifactRoot.useMemo(
        () => [...snapshot.fonts, ...snapshot.assetFonts],
        [snapshot.fonts, snapshot.assetFonts],
      ),
      blobFontAvailability = (0, runtime.useBlobDataUrls)(
        runtime.reactArtifactRoot.useMemo(
          () =>
            allFonts
              .filter((input) => input.store === "blob")
              .map((input) => ({
                src: input.src,
                type: (0, runtime.mimeTypeForPath)(input.path),
                bytes: input.bytes,
              })),
          [allFonts],
        ),
      );
    (0, runtime.useInlineFontFaces)(allFonts, blobFontAvailability);
    (0, runtime.usePublishedPreviewGeneration)(document2);
    (0, runtime.useFileAvailability)(
      runtime.reactArtifactRoot.useMemo(
        () =>
          runtime.preferLivePreviewUrls &&
          (0, runtime.supportsLivePreviewUrls)()
            ? []
            : snapshot.fonts
                .filter(
                  (input) =>
                    input.referenced &&
                    !input.missing &&
                    input.store === "inline",
                )
                .map((input) => ({
                  path: input.path,
                  typePrefix: "font/",
                  bytes: input.bytes,
                })),
        [snapshot.fonts],
      ),
    );
    (0, runtime.usePreviewStaticNotice)();
    let readOnly = document2.readOnly();
    runtime.reactArtifactRoot.useEffect(() => {
      let value = system.bootReport.warnings.filter((input) =>
        input.includes(": carried as "),
      );
      if (value.length > 0) {
        console.warn(
          `[design-system] renamed in this system (their names are generated beside the page):
` +
            value.join(`
`),
        );
      }
      let dropped = system.bootReport.dropped;
      if (dropped.length === 0) {
        return;
      }
      console.warn(
        `[design-system] not kept from the published files:
` +
          dropped.join(`
`),
      );
      (0, runtime.showEditorNotification)(
        String(dropped.length) +
          (dropped.length === 1
            ? " file in this system couldn’t be kept: "
            : " files in this system couldn’t be kept — first: ") +
          (dropped[0] ?? "") +
          (dropped.length > 1 ? " (the console lists all)" : ""),
        12000,
      );
    }, [system]);
    let [, refreshLibraryState] = runtime.reactArtifactRoot.useState(0);
    runtime.reactArtifactRoot.useEffect(
      () =>
        (0, runtime.subscribeAssetsState)(() =>
          refreshLibraryState((input) => input + 1),
        ),
      [],
    );
    runtime.reactArtifactRoot.useEffect(() => {
      if (
        readOnly ||
        (0, runtime.getAssetsCatalogState)().state !== "unknown"
      ) {
        return;
      }
      (0, runtime.resolveAssetsCapability)().then((input) =>
        input === null ? undefined : (0, runtime.refreshAssetsCatalog)(input),
      );
    }, [readOnly]);
    let [intakeProgress, setIntakeProgress] = (
        runtime.reactArtifactRoot as typeof React
      ).useState<string | null>(null),
      [intakeBusy, setIntakeBusy] = runtime.reactArtifactRoot.useState(false),
      freeingBlobIdsRef = runtime.reactArtifactRoot.useRef(new Set<string>()),
      intakeOptions: AssetIntakeOptions = runtime.reactArtifactRoot.useMemo(
        () => ({
          room: () =>
            (0, runtime.isUnboundedFileParsing)()
              ? Number.POSITIVE_INFINITY
              : runtime.DESIGN_SYSTEM_INLINE_LIMITS.total -
                system.getSnapshot().bytes.total.bytes,
          catalogue: () => system.getSnapshot().storage,
          freeing: () => freeingBlobIdsRef.current,
          onProgress: setIntakeProgress,
          onTierOff: (input) =>
            (0, runtime.showEditorNotification)(
              (0, runtime.inlineStorageFallbackMessage)(input),
            ),
        }),
        [system],
      ),
      editable: ApplicationCommands | undefined = readOnly ? undefined : editor;
    runtime.reactArtifactRoot.useEffect(() => {
      if (readOnly) {
        return;
      }
      let value: Promise<void> | null = null,
        callback = (
          input: string,
          options: string,
          context: string,
          value2: import("../../contracts").AssetUploadRecord,
        ) => {
          let value3 = system.content();
          system.update(
            (input2) =>
              (0, runtime.replaceInlineFileWithPointer)(
                input2,
                input,
                options,
                context,
                value2,
              ),
            {
              auto: true,
            },
          );
          return system.content() !== value3;
        },
        callback2 = () => {
          value = null;
        };
      system.beforeSave = () =>
        document.visibilityState === "hidden"
          ? Promise.resolve()
          : (value ??= (0, runtime.existingFontUploadFiles)(
              system.content().files,
              intakeOptions,
              callback,
            ).then(callback2, callback2));
      return () => {
        system.beforeSave = null;
      };
    }, [system, intakeOptions, readOnly]);
    let view: ApplicationView = runtime.reactArtifactRoot.useMemo(
        () => (0, runtime.designSystemEditorView)(snapshot),
        [snapshot],
      ),
      viewRef = runtime.reactArtifactRoot.useRef(view);
    viewRef.current = view;
    let blobCatalogue = (0, runtime.getAssetsCatalogState)(),
      blobAnalysis = runtime.reactArtifactRoot.useMemo(
        () =>
          (0, runtime.assessAssetReclamation)(
            snapshot.files,
            freeingBlobIdsRef.current,
          ),
        [snapshot.files, blobCatalogue],
      ),
      storedBlobBytes =
        blobCatalogue.state === "listed"
          ? blobCatalogue.usage.bytes
          : snapshot.blobBytesUsed,
      emptySystem =
        (0, runtime.hasOnlyManifestFile)(snapshot.files) &&
        storedBlobBytes === 0,
      colorTokenNames = runtime.reactArtifactRoot.useMemo(
        () =>
          new Set((0, runtime.tokenNamesForFamily)(snapshot.tokens, "color")),
        [snapshot.tokens],
      ),
      emptySections = runtime.reactArtifactRoot.useMemo(
        () =>
          emptySystem
            ? new Set(runtime.STARTER_SECTION_IDS)
            : (0, runtime.emptyDesignSystemSections)(view, {
                storedBytes: storedBlobBytes,
              }),
        [emptySystem, view, storedBlobBytes],
      ),
      editingOff =
        runtime.reactArtifactRoot.useSyncExternalStore(
          runtime.subscribeStoredSystemStatus,
          runtime.getStoredSystemStatus,
          runtime.getStoredSystemStatus,
        ).editingOff === true && editable === undefined,
      sections: SectionRow[] = runtime.reactArtifactRoot.useMemo(
        () =>
          editingOff
            ? designSystemSections(view.extras).filter(
                (input) => input.id === "readme",
              )
            : designSystemSections(view.extras),
        [view.extras, editingOff],
      ),
      handoffAvailable = (0, runtime.useMigrationCleanupEnabled)(),
      sectionsRef = runtime.reactArtifactRoot.useRef(sections);
    sectionsRef.current = sections;
    useGoogleFontStylesheets(
      view.familyNames,
      view.fonts,
      snapshot.tokens.type,
    );
    let sectionIds: string[] = runtime.reactArtifactRoot.useMemo(
        () => sections.map((input) => input.id),
        [sections],
      ),
      [initialSection] = runtime.reactArtifactRoot.useState(
        initialDesignSystemSection,
      ),
      sectionScroller: SectionScroller = (0, runtime.useSectionScroller)(
        sectionIds,
        stickyHeaderBottom,
        sectionRefs,
        initialSection,
      ),
      attachScroller = runtime.reactArtifactRoot.useCallback(
        (input: HTMLElement | null) => {
          scrollerRef.current = input;
          sectionScroller.attach(input);
        },
        [sectionScroller.attach],
      ),
      currentSection = sections.some(
        (input) => input.id === sectionScroller.current,
      )
        ? sectionScroller.current
        : "readme",
      currentSectionRef = runtime.reactArtifactRoot.useRef(currentSection);
    currentSectionRef.current = currentSection;
    let markSectionRef = runtime.reactArtifactRoot.useRef(sectionScroller.mark);
    markSectionRef.current = sectionScroller.mark;
    let revealController = runtime.reactArtifactRoot.useMemo(
        () =>
          (0, runtime.createEditorSectionNavigationActions)({
            sectionLabel: (input) =>
              sectionsRef.current.find((input2) => input2.id === input)?.label,
            show: (input) => {
              if (isDesignSystemSection(input)) {
                jumpToSectionRef.current(input);
              }
            },
            mark: (input) => {
              if (isDesignSystemSection(input)) {
                markSectionRef.current(input);
              }
            },
            sectionEl: (input) => sectionRefs.current[input],
            say: runtime.announceLiveMessage,
          }),
        [],
      ),
      textReveal = (0, runtime.useEditorSectionNavigation)({
        sections: sectionRefs,
        port: sectionScroller.port,
        ...revealController,
      }),
      jumpToSection = (input: string) => {
        textReveal.release();
        if (sections.some((input2) => input2.id === input)) {
          sectionScroller.jump(input);
        }
      },
      jumpToSectionRef = runtime.reactArtifactRoot.useRef(jumpToSection);
    jumpToSectionRef.current = jumpToSection;
    let hashTimerRef = runtime.reactArtifactRoot.useRef(0);
    runtime.reactArtifactRoot.useEffect(() => {
      if (!sectionScroller.moved) {
        return;
      }
      window.clearTimeout(hashTimerRef.current);
      hashTimerRef.current = window.setTimeout(
        () => (0, runtime.replaceSectionHash)(currentSection),
        200,
      );
      return () => window.clearTimeout(hashTimerRef.current);
    }, [currentSection, sectionScroller.moved]);
    runtime.reactArtifactRoot.useEffect(() => {
      let callback = () => {
        let value = window.location.hash.slice(1);
        if (
          isDesignSystemSection(value) &&
          value !== currentSectionRef.current
        ) {
          jumpToSectionRef.current(value);
        }
      };
      window.addEventListener("hashchange", callback);
      return () => window.removeEventListener("hashchange", callback);
    }, []);
    let revealAsset = (
        source: import("../../contracts/application").AssetRevealTarget,
      ): void => {
        sectionScroller.want(REVEAL_SECTION_BY_KIND[source.kind]);
        assetReveal.reveal(source);
      },
      starter = runtime.reactArtifactRoot.useMemo(
        () =>
          (0, runtime.starterSectionState)(
            emptySections,
            editable !== undefined,
            view.assetGroups.length === 0,
            view.extras.length > 0,
          ),
        [emptySections, editable, view.assetGroups.length, view.extras.length],
      ),
      [confirmation, setConfirmation] = (
        runtime.reactArtifactRoot as typeof React
      ).useState<ConfirmationState | null>(null),
      undoAvailable = (0, runtime.useCoarsePointer)(),
      announceUndoableChange = (input: string) => {
        if (!undoAvailable) {
          return (0, runtime.announceLiveMessage)(input);
        }
        let callback = () => {
            return;
          },
          value = (0, runtime.showEditorPromiseNotification)(
            input,
            <runtime.Button
              size={"sm"}
              onClick={() => {
                callback();
                (0, runtime.closeToast)(value);
                editor.undo.undo();
              }}
            >
              {"Undo"}
            </runtime.Button>,
          );
        callback = editor.undo.subscribe(() => {
          callback();
          (0, runtime.closeToast)(value);
        });
      },
      focusTestId = (input: string) => {
        let value =
          scrollerRef.current?.querySelector<HTMLElement>(
            '[data-testid="' + input + '"]',
          ) ?? null;
        if (value === null) {
          return;
        }
        value.focus({
          preventScroll: true,
        });
        value.scrollIntoView({
          block: "nearest",
          inline: "nearest",
        });
      },
      removeToken = (input: AddTokenKind) => (input2: string) => {
        if (
          editable?.exec("remove " + input2, (input3) =>
            (0, runtime.deleteToken)(input3, input, input2),
          ) === true
        ) {
          announceUndoableChange("Removed " + input2);
        }
      },
      renameToken2 =
        (input: AddTokenKind) => (input2: string, options: string) =>
          editable?.exec("rename " + input2, (input3) =>
            (0, runtime.renameToken)(input3, input, input2, options),
          ) ?? false,
      sectionTitle = (input: string, options: string) =>
        snapshot.sectionTitles[input] ?? options,
      sectionHead = (input: string, options: string) => ({
        title: sectionTitle(input, options),
        defaultTitle: options,
        "data-testid": "ds-card-" + input,
      }),
      colorEdit = runtime.reactArtifactRoot.useMemo<
        ColorEditActions | undefined
      >(
        () =>
          editable === undefined
            ? undefined
            : {
                usage: (input, options) =>
                  void editable.set("usage:color:" + input, (input2) =>
                    (0, runtime.setColorTokenUsage)(input2, input, options),
                  ),
                value: (input, options, context) =>
                  void editable.set(
                    "color:" + input + ":" + options,
                    (input2) =>
                      (0, runtime.setColorTokenValue)(
                        input2,
                        input,
                        options,
                        context,
                      ),
                  ),
                clear: (input, options) =>
                  void editable.exec(
                    "clear " + input + " " + options,
                    (input2) =>
                      (0, runtime.clearColorThemeOverride)(
                        input2,
                        input,
                        options,
                      ),
                  ),
                done: () => editable.seal(),
                remove: removeToken("color"),
                rename: renameToken2("color"),
                addTo: (input) => showAddColor(input.name),
                addGroup: (input) => showAddColor("", input === true),
                removeGroup: (input) => {
                  let value =
                      input.name === ""
                        ? runtime.PALETTE_GROUP_NAME
                        : input.name,
                    length = input.tokens.length;
                  setConfirmation({
                    title:
                      "Delete " +
                      value +
                      " and its " +
                      String(length) +
                      (length === 1 ? " color?" : " colors?"),
                    confirmLabel: "Delete",
                    body:
                      (length === 1
                        ? "It is"
                        : "All " + String(length) + " are") +
                      " removed from tokens.json; colors in other groups that alias them keep their resolved values. Undo brings the group back.",
                    run: () => {
                      let value2 = (
                        viewRef.current.colorGroups.find(
                          (input2) => input2.name === input.name,
                        )?.tokens ?? []
                      ).map((input2) => input2.name);
                      if (
                        value2.length > 0 &&
                        editable.exec("remove group " + value, (input2) =>
                          (0, runtime.deleteColorTokens)(input2, value2),
                        )
                      ) {
                        announceUndoableChange("Deleted " + value);
                      } else {
                        (0, runtime.showEditorNotification)(
                          value + " changed meanwhile. Nothing was deleted.",
                        );
                      }
                      requestAnimationFrame(() =>
                        focusTestId("ds-add-color-group"),
                      );
                    },
                  });
                },
                renameGroup: (input, options) => {
                  let value = (0, runtime.tokenGroupRenamePairs)(
                    input.tokens.map((input2) => input2.name),
                    (0, runtime.commonTokenNamePrefix)(
                      (0, runtime.tokenNamesForFamily)(
                        snapshot.tokens,
                        "color",
                      ),
                    ),
                    input.name,
                    options,
                  );
                  if (value.length === 0) {
                    return false;
                  }
                  return editable.exec(
                    "rename group " +
                      (input.name === "" ? "palette" : input.name),
                    (input2) =>
                      (0, runtime.renameColorTokensAtomically)(input2, value),
                  );
                },
              },
        [editable, snapshot],
      ),
      scaleEdit = (
        input: ScalarTokenKind,
        options?: string,
      ): ScalarEditActions | undefined =>
        editable === undefined
          ? undefined
          : {
              value: (input2, options2) =>
                void editable.set(input + ":" + input2, (input3) =>
                  (0, runtime.setScalarTokenValue)(
                    input3,
                    input,
                    input2,
                    options2,
                  ),
                ),
              done: () => editable.seal(),
              usage: (input2, options2) =>
                void editable.set("usage:" + input + ":" + input2, (input3) =>
                  (0, runtime.setTokenUsage)(input3, input, input2, options2),
                ),
              note: (input2) =>
                void editable.exec(
                  "edit " + (options ?? input) + " note",
                  (input3) =>
                    (0, runtime.setTokenFamilyNote)(
                      input3,
                      input,
                      input2,
                      options,
                    ),
                ),
              remove: removeToken(input),
              rename: renameToken2(input),
            },
      spacingEdit = runtime.reactArtifactRoot.useMemo<
        ScalarEditActions | undefined
      >(() => scaleEdit("spacing"), [editable, snapshot]),
      radiusEdit = runtime.reactArtifactRoot.useMemo<
        ScalarEditActions | undefined
      >(() => scaleEdit("radius"), [editable, snapshot]),
      extraScaleEdit = (input: string) => {
        let value = scaleEdit("extra", input);
        if (value === undefined) {
          return undefined;
        } else {
          return {
            ...value,
            add: showAddScaleToken,
          };
        }
      },
      shadowEdit = runtime.reactArtifactRoot.useMemo<
        ShadowEditActions | undefined
      >(
        () =>
          editable === undefined
            ? undefined
            : {
                value: (input, options, context) =>
                  void editable.exec(
                    "edit " + input + " " + options,
                    (input2) =>
                      (0, runtime.setShadowTokenValue)(
                        input2,
                        input,
                        options,
                        context,
                      ),
                  ),
                live: (input, options, context) =>
                  void editable.set(
                    "shadow:" + input + ":" + options,
                    (input2) =>
                      (0, runtime.setShadowTokenValue)(
                        input2,
                        input,
                        options,
                        context,
                      ),
                  ),
                done: () => editable.seal(),
                usage: (input, options) =>
                  void editable.set("usage:shadow:" + input, (input2) =>
                    (0, runtime.setTokenUsage)(
                      input2,
                      "shadow",
                      input,
                      options,
                    ),
                  ),
                remove: removeToken("shadow"),
                rename: renameToken2("shadow"),
              },
        [editable, snapshot],
      ),
      typeEdit = runtime.reactArtifactRoot.useMemo<
        TypographyEditActions | undefined
      >(
        () =>
          editable === undefined
            ? undefined
            : {
                setField: (input, options, context) =>
                  void editable.set(
                    "style:" + input + ":" + options,
                    (input2) =>
                      (0, runtime.setTypographyProperty)(
                        input2,
                        input,
                        options,
                        context,
                      ),
                  ),
                setFont: (input, options) => {
                  let value = (0, runtime.validateNewFontFamily)(
                    options,
                    snapshot.tokens.type.families,
                  );
                  if (value !== null) {
                    (0, runtime.showEditorNotification)(value);
                    return;
                  }
                  editable.exec("font " + input, (input2) =>
                    (0, runtime.setTypographyFontFamily)(
                      input2,
                      input,
                      options,
                    ),
                  );
                },
                done: () => editable.seal(),
                setUsage: (input, options) =>
                  void editable.set("usage:style:" + input, (input2) =>
                    (0, runtime.setTypographyStyleUsage)(
                      input2,
                      input,
                      options,
                    ),
                  ),
                remove: removeToken("type"),
                rename: renameToken2("type"),
                dropMissingFonts: () => {
                  if (
                    editable.exec("drop missing font references", (input) =>
                      (0, runtime.removeMissingFontReferences)(input),
                    )
                  ) {
                    (0, runtime.announceLiveMessage)("Reference removed");
                  }
                },
              },
        [editable, snapshot],
      ),
      componentEdit = runtime.reactArtifactRoot.useMemo<
        ComponentEditActions | undefined
      >(
        () =>
          editable === undefined
            ? undefined
            : {
                setGuidelines: (input, options) =>
                  void editable.set("guide:" + input, (input2) =>
                    (0, runtime.setComponentGuidelines)(input2, input, options),
                  ),
                done: () => editable.seal(),
              },
        [editable],
      ),
      componentProps = runtime.reactArtifactRoot.useMemo(() => {
        if (!runtime.editorFeatureFlags.componentProps) {
          return;
        }
        let entries = new Map<string, InferredPropControl[]>(),
          value = snapshot.bundle.dts.map((input) => input.text);
        return (input: EditorComponent) => {
          let entry = entries.get(input.name);
          if (entry !== undefined) {
            return entry;
          }
          let value2 = (0, runtime.inferComponentPropControls)(input.name, [
            input.types,
            ...value,
          ]);
          entries.set(input.name, value2);
          return value2;
        };
      }, [snapshot.bundle.dts]),
      componentStage = runtime.reactArtifactRoot.useMemo(
        () => ({
          namespace: snapshot.bundle.namespace ?? "",
          globals: snapshot.bundle.declared.flatMap((input) =>
            input.global !== undefined ? [input.global] : [],
          ),
        }),
        [snapshot.bundle.namespace, snapshot.bundle.declared],
      ),
      lastChange = snapshot.lastChange,
      removeFont =
        editable === undefined
          ? undefined
          : (input: Pick<EditorFont, "path">) => {
              if (
                editable.exec("remove font " + input.path, (input2) =>
                  (0, runtime.deleteFontFace)(input2, input.path),
                )
              ) {
                announceUndoableChange(
                  "Removed " + input.path.replace(/^(?:fonts|assets)\//, ""),
                );
              }
            },
      [openAssetPath, setOpenAssetPath] = (
        runtime.reactArtifactRoot as typeof React
      ).useState<string | null>(null),
      openAsset = runtime.reactArtifactRoot.useMemo(
        () =>
          openAssetPath === null
            ? null
            : (view.assetGroups
                .flatMap((input) => input.assets)
                .find((input) => input.path === openAssetPath) ?? null),
        [openAssetPath, view.assetGroups],
      ),
      storageUsageText = (0, runtime.assetStorageUsageMessage)(blobCatalogue, {
        bytes: snapshot.blobBytesUsed,
        files: (0, runtime.uniqueStoredBlobCount)(snapshot.storage),
      }),
      missingBlobsNoticedRef = runtime.reactArtifactRoot.useRef(false);
    runtime.reactArtifactRoot.useEffect(() => {
      if (
        blobAnalysis === null ||
        blobAnalysis.missing.length === 0 ||
        missingBlobsNoticedRef.current
      ) {
        return;
      }
      missingBlobsNoticedRef.current = true;
      (0, runtime.showEditorNotification)(
        (0, runtime.missingAssetsMessage)(blobAnalysis.missing),
      );
    }, [blobAnalysis]);
    let [freeingStorage, setFreeingStorage] =
        runtime.reactArtifactRoot.useState(false),
      freeSpaceText =
        editable === undefined || freeingStorage || blobAnalysis === null
          ? ""
          : (0, runtime.reclaimAssetsButtonLabel)(
              blobAnalysis.reclaimableBytes,
              blobAnalysis.reclaimable.length,
              undefined,
              blobAnalysis.windowed,
            ),
      documentStillLoading = () =>
        "loadState" in document2 && document2.saveState().status !== "ready",
      afterContentSaved = (input: () => void) => {
        let callback = () =>
          documentStillLoading()
            ? (0, runtime.showEditorNotification)(
                runtime.RECLAIM_RECONNECTING_MESSAGE,
              )
            : input();
        if (!document2.dirty()) {
          return callback();
        }
        if (document2.saveMode() !== "auto") {
          return (0, runtime.showEditorNotification)(
            runtime.RECLAIM_SAVE_FIRST_MESSAGE,
          );
        }
        if (system.holdAutosave) {
          return (0, runtime.showEditorNotification)(
            "Adding your files first. Try again once they are in.",
          );
        }
        document2.save().then(() => {
          if (!document2.dirty()) {
            return callback();
          }
          let value = document2.saveState();
          (0, runtime.showEditorNotification)(
            value.status === "error"
              ? "Your latest changes could not be saved yet: " +
                  (value.message ?? "")
              : runtime.RECLAIM_SAVING_MESSAGE,
          );
        });
      },
      freeStorage = () =>
        afterContentSaved(() => {
          let value = (0, runtime.assessAssetReclamation)(
            system.getSnapshot().files,
          );
          if (value?.windowed === true) {
            return (0, runtime.showEditorNotification)(
              runtime.RECLAIM_WINDOWED_COLLECTION_MESSAGE,
            );
          }
          if (value === null || value.reclaimable.length === 0) {
            return;
          }
          setFreeingStorage(true);
          (0, runtime.publishedPageBlobIds)()
            .then((input) => {
              if (document2.dirty() || documentStillLoading()) {
                (0, runtime.showEditorNotification)(
                  !document2.dirty()
                    ? runtime.RECLAIM_RECONNECTING_MESSAGE
                    : document2.saveMode() === "auto"
                      ? runtime.RECLAIM_SAVING_MESSAGE
                      : runtime.RECLAIM_SAVE_FIRST_MESSAGE,
                );
                return;
              }
              let value2 = (0, runtime.assessAssetReclamation)(
                system.getSnapshot().files,
              );
              if (value2 === null || value2.windowed) {
                (0, runtime.showEditorNotification)(
                  value2 === null
                    ? runtime.RECLAIM_LIST_FAILED_MESSAGE
                    : runtime.RECLAIM_WINDOWED_COLLECTION_MESSAGE,
                );
                return;
              }
              let values = new Set(
                  value2.reclaimable.map((input2) => input2.id),
                ),
                value3 = (0, runtime.excludePublishedAssets)(
                  value.reclaimable.filter((input2) => values.has(input2.id)),
                  input,
                );
              if (value3.length === 0) {
                (0, runtime.showEditorNotification)(
                  runtime.RECLAIM_NOTHING_UNUSED_MESSAGE,
                );
                return;
              }
              freeingBlobIdsRef.current = new Set(
                value3.map((input2) => input2.id),
              );
              return (0, runtime.deleteStoredAssets)(value3).then((input2) => {
                if (input2.freed.size > 0) {
                  editor.undo.clear();
                }
                (0, runtime.showEditorNotification)(
                  (0, runtime.reclaimAssetsResultMessage)(input2),
                );
              });
            })
            .finally(() => {
              freeingBlobIdsRef.current = new Set();
              setFreeingStorage(false);
            });
        }),
      askFreeStorage = () =>
        afterContentSaved(() => {
          (0, runtime.refreshAssetsCatalog)().then(() => {
            let value = (0, runtime.assessAssetReclamation)(
              system.getSnapshot().files,
            );
            if (value === null || value.reclaimable.length === 0) {
              (0, runtime.showEditorNotification)(
                value === null
                  ? runtime.RECLAIM_LIST_FAILED_MESSAGE
                  : value.windowed
                    ? runtime.RECLAIM_WINDOWED_COLLECTION_MESSAGE
                    : runtime.RECLAIM_NOTHING_UNUSED_MESSAGE,
              );
              return;
            }
            setConfirmation({
              title: "Free space?",
              body: (0, runtime.reclaimAssetsConfirmation)(
                value.reclaimable.length,
                value.reclaimableBytes,
              ),
              confirmLabel: "Delete permanently",
              run: freeStorage,
            });
          });
        }),
      downloadAsset = (input: EditorAsset) => {
        (0, runtime.readDownloadFileBytes)(
          snapshot.files,
          input.path,
          snapshot.storage,
        ).then((input2) => {
          if (input2 === null) {
            runtime.artifactHealth.report(...runtime.DOWNLOAD_INTERNAL_FAILURE);
            (0, runtime.showEditorNotification)(
              "Could not read " + input.name + " here",
            );
            return;
          }
          (0, runtime.saveDownloadFile)(
            input.name,
            input2,
            input.mime !== "" ? input.mime : "application/octet-stream",
          ).then((input3) => {
            runtime.artifactHealth.report(
              ...(0, runtime.downloadHealthOutcome)(input3.shell)!,
            );
            if (
              input3.outcome === "withheld" ||
              input3.outcome === "refused" ||
              input3.outcome === "failed"
            ) {
              (0, runtime.showEditorNotification)(
                artifactDownloadResultMessage(input.name, input3),
              );
            }
          });
        });
      },
      [handoffHost] = runtime.reactArtifactRoot.useState(() =>
        (0, runtime.createClaudeDeliveryContextStore)(),
      ),
      refreshHandoffHost = handoffHost.refresh;
    runtime.reactArtifactRoot.useEffect(() => {
      let callback = () => {
        if (document.visibilityState !== "hidden") {
          handoffHost.refresh();
        }
      };
      handoffHost.refresh();
      window.addEventListener("focus", callback);
      document.addEventListener("visibilitychange", callback);
      return () => {
        window.removeEventListener("focus", callback);
        document.removeEventListener("visibilitychange", callback);
      };
    }, [handoffHost]);
    let [handoffNotice, setHandoffNotice] = runtime.reactArtifactRoot.useState<{
        kind: "failed" | "suggested" | "copied";
        held: boolean;
        prompt: string;
      } | null>(null),
      [handoffBusy, setHandoffBusy] = runtime.reactArtifactRoot.useState(false),
      noticeWithAction = (
        input: string,
        options: string,
        context: () => void,
      ) => {
        let value = (0, runtime.showEditorPromiseNotification)(
          input,
          <runtime.Button
            size={"sm"}
            onClick={() => {
              (0, runtime.closeToast)(value);
              context();
            }}
          >
            {options}
          </runtime.Button>,
        );
      },
      copyHandoffPrompt = (input: string) =>
        void (0, runtime.copyTextToClipboard)(input).then((input2) =>
          input2
            ? (0, runtime.showEditorNotification)("Copied")
            : noticeWithAction("Copy failed", "Copy it", () =>
                copyHandoffPrompt(input),
              ),
        ),
      askClaude = (
        input: ClaudeRequest,
        options?: Element | null,
        context?: () => void,
      ) => {
        setHandoffNotice(null);
        setHandoffBusy(true);
        let value = handoffHost.current(),
          value2 = document2.dirty(),
          value3 = (0, runtime.chooseClaudeDeliveryRoad)(input, value, value2);
        (0, runtime.reportMigrationCleanupPressed)(input, value3);
        (0, runtime.deliverClaudeRequest)(input, options, value, value2)
          .then((source) => {
            (0, runtime.reportMigrationCleanupResult)(
              input,
              value3,
              source.kind,
            );
            if (source.kind !== "staged") {
              refreshHandoffHost();
            }
            if (source.kind === "staged" && input.deliver === "send") {
              return;
            }
            if (source.kind === "unanswered" && context !== undefined) {
              noticeWithAction(
                (0, runtime.claudeSendResultMessage)("unanswered"),
                // CucCut: user-facing copy calls the agent "the agent", not Claude.
                "Ask the agent",
                context,
              );
              return;
            }
            if (source.kind === "staged" || source.kind === "unanswered") {
              (0, runtime.showEditorNotification)(
                (0, runtime.claudeSendResultMessage)(source.kind),
              );
              return;
            }
            if (source.kind === "sent") {
              (0, runtime.showEditorNotification)(CLAUDE_COMMENT_SENT_MESSAGE);
              return;
            }
            setHandoffNotice({
              kind: source.kind,
              held: source.held === true,
              prompt: input.prompt,
            });
          })
          .finally(() => setHandoffBusy(false));
      },
      askGithub =
        editable === undefined
          ? undefined
          : (input: Element) =>
              askClaude(
                {
                  label: "Sync from GitHub",
                  request: (0, runtime.viewerGitHubSyncPrompt)(
                    (0, runtime.artifactPageAddress)(),
                  ),
                  prompt: (0, runtime.githubStarterPrompt)(
                    (0, runtime.artifactPageAddress)(),
                  ),
                  deliver: "send",
                },
                input,
              ),
      connectorOptionLabel = runtime.WELCOME_OPTIONS.connect[0],
      uploadOptionLabel = runtime.WELCOME_OPTIONS.upload[0],
      askConnectors =
        editable === undefined
          ? undefined
          : (input: Element) =>
              askClaude(
                {
                  label: connectorOptionLabel,
                  request: (0, runtime.viewerEmptySystemPrompt)(
                    (0, runtime.artifactPageAddress)(),
                    connectorOptionLabel,
                  ),
                  prompt: (0, runtime.ownerEmptySystemPrompt)(
                    (0, runtime.artifactPageAddress)(),
                    connectorOptionLabel,
                  ),
                  deliver: "send",
                },
                input,
              ),
      [uploadPanelOpen, setUploadPanelOpen] =
        runtime.reactArtifactRoot.useState(false),
      uploadPanelActive = uploadPanelOpen,
      uploadPanelActiveRef = runtime.reactArtifactRoot.useRef(false);
    uploadPanelActiveRef.current = uploadPanelActive;
    let uploadPanelVisibleRef = runtime.reactArtifactRoot.useRef(false);
    uploadPanelVisibleRef.current =
      uploadPanelOpen && currentSection === "readme";
    let showWelcome = starter.hint || uploadPanelOpen,
      emptyIntakeSummary: WelcomeIntakeSummary = {
        refused: [],
        landTo: null,
      },
      [intakeSummary, setIntakeSummary] =
        runtime.reactArtifactRoot.useState(emptyIntakeSummary),
      [intakeFiles, setIntakeFiles] = runtime.reactArtifactRoot.useState<
        File[]
      >([]),
      intakeFilesRef = runtime.reactArtifactRoot.useRef<File[]>([]);
    intakeFilesRef.current = intakeFiles;
    let addWelcomeFiles = (input: File[]) => {
        let callback = (input2: File, options: File) =>
            input2.name === options.name &&
            input2.size === options.size &&
            (0, runtime.uploadedFileRelativePath)(input2) ===
              (0, runtime.uploadedFileRelativePath)(options),
          value = input.filter(
            (input2, options) =>
              !intakeFilesRef.current.some((input3) =>
                callback(input3, input2),
              ) &&
              input.findIndex((input3) => callback(input3, input2)) === options,
          );
        if (
          value.length === 0 ||
          addFiles === undefined ||
          !addFiles(value, undefined, true)
        ) {
          return;
        }
        intakeFilesRef.current = [...intakeFilesRef.current, ...value];
        setIntakeFiles((input2) => [...input2, ...value]);
        setUploadPanelOpen(true);
      },
      clearWelcomeFiles = () => {
        setIntakeSummary(emptyIntakeSummary);
        setIntakeFiles([]);
        intakeFilesRef.current = [];
        setIntakeFilePaths(new Map());
      },
      closeUploadPanel = () => setUploadPanelOpen(false),
      openUploadPanel = () => setUploadPanelOpen(true),
      backFromUpload = () => {
        closeUploadPanel();
        if (intakeSummary.landTo !== null) {
          jumpToSection(intakeSummary.landTo);
        }
      },
      [intakeFilePaths, setIntakeFilePaths] =
        runtime.reactArtifactRoot.useState(new Map<File, string>()),
      keptIntakeCount = intakeFilePaths.size,
      previousFilesRef = runtime.reactArtifactRoot.useRef(snapshot.files);
    runtime.reactArtifactRoot.useEffect(() => {
      let current = previousFilesRef.current;
      previousFilesRef.current = snapshot.files;
      if (current === snapshot.files || intakeFilePaths.size === 0) {
        return;
      }
      let callback = (input: string) =>
          input.startsWith(runtime.DESIGN_SYSTEM_PATHS.fontsDir) ||
          input.startsWith(runtime.DESIGN_SYSTEM_PATHS.assetsDir),
        values = new Set(intakeFilePaths.values()),
        value = Object.keys(snapshot.files).filter(
          (input) =>
            !Object.hasOwn(current, input) &&
            !values.has(input) &&
            callback(input),
        ),
        value2 = Object.keys(current).filter(
          (input) => !Object.hasOwn(snapshot.files, input) && callback(input),
        ),
        value3 = [...intakeFilePaths].filter(
          ([, input]) => !Object.hasOwn(snapshot.files, input),
        );
      if (value3.length === 0) {
        return;
      }
      let entries = new Map(intakeFilePaths),
        items = [],
        callback2 = (input: string) => input.slice(input.lastIndexOf("/") + 1),
        callback3 = (input: string) => input.slice(0, input.indexOf("/"));
      for (let [value4, value5] of value3) {
        let value6 = value.filter(
            (input) =>
              callback2(input) === callback2(value5) &&
              callback3(input) === callback3(value5),
          ),
          value7 = value2.filter(
            (input) =>
              callback2(input) === callback2(value5) &&
              callback3(input) === callback3(value5),
          );
        if (value6.length === 1 && value7.length === 1) {
          entries.set(value4, value6[0]);
          value.splice(value.indexOf(value6[0]), 1);
        } else {
          entries.delete(value4);
          items.push(value4);
        }
      }
      setIntakeFilePaths(entries);
      if (items.length > 0) {
        setIntakeFiles((input) =>
          input.filter((input2) => !items.includes(input2)),
        );
      }
    }, [snapshot.files, intakeFilePaths]);
    let recordIntakeOutcome = (
        input: AssetUploadSummary,
        options: Map<File, string>,
      ) => {
        let value = (0, runtime.countSuccessfulUploads)(input);
        setIntakeSummary((input2) => ({
          refused: [
            ...input2.refused,
            ...input.refused.map((input3) => input3.name),
          ],
          landTo:
            value === 0
              ? input2.landTo
              : input2.landTo === "assets" ||
                  Object.keys(input.assets).length > 0
                ? "assets"
                : "type",
        }));
        if (options.size > 0) {
          setIntakeFilePaths((input2) => new Map([...input2, ...options]));
        }
      },
      removeWelcomeFile = (input: number) => {
        let value = intakeFiles[input];
        if (value === undefined || editable === undefined) {
          return;
        }
        let entry = intakeFilePaths.get(value),
          name = (0, runtime.uploadedAssetFile)(value).name,
          value2 = intakeFiles.length === 1,
          callback = () => {
            setIntakeFiles((input2) =>
              input2.filter((input3) => input3 !== value),
            );
            if (value2) {
              clearWelcomeFiles();
              closeUploadPanel();
            }
          };
        if (entry !== undefined) {
          let callback2 = (
            input2: import("../../contracts").DesignSystemContent,
          ) =>
            entry.startsWith(runtime.DESIGN_SYSTEM_PATHS.fontsDir)
              ? (0, runtime.deleteFontFace)(input2, entry)
              : (0, runtime.deleteAssetFile)(input2, entry);
          (0, runtime.performDesignSystemEdit)(
            editable,
            callback2,
            (input2) => {
              if (!editable.exec("remove " + entry, callback2, input2)) {
                return false;
              }
              setIntakeFilePaths((input3) => {
                let entries = new Map(input3);
                entries.delete(value);
                return entries;
              });
              callback();
              return true;
            },
            {
              nameOf: () => name,
            },
            "removal",
          );
          return;
        }
        if (intakeSummary.refused.includes(name)) {
          setIntakeSummary((input2) => {
            let items = [...input2.refused];
            items.splice(items.indexOf(name), 1);
            return {
              ...input2,
              refused: items,
            };
          });
        }
        callback();
      },
      renderAssetThumbnail = (input: import("../../contracts/editor-runtime").AssetThumbnail): React.ReactElement => (
        <runtime.AssetDetailsPreview
          asset={input}
          files={snapshot.files}
          storage={snapshot.storage}
          size={"tile"}
        />
      ),
      renderUploadThumbnail = (input: File): React.ReactElement => {
        let entry = intakeFilePaths.get(input),
          value = (entry === undefined
            ? undefined
            : view.assetGroups
                .flatMap((input2) => input2.assets)
                .find((input2) => input2.path === entry)) ?? {
            path: entry ?? "",
            group: "",
            name: input.name,
            mime: (0, runtime.mimeTypeForPath)(input.name),
            ext: (0, runtime.fileExtension)(input.name),
            kind:
              entry !== undefined &&
              entry.startsWith(runtime.DESIGN_SYSTEM_PATHS.fontsDir)
                ? "font"
                : (0, runtime.assetKindForPath)(input.name),
            bytes: input.size,
          };
        return (
          <runtime.AssetTileThumbnail
            a={value}
            renderThumb={renderAssetThumbnail}
          />
        );
      },
      createFromWelcomeFiles = (input: File[]) => {
        let value = input
            .filter(
              (input2) =>
                !(0, runtime.isIgnoredUploadFile)(input2) &&
                !intakeSummary.refused.includes(
                  (0, runtime.uploadedAssetFile)(input2).name,
                ),
            )
            .map((input2) => ({
              name: input2.name,
              bytes: input2.size,
            })),
          state: ClaudeRequest = {
            label: uploadOptionLabel,
            request: (0, runtime.viewerBuildFromFilesPrompt)(
              keptIntakeCount,
              (0, runtime.artifactPageAddress)(),
              uploadOptionLabel,
            ),
            prompt: (0, runtime.ownerBuildFromFilesPrompt)(
              value,
              (0, runtime.artifactPageAddress)(),
              uploadOptionLabel,
            ),
            deliver: "send",
          },
          callback = () => askClaude(state, null, callback);
        callback();
        let landTo = intakeSummary.landTo;
        clearWelcomeFiles();
        if (document2.dirty() && !system.holdAutosave) {
          editor.seal();
          document2.save().then(() => {
            let value2 = document2.saveState();
            if (value2.status === "error") {
              (0, runtime.showEditorNotification)(
                "The files are in but not saved yet: " +
                  (value2.message ?? "") +
                  (document2.saveMode() === "auto"
                    ? ""
                    : " Press Save to retry."),
              );
            }
          });
        }
        closeUploadPanel();
        if (landTo !== null) {
          jumpToSection(landTo);
        }
      },
      handoffNote =
        handoffNotice === null ? null : (
          <runtime.HandoffNotice
            kind={handoffNotice.kind}
            held={handoffNotice.held}
            prompt={handoffNotice.prompt}
            onCopy={() => copyHandoffPrompt(handoffNotice.prompt)}
          />
        ),
      sendFileHandoff = (input: ClaudeRequest, options: () => void) => {
        (0, runtime.deliverClaudeRequest)(
          input,
          null,
          handoffHost.current(),
          document2.dirty(),
        ).then((source) => {
          if (source.kind !== "staged") {
            refreshHandoffHost();
          }
          if (source.kind === "staged") {
            (0, runtime.showEditorNotification)(
              (0, runtime.claudeSendResultMessage)("staged"),
            );
          } else if (source.kind === "unanswered") {
            noticeWithAction(
              (0, runtime.claudeSendResultMessage)("unanswered"),
              // CucCut: user-facing copy calls the agent "the agent", not Claude.
              "Ask the agent",
              options,
            );
          } else if (source.kind === "sent") {
            (0, runtime.showEditorNotification)(CLAUDE_COMMENT_SENT_MESSAGE);
          } else if (source.kind === "failed") {
            noticeWithAction(
              (0, runtime.claudeDeliveryStatusMessage)(
                "failed",
                source.held === true,
              ),
              "Copy it",
              () => copyHandoffPrompt(input.prompt),
            );
          } else {
            (0, runtime.showEditorNotification)(
              (0, runtime.claudeDeliveryStatusMessage)(
                source.kind,
                source.held === true,
              ),
            );
          }
        });
      },
      fileHandoffAction = (items: RefusedUpload[]) => {
        let callback = () => {
          let value =
            items.length === 1
              ? // CucCut: user-facing copy calls the agent "the agent", not Claude.
                "Ask the agent about this file"
              : "Ask the agent about " + String(items.length) + " files";
          sendFileHandoff(
            {
              label: value,
              request: (0, runtime.ownerHandoffFilesPrompt)(
                items,
                (0, runtime.artifactPageAddress)(),
              ),
              prompt: (0, runtime.viewerHandoffFilesPrompt)(
                items,
                (0, runtime.artifactPageAddress)(),
              ),
            },
            callback,
          );
        };
        return callback;
      },
      announceIntakeOutcome = (
        input: AssetUploadSummary,
        options: boolean,
        context = false,
      ) => {
        if (
          context &&
          uploadPanelVisibleRef.current &&
          options &&
          input.refused.length === 0 &&
          input.warnings.length === 0
        ) {
          return;
        }
        let value = (0, runtime.uploadResultSummary)(input, options, context);
        if (value === null) {
          return;
        }
        if (value.handOff !== undefined) {
          noticeWithAction(
            value.text,
            // CucCut: user-facing copy calls the agent "the agent", not Claude.
            "Ask the agent",
            fileHandoffAction(value.handOff),
          );
        } else {
          (0, runtime.showEditorNotification)(value.text);
        }
      },
      assetManager = (0, runtime.useAssetGroupEditor)({
        groups: view.assetGroups,
        edit: editable,
        files: () => system.getSnapshot().files,
        scroller: scrollerRef,
        openAsset: setOpenAssetPath,
        downloadAsset: downloadAsset,
        askRemove: setConfirmation,
        removed: announceUndoableChange,
        reveal: revealAsset,
      }),
      INTAKE_QUEUE_WAIT_MS = 700,
      intakeRunningRef = runtime.reactArtifactRoot.useRef(false),
      intakeQueueRef = runtime.reactArtifactRoot.useRef<IntakeQueueEntry[]>([]),
      intakeSavingRef = runtime.reactArtifactRoot.useRef(false),
      addFiles =
        editable === undefined
          ? undefined
          : (items: File[], options?: string, context = false) => {
              if (items.length === 0) {
                return false;
              }
              if (intakeSavingRef.current) {
                (0, runtime.showEditorNotification)(
                  "Saving what you just added. Drop these again in a moment.",
                );
                return false;
              }
              intakeQueueRef.current.push({
                files: items,
                group: options ?? null,
                fromStart: context,
              });
              if (intakeRunningRef.current) {
                return true;
              }
              intakeRunningRef.current = true;
              setIntakeBusy(true);
              let current = currentSectionRef.current;
              system.holdAutosave = true;
              let value = document2.dirty(),
                values = new Set(Object.keys(document2.content().files)),
                callback = (input: string) =>
                  !values.has(input) &&
                  (input.startsWith(runtime.DESIGN_SYSTEM_PATHS.fontsDir) ||
                    input.startsWith(runtime.DESIGN_SYSTEM_PATHS.assetsDir)),
                flag = false;
              (async (): Promise<AssetUploadSummary> => {
                let state: AssetUploadSummary = {
                  fonts: 0,
                  assets: {},
                  blobs: 0,
                  refused: [],
                  warnings: [],
                };
                while (
                  intakeQueueRef.current.length > 0 ||
                  (await new Promise<boolean>((input) =>
                    setTimeout(
                      () => input(intakeQueueRef.current.length > 0),
                      INTAKE_QUEUE_WAIT_MS,
                    ),
                  ))
                ) {
                  if (intakeQueueRef.current.length === 0) {
                    continue;
                  }
                  let value2 = intakeQueueRef.current.shift();
                  if (value2 === undefined) {
                    continue;
                  }
                  let group = value2.group,
                    entries = new Map<File, string>(),
                    callback2 = (
                      input: File,
                      options2: () => import("../../contracts/application").UploadCommitResult,
                    ) => {
                      if (!value2.fromStart) {
                        return options2();
                      }
                      let values2 = new Set(
                          Object.keys(document2.content().files),
                        ),
                        value4 = options2(),
                        value5 =
                          value4 === true
                            ? Object.keys(document2.content().files).find(
                                (input2) =>
                                  !values2.has(input2) && callback(input2),
                              )
                            : undefined;
                      if (value5 !== undefined) {
                        entries.set(input, value5);
                      }
                      return value4;
                    },
                    neverSaves = document2.neverSaves,
                    value3 = await (0, runtime.uploadAssetFiles)(
                      value2.files,
                      {
                        ...intakeOptions,
                        onProgress: (input) => {
                          let value4 = intakeQueueRef.current.reduce(
                            (input2, options2) =>
                              input2 + options2.files.length,
                            0,
                          );
                          setIntakeProgress(
                            input === null
                              ? null
                              : input +
                                  (value4 > 0
                                    ? " · " + String(value4) + " more queued"
                                    : ""),
                          );
                        },
                        font: (input, options2) =>
                          callback2(options2, () =>
                            (0, runtime.commitUploadedAssetChange)(
                              (input2) =>
                                editable.exec(
                                  "add font " + input.fileName,
                                  input2,
                                ),
                              (input2) =>
                                (0, runtime.addFontFace)(input2, input),
                              neverSaves,
                            ),
                          ),
                        asset: (input, options2) =>
                          callback2(options2, () =>
                            (0, runtime.commitUploadedAssetChange)(
                              (input2) =>
                                editable.exec("add " + input.fileName, input2),
                              (input2) =>
                                (0, runtime.addAssetFile)(input2, input),
                              neverSaves,
                            ),
                          ),
                      },
                      group ?? undefined,
                    );
                  if (value2.fromStart) {
                    flag = true;
                    recordIntakeOutcome(value3, entries);
                  }
                  state = (0, runtime.mergeAssetUploadResults)(state, value3);
                }
                return state;
              })()
                .then(async (input): Promise<void> => {
                  setIntakeProgress(null);
                  if ((0, runtime.countSuccessfulUploads)(input) === 0) {
                    announceIntakeOutcome(input, false, flag);
                    return;
                  }
                  system.setNote(
                    flag
                      ? (0, runtime.uploadedFilesBuildSummary)(input)
                      : (0, runtime.addedFilesSummary)(input),
                    Object.fromEntries(
                      Object.entries(document2.content().files).filter(
                        ([input2]) => callback(input2),
                      ),
                    ),
                  );
                  let activeElement = document.activeElement,
                    value2 =
                      activeElement instanceof HTMLElement &&
                      (activeElement.isContentEditable ||
                        /^(INPUT|TEXTAREA|SELECT)$/.test(
                          activeElement.tagName,
                        ));
                  if (
                    currentSectionRef.current === current &&
                    tokenDialogRef.current === null &&
                    !uploadPanelVisibleRef.current &&
                    !value2
                  ) {
                    jumpToSection(
                      Object.keys(input.assets).length === 0 && input.fonts > 0
                        ? "type"
                        : "assets",
                    );
                  }
                  let value3 = value && document2.saveMode() !== "auto";
                  announceIntakeOutcome(input, !value3, flag);
                  if (value3) {
                    return;
                  }
                  editor.seal();
                  system.holdAutosave = false;
                  setIntakeProgress("Saving…");
                  intakeSavingRef.current = true;
                  await document2.save();
                  intakeSavingRef.current = false;
                  setIntakeProgress(null);
                  let value4 = document2.saveState();
                  if (value4.status === "error") {
                    (0, runtime.showEditorNotification)(
                      "The files are in but not saved yet: " +
                        value4.message +
                        (document2.saveMode() === "auto"
                          ? ""
                          : " Press Save to retry."),
                    );
                  }
                })
                .finally(() => {
                  system.holdAutosave = false;
                  intakeSavingRef.current = false;
                  intakeRunningRef.current = false;
                  setIntakeBusy(false);
                });
              return true;
            },
      uploadAssets =
        addFiles === undefined
          ? undefined
          : () => void (0, runtime.pickUploadFiles)().then(addFiles),
      uploadFonts =
        addFiles === undefined
          ? undefined
          : () =>
              void (0, runtime.pickUploadFiles)(
                false,
                runtime.FONT_FILE_ACCEPT,
              ).then(addFiles),
      [flashTarget, setFlashTarget] = (
        runtime.reactArtifactRoot as typeof React
      ).useState<TokenFlashTarget | null>(null),
      flashToken = (input: string, options = true, context?: string) =>
        setFlashTarget({
          name: input,
          scroll: options,
          group: context,
        });
    runtime.reactArtifactRoot.useEffect(() => {
      if (flashTarget === null) {
        return;
      }
      let current = scrollerRef.current,
        value = ["color", "style", "spacing", "corners", "family", "shadow"]
          .map(
            (input) =>
              '[data-testid="ds-' + input + "-" + flashTarget.name + '"]',
          )
          .join(", "),
        value2 =
          current?.querySelector(value) ??
          (flashTarget.group !== undefined
            ? current?.querySelector(
                '[data-testid="ds-color-group-' + flashTarget.group + '"]',
              )
            : null);
      if (!(value2 instanceof HTMLElement)) {
        return;
      }
      if (flashTarget.scroll && typeof value2.scrollIntoView === "function") {
        value2.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
      value2.classList.add("ds-flash");
      let value3 = window.setTimeout(() => {
        value2.classList.remove("ds-flash");
        setFlashTarget(null);
      }, 1200);
      return () => {
        window.clearTimeout(value3);
        value2.classList.remove("ds-flash");
      };
    }, [flashTarget]);
    let nextNumericTokenName = (
        input: string,
        options: string[],
        context: string,
      ) => {
        if (input === "") {
          return context;
        }
        let value = options
          .map((input2) => /-(\d{1,4})$/.exec(input2)?.[1])
          .filter((input2) => input2 !== undefined);
        if (value.length === 0) {
          return input + "-2";
        }
        let value2 = [
            ...new Set(value.map((input2) => parseInt(input2, 10))),
          ].sort((input2, options2) => input2 - options2),
          value3 =
            value2.length > 1
              ? Math.min(
                  ...value2
                    .slice(1)
                    .map((input2, options2) => input2 - value2[options2]),
                )
              : 100;
        return (
          input +
          "-" +
          String(value2.at(-1)! + value3).padStart(
            Math.max(...value.map((items) => items.length)),
            "0",
          )
        );
      },
      [tokenDialog, setTokenDialog] = (
        runtime.reactArtifactRoot as typeof React
      ).useState<TokenDialogState | null>(null),
      tokenDialogRef = runtime.reactArtifactRoot.useRef(tokenDialog);
    tokenDialogRef.current = tokenDialog;
    let valueThemes =
        themes.length > 0
          ? themes
          : [
              {
                id: "light",
                name: "Value",
              },
            ],
      defaultValueThemeId = valueThemes[0]?.id ?? "light",
      themeGrounds = runtime.reactArtifactRoot.useMemo(
        () => previewThemeGroundColors(snapshot.tokens, valueThemes),
        [snapshot.tokens, valueThemes],
      ),
      previewGround =
        needsGround && previewThemeId !== undefined
          ? themeGrounds[previewThemeId]?.well
          : undefined,
      addColorToken2 = (source: AddedToken, options?: string) => {
        if (editable === undefined || source.kind !== "color") {
          return;
        }
        let value = source.values[defaultValueThemeId] ?? "#888888";
        if (
          editable.exec(
            source.newGroup ? "add color group" : "add color",
            (input) => {
              let value2 = (0, runtime.addColorToken)(
                input,
                source.name,
                value,
                options,
              );
              if (value2 === input) {
                return input;
              }
              for (let [value3, value4] of Object.entries(source.values)) {
                if (value3 !== defaultValueThemeId) {
                  value2 = (0, runtime.setColorTokenValue)(
                    value2,
                    source.name,
                    value3,
                    value4,
                  );
                }
              }
              if (source.usage !== "") {
                value2 = (0, runtime.setColorTokenUsage)(
                  value2,
                  source.name,
                  source.usage,
                );
              }
              return value2;
            },
          )
        ) {
          flashToken(
            source.name,
            true,
            source.group === "" ? undefined : source.group,
          );
        } else {
          (0, runtime.showEditorNotification)(
            "Could not add " + source.name + ".",
          );
        }
      },
      showAddColor = (input = "", options = false) => {
        if (editable === undefined) {
          return;
        }
        let value = (0, runtime.tokenNamesForFamily)(snapshot.tokens, "color"),
          value2 = (0, runtime.commonTokenNamePrefix)(value),
          value3 = view.colorGroups.map((input2) => ({
            key: input2.name,
            label:
              input2.name === "" ? runtime.PALETTE_GROUP_NAME : input2.name,
            seed:
              input2.name === ""
                ? value2
                : input2.numeric === true
                  ? (0, runtime.unusedTokenName)(
                      snapshot.tokens,
                      "color",
                      nextNumericTokenName(
                        value2 + input2.name,
                        input2.tokens.map((input3) => input3.name),
                        "color",
                      ),
                    )
                  : value2 + input2.name + "-",
          }));
        if (!value3.some((input2) => input2.key === "")) {
          value3.unshift({
            key: "",
            label: runtime.PALETTE_GROUP_NAME,
            seed: value2,
          });
        }
        let value4 = options
            ? {
                key: runtime.NEW_TOKEN_GROUP_SENTINEL,
                label: "",
                seed: value2,
              }
            : (value3.find((input2) => input2.key === input) ?? value3[0]),
          callback = (input2: string) =>
            view.colorGroups
              .find((input3) => input3.name === input2)
              ?.tokens.at(-1)?.name;
        setTokenDialog({
          req: {
            kind: "color",
            themes: valueThemes,
            taken: new Set(
              (0, runtime.conflictingTokenNames)(snapshot.tokens, "color"),
            ),
            names: new Set(value),
            name: value4.seed,
            value: "#888888",
            groups: value3,
            group: value4.key,
            namespace: value2,
            seedFor: (input2) => value2 + input2 + "-",
            groupOf: (input2) =>
              (0, runtime.tokenHasGroupSuffix)(input2, value2)
                ? (0, runtime.tokenGroupName)(input2, value2)
                : "",
          },
          land: (source) => {
            if (source.kind === "color") {
              addColorToken2(source, callback(source.group));
            }
          },
        });
      },
      TOKEN_DEFAULTS: Record<
        ScalarTokenKind,
        {
          value: string;
          label: string;
        }
      > = {
        spacing: {
          value: "8px",
          label: "spacing value",
        },
        radius: {
          value: "4px",
          label: "corner radius",
        },
        extra: {
          value: "1",
          label: "token",
        },
      },
      commonNumericNameStem = (input: string[]): string => {
        let values = new Set(
            input.map((input2) => /^(.*)-\d{1,4}$/.exec(input2)?.[1] ?? null),
          ),
          [items] = [...values];
        if (values.size === 1 && items !== null && items !== undefined) {
          return items;
        } else {
          return "";
        }
      },
      newTokenNameSeed = (
        input: AddTokenKind,
        options: string,
        items: string[],
        value = "",
      ) => {
        let value2 = options !== "" ? options : commonNumericNameStem(items);
        if (value2 === "") {
          return value;
        }
        if (
          items.length > 0 &&
          items.every((input2) => /-\d{1,4}$/.test(input2))
        ) {
          return (0, runtime.unusedTokenName)(
            snapshot.tokens,
            input,
            nextNumericTokenName(value2, items, value2),
          );
        } else {
          return value2 + "-";
        }
      },
      showAddScaleToken = (source: ScalarScaleGroup) => {
        if (editable === undefined) {
          return;
        }
        let kind = source.kind,
          value = source.family?.key,
          value2 = TOKEN_DEFAULTS[kind],
          value3 =
            (kind === "spacing"
              ? view.spacing
              : kind === "radius"
                ? view.corners
                : view.extras.find((input) => input.key === value)?.scale
            )?.tokens ?? [],
          value4 = (0, runtime.commonTokenNamePrefix)(
            value3.map((input) => input.name),
          ),
          value5 =
            kind === "spacing"
              ? (0, runtime.groupedTokenScale)(kind, value3)
              : null,
          value6 =
            value5 === null
              ? undefined
              : value5.map((input) => ({
                  key: input.name === "" ? "" : value4 + input.name,
                  label: input.name === "" ? "Spacing" : input.name,
                  seed: newTokenNameSeed(
                    kind,
                    input.name === "" ? "" : value4 + input.name,
                    input.tokens.map((input2) => input2.name),
                    value4,
                  ),
                })),
          value7 =
            value6?.find((input) => input.key === source.name) ?? value6?.[0],
          callback = (input: string) =>
            input === ""
              ? value3.filter(
                  (input2) =>
                    !(0, runtime.tokenHasGroupSuffix)(input2.name, value4),
                )
              : value3.filter((input2) => input2.name.startsWith(input + "-"));
        setTokenDialog({
          req: {
            kind: kind,
            label: value !== undefined ? value + " token" : value2.label,
            taken: new Set(
              (0, runtime.conflictingTokenNames)(snapshot.tokens, kind),
            ),
            name:
              value7 !== undefined
                ? value7.seed
                : newTokenNameSeed(
                    kind,
                    source.name,
                    source.tokens.map((input) => input.name),
                    value4,
                  ),
            value:
              source.tokens.at(-1)?.value ??
              value3.at(-1)?.value ??
              value2.value,
            ...(kind === "spacing"
              ? {
                  namespace: value4,
                }
              : {}),
            ...(value6 !== undefined && value7 !== undefined
              ? {
                  groups: value6,
                  group: value7.key,
                  groupOf: (input: string) =>
                    (0, runtime.tokenHasGroupSuffix)(input, value4)
                      ? value4 + (0, runtime.tokenGroupName)(input, value4)
                      : "",
                }
              : {}),
          },
          land: (source2: AddedToken) => {
            if (source2.kind !== kind) {
              return;
            }
            let value8 = (
              (source2.group !== undefined
                ? callback(source2.group).at(-1)
                : undefined) ??
              source.tokens.at(-1) ??
              value3.at(-1)
            )?.name;
            if (
              editable.exec("add " + (value ?? kind), (input) => {
                let value9 = (0, runtime.addScalarToken)(
                  input,
                  kind,
                  source2.name,
                  source2.value,
                  value8,
                  value,
                );
                if (value9 === input || source2.usage === "") {
                  return value9;
                } else {
                  return (0, runtime.setTokenUsage)(
                    value9,
                    kind,
                    source2.name,
                    source2.usage,
                  );
                }
              })
            ) {
              flashToken(source2.name);
            } else {
              (0, runtime.showEditorNotification)(
                "Could not add " + source2.name + ".",
              );
            }
          },
        });
      },
      lastTypeSetRef = runtime.reactArtifactRoot.useRef<string | null>(null),
      showAddTypeStyle = (input?: string) => {
        if (editable === undefined) {
          return;
        }
        let value = view.typeGroups.map((input2) => input2.name),
          value2 =
            input ??
            (lastTypeSetRef.current !== null &&
            value.includes(lastTypeSetRef.current)
              ? lastTypeSetRef.current
              : (value.at(-1) ?? "")),
          value3 = view.typeGroups.find((input2) => input2.name === value2),
          value4 =
            value3?.styles.at(-1) ?? view.typeGroups.at(-1)?.styles.at(-1),
          value5 =
            value4?.familyKey ??
            value3?.family ??
            Object.keys(view.families)[0] ??
            "",
          value6 =
            value4 === undefined
              ? "400"
              : String(
                  typeof value4.fontWeight === "number"
                    ? value4.fontWeight
                    : parseInt(String(value4.fontWeight), 10) || 400,
                );
        setTokenDialog({
          req: {
            kind: "type",
            taken: new Set(
              (0, runtime.conflictingTokenNames)(snapshot.tokens, "type"),
            ),
            name: "",
            families: view.families,
            familyNames: view.familyNames,
            fontNames: [
              ...new Set(
                view.fonts
                  .filter((input2) => input2.asset !== true)
                  .map((input2) => input2.family),
              ),
            ],
            style: {
              family: value5,
              fontSize: value4?.fontSize ?? "16px",
              lineHeight: value4?.lineHeight ?? "1.5",
              fontWeight: value6,
              fontStyle: value4?.fontStyle === "italic" ? "italic" : "normal",
              letterSpacing: value4?.letterSpacing ?? "0",
            },
            sets: value,
            set: value2,
          },
          land: (source) => {
            if (source.kind !== "type") {
              return;
            }
            let value7 = view.typeGroups
                .find((input2) => input2.name === source.set)
                ?.styles.at(-1)?.name,
              value8 = editable.exec(
                source.newSet ? "add type set" : "add type style",
                (input2) => {
                  let value9 = source.newSet
                    ? (0, runtime.addTypographyGroup)(input2, source.set)
                    : input2;
                  if (source.newSet && value9 === input2) {
                    return input2;
                  }
                  let value10 = (0, runtime.addTypographyStyle)(
                    value9,
                    source.name,
                    value7,
                    source.set,
                  );
                  if (value10 === value9) {
                    return input2;
                  }
                  value10 =
                    source.font !== undefined
                      ? (0, runtime.setTypographyFontFamily)(
                          value10,
                          source.name,
                          source.font,
                        )
                      : (0, runtime.setTypographyProperty)(
                          value10,
                          source.name,
                          "family",
                          source.style.family,
                        );
                  value10 = (0, runtime.setTypographyProperty)(
                    value10,
                    source.name,
                    "fontSize",
                    source.style.fontSize,
                  );
                  value10 = (0, runtime.setTypographyProperty)(
                    value10,
                    source.name,
                    "lineHeight",
                    source.style.lineHeight,
                  );
                  value10 = (0, runtime.setTypographyProperty)(
                    value10,
                    source.name,
                    "fontWeight",
                    source.style.fontWeight,
                  );
                  value10 = (0, runtime.setTypographyProperty)(
                    value10,
                    source.name,
                    "fontStyle",
                    source.style.fontStyle,
                  );
                  value10 = (0, runtime.setTypographyProperty)(
                    value10,
                    source.name,
                    "letterSpacing",
                    source.style.letterSpacing,
                  );
                  if (source.usage !== "") {
                    value10 = (0, runtime.setTypographyStyleUsage)(
                      value10,
                      source.name,
                      source.usage,
                    );
                  }
                  return value10;
                },
              );
            if (value8) {
              lastTypeSetRef.current = source.set;
            }
            if (value8 && source.newSet) {
              revealAsset({
                kind: "type",
                key: source.set,
              });
            } else if (value8) {
              flashToken(source.name);
            } else {
              (0, runtime.showEditorNotification)(
                "Could not add " + source.name + ".",
              );
            }
          },
        });
      },
      showAddShadow = () => {
        if (editable === undefined) {
          return;
        }
        let value = view.shadows.tokens.at(-1);
        setTokenDialog({
          req: {
            kind: "shadow",
            themes: valueThemes,
            taken: new Set(
              (0, runtime.conflictingTokenNames)(snapshot.tokens, "shadow"),
            ),
            name: newTokenNameSeed(
              "shadow",
              "",
              view.shadows.tokens.map((input) => input.name),
            ),
            value:
              value?.value[defaultValueThemeId] ??
              "0 1px 2px rgba(0, 0, 0, 0.2)",
          },
          land: (source) => {
            if (source.kind !== "shadow") {
              return;
            }
            if (
              editable.exec("add shadow", (input) => {
                let value2 = (0, runtime.addShadowToken)(
                  input,
                  source.name,
                  source.values[defaultValueThemeId] ?? "",
                );
                if (value2 === input) {
                  return input;
                }
                for (let [value3, value4] of Object.entries(source.values)) {
                  if (value3 !== defaultValueThemeId) {
                    value2 = (0, runtime.setShadowTokenValue)(
                      value2,
                      source.name,
                      value3,
                      value4,
                    );
                  }
                }
                if (source.usage !== "") {
                  value2 = (0, runtime.setTokenUsage)(
                    value2,
                    "shadow",
                    source.name,
                    source.usage,
                  );
                }
                return value2;
              })
            ) {
              flashToken(source.name);
            } else {
              (0, runtime.showEditorNotification)(
                "Could not add " + source.name + ".",
              );
            }
          },
        });
      },
      announceDropLimit = (input: number) =>
        (0, runtime.showEditorNotification)(
          String(input) +
            " files left out — one drop takes up to " +
            String(runtime.MAX_DROPPED_FILES) +
            ". Drop the rest separately.",
        ),
      readDroppedFiles = (
        input: DataTransfer,
        options: (files: File[]) => void,
      ) => {
        (0, runtime.extractDroppedFiles)(input).then(
          ({ files: files, leftOut: leftOut }) => {
            if (leftOut > 0) {
              announceDropLimit(leftOut);
            }
            if (files.length > 0) {
              options(files);
            }
          },
        );
      },
      dropTarget = (0, runtime.useFileDrop)({
        disabled: addFiles === undefined,
        onFiles: (input, options) => {
          if (addFiles !== undefined) {
            readDroppedFiles(
              options.dataTransfer,
              uploadPanelActiveRef.current ? addWelcomeFiles : addFiles,
            );
          }
        },
      }),
      [exportBusy, setExportBusy] = runtime.reactArtifactRoot.useState(false),
      exportSystem = (input: "tokens" | "css" | "readme" | "zip") => {
        let value = system.getSnapshot();
        if (input === "tokens") {
          (0, runtime.saveDownloadFile)(
            "tokens.json",
            value.files[runtime.DESIGN_SYSTEM_PATHS.tokens] ??
              `{}
`,
            "application/json",
          ).then((input2) =>
            (0, runtime.showEditorNotification)(
              artifactDownloadResultMessage("tokens.json", input2),
            ),
          );
          return;
        }
        if (input === "css") {
          (0, runtime.saveDownloadFile)(
            "tokens.css",
            (0, runtime.generateNamedTokensCss)(value.tokens, value.title),
            "text/css",
          ).then((input2) =>
            (0, runtime.showEditorNotification)(
              artifactDownloadResultMessage("tokens.css", input2),
            ),
          );
          return;
        }
        if (input === "readme") {
          (0, runtime.saveDownloadFile)(
            "README.md",
            value.readme,
            "text/markdown",
          ).then((input2) =>
            (0, runtime.showEditorNotification)(
              artifactDownloadResultMessage("README.md", input2),
            ),
          );
          return;
        }
        setExportBusy(true);
        let value2 = (0, runtime.downloadZipBaseName)(value.title) + ".zip";
        (0, runtime.collectDownloadFiles)(
          value.files,
          value.tokens,
          value.title,
          value.storage,
        )
          .then(
            async ({ entries: entries, skipped: skipped }): Promise<void> => {
              let value3 = await (0, runtime.saveDownloadFile)(
                value2,
                (0, runtime.createStoredZip)(entries),
                "application/zip",
              );
              (0, runtime.showEditorNotification)(
                artifactDownloadResultMessage(
                  value2,
                  value3,
                  " — " +
                    String(entries.length) +
                    " files" +
                    (skipped.length > 0
                      ? " (" +
                        String(skipped.length) +
                        " stored elsewhere are listed in manifest.json only)"
                      : ""),
                ),
              );
            },
          )
          .finally(() => setExportBusy(false));
      },
      typeEditWithActions =
        typeEdit === undefined
          ? undefined
          : {
              ...typeEdit,
              add: (input?: string) => showAddTypeStyle(input),
              addSet: () => showAddTypeStyle(runtime.NEW_TOKEN_GROUP_SENTINEL),
              uploadFont: uploadFonts,
            },
      [readmeTouched, setReadmeTouched] =
        runtime.reactArtifactRoot.useState(false),
      readmeTouchedRef = runtime.reactArtifactRoot.useRef(false),
      readmeSizeNoticeRef = runtime.reactArtifactRoot.useRef(false),
      readmeStarterWasShownRef = runtime.reactArtifactRoot.useRef(false),
      readmeEditorKeyRef = runtime.reactArtifactRoot.useRef(0),
      [readmeEditRetry, setReadmeEditRetry] =
        runtime.reactArtifactRoot.useState(0),
      markReadmeTouched = (input: boolean) => {
        readmeTouchedRef.current = input;
        setReadmeTouched(input);
      },
      sectionIsEmptyOrStarter = (input: string) =>
        starter.starter.has(input) || emptySections.has(input),
      starterSectionNote = (input: string): string | undefined =>
        editable !== undefined && sectionIsEmptyOrStarter(input)
          ? runtime.EMPTY_SECTION_HINTS[
              isExtraTokenSection(input) ? "family" : input
            ]
          : undefined,
      sectionHeaderActions = (input: string): React.ReactNode => {
        if (editable === undefined) {
          return;
        }
        if (input === "shadows") {
          return (
            <runtime.SectionAddButton
              label={"Add"}
              what={"Add shadow"}
              onClick={() => showAddShadow()}
              data-testid={"ds-page-add-" + input}
            />
          );
        }
        if (input === "spacing" || input === "corners") {
          let value: ScalarTokenKind =
            input === "spacing" ? "spacing" : "radius";
          return (
            <runtime.SectionAddButton
              label={"Add"}
              what={"Add " + TOKEN_DEFAULTS[value].label}
              onClick={() =>
                showAddScaleToken(
                  (0, runtime.tokenScaleGroups)(
                    value,
                    value === "spacing" ? view.spacing : view.corners,
                  )[0] ?? {
                    kind: value,
                    name: "",
                    tokens: [],
                  },
                )
              }
              data-testid={"ds-page-add-" + input}
            />
          );
        }
        if (input === "assets") {
          if (addFiles === undefined) {
            return undefined;
          } else {
            return (
              <runtime.SectionAddButton
                label={"New set"}
                onClick={showNewAssetGroup}
                data-testid={"ds-page-add-" + input}
              />
            );
          }
        }
        if (isExtraTokenSection(input)) {
          let value = view.extras.find(
              (input2) =>
                (0, runtime.extraTokenFamilySectionId)(input2.key) === input,
            ),
            value2 =
              value === undefined
                ? undefined
                : (0, runtime.extraTokenScaleGroups)([value])[0],
            value3 =
              value === undefined ? undefined : extraScaleEdit(value.key)?.add;
          if (value2 === undefined || value3 === undefined) {
            return undefined;
          } else {
            return (
              <runtime.SectionAddButton
                label={"Add"}
                what={"Add " + value!.title.toLowerCase() + " token"}
                onClick={() => value3(value2)}
                data-testid={"ds-page-add-" + input}
              />
            );
          }
        }
        return;
      },
      extraScaleHead = (input: ScalarScaleGroup) => {
        let value = (0, runtime.tokenScaleGroupId)(input),
          value2 = (0, runtime.tokenScaleGroupLabel)(input);
        return {
          title: sectionTitle(value, value2),
          defaultTitle: value2,
          "data-testid": "ds-card-" + value,
        };
      },
      renderReadme = (): React.ReactElement => {
        let value =
            starter.hint &&
            !readmeTouched &&
            view.readme.trim() === "" &&
            editable !== undefined &&
            !readOnly,
          value2 = value
            ? runtime.README_STARTER_TEXT
            : (0, runtime.removeTokenShortcutComments)(view.readme);
        if (
          readmeStarterWasShownRef.current &&
          !value &&
          !readmeTouchedRef.current
        ) {
          readmeEditorKeyRef.current += 1;
        }
        readmeStarterWasShownRef.current = value;
        return (() => {
          const _Element = runtime.MarkdownEditor;
          const _elementProps = {
            markdown: value2,
            readOnly: readOnly || editable === undefined,
            // CucCut: user-facing copy calls the agent "the agent", not Claude.
            placeholder: "Write the brand book here — or ask the agent to.",
            onMarkdown: (input: string) => {
              let current = readmeTouchedRef.current,
                flag = false,
                flag2 = false;
              readmeTouchedRef.current = true;
              editable?.set("readme", (input2) => {
                if (
                  value &&
                  !current &&
                  (
                    input2.files[runtime.DESIGN_SYSTEM_PATHS.readme] ?? ""
                  ).trim() !== ""
                ) {
                  flag = true;
                  return input2;
                }
                flag2 =
                  input !==
                    (input2.files[runtime.DESIGN_SYSTEM_PATHS.readme] ?? "") &&
                  input !== "" &&
                  !(0, runtime.fileFitsInlineBudgets)(
                    input2,
                    runtime.DESIGN_SYSTEM_PATHS.readme,
                    input,
                  );
                return (0, runtime.setDesignSystemReadme)(input2, input);
              });
              if (flag2 && !readmeSizeNoticeRef.current) {
                (0, runtime.showEditorNotification)(
                  README_SIZE_EXCEEDED_MESSAGE,
                );
              }
              readmeSizeNoticeRef.current = flag2;
              if (flag) {
                readmeTouchedRef.current = current;
                setReadmeEditRetry((input2) => input2 + 1);
              } else {
                markReadmeTouched(true);
              }
            },
            onDone: () => editable?.seal(),
          };
          const _elementKey =
            "readme-" +
            String(readmeEditorKeyRef.current) +
            "-" +
            String(readmeEditRetry);
          return <_Element key={_elementKey} {..._elementProps} />;
        })();
      },
      renderSection = (input: string): React.ReactNode => {
        if (isExtraTokenSection(input)) {
          let value = view.extras.filter(
            (input2) =>
              (0, runtime.extraTokenFamilySectionId)(input2.key) === input,
          );
          return (
            <runtime.TokenScaleSections
              groups={(0, runtime.extraTokenScaleGroups)(value)}
              editFor={(input2: ScalarScaleGroup) =>
                extraScaleEdit(input2.family?.key ?? "")
              }
              headFor={extraScaleHead}
            />
          );
        }
        switch (input) {
          case "spacing":
            return (
              <runtime.TokenScaleSections
                groups={(0, runtime.tokenScaleGroups)("spacing", view.spacing)}
                editFor={() => spacingEdit}
              />
            );
          case "corners":
            return (
              <runtime.TokenScaleSections
                groups={(0, runtime.tokenScaleGroups)("radius", view.corners)}
                editFor={() => radiusEdit}
              />
            );
          case "readme":
            return (
              <jsxDesignSystemApp.Fragment>
                {[
                  <runtime.SectionSheet>
                    {[
                      snapshot.cover !== null ? (
                        <runtime.CoverPreview
                          cover={snapshot.cover}
                          head={(0, runtime.createPreviewHead)(
                            snapshot,
                            hostThemeMode,
                            hostThemeId,
                            false,
                          )}
                        />
                      ) : null,
                      <runtime.ReadmeArticle>
                        {renderReadme()}
                      </runtime.ReadmeArticle>,
                    ]}
                  </runtime.SectionSheet>,
                  showWelcome &&
                  editable !== undefined &&
                  addFiles !== undefined ? (
                    <runtime.WelcomeSheet
                      onGithub={askGithub}
                      onConnect={askConnectors}
                      onUpload={openUploadPanel}
                      busy={handoffBusy}
                      note={handoffNote}
                      panel={
                        uploadPanelOpen ? (
                          <runtime.BrandUploadPanel
                            files={intakeFiles}
                            onFiles={addWelcomeFiles}
                            onLeftOut={announceDropLimit}
                            intake={{
                              busy: intakeBusy,
                              kept: keptIntakeCount,
                              refused: intakeSummary.refused,
                              save:
                                intakeBusy ||
                                saveState.status === "ready" ||
                                saveState.status === "saved"
                                  ? "clean"
                                  : saveState.status === "error"
                                    ? "error"
                                    : saveState.status === "dirty" &&
                                        document2.saveMode() !== "auto"
                                      ? "hold"
                                      : saveState.status === "dirty" ||
                                          saveState.status === "saving" ||
                                          saveState.status === "cached"
                                        ? "saving"
                                        : "clean",
                            }}
                            handing={handoffBusy}
                            onRemove={removeWelcomeFile}
                            thumb={renderUploadThumbnail}
                            onCreate={() => createFromWelcomeFiles(intakeFiles)}
                            onBack={
                              intakeFiles.length === 0
                                ? backFromUpload
                                : undefined
                            }
                          />
                        ) : undefined
                      }
                    />
                  ) : null,
                  <runtime.DocumentSections
                    docs={view.docs}
                    edit={
                      editable === undefined
                        ? undefined
                        : {
                            setText: (input2: string, options: string): void =>
                              void editable.set("doc:" + input2, (input3) =>
                                (0, runtime.setAdditionalDocument)(
                                  input3,
                                  input2,
                                  options,
                                ),
                              ),
                            done: () => editable.seal(),
                          }
                    }
                    headFor={(input2: ApplicationView["docs"][number]) => ({
                      title: input2.title,
                      defaultTitle: input2.title,
                      placeholder: "e.g. Voice and tone",
                      "data-testid": "ds-card-guidance-" + input2.path,
                      onRename:
                        editable === undefined
                          ? undefined
                          : (input3: string) => {
                              let value = input3.replace(/\s+/g, " ").trim();
                              if (value === "" || value === input2.title) {
                                return;
                              }
                              if (
                                (0, runtime.firstMarkdownTitle)(
                                  input2.markdown,
                                ) !== null
                              ) {
                                editable.exec(
                                  "rename " + input2.path,
                                  (input4) =>
                                    (0, runtime.setAdditionalDocument)(
                                      input4,
                                      input2.path,
                                      (0, runtime.replaceMarkdownTitle)(
                                        input2.markdown,
                                        value,
                                      ),
                                    ),
                                );
                                return;
                              }
                              let value2 =
                                  /\.[^.]+$/.exec(
                                    (0, runtime.pathBasename)(input2.path),
                                  )?.[0] ?? ".md",
                                value3 = (0, runtime.sanitizeUploadFileName)(
                                  value,
                                ).replace(/\.(md|mdx)$/i, "");
                              if (value3 === "") {
                                return;
                              }
                              let value4 =
                                ((0, runtime.pathDirname)(input2.path) === ""
                                  ? ""
                                  : (0, runtime.pathDirname)(input2.path) +
                                    "/") +
                                value3 +
                                value2;
                              if (value4 === input2.path) {
                                return;
                              }
                              if (Object.hasOwn(snapshot.files, value4)) {
                                (0, runtime.showEditorNotification)(
                                  "There is already a " + value4,
                                );
                                return;
                              }
                              if (
                                !editable.exec(
                                  "rename " + input2.path,
                                  (input4) =>
                                    (0, runtime.renameDesignSystemFile)(
                                      input4,
                                      input2.path,
                                      value4,
                                    ),
                                )
                              ) {
                                (0, runtime.showEditorNotification)(
                                  "Can’t rename it to " +
                                    value4 +
                                    " — that name isn’t one a file here can take",
                                );
                                return;
                              }
                              return (0, runtime.humanizeDocumentFilename)(
                                value4,
                              );
                            },
                      onRemove:
                        editable === undefined
                          ? undefined
                          : () => {
                              if (
                                editable.exec(
                                  "remove " + input2.path,
                                  (input3) =>
                                    (0, runtime.deleteDesignSystemFiles)(
                                      input3,
                                      [input2.path],
                                    ),
                                )
                              ) {
                                announceUndoableChange(
                                  "Deleted " + input2.title,
                                );
                              }
                            },
                    })}
                  />,
                ]}
              </jsxDesignSystemApp.Fragment>
            );
          case "colors":
            return (
              <runtime.ColorsSection
                themes={themes}
                groups={view.colorGroups}
                names={colorTokenNames}
                edit={colorEdit}
                askClaude={askClaude}
                busy={handoffBusy}
              />
            );
          case "type":
            return (
              <runtime.TypographySection
                groups={view.typeGroups}
                families={view.families}
                familyNames={view.familyNames}
                fonts={view.fonts}
                onRemoveFont={removeFont}
                edit={typeEditWithActions}
                headFor={(input2: EditorTypeGroup) => ({
                  title: input2.name,
                  defaultTitle: input2.name,
                  "data-testid": "ds-card-type-" + input2.name,
                  onRename:
                    editable === undefined
                      ? undefined
                      : (input3: string) => {
                          if (
                            input3 !== "" &&
                            !editable.exec("rename " + input2.name, (input4) =>
                              (0, runtime.renameTypographyGroup)(
                                input4,
                                input2.name,
                                input3,
                              ),
                            )
                          ) {
                            (0, runtime.showEditorNotification)(
                              "There is already a set called " + input3,
                            );
                          }
                        },
                  onRemove:
                    editable === undefined
                      ? undefined
                      : () =>
                          setConfirmation({
                            title:
                              "Delete " +
                              input2.name +
                              (input2.styles.length > 0
                                ? " and its " +
                                  String(input2.styles.length) +
                                  (input2.styles.length === 1
                                    ? " style?"
                                    : " styles?")
                                : "?"),
                            confirmLabel: "Delete",
                            body: "The set and every style in it leave tokens.json. Undo brings the set back.",
                            run: () => {
                              if (
                                !viewRef.current.typeGroups.some(
                                  (input3) => input3.name === input2.name,
                                )
                              ) {
                                (0, runtime.showEditorNotification)(
                                  input2.name +
                                    " changed meanwhile. Nothing was deleted.",
                                );
                              } else if (
                                editable.exec(
                                  "remove " + input2.name,
                                  (input3) =>
                                    (0, runtime.deleteTypographyGroup)(
                                      input3,
                                      input2.name,
                                    ),
                                )
                              ) {
                                announceUndoableChange(
                                  "Deleted " + input2.name,
                                );
                              }
                              requestAnimationFrame(() =>
                                focusTestId("ds-add-type-set"),
                              );
                            },
                          }),
                })}
              />
            );
          case "shadows":
            return (
              <runtime.ShadowsSection
                shadows={view.shadows}
                themes={valueThemes}
                grounds={themeGrounds}
                previewThemeId={hostThemeId}
                edit={
                  shadowEdit === undefined
                    ? undefined
                    : {
                        ...shadowEdit,
                        add: showAddShadow,
                      }
                }
                head={sectionHead("shadow", "Shadows")}
              />
            );
          case "components": {
            let value = (0, runtime.createPreviewHead)(
              snapshot,
              stageMode,
              previewThemeId,
              true,
              previewGround,
            );
            return (
              <runtime.ComponentsSection
                components={view.components}
                mode={stageMode}
                renderPreview={(
                  input2: EditorComponent,
                  options: {
                    height: number;
                  },
                  context: import("../../contracts/preview").PreviewMode,
                  value2?: import("../../contracts/editor-runtime").ComponentPropValues,
                ) =>
                  (0, runtime.renderComponentPreview)(
                    input2,
                    options,
                    (0, runtime.createPreviewHead)(
                      snapshot,
                      context,
                      previewThemeId,
                      true,
                      previewGround,
                    ),
                    value2 === undefined
                      ? undefined
                      : {
                          ...componentStage,
                          values: value2,
                        },
                  )
                }
                propsOf={componentProps}
                edit={componentEdit}
                head={sectionHead("components", "Components")}
                staticNote={value.staticReason}
                staticFiles={value.staticMissing}
              />
            );
          }
          case "assets":
            return (
              <runtime.AssetGroupsList
                groups={view.assetGroups}
                tiles={assetManager.tiles}
                reveal={assetSearchReveal}
                renderThumb={renderAssetThumbnail}
                onOpen={(input2: EditorAsset) => setOpenAssetPath(input2.path)}
                onUpload={
                  addFiles === undefined
                    ? undefined
                    : (input2: EditorAssetGroup) =>
                        void (0, runtime.pickUploadFiles)().then((input3) =>
                          addFiles(input3, input2.name),
                        )
                }
                onDropFiles={
                  addFiles === undefined
                    ? undefined
                    : (input2: EditorAssetGroup, options: React.DragEvent) =>
                        readDroppedFiles(options.dataTransfer, (input3) =>
                          addFiles(input3, input2.name),
                        )
                }
                onRename={
                  editable === undefined
                    ? undefined
                    : (input2: EditorAsset, options: string) => {
                        let value =
                            /\.[A-Za-z0-9]{1,8}$/.exec(input2.name)?.[0] ?? "",
                          value2 =
                            /\.(png|jpe?g|gif|webp|avif|svg|pdf|md|mdx|txt|json|woff2?|ttf|otf)$/i,
                          value3 =
                            value !== "" &&
                            !options.toLowerCase().endsWith(value.toLowerCase())
                              ? options.replace(value2, "") + value
                              : options,
                          callback = (
                            input3: import("../../contracts").DesignSystemContent,
                          ) =>
                            (0, runtime.renameAssetFile)(
                              input3,
                              input2.path,
                              value3,
                            );
                        return (0, runtime.performDesignSystemEdit)(
                          editable,
                          callback,
                          () =>
                            editable.exec("rename " + input2.name, callback),
                          {
                            nameOf: () => input2.name,
                          },
                        );
                      }
                }
                headFor={(input2: EditorAssetGroup) => {
                  let value = "assets:" + input2.name,
                    value2 = (0, runtime.assetGroupDisplayName)(input2.name);
                  return {
                    title: sectionTitle(value, value2),
                    defaultTitle: value2,
                    "data-testid": "ds-card-" + value,
                    ...assetManager.headFor(input2),
                  };
                }}
                footer={
                  storageUsageText !== "" ? (
                    <span
                      className={"text-caption text-muted"}
                      data-testid={"ds-storage-used"}
                    >
                      {[
                        storageUsageText,
                        freeSpaceText !== "" ? (
                          <jsxDesignSystemApp.Fragment>
                            {[
                              " ",
                              <runtime.TextLink
                                onClick={askFreeStorage}
                                data-testid={"ds-free-space"}
                              >
                                {freeSpaceText}
                              </runtime.TextLink>,
                            ]}
                          </jsxDesignSystemApp.Fragment>
                        ) : null,
                        freeingStorage ? " Freeing…" : null,
                      ]}
                    </span>
                  ) : undefined
                }
              />
            );
        }
      },
      navigationRef = (
        runtime.reactArtifactRoot as typeof React
      ).useRef<HTMLElement | null>(null),
      focusRegions = (0, runtime.useFocusRegions)([
        {
          el: () => navigationRef.current,
          fallback: () =>
            navigationRef.current?.querySelector<HTMLElement>(
              '[aria-current="location"]',
            ) ?? null,
        },
        {
          el: () => sectionRefs.current[currentSectionRef.current] ?? null,
          home: true,
          landOnSelf: true,
        },
        (0, runtime.notificationsFocusRegion)(),
      ]),
      navigateAndHint = (input: string) => {
        if (!isDesignSystemSection(input)) {
          return;
        }
        jumpToSection(input);
        let value = sections.find((input2) => input2.id === input)?.label;
        if (
          value !== undefined &&
          navigationRef.current !== null &&
          navigationRef.current.contains(document.activeElement)
        ) {
          focusRegions.hint(value);
        }
      },
      searchIndex: SearchEntry[] = runtime.reactArtifactRoot.useMemo(
        () =>
          (0, runtime.buildSectionSearchIndex)(
            view,
            sections,
            snapshot.sectionTitles,
          ),
        [view, sections, snapshot.sectionTitles],
      ),
      filesBrowser = (0, runtime.useDesignSystemFilesBrowser)({
        doc: document2,
        snap: snapshot,
        sections: sections,
        jump: navigateAndHint,
        mayEdit: !readOnly,
      }),
      navigateOrOpenFiles = (input: string) =>
        input === runtime.FILES_SECTION_ID
          ? filesBrowser.show()
          : filesBrowser.leave(() => navigateAndHint(input)),
      [assetSearchReveal, setAssetSearchReveal] =
        runtime.reactArtifactRoot.useState<string | null>(null),
      navigationSearch: NavigationSearch | undefined = emptySystem
        ? undefined
        : {
            index: searchIndex,
            tail: filesBrowser.searchEntries,
            onPick: (event: SearchEntry) => {
              if (
                event.section === runtime.FILES_SECTION_ID &&
                event.target !== undefined
              ) {
                return filesBrowser.show(event.target);
              }
              filesBrowser.close(false);
              if (
                event.target === undefined ||
                !isDesignSystemSection(event.section)
              ) {
                return;
              }
              sectionScroller.mark(event.section);
              assetManager.tiles.focus(null);
              setAssetSearchReveal(event.asset ?? null);
              textReveal.reveal({
                section: event.section,
                target: event.target,
                label: event.label,
              });
            },
          },
      showNavigation = !(emptySystem && editable === undefined),
      hasAutoSave = "loadState" in document2 || document2.saveMode() === "auto",
      [saveState, setSaveState] =
        runtime.reactArtifactRoot.useState<ApplicationSaveState>(() =>
          document2.saveState(),
        );
    runtime.reactArtifactRoot.useEffect(() => {
      let value = document2.subscribeSave(setSaveState);
      setSaveState(document2.saveState());
      return value;
    }, [document2]);
    // CucCut: jump back to an annotation (docs/design/canvas §10.6). The host's annotation layer (packages/design-system/src/editor/comment-targets.ts)
    // dispatches `cuccut:reveal-comment-target`; this takes the same path as selecting an entry in search. If the target is in the index, go by it (expanding that asset separately); if not, wait for it to appear in the given section.
    let commentRevealRef = runtime.reactArtifactRoot.useRef({
      index: searchIndex,
      pick: navigationSearch?.onPick,
    });
    commentRevealRef.current = { index: searchIndex, pick: navigationSearch?.onPick };
    runtime.reactArtifactRoot.useEffect(() => {
      let callback = (event: Event): void => {
        let detail = (event as CustomEvent<unknown>).detail as {
            target?: unknown;
            section?: unknown;
            label?: unknown;
          } | null,
          { index, pick } = commentRevealRef.current;
        if (pick === undefined || typeof detail?.target !== "string") {
          return;
        }
        let target = detail.target,
          entry: SearchEntry | undefined =
            index.find((input) => input.target === target) ??
            (typeof detail.section === "string"
              ? {
                  section: detail.section,
                  label: typeof detail.label === "string" ? detail.label : target,
                  words: [],
                  target: target,
                }
              : undefined);
        if (entry !== undefined) {
          pick(entry);
        }
      };
      window.addEventListener("cuccut:reveal-comment-target", callback);
      return () =>
        window.removeEventListener("cuccut:reveal-comment-target", callback);
    }, []);
    let loaded = runtime.reactArtifactRoot.useSyncExternalStore(
        runtime.subscribeStoredSystemStatus,
        runtime.getStoredSystemStatus,
        runtime.getStoredSystemStatus,
      ).loaded,
      canEdit = editable !== undefined,
      liveUrls = (0, runtime.supportsLivePreviewUrls)(),
      previewsRunnable =
        (0, runtime.previewStaticStatus)(snapshot).staticReason === "";
    useBootWarnings(
      runtime.reactArtifactRoot.useMemo(
        () =>
          loaded && saveState.status !== "loading"
            ? {
                editingOff:
                  saveState.message === runtime.MIGRATED_READONLY_MESSAGE,
                editable: canEdit,
                content: liveUrls
                  ? {
                      hasFiles: !emptySystem,
                      colorsEmpty: emptySections.has("colors"),
                      components: view.components,
                      previewsCantRun: !previewsRunnable,
                    }
                  : null,
              }
            : null,
        [
          loaded,
          saveState,
          canEdit,
          liveUrls,
          emptySystem,
          emptySections,
          view.components,
          previewsRunnable,
        ],
      ),
    );
    let themeDisabledReason = (0, runtime.previewThemeDisabledReason)(
        themes.length,
        view.components,
        previewsRunnable,
      ),
      themeMenu = (
        <runtime.PreviewThemeMenu
          themes={themes}
          value={previewThemeId ?? ""}
          onChange={setSelectedThemeId}
          disabledWhy={themeDisabledReason}
        />
      ),
      toolbarIsShown = runtime.reactArtifactRoot.useSyncExternalStore(
        runtime.subscribeHostSaveChrome,
        runtime.hostDrawsReadOnly,
        () => false,
      ),
      showReadonlyChip =
        saveState.status === "readonly" &&
        saveState.message !== runtime.MIGRATED_READONLY_MESSAGE &&
        !toolbarIsShown,
      saveControls = (
        <jsxDesignSystemApp.Fragment>
          {[
            hasAutoSave && editable !== undefined ? (
              <runtime.SaveStatusControl
                state={saveState}
                onRetry={() => {
                  (0, runtime.flushMarkdownCommitQueues)();
                  document2.save();
                }}
                tipSide={"top"}
              />
            ) : null,
            showReadonlyChip ? (
              <runtime.TooltipWrapper tip={saveState.message ?? "Read-only"}>
                <runtime.Badge
                  icon={"Lock"}
                  size={"sm"}
                  role={"status"}
                  data-testid={"ds-readonly-chip"}
                >
                  {"Read-only"}
                </runtime.Badge>
              </runtime.TooltipWrapper>
            ) : null,
            !hasAutoSave &&
            editable !== undefined &&
            document2.saveMode() === "manual" ? (
              <runtime.TooltipWrapper
                tip={
                  saveState.status === "error"
                    ? (saveState.message ?? "Couldn’t save — try again")
                    : saveState.status === "dirty"
                      ? "Save changes"
                      : "All changes saved"
                }
              >
                <runtime.Button
                  variant={
                    saveState.status === "dirty" || saveState.status === "error"
                      ? "primary"
                      : "secondary"
                  }
                  size={"sm"}
                  disabled={
                    saveState.status !== "dirty" && saveState.status !== "error"
                  }
                  onClick={() => {
                    (0, runtime.flushMarkdownCommitQueues)();
                    document2.save();
                  }}
                  data-testid={"ds-save"}
                >
                  {saveState.status === "saving" ? "Saving…" : "Save"}
                </runtime.Button>
              </runtime.TooltipWrapper>
            ) : null,
          ]}
        </jsxDesignSystemApp.Fragment>
      ),
      showSaveControls =
        (hasAutoSave && editable !== undefined) ||
        showReadonlyChip ||
        (!hasAutoSave &&
          editable !== undefined &&
          document2.saveMode() === "manual"),
      navigationFooter = showSaveControls ? saveControls : undefined,
      pendingSections =
        editingOff &&
        handoffAvailable &&
        saveState.message === runtime.MIGRATED_READONLY_MESSAGE
          ? {
              rows: PENDING_DESIGN_SYSTEM_SECTIONS,
              tip: runtime.MIGRATION_EMPTY_PAGE_TITLE,
              panel: (input: SectionRow, options: () => void) => (
                <runtime.ClaudeRequestButton
                  label={input.label}
                  ask={askClaude}
                  busy={handoffBusy}
                  onAsked={options}
                />
              ),
            }
          : undefined,
      tokenDialogActions = {
        addColor: () => showAddColor(),
        addStyle: () => showAddTypeStyle(),
        addShadow: () => showAddShadow(),
        uploadFont: () => uploadFonts?.(),
        uploadAsset: () => uploadAssets?.(),
      },
      [assetGroupDialogOpen, setAssetGroupDialogOpen] =
        runtime.reactArtifactRoot.useState(false),
      showNewAssetGroup = () => {
        if (addFiles !== undefined) {
          setAssetGroupDialogOpen(true);
        }
      },
      assetGroupDialog =
        assetGroupDialogOpen && addFiles !== undefined ? (
          <runtime.NewAssetGroupDialog
            groups={view.assetGroups.map((input) => input.name)}
            onClose={() => setAssetGroupDialogOpen(false)}
            onLeftOut={announceDropLimit}
            onCreate={(input: string, options: File[]) => {
              if (!addFiles(options, input)) {
                return false;
              }
              setAssetGroupDialogOpen(false);
              revealAsset({
                kind: "assets",
                key: input,
              });
              return true;
            }}
          />
        ) : null;
    return (
      <runtime.ArtifactShell
        doc={document2}
        undo={editor.undo}
        undoShortcuts={!filesBrowser.open}
        hideToolbar={true}
        toolbarQuietReadOnlyReason={runtime.MIGRATED_READONLY_MESSAGE}
        leading={
          showNavigation && wideLayout ? (
            <runtime.SidebarSectionNavigation
              sections={sections}
              tail={filesBrowser.row && [filesBrowser.row]}
              current={
                filesBrowser.open ? runtime.FILES_SECTION_ID : currentSection
              }
              onJump={navigateOrOpenFiles}
              dropProps={dropTarget.targetProps}
              footer={navigationFooter}
              navRef={navigationRef}
              marks={flaggedSections}
              search={navigationSearch}
              pending={pendingSections}
            />
          ) : (
            <jsxDesignSystemApp.Fragment />
          )
        }
      >
        <runtime.CdsRoot density={"compact"} className={"contents"}>
          {[
            <div
              className={"relative h-full min-h-0"}
              data-testid={"ds-drop-target"}
              {...dropTarget.targetProps}
            >
              {[
                <div
                  className={
                    "ds-main relative flex h-full min-h-0 flex-col gap-lg overflow-x-hidden overflow-y-auto scroll-smooth bg-bg-warm px-lg text-body text-primary motion-reduce:scroll-auto pointer-coarse:[--prop-row-h:40px] data-[covered]:invisible [&>:first-child]:mt-lg"
                  }
                  {...filesBrowser.covered}
                  data-mode={hostMode}
                  data-layout={wideLayout ? "sidebar" : "page"}
                  data-file-drag={dropTarget.over ? "" : undefined}
                  data-testid={"ds-main"}
                  ref={attachScroller}
                >
                  {[
                    showNavigation && !wideLayout ? (
                      <runtime.FloatingSectionNavigation
                        pending={pendingSections}
                        navRef={navigationRef}
                        edgeRef={floatingNavigationRef}
                        port={sectionScroller.port}
                        sections={sections}
                        tail={filesBrowser.row && [filesBrowser.row]}
                        current={
                          filesBrowser.open
                            ? runtime.FILES_SECTION_ID
                            : currentSection
                        }
                        onJump={navigateOrOpenFiles}
                        status={showSaveControls ? saveControls : undefined}
                        marks={flaggedSections}
                        search={navigationSearch}
                      />
                    ) : null,
                    saveState.status === "readonly" &&
                    saveState.message !== undefined &&
                    runtime.BOOT_LIVE_NOTICE_MESSAGES.has(saveState.message) ? (
                      <div {...runtime.UNCOMMENTABLE_PROPS}>
                        <runtime.Callout
                          variant={"neutral"}
                          role={"status"}
                          data-testid={"ds-move-status"}
                        >
                          {saveState.message}
                        </runtime.Callout>
                      </div>
                    ) : null,
                    <runtime.SaveConflictBanners doc={document2} />,
                    <runtime.MigrationCleanupBanner
                      ask={
                        editable === undefined &&
                        saveState.message !== runtime.MIGRATED_READONLY_MESSAGE
                          ? undefined
                          : askClaude
                      }
                      busy={handoffBusy}
                    />,
                    lastChange !== null &&
                    (0, runtime.isCiLastChange)(lastChange) &&
                    !readOnly
                      ? (() => {
                          const _Element2 = runtime.PipelineChangeBanner;
                          const _elementProps2 = {
                            change: lastChange,
                          };
                          const _elementKey2 = lastChange.at;
                          return (
                            <_Element2 key={_elementKey2} {..._elementProps2} />
                          );
                        })()
                      : null,
                    <runtime.MigrationLeftOutBanner />,
                    <runtime.IndexRecoveryBanner />,
                    !showWelcome && handoffNote !== null ? (
                      <runtime.SectionUsageNote
                        note={handoffNote}
                        edgeRef={handoffNoticeRef}
                      />
                    ) : null,
                    emptySystem && editable === undefined ? (
                      <runtime.EmptyDesignSystem />
                    ) : (
                      sections.map((input, options) =>
                        (() => {
                          const _Element3 = "section";
                          const _elementProps3 = {
                            ref: (input2: HTMLElement | null) => {
                              sectionRefs.current[input.id] = input2;
                            },
                            tabIndex: -1,
                            className:
                              "ds-section flex flex-col gap-lg focus:outline-none",
                            "aria-label": input.label,
                            "data-current":
                              input.id === currentSection ? "" : undefined,
                            "data-testid": "ds-section-" + input.id,
                            children: (
                              <runtime.LazySection
                                root={sectionScroller.port}
                                eager={
                                  options < 2 ||
                                  sectionScroller.wanted.has(input.id)
                                }
                                standIn={
                                  <runtime.SectionSheet>
                                    <runtime.SectionHeader
                                      title={input.label}
                                    />
                                  </runtime.SectionSheet>
                                }
                              >
                                {() =>
                                  input.id === "colors" ? (
                                    <runtime.SectionSheet>
                                      {[
                                        <runtime.ColorsSectionHeader
                                          edit={colorEdit}
                                          note={starterSectionNote("colors")}
                                        />,
                                        sectionIsEmptyOrStarter("colors") ? (
                                          <runtime.EmptySectionHint
                                            kind={"colors"}
                                            readOnly={editable === undefined}
                                          />
                                        ) : (
                                          renderSection("colors")
                                        ),
                                      ]}
                                    </runtime.SectionSheet>
                                  ) : input.id === "type" ? (
                                    <runtime.SectionSheet>
                                      {[
                                        <runtime.TypographySectionHeader
                                          edit={typeEditWithActions}
                                          note={starterSectionNote("type")}
                                        />,
                                        sectionIsEmptyOrStarter("type") ? (
                                          <runtime.EmptySectionHint
                                            kind={"type"}
                                            readOnly={editable === undefined}
                                          />
                                        ) : (
                                          renderSection("type")
                                        ),
                                      ]}
                                    </runtime.SectionSheet>
                                  ) : input.id === "readme" ? (
                                    editable === undefined &&
                                    view.readme.trim() === "" &&
                                    view.docs.length === 0 ? (
                                      <runtime.SectionSheet>
                                        {[
                                          <runtime.SectionHeader
                                            title={input.label}
                                            pageId={input.id}
                                          />,
                                          <runtime.EmptyEditorList
                                            text={"Nothing here yet."}
                                          />,
                                        ]}
                                      </runtime.SectionSheet>
                                    ) : (
                                      renderSection("readme")
                                    )
                                  ) : (
                                    <runtime.SectionSheet>
                                      {[
                                        <runtime.SectionHeader
                                          title={input.label}
                                          pageId={input.id}
                                          data-testid={
                                            "ds-page-head-" + input.id
                                          }
                                          actions={
                                            input.id === "components"
                                              ? themeMenu
                                              : sectionHeaderActions(input.id)
                                          }
                                          note={starterSectionNote(input.id)}
                                        />,
                                        sectionIsEmptyOrStarter(input.id) ? (
                                          <runtime.EmptySectionHint
                                            kind={
                                              isExtraTokenSection(input.id)
                                                ? "family"
                                                : input.id as import("../../contracts/token-editors").EmptySectionKind
                                            }
                                            readOnly={editable === undefined}
                                          />
                                        ) : isDesignSystemSection(input.id) ? (
                                          renderSection(input.id)
                                        ) : null,
                                      ]}
                                    </runtime.SectionSheet>
                                  )
                                }
                              </runtime.LazySection>
                            ),
                          };
                          const _elementKey3 = input.id;
                          return (
                            <_Element3 key={_elementKey3} {..._elementProps3} />
                          );
                        })(),
                      )
                    ),
                    intakeProgress !== null ? (
                      <runtime.IntakeProgressStatus
                        text={intakeProgress}
                        quiet={dropTarget.over}
                      />
                    ) : null,
                    emptySystem ? null : (
                      <footer
                        className={"ds-page-footer px-xs"}
                        data-testid={"ds-page-footer"}
                        {...runtime.UNCOMMENTABLE_PROPS}
                      >
                        <runtime.PipelineChangeSummary change={lastChange} />
                      </footer>
                    ),
                    openAsset !== null
                      ? (() => {
                          const _Element4 = runtime.AssetDetailsDialog;
                          const _elementProps4 = {
                            asset: openAsset,
                            files: snapshot.files,
                            storage: snapshot.storage,
                            focusName: assetManager.renaming === openAsset.path,
                            onClose: () => {
                              setOpenAssetPath(null);
                              assetManager.clearRenaming();
                            },
                            onDownload: () => downloadAsset(openAsset),
                            onRemove:
                              editable === undefined
                                ? undefined
                                : () => {
                                    setOpenAssetPath(null);
                                    assetManager.clearRenaming();
                                    assetManager.remove([openAsset.path]);
                                  },
                            onRename:
                              editable === undefined
                                ? undefined
                                : (input: string) => {
                                    let value = openAsset,
                                      callback = (
                                        input2: import("../../contracts").DesignSystemContent,
                                      ) =>
                                        (0, runtime.renameAssetFile)(
                                          input2,
                                          value.path,
                                          input,
                                        );
                                    return (0, runtime.performDesignSystemEdit)(
                                      editable,
                                      callback,
                                      () => {
                                        if (
                                          !editable.exec(
                                            "rename " + value.name,
                                            callback,
                                          )
                                        ) {
                                          return false;
                                        }
                                        setOpenAssetPath((input2) =>
                                          input2 === value.path
                                            ? ((0, runtime.pathDirname)(
                                                value.path,
                                              ) === ""
                                                ? ""
                                                : (0, runtime.pathDirname)(
                                                    value.path,
                                                  ) + "/") +
                                              (0,
                                              runtime.sanitizeUploadFileName)(
                                                input,
                                              )
                                            : input2,
                                        );
                                        return true;
                                      },
                                      {
                                        nameOf: () => value.name,
                                      },
                                    );
                                  },
                          };
                          const _elementKey4 = openAsset.path;
                          return (
                            <_Element4 key={_elementKey4} {..._elementProps4} />
                          );
                        })()
                      : null,
                    assetManager.overlay,
                    assetGroupDialog,
                    tokenDialog !== null ? (
                      <runtime.AddTokenDialog
                        req={tokenDialog.req}
                        onClose={() => setTokenDialog(null)}
                        onSubmit={(input: AddedToken) => {
                          let land = tokenDialog.land;
                          setTokenDialog(null);
                          land(input);
                        }}
                      />
                    ) : null,
                    confirmation !== null ? (
                      <runtime.ConfirmRemoveDialog
                        title={confirmation.title}
                        confirmLabel={confirmation.confirmLabel}
                        onCancel={() => setConfirmation(null)}
                        onConfirm={() => {
                          let run = confirmation.run;
                          setConfirmation(null);
                          run();
                        }}
                      >
                        {confirmation.body}
                      </runtime.ConfirmRemoveDialog>
                    ) : null,
                  ]}
                </div>,
                filesBrowser.layer,
                <runtime.FileDropOverlay
                  show={dropTarget.over}
                  label={"Drop to add to this design system"}
                  hint={"Fonts, logos, images, reference files — folders too"}
                />,
              ]}
            </div>,
            <runtime.LiveAnnouncer />,
          ]}
        </runtime.CdsRoot>
      </runtime.ArtifactShell>
    );
  }
  bindRuntimeValue(
    runtime,
    "reactBootWarnings",
    () => reactBootWarnings,
    (value) => {
      reactBootWarnings = value;
    },
  );
  bindRuntimeValue(runtime, "useBootWarnings", () => useBootWarnings);
  bindRuntimeValue(
    runtime,
    "jsxDesignSystemApp",
    () => jsxDesignSystemApp,
    (value) => {
      jsxDesignSystemApp = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CORE_DESIGN_SYSTEM_SECTIONS",
    () => CORE_DESIGN_SYSTEM_SECTIONS,
    (value) => {
      CORE_DESIGN_SYSTEM_SECTIONS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CONTENT_DESIGN_SYSTEM_SECTIONS",
    () => CONTENT_DESIGN_SYSTEM_SECTIONS,
    (value) => {
      CONTENT_DESIGN_SYSTEM_SECTIONS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BUILTIN_DESIGN_SYSTEM_SECTION_IDS",
    () => BUILTIN_DESIGN_SYSTEM_SECTION_IDS,
    (value) => {
      BUILTIN_DESIGN_SYSTEM_SECTION_IDS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isExtraTokenSection",
    () => isExtraTokenSection,
    (value) => {
      isExtraTokenSection = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isDesignSystemSection",
    () => isDesignSystemSection,
    (value) => {
      isDesignSystemSection = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initialDesignSystemSection",
    () => initialDesignSystemSection,
    (value) => {
      initialDesignSystemSection = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PENDING_DESIGN_SYSTEM_SECTIONS",
    () => PENDING_DESIGN_SYSTEM_SECTIONS,
    (value) => {
      PENDING_DESIGN_SYSTEM_SECTIONS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "designSystemSections",
    () => designSystemSections,
    (value) => {
      designSystemSections = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "useGoogleFontStylesheets",
    () => useGoogleFontStylesheets,
  );
  bindRuntimeValue(
    runtime,
    "REVEAL_SECTION_BY_KIND",
    () => REVEAL_SECTION_BY_KIND,
    (value) => {
      REVEAL_SECTION_BY_KIND = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CLAUDE_COMMENT_SENT_MESSAGE",
    () => CLAUDE_COMMENT_SENT_MESSAGE,
    (value) => {
      CLAUDE_COMMENT_SENT_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "README_SIZE_EXCEEDED_MESSAGE",
    () => README_SIZE_EXCEEDED_MESSAGE,
    (value) => {
      README_SIZE_EXCEEDED_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BACKGROUND_COLOR_TOKEN_PATTERNS",
    () => BACKGROUND_COLOR_TOKEN_PATTERNS,
    (value) => {
      BACKGROUND_COLOR_TOKEN_PATTERNS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SURFACE_COLOR_TOKEN_PATTERNS",
    () => SURFACE_COLOR_TOKEN_PATTERNS,
    (value) => {
      SURFACE_COLOR_TOKEN_PATTERNS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "previewThemeGroundColors",
    () => previewThemeGroundColors,
  );
  bindRuntimeValue(
    runtime,
    "artifactDownloadResultMessage",
    () => artifactDownloadResultMessage,
  );
  bindRuntimeValue(runtime, "DesignSystemApp", () => DesignSystemApp);
  return () => {
    reactBootWarnings = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxDesignSystemApp = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    CORE_DESIGN_SYSTEM_SECTIONS = [
      {
        id: "readme",
        label: "Overview",
      },
      {
        id: "colors",
        label: "Colors",
      },
      {
        id: "type",
        label: "Typography",
      },
      {
        id: "spacing",
        label: "Spacing",
      },
      {
        id: "corners",
        label: "Corner radius",
      },
      {
        id: "shadows",
        label: "Shadows",
      },
    ];
    CONTENT_DESIGN_SYSTEM_SECTIONS = [
      {
        id: "components",
        label: "Components",
      },
      {
        id: "assets",
        label: "Assets",
      },
    ];
    BUILTIN_DESIGN_SYSTEM_SECTION_IDS = [
      ...CORE_DESIGN_SYSTEM_SECTIONS,
      ...CONTENT_DESIGN_SYSTEM_SECTIONS,
    ].map((input) => input.id);
    isExtraTokenSection = (items) =>
      items.startsWith("family-") && items.length > 7;
    isDesignSystemSection = (input) =>
      BUILTIN_DESIGN_SYSTEM_SECTION_IDS.includes(input) ||
      isExtraTokenSection(input);
    initialDesignSystemSection = () =>
      (0, runtime.initialSectionFromHash)(isDesignSystemSection, "readme");
    PENDING_DESIGN_SYSTEM_SECTIONS = [
      ...CORE_DESIGN_SYSTEM_SECTIONS,
      ...CONTENT_DESIGN_SYSTEM_SECTIONS,
    ].filter((input) => input.id !== "readme");
    designSystemSections = (input) => [
      ...CORE_DESIGN_SYSTEM_SECTIONS,
      ...input.map((input2) => ({
        id: (0, runtime.extraTokenFamilySectionId)(input2.key),
        label: input2.title,
      })),
      ...CONTENT_DESIGN_SYSTEM_SECTIONS,
    ];
    REVEAL_SECTION_BY_KIND = {
      type: "type",
      assets: "assets",
      guidance: "readme",
    };
    // CucCut: user-facing copy calls the agent "the agent", not Claude.
    CLAUDE_COMMENT_SENT_MESSAGE =
      "Sent to the agent — it will reply in the comment thread";
    README_SIZE_EXCEEDED_MESSAGE =
      "That is more text than the README can keep (" +
      String(runtime.DESIGN_SYSTEM_INLINE_LIMITS.readme / 1024) +
      " KB), so it was not added. The text from before is unchanged.";
    BACKGROUND_COLOR_TOKEN_PATTERNS = [
      /^bg-?100$/,
      /^(background|bg|page|canvas|paper)$/,
      /^bg-?(base|page|default|primary)$/,
      /^(surface|bg)-?(1|base)$/,
    ];
    SURFACE_COLOR_TOKEN_PATTERNS = [
      /^bg-?0{1,3}$/,
      /^(surface|card|panel)$/,
      /^(surface|bg)-?(0|raised|card|elevated)$/,
      /^bg-?(card|raised|surface)$/,
    ];
  };
}
