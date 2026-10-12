import type * as Storage from "../contracts/model-storage";
import type * as Model from "../contracts";
import type * as Host from "../contracts/platform-host";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installModelPublish(runtime: RuntimeBindings): () => void {
  var mirrorContentEncoder: TextEncoder;
  var MAX_PUBLISH_BATCH_BYTES: number;
  var SYNC_HOST_ERROR_CLASSIFICATIONS: Record<string, string>;
  var SYNC_FILE_ERROR_CLASSIFICATIONS: Record<string, string>;
  var SYNC_FILE_INPUT_ERROR_CLASSIFICATIONS: Record<string, string>;
  var SYNC_PENDING_SAVE_STATES: Set<string>;
  var SYNC_READY_SAVE_STATES: Set<string>;
  var DOWNLOAD_INTERNAL_FAILURE: Storage.HealthEvent;
  var DOWNLOAD_OUTCOME_HEALTH: Record<string, Storage.HealthEvent>;
  var DOWNLOAD_ERROR_HEALTH: Record<string, Storage.HealthEvent>;
  var SAVE_ERROR_HEALTH: Record<string, string>;
  function fileTableOrNull(content: unknown): Model.FileTable | null {
    let files = (content as { files?: unknown } | null | undefined)?.files;
    if (typeof files === "object" && files !== null) {
      return files as Model.FileTable;
    } else {
      return null;
    }
  }
  function mirrorFileContent(
    path: string,
    content: string,
  ): { content: string | Blob; contentType: string } | null {
    let mime = (0, runtime.mirrorMimeTypeForPath)(path)!;
    if ((0, runtime.isTextFilePath)(path)) {
      return {
        content: content,
        contentType: mime,
      };
    }
    let header = (0, runtime.parseDataUriHeader)(content),
      binary: string;
    try {
      binary = atob(content.slice(header!.payloadOffset));
    } catch {
      return null;
    }
    let bytes = new Uint8Array(binary.length);
    for (let index: number = 0; index < binary.length; index++) {
      bytes[index] = binary.charCodeAt(index);
    }
    return {
      content: new Blob([bytes], {
        type: mime,
      }),
      contentType: mime,
    };
  }
  function computeMirrorChanges(
    beforeFiles: Model.FileTable,
    afterFiles: Model.FileTable,
    force: boolean = false,
  ): Model.FilePublishEntries {
    let changes: Model.FilePublishEntries = {},
      afterTokensCss = (0, runtime.generatedTokensCssForFiles)(afterFiles),
      beforeTokensCss = (0, runtime.generatedTokensCssForFiles)(beforeFiles);
    if (afterTokensCss === null) {
      if (
        beforeTokensCss !== null ||
        Object.hasOwn(beforeFiles, runtime.GENERATED_TOKENS_CSS_PATH)
      ) {
        changes[runtime.GENERATED_TOKENS_CSS_PATH] = null;
      }
    } else if (force || afterTokensCss !== beforeTokensCss) {
      changes[runtime.GENERATED_TOKENS_CSS_PATH] = {
        content: afterTokensCss,
        contentType: (0, runtime.mirrorMimeTypeForPath)(
          runtime.GENERATED_TOKENS_CSS_PATH,
        )!,
      };
    }
    let documentation = (0, runtime.consumptionDocumentationForFiles)(
        afterFiles,
      ),
      beforeCards = (0, runtime.consumptionDocumentationForFiles)(
        beforeFiles,
      ).files;
    for (let [value, value2] of documentation.files) {
      if (force || beforeCards.get(value) !== value2) {
        changes[value] = {
          content: value2,
          contentType: (0, runtime.mirrorMimeTypeForPath)(value)!,
        };
      }
    }
    for (let value of beforeCards.keys()) {
      if (!documentation.files.has(value)) {
        changes[value] = null;
      }
    }
    let renamedTokensText = (0, runtime.tokensJsonWithManifestName)(afterFiles);
    for (let value of Object.keys(afterFiles)) {
      let value2 = afterFiles[value];
      if (!(0, runtime.isMirrorEligibleFile)(value, value2)) {
        continue;
      }
      if (
        !force &&
        (value === runtime.DESIGN_SYSTEM_PATHS.tokens
          ? renamedTokensText ===
            (0, runtime.tokensJsonWithManifestName)(beforeFiles)
          : beforeFiles[value] === value2) &&
        value !== runtime.DESIGN_SYSTEM_PATHS.manifest &&
        value !== runtime.DESIGN_SYSTEM_PATHS.readme
      ) {
        continue;
      }
      let value3 = mirrorFileContent(
        value,
        value === runtime.DESIGN_SYSTEM_PATHS.readme
          ? documentation.readme
          : value === runtime.DESIGN_SYSTEM_PATHS.tokens
            ? renamedTokensText!
            : value2,
      );
      if (value3 !== null) {
        changes[value] = value3;
      }
    }
    for (let value of Object.keys(beforeFiles)) {
      if (
        value !== runtime.GENERATED_TOKENS_CSS_PATH &&
        !documentation.files.has(value) &&
        (0, runtime.isMirrorEligibleFile)(value, beforeFiles[value]) &&
        !(
          Object.hasOwn(afterFiles, value) &&
          (0, runtime.isMirrorEligibleFile)(value, afterFiles[value])
        )
      ) {
        changes[value] = null;
      }
    }
    return changes;
  }
  function countMirrorFiles(files: Model.FileTable): number {
    let count =
      ((0, runtime.generatedTokensCssForFiles)(files) !== null ? 1 : 0) +
      (0, runtime.consumptionDocumentationForFiles)(files).files.size;
    for (let value of Object.keys(files)) {
      if ((0, runtime.isMirrorEligibleFile)(value, files[value])) {
        count++;
      }
    }
    return count;
  }
  function estimatePublishContentBytes(
    changes: Model.FilePublishEntries,
  ): number {
    let bytes = 0;
    for (let value of Object.values(changes)) {
      if (
        value === null ||
        typeof value !== "object" ||
        value instanceof Blob
      ) {
        continue;
      }
      bytes +=
        typeof value.content === "string"
          ? mirrorContentEncoder.encode(value.content).length
          : Math.ceil((value.content.size * 4) / 3);
    }
    return bytes;
  }
  function createPageMirrorPublisher(
    options: Storage.MirrorPublisherOptions = {},
    resolveArtifact: () => Promise<Storage.SelfPublishCapability | null> = runtime.getSelfPublishCapability,
  ): Host.Publisher {
    let mirrorState: string = "untried",
      mirrorCurrent: boolean = false;
    return async (
      input: string,
      options2?: Parameters<Host.Publisher>[1],
    ): ReturnType<Host.Publisher> => {
      let value = await resolveArtifact();
      if (value === null) {
        throw {
          code: "not_granted",
          message: "The artifact capability is not available to this view.",
        };
      }
      let value2 =
          options2 === undefined
            ? null
            : fileTableOrNull(options2.published.content),
        value3 =
          options2 === undefined
            ? null
            : fileTableOrNull(options2.base.content);
      if (value2 === null || value3 === null || mirrorState === "off") {
        return value.publish(input);
      }
      let callback = (input2: string) => {
          mirrorCurrent = false;
          options.onStale?.(input2);
          return value.publish(input);
        },
        value4: Model.FilePublishEntries;
      try {
        value4 = computeMirrorChanges(value3, value2, !mirrorCurrent);
      } catch (value5: unknown) {
        return callback(
          "the mirror could not be computed (" +
            (value5 instanceof Error ? value5.message : String(value5)) +
            ")",
        );
      }
      if (
        Math.max(countMirrorFiles(value2), Object.keys(value4).length) + 1 >
          runtime.ARTIFACT_FILE_LIMITS.call ||
        mirrorContentEncoder.encode(input).length +
          estimatePublishContentBytes(value4) >
          MAX_PUBLISH_BATCH_BYTES
      ) {
        return callback(
          "the page and its files are more than one save can send",
        );
      }
      value4["index.html"] = {
        content: input,
        contentType: "text/html",
      };
      try {
        let value5 = await value.publish(value4);
        mirrorState = "on";
        mirrorCurrent = true;
        return {
          ...value5,
          reloads: false,
        };
      } catch (value5: unknown) {
        let code = (0, runtime.normalizeSelfPublishError)(value5).code;
        if (
          code === "capability_disabled" ||
          code === "capability_removed" ||
          (mirrorState === "untried" &&
            (code === "invalid_content" || code === "transform_error"))
        ) {
          mirrorState = "off";
          return callback(
            "this view cannot write files beside the page (" + code + ")",
          );
        }
        if (code === "too_large") {
          return callback(
            "the page and its files are more than one save can send",
          );
        }
        if (code === "invalid_content" || code === "transform_error") {
          return callback(
            "the files beside the page were refused (" + code + ")",
          );
        }
        if (code === "not_granted" || code === "not_writer") {
          return value.publish(input);
        }
        throw value5;
      }
    };
  }
  function createSystemFilesPublisher(
    options: Storage.MirrorPublisherOptions = {},
    resolveArtifact: () => Promise<Storage.SelfPublishCapability | null> = runtime.getSelfPublishCapability,
  ): Host.Publisher {
    let firstPublish: boolean = true,
      owedPaths = new Set<string>(),
      publishedCards = new Map<string, string>(),
      baseCardPaths: Set<string> | null = null;
    return async (
      input: string,
      options2?: Parameters<Host.Publisher>[1],
    ): ReturnType<Host.Publisher> => {
      let value = await resolveArtifact();
      if (value === null) {
        throw {
          code: "not_granted",
          message: "The artifact capability is not available to this view.",
        };
      }
      if (options2 === undefined) {
        throw {
          code: "invalid_content",
          message:
            "A system made from the shared type saves its files, never a page.",
        };
      }
      let value2 = fileTableOrNull(options2.published.content),
        value3 = fileTableOrNull(options2.base.content);
      if (value2 === null || value3 === null) {
        throw {
          code: "invalid_content",
          message: "The document has no file table to save.",
        };
      }
      let state = {
          content:
            JSON.stringify({
              title: options2.published.title,
              content: options2.published.content,
              comments: [],
            }) +
            `
`,
          contentType: "application/json",
        },
        value4 =
          runtime.ARTIFACT_FILE_LIMITS.files -
          runtime.TYPE_RESERVED_FILE_BUDGET.files,
        index = 0,
        flag = false,
        index2 = 0;
      try {
        baseCardPaths ??= new Set(
          (0, runtime.consumptionDocumentationForFiles)(value3).files.keys(),
        );
        index = (0, runtime.consumptionDocumentationForFiles)(value2).files
          .size;
        index2 = countMirrorFiles(value2) + 1;
        flag = index2 > value4 && index2 - index <= value4;
      } catch {
        index2 =
          Object.keys(value2).filter((input2) =>
            (0, runtime.isMirrorEligibleFile)(input2, value2[input2]),
          ).length + 2;
      }
      let callback = (input2: Model.FilePublishEntries) => {
          let value10: ReadonlyMap<string, string>;
          try {
            value10 = (0, runtime.consumptionDocumentationForFiles)(
              value2,
            ).files;
          } catch {
            return input2;
          }
          for (let value13 of Object.keys(input2)) {
            if (
              (0, runtime.isGeneratedApiPath)(value13) &&
              (input2[value13] === null || flag)
            ) {
              delete input2[value13];
            }
          }
          let value11: number =
            runtime.ARTIFACT_FILE_LIMITS.call - 1 - Object.keys(input2).length;
          for (let value13 of new Set([
            ...(baseCardPaths ?? []),
            ...publishedCards.keys(),
          ])) {
            if (value11 <= 0) {
              break;
            }
            if ((flag || !value10.has(value13)) && !(value13 in input2)) {
              input2[value13] = null;
              value11--;
            }
          }
          if (!flag) {
            return input2;
          }
          let value12 = input2[runtime.DESIGN_SYSTEM_PATHS.readme];
          if (
            value12 !== null &&
            typeof value12 === "object" &&
            !(value12 instanceof Blob) &&
            typeof value12.content === "string" &&
            !value12.content.endsWith(runtime.OMITTED_API_CARDS_NOTICE)
          ) {
            input2[runtime.DESIGN_SYSTEM_PATHS.readme] = {
              ...value12,
              content: value12.content + runtime.OMITTED_API_CARDS_NOTICE,
            };
          }
          return input2;
        },
        value5: string =
          String(Math.round(MAX_PUBLISH_BATCH_BYTES / 1024 / 1024)) + " MB",
        value6: string =
          "Not saved: this design system is more than one save can send (" +
          value5 +
          ") — remove or shrink large files, then save again.";
      if (
        estimatePublishContentBytes({
          [runtime.DESIGN_SYSTEM_ENVELOPE_PATH]: state,
        }) > MAX_PUBLISH_BATCH_BYTES
      ) {
        throw makePublishSizeError(value6);
      }
      let value7: Model.FilePublishEntries | null = null,
        callback2 = () =>
          (value7 ??= computeMirrorChanges(value3, value2, true));
      try {
        for (let value10 of [...owedPaths]) {
          if ((callback2()[value10] ?? null) === null) {
            owedPaths.delete(value10);
          }
        }
      } catch {
        owedPaths.clear();
      }
      let value8 = estimatePublishContentBytes({
          [runtime.DESIGN_SYSTEM_ENVELOPE_PATH]: state,
        }),
        cache = new WeakMap<object, number>(),
        callback3 = (input2: Model.FilePublishEntries) => {
          let index3: number = 0;
          try {
            for (let value12 of Object.keys(input2)) {
              if (
                (0, runtime.isGeneratedApiPath)(value12) &&
                input2[value12] !== null
              ) {
                delete input2[value12];
              }
            }
            let value10 = value8 + estimatePublishContentBytes(input2),
              value11 = Object.keys(input2).length + 1;
            for (let [value12, value13] of (0,
            runtime.consumptionDocumentationForFiles)(value2).files) {
              if (publishedCards.get(value12) === value13) {
                continue;
              }
              let length = mirrorContentEncoder.encode(value13).length;
              if (
                value10 + length > MAX_PUBLISH_BATCH_BYTES ||
                value11 >= runtime.ARTIFACT_FILE_LIMITS.call
              ) {
                index3++;
                continue;
              }
              input2[value12] = {
                content: value13,
                contentType: (0, runtime.mirrorMimeTypeForPath)(value12)!,
              };
              value10 += length;
              value11++;
            }
          } catch {}
          cache.set(input2, index3);
          return input2;
        },
        callback4 = () =>
          callback3(computeMirrorChanges(value3, value2, false)),
        items: [string, () => Model.FilePublishEntries][] = [
          [
            "want",
            () => {
              let value10 = computeMirrorChanges(value3, value2, false);
              for (let value11 of owedPaths) {
                value10[value11] = callback2()[value11];
              }
              return callback3(value10);
            },
          ],
          ["changed", callback4],
          [
            "least",
            () => {
              let state2: Model.FilePublishEntries = {};
              try {
                for (let [value12, value13] of Object.entries(callback4())) {
                  if (value13 === null) {
                    state2[value12] = null;
                  }
                }
              } catch {}
              let value10 = value2[runtime.DESIGN_SYSTEM_PATHS.manifest],
                value11 =
                  typeof value10 === "string" &&
                  (0, runtime.isMirrorEligibleFile)(
                    runtime.DESIGN_SYSTEM_PATHS.manifest,
                    value10,
                  )
                    ? mirrorFileContent(
                        runtime.DESIGN_SYSTEM_PATHS.manifest,
                        value10,
                      )
                    : null;
              if (value11 !== null) {
                state2[runtime.DESIGN_SYSTEM_PATHS.manifest] = value11;
              }
              if (flag) {
                try {
                  let value12 =
                    runtime.DESIGN_SYSTEM_PATHS.readme in callback4()
                      ? callback4()[runtime.DESIGN_SYSTEM_PATHS.readme]
                      : callback2()[runtime.DESIGN_SYSTEM_PATHS.readme];
                  if (value12 === null) {
                    state2[runtime.DESIGN_SYSTEM_PATHS.readme] = null;
                  } else if (
                    value12 !== undefined &&
                    value8 +
                      estimatePublishContentBytes({
                        ...state2,
                        [runtime.DESIGN_SYSTEM_PATHS.readme]: value12,
                      }) <=
                      MAX_PUBLISH_BATCH_BYTES
                  ) {
                    state2[runtime.DESIGN_SYSTEM_PATHS.readme] = value12;
                  } else if (
                    value12 !== undefined &&
                    typeof value2[runtime.DESIGN_SYSTEM_PATHS.readme] ===
                      "string"
                  ) {
                    let state3 = {
                      content:
                        (0, runtime.stripGeneratedReadmeTail)(
                          value2[runtime.DESIGN_SYSTEM_PATHS.readme],
                        ).replace(/\uFFFD/g, "") +
                        runtime.OMITTED_API_CARDS_NOTICE,
                      contentType: (0, runtime.mirrorMimeTypeForPath)(
                        runtime.DESIGN_SYSTEM_PATHS.readme,
                      )!,
                    };
                    if (
                      value8 +
                        estimatePublishContentBytes({
                          ...state2,
                          [runtime.DESIGN_SYSTEM_PATHS.readme]: state3,
                        }) <=
                      MAX_PUBLISH_BATCH_BYTES
                    ) {
                      state2[runtime.DESIGN_SYSTEM_PATHS.readme] = state3;
                    }
                  }
                } catch {}
              }
              return state2;
            },
          ],
        ];
      if (firstPublish) {
        items.unshift([
          "all",
          () => ({
            ...callback2(),
          }),
        ]);
      }
      let text: string = "",
        text2: string = "",
        text3 = "",
        value9: Host.PublishError | undefined = undefined,
        flag2: boolean = false;
      for (let [value10, value11] of items) {
        let value12: Model.FilePublishEntries;
        try {
          value12 = callback(value11());
        } catch (value15: unknown) {
          text =
            "the files beside it could not be prepared (" +
            (value15 instanceof Error ? value15.message : String(value15)) +
            ") — an appifact bug";
          text2 = "Not saved: " + text + ".";
          continue;
        }
        for (let value15 of Object.keys(value12)) {
          if ((0, runtime.explainUnsafeMirrorPath)(value15) !== null) {
            delete value12[value15];
          }
        }
        value12[runtime.DESIGN_SYSTEM_ENVELOPE_PATH] = state;
        let value13: string =
          Object.keys(value12).sort().join(`
`) +
          `
` +
          String(estimatePublishContentBytes(value12));
        if (value13 === text3) {
          continue;
        }
        text3 = value13;
        let length = Object.keys(value12).length,
          value14: number = Math.max(
            index2 - (flag ? index : 0),
            length -
              Object.values(value12).filter(
                (input2): boolean => input2 === null,
              ).length,
          );
        if (
          value14 > value4 ||
          length > runtime.ARTIFACT_FILE_LIMITS.call ||
          estimatePublishContentBytes(value12) > MAX_PUBLISH_BATCH_BYTES
        ) {
          text =
            value14 > value4
              ? "more files than one can hold (" +
                String(value14 - (flag ? 0 : index)) +
                " of " +
                String(value4) +
                (index > 0
                  ? "; the " +
                    String(index) +
                    " generated api/ cards are left out automatically"
                  : "") +
                ")"
              : length > runtime.ARTIFACT_FILE_LIMITS.call
                ? "more paths than one save can name (" +
                  String(length) +
                  " of " +
                  String(runtime.ARTIFACT_FILE_LIMITS.call) +
                  ", " +
                  String(
                    Object.values(value12).filter(
                      (input2): boolean => input2 === null,
                    ).length,
                  ) +
                  " of them deletions)"
                : "more than one save can send (" + value5 + ")";
          text2 =
            value14 > value4 || length > runtime.ARTIFACT_FILE_LIMITS.call
              ? "Not saved: this design system has " +
                text +
                " — remove some, then save again."
              : value6;
          value9 = undefined;
          continue;
        }
        try {
          let value15 = await value.publish(value12),
            values = new Set(
              Object.keys(value12).filter(
                (input2) =>
                  value12[input2] !== null &&
                  input2 !== runtime.DESIGN_SYSTEM_PATHS.manifest &&
                  input2 !== runtime.DESIGN_SYSTEM_ENVELOPE_PATH,
              ),
            );
          for (let [value17, value18] of Object.entries(value12)) {
            if (!(0, runtime.isGeneratedApiPath)(value17)) {
              continue;
            }
            if (value18 === null) {
              publishedCards.delete(value17);
              baseCardPaths?.delete(value17);
            } else if (
              typeof value18 === "object" &&
              !(value18 instanceof Blob) &&
              typeof (value18 as { content?: unknown }).content === "string"
            ) {
              publishedCards.set(
                value17,
                (value18 as { content: string }).content,
              );
            }
          }
          if (value10 === "all" || value10 === "want") {
            owedPaths.clear();
          } else {
            try {
              for (let value17 of values) {
                owedPaths.delete(value17);
              }
              for (let [value17, value18] of Object.entries(callback4())) {
                if (
                  value18 !== null &&
                  value17 !== runtime.DESIGN_SYSTEM_PATHS.manifest &&
                  !values.has(value17) &&
                  (0, runtime.explainUnsafeMirrorPath)(value17) === null &&
                  !(0, runtime.isGeneratedApiPath)(value17)
                ) {
                  owedPaths.add(value17);
                }
              }
            } catch {}
          }
          let items2: string[] = [];
          if (flag) {
            items2.push(
              "the generated api/ cards were left out: with them this system is " +
                String(index2) +
                " files and one version has room for " +
                String(value4) +
                " — agents read the long-form READMEs instead",
            );
          }
          if (owedPaths.size > 0) {
            items2.push(
              "saved design-system.json; " +
                String(owedPaths.size) +
                " mirrored file(s) beside it are behind (" +
                text +
                ") and ride the next save that fits, or a make.ts build",
            );
          }
          let value16 = cache.get(value12) ?? 0;
          if (value10 === "least" && !flag) {
            try {
              for (let [value17, value18] of (0,
              runtime.consumptionDocumentationForFiles)(value2).files) {
                if (publishedCards.get(value17) !== value18) {
                  value16++;
                }
              }
            } catch {}
          }
          if (value16 > 0) {
            items2.push(
              String(value16) +
                " generated api/ card(s) beside it are a save behind (this save was at the size limit) and ride the next save with room, or a make.ts build",
            );
          }
          if (firstPublish && value10 !== "all") {
            items2.push(
              "the whole mirror was not re-sent this session (" +
                text +
                "); changed files go beside it as they change — a make.ts build refreshes the rest",
            );
          }
          if (items2.length > 0) {
            options.onStale?.(items2.join("; "));
          }
          if (value10 !== "least" || flag2) {
            firstPublish = false;
          }
          return {
            ...value15,
            reloads: false,
          };
        } catch (value15: unknown) {
          let value16 = (0, runtime.normalizeSelfPublishError)(value15),
            code = value16.code;
          if (
            code !== "too_large" &&
            code !== "invalid_content" &&
            code !== "transform_error"
          ) {
            throw value15;
          }
          text = "the store refused the files beside it (" + code + ")";
          if (value10 === "all") {
            flag2 = true;
          }
          text2 =
            code === "too_large"
              ? "Not saved: the store refused its files as too large — remove or shrink large files, then save again."
              : "Not saved: the store refused this system’s files (" +
                code +
                (value16.message !== code ? ": " + value16.message : "") +
                ") — usually a content problem, most often a pasted replacement character (U+FFFD, the box glyph) in a document: remove it and save again.";
          value9 = {
            ...value16,
            say: text2,
          };
        }
      }
      throw (
        value9 ??
        makePublishSizeError(text2 !== "" ? text2 : "Not saved: " + text + ".")
      );
    };
  }
  function makePublishSizeError(message: string): Storage.MirrorPublishError {
    return {
      code: "too_large",
      message: message,
      say: message,
    };
  }
  function classifySyncErrorCode(code: string | undefined): string {
    if (code === undefined) {
      return "unknown";
    }
    if (Object.hasOwn(SYNC_HOST_ERROR_CLASSIFICATIONS, code)) {
      return SYNC_HOST_ERROR_CLASSIFICATIONS[code];
    }
    if (Object.hasOwn(SYNC_FILE_ERROR_CLASSIFICATIONS, code)) {
      return SYNC_FILE_ERROR_CLASSIFICATIONS[code];
    } else {
      return "unknown";
    }
  }
  function syncLoadHealthOutcome(
    loadState: string,
    errorCode: string | undefined,
  ): Storage.HealthEvent {
    if (loadState === "live") {
      return ["render", "success"];
    }
    if (loadState === "saved_copy") {
      return ["render", "success", "saved_copy"];
    }
    return [
      "render",
      "failure",
      errorCode === "timeout" ? "timeout" : "capability_error",
    ];
  }
  function monitorSyncLoadHealth(
    document2: Storage.MonitoredSyncDocument,
    report: Storage.SyncHealthReporter,
  ): () => void {
    let reported: boolean = false,
      unsubscribe: (() => void) | undefined,
      check = (): void => {
        if (reported) {
          return;
        }
        let value = document2.loadState();
        if (value === "loading") {
          return;
        }
        if (value === "cached" && document2.cachedSettled?.() !== true) {
          return;
        }
        reported = true;
        unsubscribe?.();
        safeReportSyncHealth(
          report,
          syncLoadHealthOutcome(
            value === "cached" ? "saved_copy" : value,
            document2.syncDetail().lastError?.code,
          ),
        );
      };
    unsubscribe = document2.subscribeLoad(check);
    check();
    return (): void => {
      reported = true;
      unsubscribe?.();
    };
  }
  function monitorSyncSaveHealth(
    document2: Storage.MonitoredSyncDocument,
    report: Storage.SyncHealthReporter,
  ): () => void {
    let previousStatus = document2.saveState().status,
      previousLeftOut = new Map<string, string>(),
      unsubscribeStuck =
        document2.subscribeStuck?.(() =>
          safeReportSyncHealth(report, ["sync", "failure", "timeout"]),
        ) ?? ((): void => {}),
      unsubscribeSave = document2.subscribeSave(
        (state: Storage.MonitoredSaveState): void => {
          let status = state.status;
          if (status === previousStatus) {
            return;
          }
          let value = previousStatus;
          previousStatus = status;
          if (document2.loadState() !== "live") {
            return;
          }
          if (status === "ready") {
            previousLeftOut = new Map();
          }
          if (status === "ready" && SYNC_PENDING_SAVE_STATES.has(value)) {
            safeReportSyncHealth(report, ["sync", "success"]);
          } else if (status === "error" && SYNC_READY_SAVE_STATES.has(value)) {
            let value2 = document2.syncDetail().lastError?.code;
            if (value2 !== undefined || state.leftOut === undefined) {
              safeReportSyncHealth(report, [
                "sync",
                "failure",
                classifySyncErrorCode(value2 ?? state.code),
              ]);
              return;
            }
            let values = new Set<string>();
            for (let value3 of state.leftOut) {
              if (previousLeftOut.get(value3.id) !== value3.cause) {
                values.add(SYNC_FILE_INPUT_ERROR_CLASSIFICATIONS[value3.cause]);
              }
            }
            previousLeftOut = new Map(
              state.leftOut.map((input) => [input.id, input.cause]),
            );
            for (let value3 of values) {
              safeReportSyncHealth(report, ["sync", "failure", value3]);
            }
          } else if (
            status === "readonly" &&
            SYNC_PENDING_SAVE_STATES.has(value) &&
            document2.dirty()
          ) {
            safeReportSyncHealth(report, [
              "sync",
              "failure",
              "capability_denied",
            ]);
          }
        },
      );
    return (): void => {
      unsubscribeStuck();
      unsubscribeSave();
    };
  }
  function safeReportSyncHealth(
    report: Storage.SyncHealthReporter,
    event: Storage.HealthEvent,
  ): void {
    try {
      report(event);
    } catch (value: unknown) {
      console.error(
        "appifact sync health: reporter threw; report dropped",
        value,
      );
    }
  }
  function bootHealthOutcome(
    bootResult: Storage.SystemBootResult & { errorAt?: string },
    successOverride: boolean = false,
  ): Storage.HealthEvent {
    if (bootResult.origin === "instance" || successOverride) {
      return ["render", "success"];
    }
    if (bootResult.origin === "demo" && bootResult.stateFileFound === false) {
      return ["render", "success"];
    }
    if (bootResult.errorAt === undefined) {
      return ["render", "failure", "internal"];
    }
    return [
      "render",
      "failure",
      bootResult.errorAt === "read" ? "invalid_content" : "network",
    ];
  }
  function downloadHealthOutcome(
    result: Storage.DownloadOutcome,
  ): Storage.HealthEvent | undefined {
    return (
      (result.outcome === "unsupported"
        ? DOWNLOAD_ERROR_HEALTH[result.code!]
        : undefined) ?? DOWNLOAD_OUTCOME_HEALTH[result.outcome]
    );
  }
  function reportPublisherOutcome(
    publish: Host.Publisher,
    report: (result: string) => void,
  ): Host.Publisher {
    return async (
      input: string,
      options?: Parameters<Host.Publisher>[1],
    ): ReturnType<Host.Publisher> => {
      try {
        let value = await publish(input, options);
        if (options !== undefined) {
          report("landed");
        }
        return value;
      } catch (value: unknown) {
        if (options !== undefined) {
          report((0, runtime.normalizeSelfPublishError)(value).code);
        }
        throw value;
      }
    };
  }
  function saveHealthOutcome(
    saveStatus: string,
    publishOutcome?: string,
  ): Storage.HealthEvent | null {
    if (
      saveStatus === "readonly" ||
      saveStatus === "saving" ||
      saveStatus === "loading"
    ) {
      return null;
    }
    if (publishOutcome === "landed") {
      return ["save", "success"];
    }
    if (publishOutcome === undefined) {
      if (saveStatus === "error") {
        return ["save", "failure", "internal"];
      } else {
        return null;
      }
    }
    return ["save", "failure", SAVE_ERROR_HEALTH[publishOutcome]];
  }
  bindRuntimeValue(runtime, "fileTableOrNull", () => fileTableOrNull);
  bindRuntimeValue(runtime, "mirrorFileContent", () => mirrorFileContent);
  bindRuntimeValue(runtime, "computeMirrorChanges", () => computeMirrorChanges);
  bindRuntimeValue(runtime, "countMirrorFiles", () => countMirrorFiles);
  bindRuntimeValue(
    runtime,
    "mirrorContentEncoder",
    () => mirrorContentEncoder,
    (value) => {
      mirrorContentEncoder = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "estimatePublishContentBytes",
    () => estimatePublishContentBytes,
  );
  bindRuntimeValue(
    runtime,
    "MAX_PUBLISH_BATCH_BYTES",
    () => MAX_PUBLISH_BATCH_BYTES,
    (value) => {
      MAX_PUBLISH_BATCH_BYTES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createPageMirrorPublisher",
    () => createPageMirrorPublisher,
  );
  bindRuntimeValue(
    runtime,
    "createSystemFilesPublisher",
    () => createSystemFilesPublisher,
  );
  bindRuntimeValue(runtime, "makePublishSizeError", () => makePublishSizeError);
  bindRuntimeValue(
    runtime,
    "SYNC_HOST_ERROR_CLASSIFICATIONS",
    () => SYNC_HOST_ERROR_CLASSIFICATIONS,
    (value) => {
      SYNC_HOST_ERROR_CLASSIFICATIONS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SYNC_FILE_ERROR_CLASSIFICATIONS",
    () => SYNC_FILE_ERROR_CLASSIFICATIONS,
    (value) => {
      SYNC_FILE_ERROR_CLASSIFICATIONS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SYNC_FILE_INPUT_ERROR_CLASSIFICATIONS",
    () => SYNC_FILE_INPUT_ERROR_CLASSIFICATIONS,
    (value) => {
      SYNC_FILE_INPUT_ERROR_CLASSIFICATIONS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "classifySyncErrorCode",
    () => classifySyncErrorCode,
  );
  bindRuntimeValue(
    runtime,
    "syncLoadHealthOutcome",
    () => syncLoadHealthOutcome,
  );
  bindRuntimeValue(
    runtime,
    "monitorSyncLoadHealth",
    () => monitorSyncLoadHealth,
  );
  bindRuntimeValue(
    runtime,
    "SYNC_PENDING_SAVE_STATES",
    () => SYNC_PENDING_SAVE_STATES,
    (value) => {
      SYNC_PENDING_SAVE_STATES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SYNC_READY_SAVE_STATES",
    () => SYNC_READY_SAVE_STATES,
    (value) => {
      SYNC_READY_SAVE_STATES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "monitorSyncSaveHealth",
    () => monitorSyncSaveHealth,
  );
  bindRuntimeValue(runtime, "safeReportSyncHealth", () => safeReportSyncHealth);
  bindRuntimeValue(runtime, "bootHealthOutcome", () => bootHealthOutcome);
  bindRuntimeValue(
    runtime,
    "DOWNLOAD_INTERNAL_FAILURE",
    () => DOWNLOAD_INTERNAL_FAILURE,
    (value) => {
      DOWNLOAD_INTERNAL_FAILURE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DOWNLOAD_OUTCOME_HEALTH",
    () => DOWNLOAD_OUTCOME_HEALTH,
    (value) => {
      DOWNLOAD_OUTCOME_HEALTH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DOWNLOAD_ERROR_HEALTH",
    () => DOWNLOAD_ERROR_HEALTH,
    (value) => {
      DOWNLOAD_ERROR_HEALTH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "downloadHealthOutcome",
    () => downloadHealthOutcome,
  );
  bindRuntimeValue(
    runtime,
    "SAVE_ERROR_HEALTH",
    () => SAVE_ERROR_HEALTH,
    (value) => {
      SAVE_ERROR_HEALTH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reportPublisherOutcome",
    () => reportPublisherOutcome,
  );
  bindRuntimeValue(runtime, "saveHealthOutcome", () => saveHealthOutcome);
  return () => {
    mirrorContentEncoder = new TextEncoder();
    MAX_PUBLISH_BATCH_BYTES = 15728640;
    SYNC_HOST_ERROR_CLASSIFICATIONS = {
      refused: "too_large",
      quota_exceeded: "too_large",
      invalid_argument: "invalid_content",
      transform_error: "invalid_content",
      resource_exhausted: "backpressure",
      unavailable: "transient",
      timeout: "timeout",
      revoked: "capability_denied",
      not_granted: "capability_denied",
      capability_disabled: "capability_denied",
      capability_removed: "capability_denied",
    };
    SYNC_FILE_ERROR_CLASSIFICATIONS = {
      conflict: "conflict",
      too_large: "too_large",
      invalid_content: "invalid_content",
      index_damaged: "invalid_content",
      index_newer_build: "internal",
      upstream_error: "transient",
      rate_limited: "backpressure",
      read_only_path: "internal",
      not_writer: "capability_denied",
      not_declared: "capability_denied",
      capability_disabled: "capability_denied",
    };
    SYNC_FILE_INPUT_ERROR_CLASSIFICATIONS = {
      size: "too_large",
      kind: "validation",
      name: "user_error",
      damaged_text: "user_error",
      gone: "internal",
      unreadable: "internal",
      other: "invalid_content",
    };
    SYNC_PENDING_SAVE_STATES = new Set(["dirty", "saving", "error"]);
    SYNC_READY_SAVE_STATES = new Set(["ready", "dirty", "saving"]);
    DOWNLOAD_INTERNAL_FAILURE = ["download", "failure", "internal"];
    DOWNLOAD_OUTCOME_HEALTH = {
      saved: ["download", "success"],
      declined: ["download", "aborted"],
      withheld: ["download", "aborted"],
      unsupported: ["download", "failure", "capability_error"],
    };
    DOWNLOAD_ERROR_HEALTH = {
      too_large: ["download", "aborted"],
      rate_limited: ["download", "aborted"],
      rejected_extension: ["download", "aborted"],
      extension_not_enabled: ["download", "aborted"],
      bad_request: ["download", "failure", "invalid_content"],
    };
    SAVE_ERROR_HEALTH = {
      conflict: "conflict",
      too_large: "too_large",
      invalid_content: "invalid_content",
      transform_error: "invalid_content",
      upstream_error: "transient",
      rate_limited: "backpressure",
      read_only_path: "internal",
      not_writer: "capability_denied",
      not_declared: "capability_denied",
      not_granted: "capability_denied",
      consent_required: "capability_denied",
      capability_disabled: "capability_denied",
      capability_removed: "capability_denied",
    };
  };
}
