import type * as React from "react";
import type * as Editor from "../contracts/editor-runtime";
import type * as Model from "../contracts";
import type * as Application from "../contracts/application";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installEditorAssetGroups(runtime: RuntimeBindings): () => void {
  var jsxAssetGroups: typeof import("react/jsx-runtime");
  var ASSET_SELECTION_CLASS_NAME: string;
  var assetFileSizeLabel: (bytes: number | undefined) => string;
  var MIN_ASSET_TILE_SIZE: number;
  var EMPTY_ASSET_SELECTION_SET: ReadonlySet<string>;
  var stopAssetInputKeyPropagation: (
    event: React.SyntheticEvent<HTMLElement>,
  ) => void;
  function isReversedLogoAsset(asset: Pick<Application.EditorAsset,"name">): boolean {
    return /\b(white|reversed?|knockout|on[- ]dark|for[- ]dark)\b/i.test(
      asset.name,
    );
  }
  function isFileIconAsset(asset: Pick<Application.EditorAsset,"kind">): boolean {
    return (0, runtime.isWallAssetKind)(asset.kind);
  }
  function assetKindLabel(asset: Pick<Application.EditorAsset,"kind"|"ext">): {
    label: string;
    icon: string;
  } {
    if (asset.kind === "font") {
      return {
        label: "Font",
        icon: "TextAa",
      };
    }
    if (asset.kind === "video") {
      return {
        label: "Video",
        icon: "Play",
      };
    }
    if (asset.kind === "audio") {
      return {
        label: "Audio",
        icon: "Voice",
      };
    }
    switch (asset.ext) {
      case "css":
      case "json":
        return {
          label: asset.ext.toUpperCase(),
          icon: "CodeBrackets",
        };
      case "js":
      case "ts":
      case "tsx":
      case "jsx":
      case "html":
        return {
          label: asset.ext.toUpperCase(),
          icon: "Code",
        };
      case "md":
      case "txt":
      case "pdf":
        return {
          label: asset.ext === "md" ? "Markdown" : asset.ext.toUpperCase(),
          icon: "BookText",
        };
      default:
        return {
          label: asset.ext !== "" ? asset.ext.toUpperCase() : "File",
          icon: "File",
        };
    }
  }
  function assetGroupRelativePath(
    asset: Application.EditorAsset,
    group: Application.EditorAssetGroup,
  ): string {
    if (
      asset.path.startsWith(group.folder) &&
      asset.path.length > group.folder.length
    ) {
      return asset.path.slice(group.folder.length);
    } else {
      return asset.name;
    }
  }
  function assetGroupRenderTiles(
    groups: Application.EditorAssetGroup[],
    drag: Editor.AssetDragView | null,
  ): Map<string, Editor.AssetTile[]> {
    let groupTiles = new Map<string, Editor.AssetTile[]>(),
      draggedIds = new Set(drag?.ids ?? []),
      assetLookup = new Map<string, Application.EditorAsset>();
    for (let value of groups) {
      for (let value2 of value.assets) {
        assetLookup.set(value2.path, value2);
      }
    }
    let dragSlots: Editor.AssetTile[] = (drag?.ids ?? []).flatMap((input) => {
        let entry = assetLookup.get(input);
        if (entry !== undefined) {
          return [
            {
              kind: "slot",
              a: entry,
            },
          ];
        } else {
          return [];
        }
      }),
      target = drag?.target ?? null;
    for (let value of groups) {
      let items: Editor.AssetTile[] = [];
      for (let value2 of value.assets) {
        if (draggedIds.has(value2.path)) {
          if (target === null) {
            items.push({
              kind: "slot",
              a: value2,
            });
          }
          continue;
        }
        if (
          target !== null &&
          target.kind === "slot" &&
          target.group === value.name &&
          target.before === value2.path
        ) {
          items.push(...dragSlots);
        }
        items.push({
          kind: "asset",
          a: value2,
        });
      }
      if (
        target !== null &&
        target.kind !== "new" &&
        target.group === value.name &&
        (target.kind === "group" ||
          target.before === null ||
          !items.some((source): boolean => source.kind === "slot"))
      ) {
        items.push(...dragSlots);
      }
      groupTiles.set(value.name, items);
    }
    return groupTiles;
  }
  function AssetGroupsList({
    groups: groups,
    renderThumb: renderThumb,
    tiles: tiles,
    onOpen: onOpen,
    footer: footer,
    headFor: headFor,
    onUpload: onUpload,
    onDropFiles: onDropFiles,
    onRename: onRename,
    reveal: reveal,
  }: Editor.AssetGroupsListProps): React.ReactElement | null {
    let memo = (runtime.reactAssetGroups as typeof React).useMemo(
        () => groups.filter((input): boolean => input.assets.length > 0),
        [groups],
      ),
      value = tiles?.drag ?? null,
      memo2 = (runtime.reactAssetGroups as typeof React).useMemo(
        () => assetGroupRenderTiles(memo, value),
        [memo, value],
      ),
      memo3 = (runtime.reactAssetGroups as typeof React).useMemo(
        () =>
          new Map(
            memo.flatMap((input) =>
              input.assets.map((input2) => [
                input2.path,
                {
                  a: input2,
                  g: input,
                },
              ]),
            ),
          ),
        [memo],
      );
    if (memo.length === 0 && footer === undefined) {
      return null;
    }
    let value2 = tiles?.focusId ?? memo[0]?.assets[0]?.path ?? null,
      value3 = value?.target ?? null,
      value4 = value !== null && tiles?.editable === true;
    return (
      <jsxAssetGroups.Fragment>
        {[
          memo.map((input, options) =>
            (() => {
              const _Element = AssetGroupGrid;
              const _elementProps = {
                group: input,
                items: memo2.get(input.name) ?? [],
                head: headFor?.(input),
                title: (0, runtime.assetGroupDisplayName)(input.name),
                renderThumb: renderThumb,
                tiles: tiles,
                tabStop: value2,
                wanted: reveal,
                onOpen: onOpen,
                onUpload: onUpload,
                onDropFiles: onDropFiles,
                onRename: onRename,
                targeted:
                  value3 !== null &&
                  value3.kind !== "new" &&
                  value3.group === input.name,
                footer: options === memo.length - 1 ? footer : undefined,
              };
              const _elementKey = input.name;
              return <_Element key={_elementKey} {..._elementProps} />;
            })(),
          ),
          value4 ? (
            <NewAssetGroupDropZone
              targeted={value3?.kind === "new"}
              count={value!.ids.length}
            />
          ) : null,
          memo.length === 0 && footer !== undefined && footer !== null ? (
            <div
              className={runtime.SECTION_CARD_CLASS_NAME}
              data-testid={"ds-assets-pane"}
            >
              <div
                className={"ds-assets-foot ds-pad py-md"}
                {...runtime.UNCOMMENTABLE_PROPS}
              >
                {footer}
              </div>
            </div>
          ) : null,
          value !== null && tiles !== undefined ? (
            <AssetDragOverlay
              drag={value}
              tiles={tiles}
              lookup={memo3}
              renderThumb={renderThumb}
            />
          ) : null,
        ]}
      </jsxAssetGroups.Fragment>
    );
  }
  function NewAssetGroupDropZone({
    targeted: targeted,
    count: count,
  }: {
    targeted: boolean;
    count: number;
  }): React.ReactElement {
    return (
      <div
        className={(0, runtime.joinClassNames)(
          "ds-newgroup flex min-h-24 items-center justify-center gap-sm rounded-card border-2 border-dashed border-app-accent/40 text-footnote text-secondary transition-colors",
          targeted && "border-app-accent bg-app-accent/5 text-accent",
        )}
        data-drop-zone={"new"}
        data-testid={"ds-newgroup-zone"}
        {...runtime.UNCOMMENTABLE_PROPS}
      >
        {[
          <runtime.KitIcon name={"FolderPlus"} size={14} />,
          <span className={"font-medium"}>{"New set"}</span>,
          targeted ? (
            <span className={"text-secondary"}>
              {["· ", String(count), " ", count === 1 ? "file" : "files"]}
            </span>
          ) : null,
        ]}
      </div>
    );
  }
  function AssetDragOverlay({
    drag: drag,
    tiles: tiles,
    lookup: lookup,
    renderThumb: renderThumb,
  }: Editor.AssetDragOverlayProps): React.ReactElement | null {
    let entry = lookup.get(drag.lead);
    if (entry === undefined) {
      return null;
    }
    let value = isFileIconAsset(entry.a),
      value2: number = value ? 64 : 28,
      value3 = drag.ids
        .filter((input): boolean => input !== drag.lead)
        .slice(0, 3)
        .map((input) => lookup.get(input))
        .filter((input): input is Editor.AssetLookup => input !== undefined);
    return (
      runtime.reactDomAssetGroups as typeof import("react-dom")
    ).createPortal(
      <div
        ref={tiles.ghostRef as React.Ref<HTMLDivElement>}
        className={"pointer-events-none fixed top-0 left-0 z-50"}
        data-testid={"ds-drag-ghost"}
        aria-hidden={"true"}
      >
        <div
          className={"absolute"}
          style={{
            left: -12,
            top: -value2 / 2,
            width: value ? value2 : undefined,
          }}
        >
          {[
            value3.map((input, options) =>
              (() => {
                const _Element2 = "div";
                const _elementProps2 = {
                  className: "ds-ghost-tile absolute opacity-80",
                  "data-tone": isReversedLogoAsset(input.a)
                    ? "dark"
                    : undefined,
                  style: {
                    width: value ? value2 : 160,
                    height: value ? value2 : 28,
                    transform:
                      "translate(" +
                      String((value3.length - options) * 6) +
                      "px," +
                      String((value3.length - options) * 6) +
                      "px)",
                  },
                  children: isFileIconAsset(input.a)
                    ? renderThumb(input.a)
                    : null,
                };
                const _elementKey2 = input.a.path;
                return <_Element2 key={_elementKey2} {..._elementProps2} />;
              })(),
            ),
            <div
              className={"ds-ghost-tile relative"}
              data-tone={isReversedLogoAsset(entry.a) ? "dark" : undefined}
              style={{
                width: value ? value2 : 160,
                height: value ? value2 : 28,
              }}
            >
              {value ? (
                renderThumb(entry.a)
              ) : (
                <span
                  className={"flex h-full items-center gap-sm px-md text-body"}
                >
                  {[
                    <runtime.KitIcon
                      name={assetKindLabel(entry.a).icon}
                      size={14}
                      className={"shrink-0 text-muted"}
                    />,
                    <span className={"truncate font-mono"}>
                      {entry.a.name}
                    </span>,
                  ]}
                </span>
              )}
            </div>,
            drag.ids.length > 1 ? (
              <span
                className={
                  "absolute -top-2 -right-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-app-accent px-1.5 text-xs font-medium text-app-accent-fg shadow-sm"
                }
                data-testid={"ds-drag-count"}
              >
                {drag.ids.length}
              </span>
            ) : null,
          ]}
        </div>
      </div>,
      document.body,
    );
  }
  function assetVisibleTileBoundary(
    tiles: Editor.AssetTile[],
    count: number,
  ): Editor.AssetTile[] {
    let visibleCount: number = 0,
      boundary: number = 0;
    while (
      boundary < tiles.length &&
      (visibleCount < count || tiles[boundary].kind === "slot")
    ) {
      if (tiles[boundary].kind === "asset") {
        visibleCount++;
      }
      boundary++;
    }
    if (boundary === tiles.length) {
      return tiles;
    } else {
      return tiles.slice(0, boundary);
    }
  }
  function useAssetGhostSlotHeights(
    root: React.RefObject<HTMLElement | null>,
    slots: boolean,
  ): void {
    let slotHeightsRef = (runtime.reactAssetGroups as typeof React).useRef(
      new Map<
        string,
        {
          left: number;
          top: number;
        }
      >(),
    );
    (runtime.reactAssetGroups as typeof React).useLayoutEffect((): void => {
      let current = root.current;
      if (current === null || !slots) {
        slotHeightsRef.current = new Map();
        return;
      }
      let value =
          typeof matchMedia === "function" &&
          matchMedia("(prefers-reduced-motion: reduce)").matches,
        entries = new Map<
          string,
          {
            left: number;
            top: number;
          }
        >();
      for (let value2 of current.querySelectorAll<HTMLElement>(
        "[data-tile-id]",
      )) {
        let value3 = value2.dataset.tileId ?? "",
          bounds = value2.getBoundingClientRect();
        entries.set(value3, {
          left: bounds.left,
          top: bounds.top,
        });
        let entry = slotHeightsRef.current.get(value3);
        if (entry === undefined || value) {
          continue;
        }
        let value4 = entry.left - bounds.left,
          value5 = entry.top - bounds.top;
        if (Math.abs(value4) < 1 && Math.abs(value5) < 1) {
          continue;
        }
        value2.style.transition = "none";
        value2.style.transform =
          "translate(" + String(value4) + "px," + String(value5) + "px)";
        requestAnimationFrame((): void => {
          value2.style.transition = "transform 150ms ease-out";
          value2.style.transform = "";
        });
      }
      slotHeightsRef.current = entries;
    });
  }
  function AssetTileThumbnail({
    a: a,
    renderThumb: renderThumb,
  }: {
    a: Editor.AssetThumbnail;
    renderThumb: Editor.AssetGroupsListProps["renderThumb"];
  }): React.ReactElement {
    if (isFileIconAsset(a)) {
      return (
        <span
          className={"ds-athumb"}
          data-tone={isReversedLogoAsset(a) ? "dark" : undefined}
        >
          {renderThumb(a)}
        </span>
      );
    }
    return (
      <span className={"ds-athumb ds-athumb-file"} aria-hidden={"true"}>
        <runtime.KitIcon
          name={assetKindLabel(a).icon}
          size={16}
          className={"text-muted"}
        />
      </span>
    );
  }
  function AssetGroupGrid({
    group: group,
    items: items,
    head: head,
    title: title,
    renderThumb: renderThumb,
    tiles: tiles,
    tabStop: tabStop,
    wanted: wanted,
    onOpen: onOpen,
    onUpload: onUpload,
    onDropFiles: onDropFiles,
    onRename: onRename,
    targeted: targeted,
    footer: footer,
  }: Editor.AssetGroupGridProps): React.ReactElement {
    (0, runtime.useAssetThumbnailSources)();
    let [value, value2] = (runtime.reactAssetGroups as typeof React).useState(
        false,
      ),
      ref = (
        runtime.reactAssetGroups as typeof React
      ).useRef<HTMLDivElement | null>(null);
    useAssetGhostSlotHeights(
      ref,
      tiles?.drag !== null && tiles?.drag !== undefined,
    );
    let callback = (runtime.reactAssetGroups as typeof React).useCallback(
        (input: File[], options: React.DragEvent<HTMLElement>): void => {
          options.stopPropagation();
          onDropFiles?.(group, options);
        },
        [onDropFiles, group],
      ),
      value3 = (0, runtime.useFileDrop)({
        disabled: onDropFiles === undefined,
        onFiles: callback,
      }),
      value4 = targeted || value3.over,
      value5 = value
        ? items
        : assetVisibleTileBoundary(items, MIN_ASSET_TILE_SIZE),
      value6 = (value ? [] : items.slice(value5.length)).some(
        (source) =>
          source.kind === "asset" &&
          (tiles?.selected.has(source.a.path) === true ||
            tabStop === source.a.path ||
            wanted === source.a.path),
      );
    (runtime.reactAssetGroups as typeof React).useLayoutEffect((): void => {
      if (value6) {
        value2(true);
      }
    }, [value6]);
    let value7 = head?.title ?? title,
      value8 = tiles !== undefined && tiles.editable,
      callback2 = (input: Application.EditorAsset) => {
        let value9: boolean = tiles?.selected.has(input.path) === true;
        return {
          role: "option",
          "aria-selected": value9,
          "aria-label": assetGroupRelativePath(input, group),
          tabIndex: tiles === undefined || tabStop === input.path ? 0 : -1,
          "data-tile-id": input.path,
          "data-tile-axis": "y",
          "data-selected": value9 ? "" : undefined,
          onPointerDown:
            tiles !== undefined
              ? (input2: React.PointerEvent<HTMLElement>) =>
                  tiles.onPointerDown(input2, input.path)
              : undefined,
          onClick:
            tiles !== undefined
              ? (input2: React.MouseEvent<HTMLElement>) =>
                  tiles.onClick(input2, input.path)
              : () => onOpen(input),
          onDoubleClick:
            tiles !== undefined
              ? () => tiles.onDoubleClick(input.path)
              : undefined,
          onContextMenu:
            tiles !== undefined
              ? (input2: React.MouseEvent<HTMLElement>) =>
                  tiles.onContextMenu(input2, input.path)
              : undefined,
          onKeyDown:
            tiles !== undefined
              ? (input2: React.KeyboardEvent<HTMLElement>) =>
                  tiles.onKeyDown(input2, input.path)
              : (input2: React.KeyboardEvent<HTMLElement>): void => {
                  if (input2.key === "Enter") {
                    onOpen(input);
                  }
                },
        };
      };
    return (
      <runtime.SectionCard
        head={{
          title: title,
          ...head,
        }}
        className={"ds-assets-sec"}
        data-testid={"ds-assets-pane-" + group.name}
        dropGroup={group.name}
        dropHandlers={value3.targetProps}
        overlay={
          value4 ? (
            <div
              className={(0, runtime.joinClassNames)(
                "pointer-events-none absolute inset-0 z-[3] rounded-card",
                value3.over
                  ? runtime.FILE_DROP_RING_CLASS
                  : ASSET_SELECTION_CLASS_NAME,
              )}
              data-testid={"ds-drop-ring"}
              aria-hidden={"true"}
            />
          ) : undefined
        }
        cardKey={"assets:" + group.name}
        anchorId={(0, runtime.commentTargetId)("agroup", group.name)}
        flat={true}
        actions={
          onUpload !== undefined ? (
            <runtime.Button
              variant={"ghost"}
              size={"sm"}
              iconOnly={true}
              icon={"Upload"}
              aria-label={"Upload file to " + value7}
              tooltip={"Upload file"}
              onClick={() => onUpload(group)}
              data-testid={"ds-assets-upload-" + group.name}
              {...runtime.UNCOMMENTABLE_PROPS}
            />
          ) : undefined
        }
      >
        <div ref={ref} className={"flex flex-col"}>
          {[
            <div
              className={"ds-atable ds-ctable"}
              role={"listbox"}
              aria-multiselectable={"true"}
              aria-label={value7 + " files"}
              data-testid={"ds-flist"}
            >
              {[
                <div
                  className={"ds-arow ds-crow ds-chead text-caption text-muted"}
                  aria-hidden={"true"}
                  {...runtime.UNCOMMENTABLE_PROPS}
                >
                  {[
                    <span>{"Name"}</span>,
                    <span>{"Preview"}</span>,
                    <span>{"Type"}</span>,
                    <span className={"ds-cgutter"} />,
                  ]}
                </div>,
                items.length === 0 && group.assets.length > 0 ? (
                  <div
                    className={"ds-arow ds-tokrow ds-crow"}
                    aria-hidden={"true"}
                  />
                ) : null,
                value5.map((source) => {
                  if (source.kind === "slot") {
                    return (() => {
                      const _Element3 = "div";
                      const _elementProps3 = {
                        className: "ds-fslot",
                        "data-drop-slot": "",
                        "data-testid": "ds-slot-" + source.a.path,
                      };
                      const _elementKey3 = "slot:" + source.a.path;
                      return (
                        <_Element3 key={_elementKey3} {..._elementProps3} />
                      );
                    })();
                  }
                  let value9 = assetKindLabel(source.a),
                    value10 = assetFileSizeLabel(
                      (source.a.bytes ?? 0) > 0 || source.a.store !== "file"
                        ? (source.a.bytes ?? 0)
                        : ((0, runtime.addressedFileEntry)(
                            (0, runtime.projectFilePath)(source.a.path),
                          )?.size ?? 0),
                    );
                  return (() => {
                    const _Element4 = "div";
                    const _elementProps4 = {
                      className:
                        "ds-arow ds-tokrow ds-crow group/row cursor-default select-none outline-none",
                      "data-testid": "ds-asset-" + source.a.path,
                      ...(0, runtime.commentTargetProps)(
                        "asset",
                        source.a.path,
                      ),
                      ...callback2(source.a),
                      children: [
                        onRename !== undefined ? (
                          <span
                            className={"ds-cname min-w-0 gap-sm font-mono"}
                            onPointerDown={stopAssetInputKeyPropagation}
                            onClick={stopAssetInputKeyPropagation}
                            onDoubleClick={stopAssetInputKeyPropagation}
                            onKeyDown={stopAssetInputKeyPropagation}
                          >
                            <runtime.EditableName
                              kind={"title"}
                              name={source.a.name}
                              taken={EMPTY_ASSET_SELECTION_SET}
                              placeholder={"File name"}
                              tabIndex={-1}
                              commit={(input: string) =>
                                input === "" ||
                                input === source.a.name ||
                                onRename(source.a, input)
                              }
                              data-testid={"ds-asset-name-" + source.a.path}
                            />
                          </span>
                        ) : (
                          <span className={"ds-cname min-w-0 gap-sm"}>
                            <span
                              className={"min-w-0 truncate font-mono"}
                              data-testid={"ds-asset-open-" + source.a.path}
                            >
                              {assetGroupRelativePath(source.a, group)}
                            </span>
                          </span>
                        ),
                        <span className={"ds-bcell ds-aprev min-w-0"}>
                          <AssetTileThumbnail
                            a={source.a}
                            renderThumb={renderThumb}
                          />
                        </span>,
                        <span
                          className={
                            "ds-bcell ds-atype min-w-0 truncate text-footnote text-muted"
                          }
                        >
                          {value9.label +
                            (value10 !== "" ? " · " + value10 : "")}
                        </span>,
                        <span
                          className={"ds-cgutter"}
                          onPointerDown={(
                            input: React.PointerEvent<HTMLElement>,
                          ) => input.stopPropagation()}
                          onClick={(input: React.MouseEvent<HTMLElement>) =>
                            input.stopPropagation()
                          }
                          {...runtime.UNCOMMENTABLE_PROPS}
                        >
                          {value8 ? (
                            <runtime.RemoveRowButton
                              label={"Remove " + source.a.name}
                              onRemove={() => tiles!.remove([source.a.path])}
                              tabIndex={-1}
                              data-testid={"ds-asset-remove-" + source.a.path}
                            />
                          ) : null}
                        </span>,
                      ],
                    };
                    const _elementKey4 = source.a.path;
                    return <_Element4 key={_elementKey4} {..._elementProps4} />;
                  })();
                }),
              ]}
            </div>,
            items.length > value5.length ? (
              <runtime.TextLink
                className={"ds-apad mt-sm w-fit text-footnote"}
                onClick={() => value2(true)}
                data-testid={"ds-wall-all"}
                {...runtime.UNCOMMENTABLE_PROPS}
              >
                {["Show all ", String(group.assets.length), " files"]}
              </runtime.TextLink>
            ) : null,
            footer !== undefined && footer !== null ? (
              <div
                className={"ds-assets-foot ds-apad pt-md"}
                {...runtime.UNCOMMENTABLE_PROPS}
              >
                {footer}
              </div>
            ) : null,
          ]}
        </div>
      </runtime.SectionCard>
    );
  }
  bindRuntimeValue(
    runtime,
    "jsxAssetGroups",
    () => jsxAssetGroups,
    (value) => {
      jsxAssetGroups = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ASSET_SELECTION_CLASS_NAME",
    () => ASSET_SELECTION_CLASS_NAME,
    (value) => {
      ASSET_SELECTION_CLASS_NAME = value;
    },
  );
  bindRuntimeValue(runtime, "isReversedLogoAsset", () => isReversedLogoAsset);
  bindRuntimeValue(runtime, "isFileIconAsset", () => isFileIconAsset);
  bindRuntimeValue(runtime, "assetKindLabel", () => assetKindLabel);
  bindRuntimeValue(
    runtime,
    "assetGroupRelativePath",
    () => assetGroupRelativePath,
  );
  bindRuntimeValue(
    runtime,
    "assetFileSizeLabel",
    () => assetFileSizeLabel,
    (value) => {
      assetFileSizeLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MIN_ASSET_TILE_SIZE",
    () => MIN_ASSET_TILE_SIZE,
    (value) => {
      MIN_ASSET_TILE_SIZE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "assetGroupRenderTiles",
    () => assetGroupRenderTiles,
  );
  bindRuntimeValue(runtime, "AssetGroupsList", () => AssetGroupsList);
  bindRuntimeValue(
    runtime,
    "NewAssetGroupDropZone",
    () => NewAssetGroupDropZone,
  );
  bindRuntimeValue(runtime, "AssetDragOverlay", () => AssetDragOverlay);
  bindRuntimeValue(
    runtime,
    "assetVisibleTileBoundary",
    () => assetVisibleTileBoundary,
  );
  bindRuntimeValue(
    runtime,
    "useAssetGhostSlotHeights",
    () => useAssetGhostSlotHeights,
  );
  bindRuntimeValue(runtime, "AssetTileThumbnail", () => AssetTileThumbnail);
  bindRuntimeValue(
    runtime,
    "EMPTY_ASSET_SELECTION_SET",
    () => EMPTY_ASSET_SELECTION_SET,
    (value) => {
      EMPTY_ASSET_SELECTION_SET = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "stopAssetInputKeyPropagation",
    () => stopAssetInputKeyPropagation,
    (value) => {
      stopAssetInputKeyPropagation = value;
    },
  );
  bindRuntimeValue(runtime, "AssetGroupGrid", () => AssetGroupGrid);
  return () => {
    jsxAssetGroups = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    ASSET_SELECTION_CLASS_NAME = "shadow-[inset_0_0_0_2px_var(--t-app-accent)]";
    assetFileSizeLabel = (bytes: number | undefined) =>
      bytes !== undefined && bytes > 0
        ? (0, runtime.formatInlineBudgetBytes)(bytes)
        : "";
    MIN_ASSET_TILE_SIZE = 60;
    EMPTY_ASSET_SELECTION_SET = new Set();
    stopAssetInputKeyPropagation = (
      event: React.SyntheticEvent<HTMLElement>,
    ): void => {
      if (event.target instanceof HTMLInputElement) {
        event.stopPropagation();
      }
    };
  };
}
