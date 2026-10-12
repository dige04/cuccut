import type * as React from "react";
import type * as Editor from "../contracts/editor-runtime";
import type * as Model from "../contracts";
import type * as Application from "../contracts/application";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installEditorAssetContextMenu(
  runtime: RuntimeBindings,
): () => void {
  var jsxAssetActions: typeof import("react/jsx-runtime");
  var NEW_ASSET_GROUP_SENTINEL: symbol;
  var SINGLE_FILE_ACTION_REASON: string;
  var assetActionDisabledProps: (reason: string | undefined) => {
    disabled: boolean;
    disabledReason: string | null;
  };
  function AssetContextMenu({
    at: at2,
    anchor: anchor,
    onClose: onClose,
    items: items,
    groups: groups,
    onOpen: onOpen,
    onDownload: onDownload,
    edit: edit,
  }: Editor.AssetContextMenuProps): React.ReactElement {
    let value = items.length === 1 ? items[0] : undefined,
      value2: string | undefined =
        value === undefined ? SINGLE_FILE_ACTION_REASON : undefined,
      value3 = (0, runtime.useDownloadsWithheld)(),
      value4 =
        value2 ??
        (value !== undefined
          ? (0, runtime.assetDownloadBlockedReason)(value, value3)
          : undefined),
      length = items.length,
      value5 = runtime.assetGroupDisplayName,
      value6 = value !== undefined ? value.name : String(length) + " files";
    return (
      <runtime.ContextMenu
        at={items.length > 0 ? at2 : null}
        anchor={anchor}
        onClose={onClose}
        title={value6}
        className={"min-w-[12rem]"}
      >
        {[
          <runtime.Menu.Item
            icon={"Expand"}
            {...assetActionDisabledProps(value2)}
            onClick={() => value !== undefined && onOpen(value)}
            data-testid={"ds-amenu-open"}
          >
            {"Open"}
          </runtime.Menu.Item>,
          edit !== undefined ? (
            <runtime.Menu.Item
              icon={"Edit"}
              {...assetActionDisabledProps(value2)}
              onClick={() => value !== undefined && edit.rename(value)}
              data-testid={"ds-amenu-rename"}
            >
              {"Rename…"}
            </runtime.Menu.Item>
          ) : null,
          <runtime.Menu.Item
            icon={"Download"}
            {...assetActionDisabledProps(value4)}
            onClick={() => value !== undefined && onDownload(value)}
            data-testid={"ds-amenu-download"}
          >
            {"Download"}
          </runtime.Menu.Item>,
          edit !== undefined ? (
            <jsxAssetActions.Fragment>
              {[
                <runtime.Menu.Separator />,
                <runtime.Menu.Group>
                  {[
                    <runtime.Menu.GroupLabel>
                      {length > 1
                        ? "Move " + String(length) + " files to"
                        : "Move to"}
                    </runtime.Menu.GroupLabel>,
                    groups.map((input) =>
                      (() => {
                        const _Element = runtime.Menu.Item;
                        const _elementProps = {
                          icon: "Folder",
                          ...assetActionDisabledProps(
                            items.every(
                              (input2): boolean => input2.group === input.name,
                            )
                              ? (length > 1
                                  ? "They are all in "
                                  : "Already in ") + value5(input.name)
                              : undefined,
                          ),
                          onClick: () => edit.moveTo(items, input.name),
                          "data-testid": "ds-amenu-move-" + input.name,
                          children: value5(input.name),
                        };
                        const _elementKey = input.name;
                        return (
                          <_Element key={_elementKey} {..._elementProps} />
                        );
                      })(),
                    ),
                    <runtime.Menu.Item
                      icon={"FolderPlus"}
                      onClick={() =>
                        edit.moveTo(items, NEW_ASSET_GROUP_SENTINEL)
                      }
                      data-testid={"ds-amenu-move-new"}
                    >
                      {"New set…"}
                    </runtime.Menu.Item>,
                  ]}
                </runtime.Menu.Group>,
                <runtime.Menu.Separator />,
                <runtime.Menu.Item
                  icon={"Trash"}
                  variant={"danger"}
                  onClick={() => edit.remove(items)}
                  data-testid={"ds-amenu-remove"}
                >
                  {length > 1
                    ? "Remove " + String(length) + " files"
                    : "Remove"}
                </runtime.Menu.Item>,
              ]}
            </jsxAssetActions.Fragment>
          ) : null,
        ]}
      </runtime.ContextMenu>
    );
  }
  bindRuntimeValue(
    runtime,
    "jsxAssetActions",
    () => jsxAssetActions,
    (value) => {
      jsxAssetActions = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NEW_ASSET_GROUP_SENTINEL",
    () => NEW_ASSET_GROUP_SENTINEL,
    (value) => {
      NEW_ASSET_GROUP_SENTINEL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SINGLE_FILE_ACTION_REASON",
    () => SINGLE_FILE_ACTION_REASON,
    (value) => {
      SINGLE_FILE_ACTION_REASON = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "assetActionDisabledProps",
    () => assetActionDisabledProps,
    (value) => {
      assetActionDisabledProps = value;
    },
  );
  bindRuntimeValue(runtime, "AssetContextMenu", () => AssetContextMenu);
  return () => {
    jsxAssetActions = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    NEW_ASSET_GROUP_SENTINEL = Symbol("new group");
    SINGLE_FILE_ACTION_REASON = "Works on one file at a time";
    assetActionDisabledProps = (reason: string | undefined) => ({
      disabled: reason !== undefined,
      disabledReason: reason ?? null,
    });
  };
}
