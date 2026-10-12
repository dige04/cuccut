import type * as React from "react";
import type * as Editor from "../contracts/editor-runtime";
import type * as Model from "../contracts";
import type * as Application from "../contracts/application";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installEditorAssetGroupEditor(
  runtime: RuntimeBindings,
): () => void {
  var jsxAssetGroupEditor: typeof import("react/jsx-runtime");
  var NEW_ASSET_GROUP_PLACEHOLDER: string;
  function validateAssetGroupName(
    name: string,
    currentName: string,
    taken: string[],
  ): string | null {
    if (/[/\\]/.test(name)) {
      return "Set names can’t contain slashes. Use a name without / or \\.";
    }
    if (name.length > runtime.MAX_ASSET_GROUP_NAME_LENGTH) {
      return (
        "That name is too long. Keep it under " +
        String(runtime.MAX_ASSET_GROUP_NAME_LENGTH) +
        " characters."
      );
    }
    if (
      !(0, runtime.isAssetGroupName)(name) ||
      !(0, runtime.isValidDesignSystemPath)("assets/" + name + "/x")
    ) {
      return "Set names can’t contain hidden or special characters. Type it with plain letters, numbers and spaces.";
    }
    if (
      name === "." ||
      name === ".." ||
      runtime.RESERVED_PROTOTYPE_NAMES.has(name) ||
      name === runtime.UNGROUPED_ASSETS_NAME ||
      name === runtime.ASSETS_SECTION_LABEL
    ) {
      return "“" + name + "” is reserved. Pick another name.";
    }
    if (name !== currentName && taken.includes(name)) {
      return (
        "There is already a set called “" +
        name +
        "”. Pick another name, or drag these files onto it."
      );
    }
    return null;
  }
  function nextAssetGroupName(names: string[]): string {
    let name: string = "Set";
    for (let count: number = 2; names.includes(name); count++) {
      name = "Set " + String(count);
    }
    return name;
  }
  function assetFileCountLabel(count: number): string {
    if (count === 1) {
      return "1 file";
    } else {
      return String(count) + " files";
    }
  }
  function useAssetGroupEditor(
    options: Editor.AssetGroupEditorOptions,
  ): Editor.AssetGroupEditorResult {
    let { groups: value, edit: value2, scroller: value3 } = options,
      ref = (runtime.reactAssetGroupEditor as typeof React).useRef(options);
    ref.current = options;
    let value4 = runtime.assetGroupDisplayName,
      value5 = (0, runtime.useCoarsePointer)(),
      memo = (runtime.reactAssetGroupEditor as typeof React).useMemo(
        () =>
          value.flatMap((input) => input.assets.map((input2) => input2.path)),
        [value],
      ),
      memo2 = (runtime.reactAssetGroupEditor as typeof React).useMemo<
        Map<string, Application.EditorAsset>
      >(
        () =>
          new Map(
            value.flatMap((input) =>
              input.assets.map((input2) => [input2.path, input2]),
            ),
          ),
        [value],
      ),
      [value6, value7] = (
        runtime.reactAssetGroupEditor as typeof React
      ).useState<string | null>(null),
      [value8, value9] = (
        runtime.reactAssetGroupEditor as typeof React
      ).useState<string | null>(null),
      ref2 = (
        runtime.reactAssetGroupEditor as typeof React
      ).useRef<Editor.AssetGridInteractions | null>(null),
      callback = () => ({
        nameOf: (input: string) =>
          memo2.get(input)?.name ?? input.slice(input.lastIndexOf("/") + 1),
        ask: (input: Omit<Application.ConfirmationState, "confirmLabel">) =>
          ref.current.askRemove(input),
      }),
      callback2 = (runtime.reactAssetGroupEditor as typeof React).useCallback(
        (items: string[], source: Model.AssetDropTarget): void => {
          if (value2 === undefined || items.length === 0) {
            return;
          }
          let groups = ref.current.groups,
            value13: boolean = source.kind === "new",
            value14 = value13
              ? nextAssetGroupName(groups.map((input) => input.name))
              : (
                  source as Exclude<
                    Model.AssetDropTarget,
                    {
                      kind: "new";
                    }
                  >
                ).group,
            value15 =
              source.kind === "slot"
                ? source.before
                : source.kind === "group"
                  ? null
                  : undefined,
            values = new Set(items.map((input) => memo2.get(input)?.group)),
            value16 = !value13 && values.size === 1 && values.has(value14),
            callback5 = (input: Model.DesignSystemContent) =>
              (0, runtime.moveAssetsToGroup)(input, items, value14, value15);
          (0, runtime.performDesignSystemEdit)(
            value2,
            callback5,
            (): boolean => {
              let files = value2.content().files;
              if (
                !value2.exec(
                  (value16 ? "reorder " : "move ") +
                    assetFileCountLabel(items.length) +
                    " to " +
                    value14,
                  callback5,
                )
              ) {
                return false;
              }
              let value17: string =
                  value14 === runtime.UNGROUPED_ASSETS_NAME
                    ? "assets/"
                    : "assets/" + value14 + "/",
                files2 = value2.content().files,
                items2 = [
                  ...items.filter((input) => Object.hasOwn(files2, input)),
                  ...Object.keys(files2).filter(
                    (input) =>
                      !Object.hasOwn(files, input) &&
                      input.startsWith(value17) &&
                      !input.slice(value17.length).includes("/"),
                  ),
                ];
              ref2.current?.selection.set(items2);
              if (value13) {
                value7(value14);
                ref.current.reveal({
                  kind: "assets",
                  key: value14,
                });
              } else {
                ref2.current?.focus(items2[0] ?? null);
              }
              let length = items.filter(
                (input) =>
                  Object.hasOwn(files2, input) &&
                  memo2.get(input)?.group !== value14,
              ).length;
              if (length > 0) {
                (0, runtime.showEditorNotification)(
                  assetFileCountLabel(length) + " couldn’t be moved",
                );
              }
              return true;
            },
            callback(),
          );
        },
        [value2, memo2],
      ),
      callback3 = (runtime.reactAssetGroupEditor as typeof React).useCallback(
        (items: string[]): void => {
          if (value2 === undefined || items.length === 0) {
            return;
          }
          let value13 = items.filter(
            (input: string): boolean =>
              (0, runtime.remoteTextEntry)(input) !== undefined,
          );
          if (value13.length > 0) {
            (0, runtime.showEditorNotification)(
              (value13.length === 1
                ? (memo2.get(value13[0])?.name ?? "1 file") + " is"
                : assetFileCountLabel(value13.length) + " are") +
                " kept in this system’s store as code — remove " +
                (value13.length === 1 ? "it" : "them") +
                // CucCut: user-facing copy calls the agent "the agent", not Claude.
                " with the agent for now",
            );
            items = items.filter(
              (input: string): boolean =>
                (0, runtime.remoteTextEntry)(input) === undefined,
            );
            if (items.length === 0) {
              return;
            }
          }
          let callback5 = (): void => {
            let values = new Set(items),
              value14 = memo.indexOf(items[0]),
              value15 =
                memo
                  .slice(value14 + 1)
                  .find((input: string): boolean => !values.has(input)) ??
                memo
                  .slice(0, Math.max(0, value14))
                  .reverse()
                  .find((input: string): boolean => !values.has(input)) ??
                null,
              callback6 = (input: Model.DesignSystemContent) =>
                (0, runtime.deleteAssetFiles)(input, items);
            (0, runtime.performDesignSystemEdit)(
              value2,
              callback6,
              (input?: { withoutBytes: string[] }): boolean => {
                if (
                  !value2.exec(
                    "remove " + assetFileCountLabel(items.length),
                    callback6,
                    input,
                  )
                ) {
                  return false;
                }
                let value16: string =
                    "Removed " +
                    (items.length === 1
                      ? (memo2.get(items[0])?.name ?? "1 file")
                      : assetFileCountLabel(items.length)),
                  length = value2.lastNotUndoable().length;
                if (length === 0) {
                  ref.current.removed(value16);
                } else if (length >= items.length) {
                  (0, runtime.showEditorNotification)(
                    value16 + ". This cannot be undone.",
                  );
                } else {
                  ref.current.removed(
                    value16 +
                      ". Undo brings back all but " +
                      assetFileCountLabel(length) +
                      ".",
                  );
                }
                ref2.current?.focus(value15);
                return true;
              },
              callback(),
              "removal",
            );
          };
          if (items.length === 1) {
            callback5();
          } else {
            ref.current.askRemove({
              title: "Remove " + assetFileCountLabel(items.length) + "?",
              body: "The files are deleted from assets/. Anything linking to them will break. Undo brings them back.",
              run: callback5,
            });
          }
        },
        [value2, memo2, memo],
      ),
      value10 = (0, runtime.useAssetGridInteractions)({
        order: memo,
        editable: value2 !== undefined,
        coarse: value5,
        scroller: value3,
        onOpen: (input: string) => ref.current.openAsset(input),
        onDrop: callback2,
        onRemove: callback3,
      });
    ref2.current = value10;
    let callback4 = (
        input: Application.EditorAsset[],
        options2: string | symbol,
      ) =>
        callback2(
          input.map((input2) => input2.path),
          options2 === runtime.NEW_ASSET_GROUP_SENTINEL
            ? {
                kind: "new",
              }
            : {
                kind: "group",
                group: options2 as string,
              },
        ),
      value11 =
        value10.menu === null
          ? []
          : value10.menu.paths.flatMap((input: string) => {
              let entry = memo2.get(input);
              if (entry !== undefined) {
                return [entry];
              } else {
                return [];
              }
            }),
      value12 = (
        <runtime.AssetContextMenu
          at={value10.menu}
          anchor={value10.menu?.anchor}
          onClose={value10.closeMenu}
          items={value11}
          groups={value}
          onOpen={(input: Application.EditorAsset) =>
            ref.current.openAsset(input.path)
          }
          onDownload={(input: Application.EditorAsset) =>
            ref.current.downloadAsset(input)
          }
          edit={
            value2 === undefined
              ? undefined
              : {
                  rename: (input: Application.EditorAsset): void => {
                    value9(input.path);
                    ref.current.openAsset(input.path);
                  },
                  moveTo: callback4,
                  remove: (input: Application.EditorAsset[]) =>
                    callback3(input.map((input2) => input2.path)),
                }
          }
        />
      );
    return {
      tiles: value10,
      headFor: (input: Application.EditorAssetGroup) =>
        value2 === undefined
          ? {}
          : {
              onRename: (input2: string): void => {
                let value13 = input2.replace(/\s+/g, " ").trim();
                if (value13 === "" || value13 === input.name) {
                  return;
                }
                let items = [
                    ...new Set(
                      Object.keys(ref.current.files()).flatMap(
                        (input3) =>
                          (0, runtime.parseAssetGroupPath)(input3)?.group ?? [],
                      ),
                    ),
                  ],
                  value14 = validateAssetGroupName(value13, input.name, items);
                if (value14 !== null) {
                  (0, runtime.showEditorNotification)(value14);
                  return;
                }
                let callback5 = (input3: Model.DesignSystemContent) =>
                  (0, runtime.renameAssetGroup)(input3, input.name, value13);
                (0, runtime.performDesignSystemEdit)(
                  value2,
                  callback5,
                  (): boolean => {
                    if (!value2.exec("rename group " + input.name, callback5)) {
                      (0, runtime.showEditorNotification)(
                        "Could not rename " +
                          value4(input.name) +
                          " to “" +
                          value13 +
                          "”. Try a different name.",
                      );
                      return false;
                    }
                    let callback6 = (input3: string) =>
                        input3.startsWith(input.folder) &&
                        (input.name !== runtime.UNGROUPED_ASSETS_NAME ||
                          !input3.slice(input.folder.length).includes("/"))
                          ? "assets/" +
                            value13 +
                            "/" +
                            input3.slice(input.folder.length)
                          : input3,
                      current = ref2.current;
                    if (current !== undefined && current !== null) {
                      if (
                        current.selection.selected.some(
                          (input3): boolean => callback6(input3) !== input3,
                        )
                      ) {
                        current.selection.set(
                          current.selection.selected.map(callback6),
                        );
                      }
                      let value15 = input.assets[0]?.path;
                      if (value15 !== undefined) {
                        current.focus(callback6(value15));
                      }
                    }
                    if (value6 === input.name) {
                      value7(null);
                    }
                    return true;
                  },
                  callback(),
                );
              },
              onRemove: (): void => {
                let value13 = (0, runtime.assetGroupFilePaths)(
                    ref.current.files(),
                    input.name,
                  ),
                  value14 = value13.filter(
                    (input2: string): boolean =>
                      (0, runtime.remoteTextEntry)(input2) !== undefined,
                  ),
                  value15 = value13.filter(
                    (input2: string): boolean =>
                      (0, runtime.remoteTextEntry)(input2) === undefined,
                  );
                if (value14.length > 0 && value15.length === 0) {
                  (0, runtime.showEditorNotification)(
                    assetFileCountLabel(value14.length) +
                      " in " +
                      value4(input.name) +
                      " " +
                      (value14.length === 1 ? "is" : "are") +
                      " kept in this system’s store as code — remove " +
                      (value14.length === 1 ? "it" : "them") +
                      // CucCut: user-facing copy calls the agent "the agent", not Claude.
                      " with the agent for now",
                  );
                  return;
                }
                ref.current.askRemove({
                  title:
                    "Remove " +
                    value4(input.name) +
                    " and its " +
                    assetFileCountLabel(value15.length) +
                    "?",
                  body:
                    "The files are deleted from " +
                    input.folder +
                    ". Anything linking to them will break. Undo brings them back.",
                  run: (): void => {
                    let value16 = memo.indexOf(input.assets[0]?.path ?? ""),
                      value17 =
                        memo
                          .slice(value16 + input.assets.length)
                          .find((): boolean => true) ??
                        (value16 > 0 ? memo[value16 - 1] : null) ??
                        null,
                      callback5 = (input2: Model.DesignSystemContent) =>
                        (0, runtime.deleteAssetFiles)(
                          input2,
                          (0, runtime.assetGroupFilePaths)(
                            input2.files,
                            input.name,
                          ).filter(
                            (input3: string): boolean =>
                              (0, runtime.remoteTextEntry)(input3) ===
                              undefined,
                          ),
                        );
                    (0, runtime.performDesignSystemEdit)(
                      value2,
                      callback5,
                      (input2?: { withoutBytes: string[] }): boolean => {
                        if (
                          !value2.exec(
                            "remove group " + input.name,
                            callback5,
                            input2,
                          )
                        ) {
                          return false;
                        }
                        let value18: string =
                            "Removed " +
                            value4(input.name) +
                            " and its " +
                            assetFileCountLabel(value15.length) +
                            (value14.length > 0
                              ? " (" +
                                assetFileCountLabel(value14.length) +
                                // CucCut: user-facing copy calls the agent "the agent", not Claude.
                                " of stored code kept — remove with the agent)"
                              : ""),
                          length = value2.lastNotUndoable().length;
                        if (length === 0) {
                          ref.current.removed(value18);
                        } else if (length >= value15.length) {
                          (0, runtime.showEditorNotification)(
                            value18 + ". This cannot be undone.",
                          );
                        } else {
                          ref.current.removed(
                            value18 +
                              ". Undo brings back all but " +
                              assetFileCountLabel(length) +
                              ".",
                          );
                        }
                        ref2.current?.focus(value17);
                        return true;
                      },
                      callback(),
                      "removal",
                    );
                  },
                });
              },
              autoEdit:
                value6 === input.name
                  ? {
                      placeholder: NEW_ASSET_GROUP_PLACEHOLDER,
                      onEnd: () => value7(null),
                    }
                  : undefined,
            },
      overlay: value12,
      renaming: value8,
      clearRenaming: () => value9(null),
      nameGroup: (input: string): void => {
        value7(input);
        ref.current.reveal({
          kind: "assets",
          key: input,
        });
      },
      remove: callback3,
    };
  }
  bindRuntimeValue(
    runtime,
    "jsxAssetGroupEditor",
    () => jsxAssetGroupEditor,
    (value) => {
      jsxAssetGroupEditor = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NEW_ASSET_GROUP_PLACEHOLDER",
    () => NEW_ASSET_GROUP_PLACEHOLDER,
    (value) => {
      NEW_ASSET_GROUP_PLACEHOLDER = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "validateAssetGroupName",
    () => validateAssetGroupName,
  );
  bindRuntimeValue(runtime, "nextAssetGroupName", () => nextAssetGroupName);
  bindRuntimeValue(runtime, "assetFileCountLabel", () => assetFileCountLabel);
  bindRuntimeValue(runtime, "useAssetGroupEditor", () => useAssetGroupEditor);
  return () => {
    jsxAssetGroupEditor = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    NEW_ASSET_GROUP_PLACEHOLDER = "Name this set";
  };
}
