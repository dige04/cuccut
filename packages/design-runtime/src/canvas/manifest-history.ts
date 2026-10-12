/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installCanvasManifestHistory(
  runtime: RuntimeBindings,
): () => void {
  var defaultCanvasPage: Dynamic;
  var omitDefaultCanvasPage: Dynamic;
  var changedObjectKeys: Dynamic;
  var pickObjectKeys: Dynamic;
  var canvasLaunchViewKey: Dynamic;
  function applyCanvasPageHistory(
    manifest?: Dynamic,
    step?: Dynamic,
    direction?: Dynamic,
  ): Dynamic {
    let value: Dynamic = manifest.pages ?? [],
      value2: Dynamic =
        value.length > 0
          ? value
          : direction === "redo" && step.first !== undefined
            ? [step.first]
            : value;
    if (step.kind === "page-add") {
      let value6: Dynamic = value.some(
        (input?: Dynamic): Dynamic => input.id === step.page.id,
      );
      if (direction === "redo")
        return value6 || value2.length >= (0, runtime.maxDesignPages)()
          ? null
          : {
              pages: [
                ...(value2.length > 0 || step.page.id === defaultCanvasPage.id
                  ? value2
                  : [defaultCanvasPage]),
                step.page,
              ],
            };
      let callback: Dynamic = (input?: Dynamic): Dynamic =>
        (0, runtime.designPageId)(input, value) === step.page.id;
      return !value6 ||
        manifest.artboards.some(callback) ||
        (manifest.annotations ?? []).some(callback)
        ? null
        : {
            pages: omitDefaultCanvasPage(
              value.filter(
                (input?: Dynamic): Dynamic => input.id !== step.page.id,
              ),
              step.first,
            ),
          };
    }
    let value3: Dynamic = direction === "undo" ? step.from : step.to,
      value4: Dynamic = value2.find(
        (input?: Dynamic): Dynamic => input.id === step.id,
      );
    if (value4 === undefined || value4.name === value3) return null;
    let value5: Dynamic = value2.map(
      (input?: Dynamic): Dynamic =>
        input.id === step.id
          ? {
              ...input,
              name: value3,
            }
          : input,
    );
    return {
      pages:
        direction === "undo"
          ? omitDefaultCanvasPage(value5, step.first)
          : value5,
    };
  }
  function updateArtboardGuides(
    manifest?: Dynamic,
    file?: Dynamic,
    guides?: Dynamic,
  ): Dynamic {
    return {
      ...manifest,
      artboards: manifest.artboards.map((input?: Dynamic): Dynamic => {
        if (input.file !== file) return input;
        let { guides: value, ...value2 }: Dynamic = input;
        return guides !== undefined
          ? {
              ...value2,
              guides: guides,
            }
          : value2;
      }),
    };
  }
  function mergeChangedArtboardSettings(
    current?: Dynamic,
    before?: Dynamic,
    after?: Dynamic,
    restored?: Dynamic,
  ): Dynamic {
    let values: Dynamic = new Set(changedObjectKeys(before, after)),
      state: Dynamic = {};
    for (let value of runtime.PlatformFileContentBackgroundBackgroundColorOpacityValues as Dynamic) {
      let value2: Dynamic = (values.has(value) ? restored : current)?.[value];
      value2 !== undefined && (state[value] = value2);
    }
    return Object.keys(state).length > 0 ? state : undefined;
  }
  function artboardOrderHistoryStep(
    before?: Dynamic,
    after?: Dynamic,
  ): Dynamic {
    let value: Dynamic = before.flatMap(
      (input?: Dynamic, options?: Dynamic): Dynamic =>
        after[options]?.file !== input.file ? [options] : [],
    );
    return {
      kind: "order",
      from: value.map((input?: Dynamic): Dynamic => before[input].file),
      to: value.map((input?: Dynamic): Dynamic => after[input].file),
    };
  }
  function filterSettingHistoryStep(
    step?: Dynamic,
    property?: Dynamic,
    current?: Dynamic,
  ): Dynamic {
    let callback: Dynamic = (input?: Dynamic): Dynamic => {
        let value: Dynamic = input?.[property];
        if (value === undefined) return;
        let state: Dynamic = {};
        state[property] = value;
        return state;
      },
      [items, items2]: Dynamic = [callback(step.from), callback(current)];
    return items?.[property] === items2?.[property]
      ? null
      : {
          ...step,
          from: items,
          to: items2,
        };
  }
  function applyCanvasManifestHistory(
    manifest?: Dynamic,
    step?: Dynamic,
    direction?: Dynamic,
  ): Dynamic {
    if (step.kind === "move") {
      let entries: Dynamic = new Map(
          step.moves.map(
            (input?: Dynamic): Dynamic => [
              input.file,
              direction === "undo" ? input.from : input.to,
            ],
          ),
        ),
        entries2: Dynamic = new Map(
          (step.anns ?? []).map(
            (input?: Dynamic): Dynamic => [
              input.id,
              direction === "undo" ? input.from : input.to,
            ],
          ),
        );
      return {
        ...manifest,
        artboards: manifest.artboards.map((input?: Dynamic): Dynamic => {
          let entry: Dynamic = entries.get(input.file);
          return entry
            ? {
                ...input,
                x: entry.x,
                y: entry.y,
              }
            : input;
        }),
        ...(entries2.size > 0
          ? {
              annotations: (manifest.annotations ?? []).map(
                (input?: Dynamic): Dynamic => {
                  let entry: Dynamic = entries2.get(input.id);
                  return entry
                    ? (0, runtime.moveAnnotation)(input, entry.x, entry.y)
                    : input;
                },
              ),
            }
          : {}),
      };
    }
    if (step.kind === "resize") {
      let value: Dynamic = direction === "undo" ? step.from : step.to,
        value2: Dynamic = Object.fromEntries(
          ["x", "y", "w", "h"]
            .filter(
              (input?: Dynamic): Dynamic => step.from[input] !== step.to[input],
            )
            .map((input?: Dynamic): Dynamic => [input, value[input]]),
        );
      return {
        ...manifest,
        artboards: manifest.artboards.map(
          (input?: Dynamic): Dynamic =>
            input.file === step.file
              ? {
                  ...input,
                  ...value2,
                }
              : input,
        ),
      };
    }
    if (step.kind === "transform") {
      let value: Dynamic = direction === "undo" ? "from" : "to",
        entries: Dynamic = new Map(
          step.boards.map(
            (input?: Dynamic): Dynamic => [input.file, input[value]],
          ),
        ),
        entries2: Dynamic = new Map(
          step.anns.map((input?: Dynamic): Dynamic => [input.id, input[value]]),
        );
      return {
        ...manifest,
        artboards: manifest.artboards.map((input?: Dynamic): Dynamic => {
          let entry: Dynamic = entries.get(input.file);
          return entry
            ? {
                ...input,
                ...entry,
              }
            : input;
        }),
        ...(entries2.size > 0
          ? {
              annotations: (manifest.annotations ?? []).map(
                (input?: Dynamic): Dynamic => {
                  let entry: Dynamic = entries2.get(input.id);
                  return entry
                    ? {
                        ...input,
                        ...entry,
                      }
                    : input;
                },
              ),
            }
          : {}),
      };
    }
    if (step.kind === "rename") {
      let value: Dynamic = direction === "undo" ? step.from : step.to;
      return {
        ...manifest,
        artboards: manifest.artboards.map(
          (input?: Dynamic): Dynamic =>
            input.file === step.file
              ? {
                  ...input,
                  ...(value
                    ? {
                        title: value,
                      }
                    : {
                        title: undefined,
                      }),
                }
              : input,
        ),
      };
    }
    if (step.kind === "print") {
      let value: Dynamic = direction === "undo" ? step.from : step.to;
      return {
        ...manifest,
        artboards: manifest.artboards.map((input?: Dynamic): Dynamic => {
          if (input.file !== step.file) return input;
          let { print: value2, ...value3 }: Dynamic = input;
          return value === "flow"
            ? {
                ...value3,
                print: "flow",
              }
            : value3;
        }),
      };
    }
    if (step.kind === "paper") {
      let value: Dynamic = direction === "undo" ? step.from : step.to;
      return {
        ...manifest,
        artboards: manifest.artboards.map((input?: Dynamic): Dynamic => {
          if (input.file !== step.file) return input;
          let { paper: value2, ...value3 }: Dynamic = input;
          return value
            ? {
                ...value3,
                paper: value,
              }
            : value3;
        }),
      };
    }
    if (step.kind === "guides")
      return updateArtboardGuides(
        manifest,
        step.file,
        direction === "undo" ? step.from : step.to,
      );
    if (step.kind === "cover")
      return {
        ...manifest,
        cover: direction === "undo" ? step.from : step.to,
      };
    if (step.kind === "page-add" || step.kind === "page-rename") {
      let value: Dynamic = applyCanvasPageHistory(manifest, step, direction);
      return value === null
        ? "nothing"
        : {
            ...manifest,
            pages: value.pages,
          };
    }
    if (step.kind === "ann-add" || step.kind === "ann-delete") {
      let value: Dynamic = manifest.annotations ?? [];
      if ((step.kind === "ann-add") == (direction === "redo")) {
        if (value.some((input?: Dynamic): Dynamic => input.id === step.spec.id))
          return "nothing";
        if (value.length >= runtime.PlatformFileContentLimit_5) return "full";
        let value2: Dynamic =
            step.kind === "ann-delete"
              ? Math.min(step.index, value.length)
              : value.length,
          items: Dynamic = [...value];
        items.splice(value2, 0, step.spec);
        return {
          ...manifest,
          annotations: items,
        };
      } else
        return {
          ...manifest,
          annotations: value.filter(
            (input?: Dynamic): Dynamic => input.id !== step.spec.id,
          ),
        };
    }
    if (step.kind === "ann-move") {
      let value: Dynamic = direction === "undo" ? step.from : step.to;
      return {
        ...manifest,
        annotations: (manifest.annotations ?? []).map(
          (input?: Dynamic): Dynamic =>
            input.id === step.id && !(0, runtime.isShapeAnnotation)(input)
              ? {
                  ...input,
                  x: value.x,
                  y: value.y,
                }
              : input,
        ),
      };
    }
    if (step.kind === "ann-resize") {
      let value: Dynamic = direction === "undo" ? step.from : step.to;
      return {
        ...manifest,
        annotations: (manifest.annotations ?? []).map(
          (input?: Dynamic): Dynamic =>
            input.id === step.id && !(0, runtime.isShapeAnnotation)(input)
              ? {
                  ...input,
                  w: value,
                }
              : input,
        ),
      };
    }
    if (step.kind === "ann-text") {
      let value: Dynamic = direction === "undo" ? step.from : step.to;
      return {
        ...manifest,
        annotations: (manifest.annotations ?? []).map(
          (input?: Dynamic): Dynamic =>
            input.id === step.id && !(0, runtime.isShapeAnnotation)(input)
              ? {
                  ...input,
                  text: value,
                }
              : input,
        ),
      };
    }
    if (step.kind === "ann-style") {
      let [value, value2]: Dynamic =
        direction === "undo"
          ? [step.from, step.caps?.from]
          : [step.to, step.caps?.to];
      return {
        ...manifest,
        annotations: (manifest.annotations ?? []).map(
          (input?: Dynamic): Dynamic =>
            input.id === step.id && !(0, runtime.isShapeAnnotation)(input)
              ? {
                  ...(0, runtime.updateAnnotationTextStyle)(input, {
                    ...(0, runtime.annotationTextStyle)(input),
                    ...pickObjectKeys(
                      value,
                      changedObjectKeys(step.from, step.to),
                    ),
                  }),
                  ...value2,
                }
              : input,
        ),
      };
    }
    if (step.kind === "ann-box" || step.kind === "ann-path") {
      let value: Dynamic = direction === "undo" ? step.from : step.to,
        value2: Dynamic =
          step.kind === "ann-path" || "x2" in value
            ? value
            : pickObjectKeys(value, changedObjectKeys(step.from, step.to));
      return {
        ...manifest,
        annotations: (manifest.annotations ?? []).map(
          (input?: Dynamic): Dynamic =>
            input.id === step.id && (0, runtime.isShapeAnnotation)(input)
              ? {
                  ...input,
                  ...value2,
                }
              : input,
        ),
      };
    }
    if (step.kind === "ann-color") {
      let value: Dynamic = direction === "undo" ? step.from : step.to,
        value2: Dynamic = direction === "undo" ? step.cssFrom : step.cssTo,
        value3: Dynamic =
          step.cssFrom !== undefined || step.cssTo !== undefined;
      return {
        ...manifest,
        annotations: (manifest.annotations ?? []).map(
          (input?: Dynamic): Dynamic =>
            input.id === step.id && (0, runtime.isShapeAnnotation)(input)
              ? value3
                ? (0, runtime.updateAnnotationCss)(
                    (0, runtime.updateAnnotationColor)(input, value),
                    mergeChangedArtboardSettings(
                      input.css,
                      step.cssFrom,
                      step.cssTo,
                      value2,
                    ),
                  )
                : (0, runtime.updateAnnotationColor)(input, value)
              : input,
        ),
      };
    }
    if (step.kind === "ann-heads") {
      let value: Dynamic = pickObjectKeys(
        direction === "undo" ? step.from : step.to,
        changedObjectKeys(step.from, step.to),
      );
      return {
        ...manifest,
        annotations: (manifest.annotations ?? []).map(
          (source?: Dynamic): Dynamic =>
            source.id === step.id &&
            (source.kind === "line" || source.kind === "arrow")
              ? (0, runtime.updateAnnotationArrowHeads)(source, {
                  ...(0, runtime.annotationArrowHeads)(source),
                  ...value,
                })
              : source,
        ),
      };
    }
    if (step.kind === "ann-css" || step.kind === "ann-src") {
      let value: Dynamic = direction === "undo" ? step.from : step.to,
        callback: Dynamic = (source?: Dynamic, options?: Dynamic): Dynamic =>
          source.kind === "image"
            ? (0, runtime.updateAnnotationCrop)(source, options)
            : source;
      return {
        ...manifest,
        annotations: (manifest.annotations ?? []).map(
          (source?: Dynamic): Dynamic => {
            if (
              source.id !== step.id ||
              !(0, runtime.isShapeAnnotation)(source)
            )
              return source;
            if (step.kind === "ann-src")
              return source.kind === "image"
                ? (0, runtime.updateAnnotationCrop)(
                    (0, runtime.uploadedVideoAnnotation)(source, value),
                    value.crop,
                  )
                : source;
            let value2: Dynamic = (0, runtime.updateAnnotationCss)(
              source,
              mergeChangedArtboardSettings(
                source.css,
                step.from,
                step.to,
                value,
              ),
            );
            return step.cropFrom !== undefined
              ? callback(
                  value2,
                  direction === "undo" ? step.cropFrom : undefined,
                )
              : value2;
          },
        ),
      };
    }
    if (step.kind === "ann-crop") {
      let value: Dynamic =
          step.cssFrom !== undefined || step.cssTo !== undefined,
        value2: Dynamic = direction === "undo" ? step.geomFrom : step.geomTo;
      return {
        ...manifest,
        annotations: (manifest.annotations ?? []).map(
          (source?: Dynamic): Dynamic =>
            source.id === step.id && source.kind === "image"
              ? (0, runtime.updateAnnotationCrop)(
                  {
                    ...(value
                      ? (0, runtime.updateAnnotationCss)(
                          source,
                          mergeChangedArtboardSettings(
                            source.css,
                            step.cssFrom,
                            step.cssTo,
                            direction === "undo" ? step.cssFrom : step.cssTo,
                          ),
                        )
                      : source),
                    ...pickObjectKeys(
                      value2,
                      changedObjectKeys(step.geomFrom, step.geomTo),
                    ),
                  },
                  direction === "undo" ? step.from : step.to,
                )
              : source,
        ),
      };
    }
    if (step.kind === "radius")
      return (0, runtime.updateArtboardRadius)(
        manifest,
        step.file,
        direction === "undo" ? step.from : step.to,
      );
    if (step.kind === "order") {
      let entries: Dynamic = new Map(
          (direction === "undo" ? step.from : step.to).map(
            (input?: Dynamic, options?: Dynamic): Dynamic => [input, options],
          ),
        ),
        entries2: Dynamic = new Map();
      manifest.artboards.forEach(
        (input?: Dynamic, options?: Dynamic): Dynamic => {
          entries.has(input.file) &&
            entries2.set((0, runtime.designPageId)(input, manifest.pages), [
              ...(entries2.get(
                (0, runtime.designPageId)(input, manifest.pages),
              ) ?? []),
              options,
            ]);
        },
      );
      let items: Dynamic = [...manifest.artboards];
      for (let value of entries2.values() as Dynamic) {
        let value2: Dynamic = value
          .map((input?: Dynamic): Dynamic => manifest.artboards[input])
          .sort(
            (input?: Dynamic, options?: Dynamic): Dynamic =>
              entries.get(input.file) - entries.get(options.file),
          );
        value.forEach(
          (input?: Dynamic, options?: Dynamic): Dynamic =>
            (items[input] = value2[options]),
        );
      }
      return items.every(
        (input?: Dynamic, options?: Dynamic): Dynamic =>
          input === manifest.artboards[options],
      )
        ? "nothing"
        : {
            ...manifest,
            artboards: items,
          };
    }
    throw new Error(
      "this kind of step cannot be undone or redone: " + String(step.kind),
    );
  }
  function mergeMissingCanvasManifestMetadata(
    manifest?: Dynamic,
    previous?: Dynamic,
  ): Dynamic {
    let value: Dynamic =
      "launch" in manifest || previous.launch === undefined
        ? manifest
        : {
            ...manifest,
            launch: previous.launch,
          };
    !("annotations" in value) &&
      previous.annotations !== undefined &&
      (value = {
        ...value,
        annotations: previous.annotations,
      });
    !("pages" in value) &&
      previous.pages !== undefined &&
      (value = {
        ...value,
        pages: previous.pages,
      });
    !("migrated" in value) &&
      previous.migrated === true &&
      (value = {
        ...value,
        migrated: true,
      });
    !("cover" in value) &&
      previous.cover !== undefined &&
      (value = {
        ...value,
        cover: previous.cover,
      });
    "cover" in value &&
      (0, runtime.validCoverArtboard)(value.cover, value.artboards) ===
        undefined &&
      ((value = {
        ...value,
      }),
      delete value.cover);
    return value;
  }
  function repairCanvasLaunchAfterDeletion(
    manifest?: Dynamic,
    deletedFiles?: Dynamic,
    deletedPageId?: Dynamic,
  ): Dynamic {
    let value: Dynamic = (0, runtime.normalizeDesignLaunch)(
      manifest.launch,
      manifest.artboards,
      manifest.pages,
    );
    if (value === undefined) return;
    let value2: Dynamic = (0, runtime.normalizeDesignLaunch)(
      value,
      manifest.artboards.filter(
        (input?: Dynamic): Dynamic => !deletedFiles.has(input.file),
      ),
      deletedPageId !== undefined
        ? (manifest.pages ?? []).filter(
            (input?: Dynamic): Dynamic => input.id !== deletedPageId,
          )
        : manifest.pages,
    );
    return canvasLaunchViewKey(value) === canvasLaunchViewKey(value2)
      ? undefined
      : value;
  }
  function canvasHistoryAnnouncementMode(
    direction?: Dynamic,
    fromPartner?: Dynamic,
    silent?: Dynamic,
  ): Dynamic {
    return silent
      ? "silent"
      : direction === "redo" && fromPartner
        ? "partner"
        : "say";
  }
  function compatibleRestoredCanvasLaunch(
    launch?: Dynamic,
    previous?: Dynamic,
  ): Dynamic {
    return launch === undefined ||
      previous === undefined ||
      (launch.view === "canvas" &&
        previous.view === "canvas" &&
        previous.page === undefined)
      ? launch
      : undefined;
  }
  function reconcileCanvasManifestHistory(
    manifest?: Dynamic,
    before?: Dynamic,
    after?: Dynamic,
  ): Dynamic {
    let callback: Dynamic = (
        input: Dynamic = [],
        options: Dynamic = [],
        context: Dynamic = [],
        value4?: Dynamic,
        extra: Dynamic = 1 / 0,
      ): Dynamic => {
        if ((0, runtime.structurallyEqual)(input, options)) return [...context];
        let entries: Dynamic = new Map(
            options.map(
              (input2?: Dynamic): Dynamic => [value4(input2), input2],
            ),
          ),
          entries2: Dynamic = new Map(
            context.map(
              (input2?: Dynamic): Dynamic => [value4(input2), input2],
            ),
          ),
          values: Dynamic = new Set(input.map(value4)),
          value5: Dynamic = input.flatMap((input2?: Dynamic): Dynamic => {
            let [items, items2]: Dynamic = [
              entries.get(value4(input2)),
              entries2.get(value4(input2)),
            ];
            return items === undefined
              ? [input2]
              : items2 === undefined
                ? []
                : [
                    (0, runtime.structurallyEqual)(input2, items)
                      ? items2
                      : input2,
                  ];
          }),
          value6: Dynamic = context
            .filter(
              (input2?: Dynamic): Dynamic =>
                !entries.has(value4(input2)) && !values.has(value4(input2)),
            )
            .slice(0, Math.max(0, extra - value5.length));
        return [...value5, ...value6];
      },
      value: Dynamic = callback(
        manifest.artboards,
        before.artboards,
        after.artboards,
        (input?: Dynamic): Dynamic => input.file,
      ),
      value2: Dynamic = callback(
        manifest.annotations,
        before.annotations,
        after.annotations,
        (input?: Dynamic): Dynamic => input.id,
        runtime.PlatformFileContentLimit_5,
      ),
      value3: Dynamic = callback(
        manifest.pages,
        before.pages,
        after.pages,
        (input?: Dynamic): Dynamic => input.id,
        (0, runtime.maxDesignPages)(),
      ),
      callback2: Dynamic = (input?: Dynamic): Dynamic =>
        (0, runtime.structurallyEqual)(
          manifest[input] ?? null,
          before[input] ?? null,
        )
          ? after[input]
          : manifest[input],
      state: Dynamic = {
        artboards: value,
        annotations: value2.length > 0 ? value2 : undefined,
        pages: value3.length > 0 ? value3 : undefined,
        launch: callback2("launch"),
        cover:
          (0, runtime.validCoverArtboard)(callback2("cover"), value) ??
          (0, runtime.validCoverArtboard)(after.cover, value),
        migrated:
          manifest.migrated === true || after.migrated === true
            ? true
            : undefined,
      };
    return Object.fromEntries(
      Object.entries(state).filter(
        ([, input]: Dynamic): Dynamic => input !== undefined,
      ),
    );
  }
  bindRuntimeValue(
    runtime,
    "defaultCanvasPage",
    () => defaultCanvasPage,
    (value) => {
      defaultCanvasPage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "omitDefaultCanvasPage",
    () => omitDefaultCanvasPage,
    (value) => {
      omitDefaultCanvasPage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "applyCanvasPageHistory",
    () => applyCanvasPageHistory,
  );
  bindRuntimeValue(runtime, "updateArtboardGuides", () => updateArtboardGuides);
  bindRuntimeValue(
    runtime,
    "changedObjectKeys",
    () => changedObjectKeys,
    (value) => {
      changedObjectKeys = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "pickObjectKeys",
    () => pickObjectKeys,
    (value) => {
      pickObjectKeys = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "mergeChangedArtboardSettings",
    () => mergeChangedArtboardSettings,
  );
  bindRuntimeValue(
    runtime,
    "artboardOrderHistoryStep",
    () => artboardOrderHistoryStep,
  );
  bindRuntimeValue(
    runtime,
    "filterSettingHistoryStep",
    () => filterSettingHistoryStep,
  );
  bindRuntimeValue(
    runtime,
    "applyCanvasManifestHistory",
    () => applyCanvasManifestHistory,
  );
  bindRuntimeValue(
    runtime,
    "mergeMissingCanvasManifestMetadata",
    () => mergeMissingCanvasManifestMetadata,
  );
  bindRuntimeValue(
    runtime,
    "canvasLaunchViewKey",
    () => canvasLaunchViewKey,
    (value) => {
      canvasLaunchViewKey = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "repairCanvasLaunchAfterDeletion",
    () => repairCanvasLaunchAfterDeletion,
  );
  bindRuntimeValue(
    runtime,
    "canvasHistoryAnnouncementMode",
    () => canvasHistoryAnnouncementMode,
  );
  bindRuntimeValue(
    runtime,
    "compatibleRestoredCanvasLaunch",
    () => compatibleRestoredCanvasLaunch,
  );
  bindRuntimeValue(
    runtime,
    "reconcileCanvasManifestHistory",
    () => reconcileCanvasManifestHistory,
  );
  return () => {
    defaultCanvasPage = Object.freeze({
      id: "page-1",
      name: "Page 1",
    });
    omitDefaultCanvasPage = (items?: Dynamic, options?: Dynamic): Dynamic =>
      options !== undefined &&
      items.length === 1 &&
      items[0].id === options.id &&
      items[0].name === options.name
        ? undefined
        : items;
    changedObjectKeys = (input?: Dynamic, options?: Dynamic): Dynamic =>
      [
        ...new Set([
          ...Object.keys(input ?? {}),
          ...Object.keys(options ?? {}),
        ]),
      ].filter(
        (input2?: Dynamic): Dynamic => input?.[input2] !== options?.[input2],
      );
    pickObjectKeys = (input?: Dynamic, options?: Dynamic): Dynamic =>
      Object.fromEntries(
        options.map((input2?: Dynamic): Dynamic => [input2, input?.[input2]]),
      );
    canvasLaunchViewKey = (input?: Dynamic): Dynamic =>
      input === undefined
        ? ""
        : input.view === "focused"
          ? "f:" + input.file
          : "c:" + (input.page ?? "");
  };
}
