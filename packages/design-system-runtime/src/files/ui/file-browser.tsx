/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";
import type * as React from "react";
import type {
  BrowserEntryType,
  BrowserFileType,
  BrowserEntry,
  BrowserFolder,
  BrowserFile,
  BrowserRow,
  VirtualFileItem,
  VirtualFileStack,
  FilesBrowserProps,
  BrowserBreadcrumbProps,
  BrowserHeadingProps,
  BrowserRowProps,
  BrowserIconProps,
  BrowserPreviewProps,
  BrowserPreviewCardProps,
  BrowserImagePreviewProps,
  BrowserTextPreviewProps,
  BrowserDownloadButtonProps,
  FileBrowserSource,
  FileBrowserReads,
  FileDownloadSpec,
  DownloadData,
  HttpError,
  BrowserDownloadState,
} from "../../contracts/file-browser";
export function installFilesUiFileBrowser(
  runtime: RuntimeBindings,
): () => void {
  var jsxFilesBrowser: typeof import("react/jsx-runtime");
  var FILE_BROWSER_ROW_HEIGHT: number;
  var FILE_BROWSER_SELECTED_FORCED_COLORS_CLASS: string;
  var FILE_BROWSER_SECTION_HEIGHT: number;
  var FILE_BROWSER_ROW_ICON_SIZE: number;
  var FILE_BROWSER_PREVIEW_WIDTH: number;
  var FILE_BROWSER_PREVIEW_HEIGHT: number;
  var FILE_BROWSER_OVERSCAN_PX: number;
  var FILE_BROWSER_FALLBACK_VIEWPORT_HEIGHT: number;
  var FILE_BROWSER_MOBILE_QUERY: string;
  var FILE_BROWSER_NO_HOVER_QUERY: string;
  var FILE_BROWSER_ICON_COLORS: Record<"surface" | "hover" | "line", string>;
  var encodeFilePathPart: (path: string) => string;
  var projectFileUrl: (path: string) => string;
  var fileBrowserDefaultSource: (file: BrowserFile) => FileBrowserSource;
  var fileCountLabel: (count: number, label: string) => string;
  var parentFolderPath: (path: string) => string;
  var fileBrowserEntryKey: (entry: BrowserEntry) => string;
  var fileBrowserEntryEncoder: TextEncoder;
  var fileBrowserEntryId: (path: string) => string;
  var initialFileBrowserSelection: (
    folder: BrowserFolder,
    whyNot: (entry: BrowserEntry) => string | undefined,
  ) => string | null;
  var FILE_BROWSER_ICON_GRADIENTS: Record<BrowserFileType, string>;
  var FILE_BROWSER_ICON_SHADOW: string;
  var MAX_DOWNLOAD_EXTENSION_LABEL_LENGTH: number;
  var fileDownloadMimeMatchesName: (
    name: string,
    mime: string,
    expected?: string,
  ) => boolean;
  var responseMimeType: (response: Response) => string;
  var fileFetchHttpError: (status: number) => HttpError;
  var fileFetchRetryDelays: (milliseconds: number) => number[];
  var FILE_DOWNLOAD_MAX_RETRY_MS: number;
  var FILE_BROWSER_PREVIEW_CARD_CLASS: string;
  var fileBrowserPreviewCardStyle: (
    tall: boolean | undefined,
  ) => React.CSSProperties;
  var FILE_BROWSER_LOAD_ERROR_TEXT: string;
  var FILE_BROWSER_LOADING_TEXT: string;
  function FilesBrowser({
    tree: tree,
    onClose: onClose,
    sourceOf = fileBrowserDefaultSource,
    retryMs = 0,
    fresh = false,
    downloadOf: downloadOf,
    typeOf: typeOf,
    whyNot: whyNot,
    openFile: openFile,
    preview: preview,
    htmlAsText: htmlAsText,
    kindLine: kindLine,
    tipOf: tipOf,
    footerOf: footerOf,
    rootLabel = "project",
    emptyText = "No files in this project",
    reveal: reveal,
  }: FilesBrowserProps) {
    let [folderPath, setFolderPath] = runtime.reactFilesBrowser.useState(() =>
        reveal ? parentFolderPath(reveal.path) : "",
      ),
      validFolderPath =
        (0, runtime.fileBrowserFolder)(tree, folderPath) === null
          ? ""
          : folderPath,
      folder = (0, runtime.fileBrowserFolder)(tree, validFolderPath) ?? tree,
      [expandedFolders, setExpandedFolders] =
        runtime.reactFilesBrowser.useState(new Set<string>()),
      disabledReason = (source: BrowserEntry) =>
        source.kind === "file" ? whyNot?.(source) : undefined,
      [selectedKey, setSelectedKey] = runtime.reactFilesBrowser.useState(() =>
        reveal
          ? "file:" + reveal.path
          : initialFileBrowserSelection(tree, disabledReason),
      ),
      rows = runtime.reactFilesBrowser.useMemo(
        () => (0, runtime.flattenFileBrowserTree)(folder, expandedFolders),
        [folder, expandedFolders],
      ),
      empty = rows.length === 0,
      typesByEntry = runtime.reactFilesBrowser.useMemo(
        () =>
          new Map<string, BrowserEntryType>(
            rows.map((input: BrowserRow) => [
              fileBrowserEntryKey(input.entry),
              input.entry.kind === "folder"
                ? "folder"
                : (typeOf?.(input.entry) ?? input.entry.type),
            ]),
          ),
        [rows],
      ),
      mobile = (0, runtime.useMediaQuery)(FILE_BROWSER_MOBILE_QUERY),
      [showMobilePreview, setShowMobilePreview] =
        runtime.reactFilesBrowser.useState(() => mobile && reveal != null),
      withheldDownloads = (0, runtime.useDownloadsWithheld)(),
      treeRef = runtime.reactFilesBrowser.useRef<HTMLDivElement | null>(null),
      mobileBackRef =
        runtime.reactFilesBrowser.useRef<HTMLButtonElement | null>(null),
      selectedRowIndex = rows.findIndex(
        (input: BrowserRow) => fileBrowserEntryKey(input.entry) === selectedKey,
      ),
      selectedEntry = rows[selectedRowIndex]?.entry,
      mobilePreviewVisible =
        mobile && showMobilePreview && selectedEntry?.kind === "file",
      {
        items: virtualItems,
        heights: rowHeights,
        stack: virtualStack,
        itemOfRow: virtualRowIndices,
        sections: virtualSectionIndices,
      } = runtime.reactFilesBrowser.useMemo(() => {
        let items: VirtualFileItem[] = [],
          items2: number[] = [],
          items3: number[] = [];
        rows.forEach((input: BrowserRow, options: number) => {
          if (input.section !== undefined) {
            items3.push(
              items.push({
                kind: "section",
                label: input.section,
                first: input.first === true,
              }) - 1,
            );
          }
          items2.push(items.length);
          items.push({
            kind: "row",
            row: input,
            at: options,
          });
        });
        let value = items.map((source: VirtualFileItem) =>
          source.kind === "section"
            ? FILE_BROWSER_SECTION_HEIGHT
            : FILE_BROWSER_ROW_HEIGHT,
        );
        return {
          items: items,
          heights: value,
          stack: (0, runtime.stackVirtualFileRows)(value),
          itemOfRow: items2,
          sections: items3,
        };
      }, [rows]),
      [scrollTop, setScrollTop] = runtime.reactFilesBrowser.useState(0),
      [viewportHeight, setViewportHeight] =
        runtime.reactFilesBrowser.useState(0);
    runtime.reactFilesBrowser.useLayoutEffect(() => {
      let current = treeRef.current;
      if (current === null) {
        return;
      }
      let callback = () => setViewportHeight(current.clientHeight);
      callback();
      setScrollTop(current.scrollTop);
      if (typeof ResizeObserver === "undefined") {
        return;
      }
      let observer = new ResizeObserver(callback);
      observer.observe(current);
      return () => observer.disconnect();
    }, [empty, mobilePreviewVisible]);
    let [firstVisibleItem, lastVisibleItem] = (0,
      runtime.visibleVirtualFileRows)(
        virtualStack,
        scrollTop,
        viewportHeight > 0
          ? viewportHeight
          : FILE_BROWSER_FALLBACK_VIEWPORT_HEIGHT,
        FILE_BROWSER_OVERSCAN_PX,
      ),
      visibleItemIndices: number[] = [];
    for (let value = firstVisibleItem; value < lastVisibleItem; value += 1) {
      visibleItemIndices.push(value);
    }
    let selectedVirtualItem = virtualRowIndices[selectedRowIndex];
    if (
      selectedVirtualItem !== undefined &&
      selectedVirtualItem < firstVisibleItem
    ) {
      visibleItemIndices.unshift(selectedVirtualItem);
    } else if (
      selectedVirtualItem !== undefined &&
      selectedVirtualItem >= lastVisibleItem
    ) {
      visibleItemIndices.push(selectedVirtualItem);
    }
    let pinnedSectionIndex = virtualSectionIndices
        .filter((input: number) => virtualStack.tops[input] <= scrollTop)
        .at(-1),
      pinnedSection =
        pinnedSectionIndex === undefined
          ? undefined
          : virtualItems[pinnedSectionIndex],
      scrollToRow = (input: number) => {
        let current = treeRef.current,
          value = virtualRowIndices[input];
        if (current === null || value === undefined) {
          return;
        }
        let value2 = (0, runtime.virtualFileRowScrollTop)(
          virtualStack,
          rowHeights,
          value,
          current.scrollTop,
          current.clientHeight > 0
            ? current.clientHeight
            : FILE_BROWSER_FALLBACK_VIEWPORT_HEIGHT,
          FILE_BROWSER_SECTION_HEIGHT,
        );
        current.scrollTop = value2;
        setScrollTop(current.scrollTop);
      },
      listHasMountedRef = runtime.reactFilesBrowser.useRef(false);
    runtime.reactFilesBrowser.useEffect(() => {
      let activeElement = document.activeElement,
        value =
          activeElement instanceof HTMLElement &&
          (activeElement.isContentEditable ||
            ["INPUT", "TEXTAREA", "SELECT"].includes(activeElement.tagName)),
        value2 = activeElement === null || activeElement === document.body;
      if (listHasMountedRef.current ? value2 : !value) {
        treeRef.current?.focus({
          preventScroll: true,
        });
      }
      listHasMountedRef.current = true;
    }, [empty]);
    let enterFolder = (input: string) => {
        setFolderPath(input);
        setExpandedFolders(new Set());
        setSelectedKey(
          initialFileBrowserSelection(
            (0, runtime.fileBrowserFolder)(tree, input) ?? tree,
            disabledReason,
          ),
        );
        setShowMobilePreview(false);
        if (treeRef.current !== null) {
          treeRef.current.scrollTop = 0;
        }
        setScrollTop(0);
      },
      toggleFolder = (input: string) =>
        setExpandedFolders((input2: Set<string>) => {
          let values = new Set(input2);
          if (values.has(input)) {
            values.delete(input);
          } else {
            values.add(input);
          }
          return values;
        }),
      openEntry = (source: BrowserEntry) => {
        if (source.kind === "folder") {
          return enterFolder(source.path);
        }
        if (disabledReason(source) === undefined) {
          openFile?.(source)?.();
        }
      },
      selectEntry = (source: BrowserEntry) => {
        setSelectedKey(fileBrowserEntryKey(source));
        if (!mobile) {
          return setShowMobilePreview(false);
        }
        if (
          source.kind === "folder" ||
          (disabledReason(source) === undefined &&
            openFile?.(source) !== undefined)
        ) {
          openEntry(source);
        } else {
          setShowMobilePreview(true);
        }
      },
      backToTree = () => {
        runtime.reactDomFilesBrowser.flushSync(() =>
          setShowMobilePreview(false),
        );
        treeRef.current?.focus({
          preventScroll: true,
        });
      };
    runtime.reactFilesBrowser.useEffect(() => {
      if (mobilePreviewVisible) {
        mobileBackRef.current?.focus({
          preventScroll: true,
        });
      }
    }, [mobilePreviewVisible]);
    let mobilePreviewWasVisibleRef =
      runtime.reactFilesBrowser.useRef(mobilePreviewVisible);
    runtime.reactFilesBrowser.useLayoutEffect(() => {
      let current = treeRef.current,
        value = mobilePreviewWasVisibleRef.current && !mobilePreviewVisible;
      mobilePreviewWasVisibleRef.current = mobilePreviewVisible;
      if (!value || current === null) {
        return;
      }
      if (selectedRowIndex >= 0) {
        scrollToRow(selectedRowIndex);
      } else {
        setScrollTop(current.scrollTop);
      }
    }, [mobilePreviewVisible]);
    let pendingRevealRef = runtime.reactFilesBrowser.useRef(
      reveal ? "file:" + reveal.path : null,
    );
    runtime.reactFilesBrowser.useEffect(() => {
      if (reveal === undefined || reveal === null) {
        return;
      }
      setFolderPath(parentFolderPath(reveal.path));
      setExpandedFolders(new Set());
      setSelectedKey("file:" + reveal.path);
      setShowMobilePreview(mobile);
      pendingRevealRef.current = "file:" + reveal.path;
    }, [reveal?.path, reveal?.n]);
    runtime.reactFilesBrowser.useLayoutEffect(() => {
      if (
        pendingRevealRef.current === null ||
        pendingRevealRef.current !== selectedKey
      ) {
        return;
      }
      pendingRevealRef.current = null;
      if (selectedRowIndex >= 0) {
        scrollToRow(selectedRowIndex);
      } else {
        setSelectedKey(initialFileBrowserSelection(folder, disabledReason));
      }
    });
    runtime.reactFilesBrowser.useEffect(() => {
      if (selectedRowIndex < 0 && pendingRevealRef.current === null) {
        setSelectedKey(initialFileBrowserSelection(folder, disabledReason));
      }
    }, [tree]);
    let treeId = runtime.reactFilesBrowser.useId(),
      entryDomId = (source: BrowserEntry) =>
        treeId + "-" + source.kind + "-" + fileBrowserEntryId(source.path),
      handleTreeKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.metaKey || event.ctrlKey || event.altKey) {
          return;
        }
        let callback = (input: number) => {
          let value = Math.max(0, Math.min(rows.length - 1, input)),
            value2 = rows[value];
          if (!value2) {
            return;
          }
          event.preventDefault();
          setSelectedKey(fileBrowserEntryKey(value2.entry));
          if (!mobile) {
            setShowMobilePreview(false);
          }
          scrollToRow(value);
        };
        if (event.key === "ArrowDown") {
          callback(selectedRowIndex + 1);
        } else if (event.key === "ArrowUp") {
          callback(selectedRowIndex < 0 ? 0 : selectedRowIndex - 1);
        } else if (event.key === "Home") {
          callback(0);
        } else if (event.key === "End") {
          callback(rows.length - 1);
        } else if (
          selectedEntry &&
          (event.key === "Enter" || event.key === " ")
        ) {
          if ((event.preventDefault(), mobile)) {
            selectEntry(selectedEntry);
          } else {
            openEntry(selectedEntry);
          }
        } else if (
          selectedEntry?.kind === "folder" &&
          event.key === "ArrowRight"
        ) {
          if (expandedFolders.has(selectedEntry.path)) {
            callback(selectedRowIndex + 1);
          } else {
            event.preventDefault();
            toggleFolder(selectedEntry.path);
          }
        } else if (selectedEntry && event.key === "ArrowLeft") {
          if (
            selectedEntry.kind === "folder" &&
            expandedFolders.has(selectedEntry.path)
          ) {
            event.preventDefault();
            toggleFolder(selectedEntry.path);
          } else {
            let value = rows.findIndex(
              (input: BrowserRow) =>
                input.entry.kind === "folder" &&
                input.entry.path === parentFolderPath(selectedEntry.path) &&
                input.depth === (rows[selectedRowIndex]?.depth ?? 0) - 1,
            );
            if (value >= 0) {
              callback(value);
            }
          }
        } else if (event.key === "Backspace" && validFolderPath !== "") {
          event.preventDefault();
          enterFolder(parentFolderPath(validFolderPath));
        }
      },
      handlePreviewEscape = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== "Escape" || !mobilePreviewVisible) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        backToTree();
      },
      kindText = (source: BrowserEntry) => {
        let value = typesByEntry.get(fileBrowserEntryKey(source)) ?? "other";
        if (source.kind === "folder") {
          return (
            runtime.FILE_BROWSER_KIND_LABELS.folder +
            " · " +
            fileCountLabel((0, runtime.folderFileCount)(source), "file")
          );
        }
        return (
          kindLine?.(source, runtime.FILE_BROWSER_KIND_LABELS[value]) ??
          runtime.FILE_BROWSER_KIND_LABELS[value]
        );
      },
      previewPanel =
        rows.length === 0 ? null : (
          <FileBrowserPreview
            entry={selectedEntry}
            type={
              selectedEntry
                ? (typesByEntry.get(fileBrowserEntryKey(selectedEntry)) ??
                  "other")
                : "other"
            }
            kind={selectedEntry ? kindText(selectedEntry) : ""}
            tip={
              selectedEntry?.kind === "file"
                ? tipOf?.(selectedEntry, "card")
                : undefined
            }
            whyNot={selectedEntry ? disabledReason(selectedEntry) : undefined}
            big={mobilePreviewVisible}
            withheld={withheldDownloads}
            source={
              selectedEntry?.kind === "file"
                ? sourceOf(selectedEntry)
                : undefined
            }
            reads={{
              retryMs: retryMs,
              fresh: fresh,
            }}
            htmlAsText={htmlAsText === true}
            preview={preview}
            download={
              selectedEntry?.kind === "file"
                ? downloadOf?.(selectedEntry)
                : undefined
            }
            footer={
              selectedEntry?.kind === "file"
                ? footerOf?.(selectedEntry)
                : undefined
            }
            onOpen={
              selectedEntry === undefined
                ? undefined
                : selectedEntry.kind === "folder"
                  ? () => openEntry(selectedEntry)
                  : openFile?.(selectedEntry) !== undefined
                    ? () => openEntry(selectedEntry)
                    : undefined
            }
          />
        );
    return (
      <div
        data-testid={"files-browser"}
        className={
          "flex h-full min-h-0 w-full flex-col bg-surface-2 text-primary"
        }
        onKeyDown={handlePreviewEscape}
      >
        {[
          <div
            className={
              "flex shrink-0 items-center gap-1.5 border-b bg-surface-2 px-2.5 py-1.5"
            }
          >
            {[
              mobilePreviewVisible ? (
                <runtime.Button
                  ref={mobileBackRef}
                  variant={"ghost"}
                  size={"sm"}
                  icon={"ArrowLeft"}
                  data-testid={"files-browser-back"}
                  onClick={backToTree}
                >
                  {"Files"}
                </runtime.Button>
              ) : (
                <FileBrowserBreadcrumbs
                  root={rootLabel}
                  folder={validFolderPath}
                  onEnter={enterFolder}
                />
              ),
              <span className={"flex-1"} />,
              <runtime.Tooltip
                content={"Close (Esc)"}
                side={"bottom"}
                hoverable={false}
              >
                <runtime.Button
                  variant={"ghost"}
                  size={"sm"}
                  iconOnly={true}
                  icon={"X"}
                  aria-label={"Close the file browser"}
                  data-testid={"files-browser-close"}
                  onClick={onClose}
                />
              </runtime.Tooltip>,
            ]}
          </div>,
          <div className={"flex min-h-0 flex-1"}>
            {[
              rows.length === 0
                ? (() => {
                    const _Element = "div";
                    const _elementProps = {
                      "data-testid": "files-browser-empty",
                      className:
                        "flex flex-1 items-center justify-center px-6 text-center text-[13px] text-secondary",
                      children:
                        validFolderPath === ""
                          ? emptyText
                          : "This folder is empty",
                    };
                    const _elementKey = "empty";
                    return <_Element key={_elementKey} {..._elementProps} />;
                  })()
                : (() => {
                    const _Element4 = "div";
                    const _elementProps4 = {
                      ref: treeRef,
                      role: "tree",
                      "aria-label": "Files",
                      "aria-activedescendant": selectedEntry
                        ? entryDomId(selectedEntry)
                        : undefined,
                      tabIndex: 0,
                      "data-testid": "files-browser-list",
                      className: (0, runtime.joinClassNames)(
                        "relative min-w-[200px] flex-[1_1_60%] overflow-auto outline-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-stronger focus-visible:ring-inset forced-colors:focus-visible:-outline-offset-2",
                        !mobile && "border-r",
                        mobilePreviewVisible && "hidden",
                      ),
                      onKeyDown: handleTreeKey,
                      onScroll: (input: React.UIEvent<HTMLDivElement>) =>
                        setScrollTop(input.currentTarget.scrollTop),
                      children: [
                        pinnedSection?.kind === "section" ? (
                          <div
                            role={"none"}
                            className={"sticky top-0 z-[1] h-0"}
                          >
                            <FileBrowserSectionHeading
                              label={pinnedSection.label}
                              first={true}
                              top={0}
                              pinned={true}
                            />
                          </div>
                        ) : null,
                        <div
                          role={"none"}
                          className={"relative"}
                          style={{
                            height: virtualStack.total,
                          }}
                        >
                          {visibleItemIndices.map((input: number) => {
                            let value = virtualItems[input];
                            if (value.kind === "section") {
                              return (() => {
                                const _Element2 = FileBrowserSectionHeading;
                                const _elementProps2 = {
                                  label: value.label,
                                  first: value.first,
                                  top: virtualStack.tops[input],
                                };
                                const _elementKey2 = "s:" + value.label;
                                return (
                                  <_Element2
                                    key={_elementKey2}
                                    {..._elementProps2}
                                  />
                                );
                              })();
                            } else {
                              return (() => {
                                const _Element3 = FileBrowserRow;
                                const _elementProps3 = {
                                  id: entryDomId(value.row.entry),
                                  row: value.row,
                                  top: virtualStack.tops[input],
                                  type:
                                    typesByEntry.get(
                                      fileBrowserEntryKey(value.row.entry),
                                    ) ?? "other",
                                  kind: kindText(value.row.entry),
                                  tip:
                                    value.row.entry.kind === "file"
                                      ? tipOf?.(value.row.entry, "row")
                                      : undefined,
                                  selected:
                                    fileBrowserEntryKey(value.row.entry) ===
                                    selectedKey,
                                  expanded:
                                    value.row.entry.kind === "folder" &&
                                    expandedFolders.has(value.row.entry.path),
                                  dimmed: disabledReason(value.row.entry),
                                  onSelect: () => selectEntry(value.row.entry),
                                  onOpen: () => openEntry(value.row.entry),
                                  onToggle: () =>
                                    toggleFolder(value.row.entry.path),
                                };
                                const _elementKey3 = fileBrowserEntryKey(
                                  value.row.entry,
                                );
                                return (
                                  <_Element3
                                    key={_elementKey3}
                                    {..._elementProps3}
                                  />
                                );
                              })();
                            }
                          })}
                        </div>,
                      ],
                    };
                    const _elementKey4 = "list";
                    return <_Element4 key={_elementKey4} {..._elementProps4} />;
                  })(),
              mobile && !mobilePreviewVisible ? null : previewPanel,
            ]}
          </div>,
        ]}
      </div>
    );
  }
  function FileBrowserBreadcrumbs({
    root: root,
    folder: folder,
    onEnter: onEnter,
  }: BrowserBreadcrumbProps) {
    let ref = runtime.reactFilesBrowser.useRef<HTMLElement | null>(null);
    runtime.reactFilesBrowser.useLayoutEffect(() => {
      if (ref.current !== null) {
        ref.current.scrollLeft = ref.current.scrollWidth;
      }
    }, [folder]);
    let items = [root, ...(folder === "" ? [] : folder.split("/"))];
    return (
      <nav
        ref={ref}
        aria-label={"Folder"}
        className={
          "flex min-w-0 items-center gap-0.5 overflow-x-auto p-px [scrollbar-width:none]"
        }
      >
        {items.map((input: string, options: number) => {
          let value = options === items.length - 1;
          return (() => {
            const _Element5 = runtime.reactFilesBrowser.Fragment;
            const _elementProps5 = {
              children: [
                options > 0 ? (
                  <span
                    aria-hidden={"true"}
                    className={"flex shrink-0 items-center text-disabled"}
                  >
                    <runtime.Icon name={"CaretRight"} size={"xs"} />
                  </span>
                ) : null,
                <button
                  type={"button"}
                  aria-current={value ? "location" : undefined}
                  data-testid={"files-browser-crumb"}
                  className={(0, runtime.joinClassNames)(
                    "shrink-0 whitespace-nowrap rounded-[4px] px-[5px] py-0.5 text-[11px] outline-none focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-stronger forced-colors:focus-visible:-outline-offset-1 pointer-coarse:min-h-10 pointer-coarse:min-w-10 pointer-coarse:px-2",
                    value
                      ? "cursor-default font-medium text-secondary"
                      : "cursor-pointer font-normal text-secondary hover:text-primary",
                  )}
                  onClick={() => {
                    if (!value) {
                      onEnter(items.slice(1, options + 1).join("/"));
                    }
                  }}
                >
                  {options === 0
                    ? input
                    : (0, runtime.visibleFileName)(
                        (0, runtime.fileBrowserFolderLabel)(input),
                      )}
                </button>,
              ],
            };
            const _elementKey5 = String(options) + "/" + input;
            return <_Element5 key={_elementKey5} {..._elementProps5} />;
          })();
        })}
      </nav>
    );
  }
  function FileBrowserSectionHeading({
    label: label,
    first: first,
    top: top,
    pinned: pinned,
  }: BrowserHeadingProps) {
    return (
      <div
        aria-hidden={"true"}
        data-testid={
          pinned === true
            ? "files-browser-section-pinned"
            : "files-browser-section"
        }
        className={(0, runtime.joinClassNames)(
          "absolute inset-x-0 flex items-end gap-1.5 border-b bg-page px-3.5 pb-1.5 text-[10px] font-[650] [font-variation-settings:normal] tracking-[0.6px] text-secondary uppercase",
          !first && "border-t",
        )}
        style={{
          height: FILE_BROWSER_SECTION_HEIGHT,
          top: top,
        }}
      >
        {label}
      </div>
    );
  }
  function FileBrowserRow({
    id: id,
    row: row,
    top: top,
    type: type,
    kind: kind,
    tip: tip,
    selected: selected,
    expanded: expanded,
    dimmed: dimmed,
    onSelect: onSelect,
    onOpen: onOpen,
    onToggle: onToggle,
  }: BrowserRowProps) {
    let { entry: value, depth: value2 } = row,
      value3 = (0, runtime.visibleFileName)(
        value.kind === "folder"
          ? (0, runtime.fileBrowserFolderLabel)(value.name)
          : value.name,
      ),
      value4 =
        value.kind === "file"
          ? (0, runtime.formatFileBrowserBytes)(value.size)
          : "";
    return (
      <div
        id={id}
        role={"treeitem"}
        aria-level={value2 + 1}
        aria-setsize={row.of}
        aria-posinset={row.pos}
        aria-selected={selected}
        aria-expanded={value.kind === "folder" ? expanded : undefined}
        aria-disabled={dimmed !== undefined ? true : undefined}
        data-testid={"files-browser-row"}
        data-path={value.path}
        title={
          dimmed ?? tip ?? (value4 !== "" ? value3 + " · " + value4 : value3)
        }
        className={(0, runtime.joinClassNames)(
          "group absolute inset-x-0 flex cursor-default items-center gap-2 border-b-[0.5px] pr-3.5",
          selected
            ? "bg-fill-accent hover:bg-fill-accent forced-colors:bg-[color:Highlight] forced-colors:hover:bg-[color:Highlight] forced-colors:[&>span[aria-hidden=true]]:forced-color-adjust-none"
            : "bg-transparent hover:bg-fill-ghost-hover",
          dimmed !== undefined && "opacity-45 hover:bg-transparent",
        )}
        style={{
          top: top,
          height: FILE_BROWSER_ROW_HEIGHT,
          paddingLeft: 14 + value2 * 20,
        }}
        onClick={onSelect}
        onDoubleClick={dimmed !== undefined ? undefined : onOpen}
      >
        {[
          value.kind === "folder" ? (
            <span
              aria-hidden={"true"}
              data-testid={"files-browser-caret"}
              className={(0, runtime.joinClassNames)(
                "relative flex w-3.5 cursor-default items-center justify-center before:absolute before:inset-[-10px] before:content-[''] pointer-coarse:before:inset-[-13px]",
                selected ? "text-on-accent" : "text-secondary",
                selected && FILE_BROWSER_SELECTED_FORCED_COLORS_CLASS,
              )}
              onClick={(input: React.MouseEvent<HTMLElement>) => {
                input.stopPropagation();
                onToggle();
              }}
              onDoubleClick={(input: React.MouseEvent<HTMLElement>) =>
                input.stopPropagation()
              }
            >
              <runtime.Icon
                name={expanded ? "CaretDown" : "CaretRight"}
                size={"xs"}
                className={"scale-75"}
              />
            </span>
          ) : (
            <span aria-hidden={"true"} className={"w-3.5 shrink-0"} />
          ),
          <FileBrowserIcon type={type} size={FILE_BROWSER_ROW_ICON_SIZE} />,
          <span className={"flex min-w-0 flex-1 flex-col justify-center"}>
            {[
              <span
                className={(0, runtime.joinClassNames)(
                  "truncate text-xs font-medium",
                  selected ? "text-on-accent" : "text-primary",
                  selected && FILE_BROWSER_SELECTED_FORCED_COLORS_CLASS,
                )}
              >
                {value3}
              </span>,
              <span
                className={(0, runtime.joinClassNames)(
                  "mt-px min-h-[13px] truncate text-[10px]",
                  selected ? "text-on-accent/60" : "text-secondary",
                  selected && FILE_BROWSER_SELECTED_FORCED_COLORS_CLASS,
                )}
              >
                {kind}
              </span>,
            ]}
          </span>,
          <span
            className={(0, runtime.joinClassNames)(
              "w-20 shrink-0 text-right text-[11px]",
              selected ? "text-on-accent/50" : "text-secondary",
              selected && FILE_BROWSER_SELECTED_FORCED_COLORS_CLASS,
            )}
          >
            {value4}
          </span>,
        ]}
      </div>
    );
  }
  function FileBrowserIcon({ type: type, size: size }: BrowserIconProps) {
    let state = {
        width: size,
        height: size,
      },
      value: React.ReactNode;
    if (type === "folder") {
      value = (
        <span
          style={{
            width: size,
            height: size * 0.7,
            background: FILE_BROWSER_ICON_COLORS.surface,
            border: "1px solid " + FILE_BROWSER_ICON_COLORS.line,
            borderRadius: 4,
            position: "relative",
            overflow: "hidden",
            boxShadow: FILE_BROWSER_ICON_SHADOW,
            display: "block",
          }}
        >
          {[
            <span
              style={{
                position: "absolute",
                top: -4,
                left: 4,
                width: 10,
                height: 5,
                background: FILE_BROWSER_ICON_COLORS.hover,
                borderRadius: "3px 3px 0 0",
                borderLeft: "1px solid " + FILE_BROWSER_ICON_COLORS.line,
                borderRight: "1px solid " + FILE_BROWSER_ICON_COLORS.line,
                borderTop: "1px solid " + FILE_BROWSER_ICON_COLORS.line,
              }}
            />,
            <span
              style={{
                position: "absolute",
                top: 5,
                left: 0,
                right: 0,
                bottom: 0,
                background: FILE_BROWSER_ICON_COLORS.hover,
                borderTop: "1px solid " + FILE_BROWSER_ICON_COLORS.line,
              }}
            />,
          ]}
        </span>
      );
    } else if (type === "deck") {
      let value2 = Math.round(size * 0.72),
        value3 = Math.max(2, Math.round(size * 0.09));
      value = (
        <span
          style={{
            position: "relative",
            width: size,
            height: value2,
            display: "block",
          }}
        >
          {[
            <span
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: size - value3,
                height: value2 - value3,
                background: FILE_BROWSER_ICON_COLORS.surface,
                border: "1px solid " + FILE_BROWSER_ICON_COLORS.line,
                borderRadius: 3,
              }}
            />,
            <span
              style={{
                position: "absolute",
                bottom: 0,
                right: 0,
                width: size - value3,
                height: value2 - value3,
                background: FILE_BROWSER_ICON_GRADIENTS.deck,
                border: "1px solid " + FILE_BROWSER_ICON_COLORS.line,
                borderRadius: 3,
                boxShadow: FILE_BROWSER_ICON_SHADOW,
                padding: 3,
                display: "block",
              }}
            >
              <span
                style={{
                  display: "block",
                  height: "28%",
                  width: "45%",
                  background: "rgba(0,0,0,0.16)",
                  borderRadius: 1,
                }}
              />
            </span>,
          ]}
        </span>
      );
    } else {
      value = (
        <span
          style={{
            width: size * 0.75,
            height: size,
            background: FILE_BROWSER_ICON_GRADIENTS[type],
            borderRadius: 3,
            border: "1px solid " + FILE_BROWSER_ICON_COLORS.line,
            padding: 3,
            display: "flex",
            flexDirection: "column",
            position: "relative",
            boxShadow: FILE_BROWSER_ICON_SHADOW,
          }}
        >
          {[
            <span
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                width: 5,
                height: 5,
                background: "rgba(255,255,255,0.6)",
                borderBottomLeftRadius: 3,
                borderLeft: "0.5px solid " + FILE_BROWSER_ICON_COLORS.line,
                borderBottom: "0.5px solid " + FILE_BROWSER_ICON_COLORS.line,
              }}
            />,
            type === "image" ? (
              <span
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "rgba(11,11,11,0.2)",
                }}
              >
                <runtime.Icon
                  name={"Image"}
                  size={"xs"}
                  className={"scale-[0.67]"}
                />
              </span>
            ) : (
              <span
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  paddingTop: 3,
                  gap: 2,
                }}
              >
                {[
                  <span
                    style={{
                      height: 1.5,
                      background: "rgba(0,0,0,0.12)",
                      borderRadius: 1,
                      width: "55%",
                    }}
                  />,
                  <span
                    style={{
                      height: 1,
                      background: "rgba(0,0,0,0.08)",
                      borderRadius: 1,
                      width: "80%",
                    }}
                  />,
                  <span
                    style={{
                      height: 1,
                      background: "rgba(0,0,0,0.08)",
                      borderRadius: 1,
                      width: "65%",
                    }}
                  />,
                ]}
              </span>
            ),
          ]}
        </span>
      );
    }
    return (
      <span
        aria-hidden={"true"}
        className={"flex shrink-0 items-center justify-center"}
        style={state}
      >
        {value}
      </span>
    );
  }
  function FileBrowserPreview({
    entry: entry,
    type: type,
    kind: kind,
    tip: tip,
    whyNot: whyNot,
    big: big,
    withheld: withheld,
    source: source,
    reads: reads,
    htmlAsText: htmlAsText,
    preview: preview,
    download: download,
    footer: footer,
    onOpen: onOpen,
  }: BrowserPreviewProps) {
    let value = (0, runtime.useMediaQuery)(FILE_BROWSER_NO_HOVER_QUERY),
      value2 = (0, runtime.joinClassNames)(
        "flex flex-col items-center overflow-auto bg-page p-5",
        big ? "min-w-0 flex-1" : "min-w-[180px] flex-[0_0_40%]",
      );
    if (!entry) {
      return (
        <div data-testid={"files-browser-preview"} className={value2}>
          <div
            className={
              "flex flex-1 items-center justify-center text-xs text-secondary"
            }
          >
            {"Select a file to preview"}
          </div>
        </div>
      );
    }
    let value3 = (0, runtime.visibleFileName)(
        entry.kind === "folder"
          ? (0, runtime.fileBrowserFolderLabel)(entry.name)
          : entry.name,
      ),
      value4 = onOpen !== undefined && whyNot === undefined,
      value5 = (0, runtime.fileBrowserMetadataText)(entry),
      value6 =
        value &&
        entry.kind === "file" &&
        source !== undefined &&
        (0, runtime.fileBrowserPreviewKind)(entry, {
          htmlAsText: htmlAsText,
        }) === "none" &&
        preview?.(entry, 0) === undefined &&
        entry.kind === "file"
          ? (tip ??
            (0, runtime.fileBrowserNoPreviewReason)(entry, {
              htmlAsText: htmlAsText,
            }))
          : undefined;
    return (
      <div data-testid={"files-browser-preview"} className={value2}>
        {[
          (() => {
            const _Element6 = FileBrowserPreviewCard;
            const _elementProps6 = {
              entry: entry,
              type: type,
              tip: whyNot ?? tip,
              tall: big,
              source: source,
              reads: reads,
              htmlAsText: htmlAsText,
              preview: preview,
              onOpen: value4 ? onOpen : undefined,
            };
            const _elementKey6 = entry.kind + ":" + entry.path;
            return <_Element6 key={_elementKey6} {..._elementProps6} />;
          })(),
          <div
            className={"my-3 flex flex-wrap items-center justify-center gap-2"}
          >
            {[
              onOpen !== undefined || whyNot !== undefined ? (
                <runtime.Button
                  variant={"secondary"}
                  size={"sm"}
                  icon={
                    entry.kind === "folder" ? "FolderOpen" : "ArrowOutSquare"
                  }
                  data-testid={"files-browser-open"}
                  disabled={!value4}
                  disabledReason={whyNot}
                  onClick={onOpen}
                >
                  {entry.kind === "folder" ? "Open folder" : "Open"}
                </runtime.Button>
              ) : null,
              entry.kind === "file" &&
              download !== undefined &&
              source !== undefined
                ? (() => {
                    const _Element7 = FileBrowserDownloadButton;
                    const _elementProps7 = {
                      file: entry,
                      from: download,
                      source: source,
                      reads: reads,
                      withheld: withheld,
                      noHover: value,
                    };
                    const _elementKey7 = "dl:" + entry.path;
                    return <_Element7 key={_elementKey7} {..._elementProps7} />;
                  })()
                : null,
              value && whyNot !== undefined ? (
                <div
                  data-testid={"files-browser-open-note"}
                  className={
                    "basis-full text-center text-[11px] leading-[1.4] text-secondary"
                  }
                >
                  {whyNot}
                </div>
              ) : null,
              value && whyNot === undefined && value6 !== undefined ? (
                <div
                  data-testid={"files-browser-preview-note"}
                  className={
                    "basis-full text-center text-[11px] leading-[1.4] text-secondary"
                  }
                >
                  {value6}
                </div>
              ) : null,
            ]}
          </div>,
          <div
            className={
              "mb-1 text-center text-sm font-semibold break-words text-primary"
            }
          >
            {value3}
          </div>,
          <div
            className={
              "mb-3.5 text-center text-[11px] leading-[1.4] text-secondary"
            }
          >
            {kind}
          </div>,
          value5 === "" ? null : (
            <div className={"text-center text-[11px] text-secondary"}>
              {value5}
            </div>
          ),
          footer,
        ]}
      </div>
    );
  }
  function fileDownloadFailureMessage(name: string, code: string | undefined) {
    let cleanName = (0, runtime.sanitizedFileName)(name),
      dot = cleanName.lastIndexOf("."),
      extension =
        dot <= 0 || dot === cleanName.length - 1
          ? ""
          : cleanName.slice(dot).toLowerCase(),
      kindLabel =
        extension === ""
          ? "Files with no extension"
          : extension.length > MAX_DOWNLOAD_EXTENSION_LABEL_LENGTH
            ? "Files of this kind"
            : "Files ending in " + extension;
    switch (code) {
      case "rejected_extension":
        return kindLabel + " can’t be downloaded here";
      case "extension_not_enabled":
        return kindLabel + " can’t be downloaded here yet";
      case "too_large":
        return "This file is too large to download here";
      case "rate_limited":
        return "The save didn’t go through (another prompt may be open). Try Download again";
      default:
        return "The save didn’t go through. Try Download again";
    }
  }
  function fileDownloadDisabledReason(name: string, withheld: boolean | undefined) {
    if (withheld === true) {
      return runtime.DOWNLOADS_UNAVAILABLE_MESSAGE;
    }
    if (
      (0, runtime.hasDownloadCapability)() &&
      !(0, runtime.normalizeDownloadName)(name)
    ) {
      return fileDownloadFailureMessage(name, "rejected_extension");
    }
    return;
  }
  function fetchFileWithRetries(
    url: string,
    retryMs: number,
    signal?: AbortSignal,
    fresh: boolean = false,
  ) {
    return (0, runtime.retryFileRead)(
      async (): Promise<Response> => {
        let value = await fetch(url, {
          credentials: "same-origin",
          ...(fresh
            ? {
                cache: "no-store",
              }
            : {}),
          ...(signal !== undefined
            ? {
                signal: signal,
              }
            : {}),
        });
        if (!value.ok) {
          throw fileFetchHttpError(value.status);
        }
        return value;
      },
      undefined,
      undefined,
      fileFetchRetryDelays(retryMs),
    );
  }
  function decodeFileDataUri(dataUri: string) {
    let match = /^data:([^;,]*)((?:;[^;,]*)*),/.exec(dataUri);
    if (match === null) {
      return null;
    }
    let payload = dataUri.slice(match[0].length);
    try {
      if (/;base64$/i.test(match[2] ?? "")) {
        return {
          bytes: Uint8Array.from(atob(payload), (input: string) =>
            input.charCodeAt(0),
          ),
          contentType: (match[1] ?? "").toLowerCase() || "text/plain",
        };
      }
      return {
        bytes: new TextEncoder().encode(decodeURIComponent(payload)),
        contentType: (match[1] ?? "").toLowerCase() || "text/plain",
      };
    } catch {
      return null;
    }
  }
  async function readFileBrowserDownload(
    name: string,
    source: FileBrowserSource,
    reads: FileBrowserReads,
    signal?: AbortSignal,
  ): Promise<DownloadData> {
    let mime =
      (0, runtime.downloadMimeTypeFromName)(name) ??
      (0, runtime.fileMimeTypeFromPath)((0, runtime.sanitizedFileName)(name));
    if ("text" in source) {
      return {
        bytes: new TextEncoder().encode(source.text),
        contentType: mime ?? "text/plain",
      };
    }
    if ("dataUri" in source) {
      let value = decodeFileDataUri(source.dataUri);
      if (value === null) {
        throw Error("unreadable");
      }
      return {
        bytes: value.bytes,
        contentType: mime ?? value.contentType,
      };
    }
    let response = await fetchFileWithRetries(
      source.url,
      Math.min(reads.retryMs, FILE_DOWNLOAD_MAX_RETRY_MS),
      signal,
      reads.fresh,
    );
    return {
      bytes: new Uint8Array(await response.arrayBuffer()),
      contentType: responseMimeType(response),
    };
  }
  async function readArtifactBlobDownload(
    url: string,
    signal?: AbortSignal,
  ): Promise<DownloadData> {
    if (!(0, runtime.isStoredBlobReference)(url)) {
      throw Error("not a blob of this artifact");
    }
    let response = await fetch(url, {
      credentials: "same-origin",
      signal: signal,
    });
    if (!response.ok) {
      throw fileFetchHttpError(response.status);
    }
    return {
      bytes: new Uint8Array(await response.arrayBuffer()),
      contentType: responseMimeType(response),
    };
  }
  function useFileBrowserDownload(
    file: BrowserFile,
    download: FileDownloadSpec,
    source: FileBrowserSource,
    reads: FileBrowserReads,
    withheld: boolean | undefined,
  ) {
    let [busy, setBusy] = runtime.reactFilesBrowser.useState(false),
      [note, setNote] = runtime.reactFilesBrowser.useState<string | null>(null),
      name = file.name,
      tip = fileDownloadDisabledReason(name, withheld),
      abortRef = runtime.reactFilesBrowser.useRef<AbortController | null>(null);
    runtime.reactFilesBrowser.useEffect(
      () => () => abortRef.current?.abort(),
      [],
    );
    return {
      tip: tip,
      note: note,
      busy: busy,
      run: () => {
        let value = (abortRef.current = new AbortController());
        (async (): Promise<void> => {
          setBusy(true);
          setNote("Reading this file…");
          try {
            if (!(0, runtime.hasDownloadCapability)()) {
              setNote("Downloads aren’t available in this view");
              return;
            }
            let value2 = await (0, runtime.downloadsWithheld)();
            if (value.signal.aborted) {
              return;
            }
            if (value2) {
              setNote(runtime.DOWNLOADS_UNAVAILABLE_MESSAGE);
              return;
            }
            let value3: DownloadData;
            try {
              value3 =
                download.url === undefined
                  ? await readFileBrowserDownload(
                      name,
                      source,
                      reads,
                      value.signal,
                    )
                  : await readArtifactBlobDownload(download.url, value.signal);
            } catch (value5: unknown) {
              if (value.signal.aborted) {
                return;
              }
              let value6: unknown = (value5 as Partial<HttpError> | null)
                ?.status;
              setNote(
                value6 === 404 || value6 === 403 || value6 === 401
                  ? "This file isn’t available. It may have been removed, or your account may not have access to it"
                  : typeof value6 === "number" && value6 > 0
                    ? "Couldn’t download this file (HTTP " +
                      String(value6) +
                      "). Try again"
                    : "Couldn’t download this file. Try again",
              );
              return;
            }
            if (value.signal.aborted) {
              return;
            }
            setNote(null);
            if (
              !fileDownloadMimeMatchesName(
                name,
                value3.contentType,
                download.type,
              )
            ) {
              setNote(
                "This isn’t the kind of file its name says, so it was not downloaded",
              );
              return;
            }
            let value4 = await (0, runtime.saveThroughShell)(
              new Blob([value3.bytes], {
                type: value3.contentType,
              }),
              name,
            );
            if (value.signal.aborted) {
              return;
            }
            if (value4.outcome === "saved") {
              setNote("Saved " + (0, runtime.visibleFileName)(name));
            } else if (value4.outcome === "withheld") {
              setNote(runtime.DOWNLOADS_UNAVAILABLE_MESSAGE);
            } else if (value4.outcome === "unsupported") {
              setNote(
                value4.code === "no_shell_save"
                  ? "Downloads aren’t available in this view"
                  : fileDownloadFailureMessage(name, value4.code),
              );
            }
          } catch {
            if (!value.signal.aborted) {
              setNote("Couldn’t download this file. Try again");
            }
          } finally {
            if (!value.signal.aborted) {
              setBusy(false);
            }
          }
        })();
      },
    };
  }
  function FileBrowserDownloadButton({
    file: file,
    from: from,
    source: source,
    reads: reads,
    withheld: withheld,
    noHover: noHover,
  }: BrowserDownloadButtonProps) {
    let value = useFileBrowserDownload(file, from, source, reads, withheld),
      value2 = value.note ?? (noHover ? (value.tip ?? null) : null);
    return (
      <jsxFilesBrowser.Fragment>
        {[
          <runtime.Button
            variant={"secondary"}
            size={"sm"}
            icon={"Download"}
            data-testid={"files-browser-download"}
            disabled={value.tip !== undefined || value.busy}
            disabledReason={value.tip}
            onClick={value.run}
          >
            {"Download"}
          </runtime.Button>,
          <div
            role={"status"}
            data-testid={"files-browser-download-note"}
            className={(0, runtime.joinClassNames)(
              "basis-full text-center text-[11px] leading-[1.4] text-secondary",
              value2 === null && "sr-only",
            )}
          >
            {value2 ?? ""}
          </div>,
        ]}
      </jsxFilesBrowser.Fragment>
    );
  }
  function useFilePreviewWidth(): [
    React.Dispatch<React.SetStateAction<HTMLDivElement | null>>,
    number,
  ] {
    let [value, value2] =
        runtime.reactFilesBrowser.useState<HTMLDivElement | null>(null),
      [value3, value4] = runtime.reactFilesBrowser.useState(0);
    runtime.reactFilesBrowser.useLayoutEffect(() => {
      if (value === null) {
        return;
      }
      value4(value.getBoundingClientRect().width);
      if (typeof ResizeObserver === "undefined") {
        return;
      }
      let observer = new ResizeObserver(() =>
        value4(value.getBoundingClientRect().width),
      );
      observer.observe(value);
      return () => observer.disconnect();
    }, [value]);
    return [value2, value3];
  }
  function FileBrowserPreviewCard({
    entry: entry,
    type: type,
    tip: tip,
    tall: tall,
    source: source,
    reads: reads,
    htmlAsText: htmlAsText,
    preview: preview,
    onOpen: onOpen,
  }: BrowserPreviewCardProps) {
    let [value, value2] = useFilePreviewWidth(),
      value3 =
        entry.kind === "file" && preview !== undefined
          ? preview(entry, value2)
          : undefined;
    if (value3 !== undefined) {
      return (
        <div
          ref={value}
          data-testid={"files-browser-card"}
          className={(0, runtime.joinClassNames)(
            FILE_BROWSER_PREVIEW_CARD_CLASS,
            onOpen && "cursor-pointer",
          )}
          style={fileBrowserPreviewCardStyle(false)}
          onClick={onOpen}
          title={onOpen ? "Click to open" : undefined}
        >
          {value2 > 0 ? value3 : null}
        </div>
      );
    }
    let value4 =
      entry.kind === "file" && source !== undefined
        ? (0, runtime.fileBrowserPreviewKind)(entry, {
            htmlAsText: htmlAsText,
          })
        : "none";
    if (entry.kind === "file" && source !== undefined && value4 === "image") {
      return (
        <FileBrowserImagePreview
          file={entry}
          source={source}
          retryMs={reads.retryMs}
          tall={tall}
        />
      );
    }
    if (entry.kind === "file" && source !== undefined && value4 === "text") {
      return (
        <FileBrowserTextPreview source={source} reads={reads} tall={tall} />
      );
    }
    return (
      <div
        data-testid={"files-browser-card"}
        className={(0, runtime.joinClassNames)(
          FILE_BROWSER_PREVIEW_CARD_CLASS,
          onOpen && "cursor-pointer",
        )}
        style={fileBrowserPreviewCardStyle(false)}
        onClick={onOpen}
        title={
          onOpen
            ? "Click to open"
            : (tip ??
              (entry.kind === "file"
                ? (0, runtime.fileBrowserNoPreviewReason)(entry, {
                    htmlAsText: htmlAsText,
                  })
                : undefined))
        }
      >
        <FileBrowserIcon type={type} size={48} />
      </div>
    );
  }
  function FileBrowserImagePreview({
    file: file,
    source: source,
    retryMs: retryMs,
    tall: tall,
  }: BrowserImagePreviewProps) {
    let value = "url" in source ? source.url : null,
      value2 = "text" in source ? source.text : null,
      value3 = "dataUri" in source ? source.dataUri : null,
      value4 = file.contentType ?? "image/svg+xml",
      memo = runtime.reactFilesBrowser.useMemo(() => {
        if (value2 === null) {
          return value ?? value3;
        }
        try {
          return (
            "data:" + value4 + ";charset=utf-8," + encodeURIComponent(value2)
          );
        } catch {
          return null;
        }
      }, [value, value2, value3, value4]),
      [value5, value6] = runtime.reactFilesBrowser.useState(0),
      [value7, value8] = runtime.reactFilesBrowser.useState("drawing"),
      ref = runtime.reactFilesBrowser.useRef<AbortController | null>(null);
    runtime.reactFilesBrowser.useEffect(() => {
      value6(0);
      value8("drawing");
      ref2.current = false;
      return () => ref.current?.abort();
    }, [memo]);
    let ref2 = runtime.reactFilesBrowser.useRef(false),
      callback = () => {
        let value9 = fileFetchRetryDelays(retryMs)[value5];
        if (value === null || ref2.current || value9 === undefined) {
          return value8("failed");
        }
        let value10 = (ref.current = new AbortController());
        value8("waiting");
        fetch(value, {
          credentials: "same-origin",
          signal: value10.signal,
        })
          .then((state: Response) => {
            state.body?.cancel().catch(() => {
              return;
            });
            if (value10.signal.aborted) {
              return;
            }
            if (state.ok) {
              ref2.current = true;
            } else if (
              !(0, runtime.isRetryableFileReadAccessError)({
                status: state.status,
              })
            ) {
              throw Error("will not draw");
            }
            return new Promise((input: (value?: unknown) => void) =>
              setTimeout(input, state.ok ? 0 : value9),
            );
          })
          .then(() => {
            if (!value10.signal.aborted) {
              value6((input: number) => input + 1);
              value8("drawing");
            }
          })
          .catch(() => {
            if (!value10.signal.aborted) {
              value8("failed");
            }
          });
      };
    return (
      <div
        data-testid={"files-browser-card"}
        className={FILE_BROWSER_PREVIEW_CARD_CLASS}
        style={fileBrowserPreviewCardStyle(tall)}
      >
        {value7 === "failed" || memo === null ? (
          <div className={"text-xs text-secondary"}>
            {FILE_BROWSER_LOAD_ERROR_TEXT}
          </div>
        ) : value7 === "waiting" ? (
          <div className={"text-xs text-secondary"}>
            {FILE_BROWSER_LOADING_TEXT}
          </div>
        ) : (
          (() => {
            const _Element8 = "img";
            const _elementProps8 = {
              src: memo,
              alt: "",
              draggable: false,
              onError: callback,
              className:
                "pointer-events-none h-full w-full object-contain select-none",
            };
            const _elementKey8 = value5;
            return <_Element8 key={_elementKey8} {..._elementProps8} />;
          })()
        )}
      </div>
    );
  }
  function FileBrowserTextPreview({
    source: source,
    reads: reads,
    tall: tall,
  }: BrowserTextPreviewProps) {
    let { retryMs: value, fresh: value2 } = reads,
      value3 = "url" in source ? source.url : null,
      value4 = "text" in source ? source.text : null,
      value5 = "dataUri" in source ? source.dataUri : null,
      memo = runtime.reactFilesBrowser.useMemo(() => {
        if (value4 !== null) {
          return value4;
        }
        if (value5 === null) {
          return null;
        }
        let value10 = decodeFileDataUri(value5);
        if (value10 === null) {
          return "failed";
        } else {
          return new TextDecoder("utf-8").decode(value10.bytes);
        }
      }, [value4, value5]),
      [value6, value7] = runtime.reactFilesBrowser.useState<string | null>(
        null,
      );
    runtime.reactFilesBrowser.useEffect(() => {
      if (value3 === null) {
        return;
      }
      let controller = new AbortController();
      value7(null);
      fetchFileWithRetries(value3, value, controller.signal, value2)
        .then(
          async (input: Response): Promise<string> =>
            responseMimeType(input) === "text/html"
              ? (0, runtime.stripFrameRuntimeBlock)(await input.text())
              : input.text(),
        )
        .then((input: string) => {
          if (!controller.signal.aborted) {
            value7(input);
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            value7("failed");
          }
        });
      return () => controller.abort();
    }, [value3, value, value2]);
    let value8 = value3 === null ? memo : value6,
      value9 =
        value8 === null || value8 === "failed"
          ? ""
          : value8.length > runtime.MAX_FILE_BROWSER_TEXT_BYTES
            ? value8.slice(0, runtime.MAX_FILE_BROWSER_TEXT_BYTES) +
              `
…`
            : value8;
    return (
      <div
        data-testid={"files-browser-card"}
        className={
          "relative w-full overflow-hidden rounded-lg border bg-surface-2 shadow-[0_4px_16px_rgba(0,0,0,0.1),0_1px_4px_rgba(0,0,0,0.06)]"
        }
        style={fileBrowserPreviewCardStyle(tall)}
      >
        {value8 === "failed" || value8 === null ? (
          <div
            className={
              "flex h-full items-center justify-center text-xs text-secondary"
            }
          >
            {value8 === null
              ? FILE_BROWSER_LOADING_TEXT
              : FILE_BROWSER_LOAD_ERROR_TEXT}
          </div>
        ) : (
          <pre
            data-testid={"files-browser-text"}
            className={(0, runtime.joinClassNames)(
              "m-0 h-full w-full overflow-auto p-3 font-mono leading-[1.45] whitespace-pre text-secondary",
              tall ? "text-[11px]" : "text-[10px]",
            )}
          >
            {value9}
          </pre>
        )}
      </div>
    );
  }
  bindRuntimeValue(
    runtime,
    "jsxFilesBrowser",
    () => jsxFilesBrowser,
    (value) => {
      jsxFilesBrowser = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_BROWSER_ROW_HEIGHT",
    () => FILE_BROWSER_ROW_HEIGHT,
    (value) => {
      FILE_BROWSER_ROW_HEIGHT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_BROWSER_SELECTED_FORCED_COLORS_CLASS",
    () => FILE_BROWSER_SELECTED_FORCED_COLORS_CLASS,
    (value) => {
      FILE_BROWSER_SELECTED_FORCED_COLORS_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_BROWSER_SECTION_HEIGHT",
    () => FILE_BROWSER_SECTION_HEIGHT,
    (value) => {
      FILE_BROWSER_SECTION_HEIGHT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_BROWSER_ROW_ICON_SIZE",
    () => FILE_BROWSER_ROW_ICON_SIZE,
    (value) => {
      FILE_BROWSER_ROW_ICON_SIZE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_BROWSER_PREVIEW_WIDTH",
    () => FILE_BROWSER_PREVIEW_WIDTH,
    (value) => {
      FILE_BROWSER_PREVIEW_WIDTH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_BROWSER_PREVIEW_HEIGHT",
    () => FILE_BROWSER_PREVIEW_HEIGHT,
    (value) => {
      FILE_BROWSER_PREVIEW_HEIGHT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_BROWSER_OVERSCAN_PX",
    () => FILE_BROWSER_OVERSCAN_PX,
    (value) => {
      FILE_BROWSER_OVERSCAN_PX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_BROWSER_FALLBACK_VIEWPORT_HEIGHT",
    () => FILE_BROWSER_FALLBACK_VIEWPORT_HEIGHT,
    (value) => {
      FILE_BROWSER_FALLBACK_VIEWPORT_HEIGHT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_BROWSER_MOBILE_QUERY",
    () => FILE_BROWSER_MOBILE_QUERY,
    (value) => {
      FILE_BROWSER_MOBILE_QUERY = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_BROWSER_NO_HOVER_QUERY",
    () => FILE_BROWSER_NO_HOVER_QUERY,
    (value) => {
      FILE_BROWSER_NO_HOVER_QUERY = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_BROWSER_ICON_COLORS",
    () => FILE_BROWSER_ICON_COLORS,
    (value) => {
      FILE_BROWSER_ICON_COLORS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "encodeFilePathPart",
    () => encodeFilePathPart,
    (value) => {
      encodeFilePathPart = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "projectFileUrl",
    () => projectFileUrl,
    (value) => {
      projectFileUrl = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fileBrowserDefaultSource",
    () => fileBrowserDefaultSource,
    (value) => {
      fileBrowserDefaultSource = value;
    },
  );
  bindRuntimeValue(runtime, "FilesBrowser", () => FilesBrowser);
  bindRuntimeValue(
    runtime,
    "fileCountLabel",
    () => fileCountLabel,
    (value) => {
      fileCountLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "parentFolderPath",
    () => parentFolderPath,
    (value) => {
      parentFolderPath = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fileBrowserEntryKey",
    () => fileBrowserEntryKey,
    (value) => {
      fileBrowserEntryKey = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fileBrowserEntryEncoder",
    () => fileBrowserEntryEncoder,
    (value) => {
      fileBrowserEntryEncoder = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fileBrowserEntryId",
    () => fileBrowserEntryId,
    (value) => {
      fileBrowserEntryId = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initialFileBrowserSelection",
    () => initialFileBrowserSelection,
    (value) => {
      initialFileBrowserSelection = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FileBrowserBreadcrumbs",
    () => FileBrowserBreadcrumbs,
  );
  bindRuntimeValue(
    runtime,
    "FileBrowserSectionHeading",
    () => FileBrowserSectionHeading,
  );
  bindRuntimeValue(runtime, "FileBrowserRow", () => FileBrowserRow);
  bindRuntimeValue(
    runtime,
    "FILE_BROWSER_ICON_GRADIENTS",
    () => FILE_BROWSER_ICON_GRADIENTS,
    (value) => {
      FILE_BROWSER_ICON_GRADIENTS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_BROWSER_ICON_SHADOW",
    () => FILE_BROWSER_ICON_SHADOW,
    (value) => {
      FILE_BROWSER_ICON_SHADOW = value;
    },
  );
  bindRuntimeValue(runtime, "FileBrowserIcon", () => FileBrowserIcon);
  bindRuntimeValue(runtime, "FileBrowserPreview", () => FileBrowserPreview);
  bindRuntimeValue(
    runtime,
    "MAX_DOWNLOAD_EXTENSION_LABEL_LENGTH",
    () => MAX_DOWNLOAD_EXTENSION_LABEL_LENGTH,
    (value) => {
      MAX_DOWNLOAD_EXTENSION_LABEL_LENGTH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fileDownloadFailureMessage",
    () => fileDownloadFailureMessage,
  );
  bindRuntimeValue(
    runtime,
    "fileDownloadDisabledReason",
    () => fileDownloadDisabledReason,
  );
  bindRuntimeValue(
    runtime,
    "fileDownloadMimeMatchesName",
    () => fileDownloadMimeMatchesName,
    (value) => {
      fileDownloadMimeMatchesName = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "responseMimeType",
    () => responseMimeType,
    (value) => {
      responseMimeType = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fileFetchHttpError",
    () => fileFetchHttpError,
    (value) => {
      fileFetchHttpError = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fileFetchRetryDelays",
    () => fileFetchRetryDelays,
    (value) => {
      fileFetchRetryDelays = value;
    },
  );
  bindRuntimeValue(runtime, "fetchFileWithRetries", () => fetchFileWithRetries);
  bindRuntimeValue(runtime, "decodeFileDataUri", () => decodeFileDataUri);
  bindRuntimeValue(
    runtime,
    "FILE_DOWNLOAD_MAX_RETRY_MS",
    () => FILE_DOWNLOAD_MAX_RETRY_MS,
    (value) => {
      FILE_DOWNLOAD_MAX_RETRY_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "readFileBrowserDownload",
    () => readFileBrowserDownload,
  );
  bindRuntimeValue(
    runtime,
    "readArtifactBlobDownload",
    () => readArtifactBlobDownload,
  );
  bindRuntimeValue(
    runtime,
    "useFileBrowserDownload",
    () => useFileBrowserDownload,
  );
  bindRuntimeValue(
    runtime,
    "FileBrowserDownloadButton",
    () => FileBrowserDownloadButton,
  );
  bindRuntimeValue(runtime, "useFilePreviewWidth", () => useFilePreviewWidth);
  bindRuntimeValue(
    runtime,
    "FILE_BROWSER_PREVIEW_CARD_CLASS",
    () => FILE_BROWSER_PREVIEW_CARD_CLASS,
    (value) => {
      FILE_BROWSER_PREVIEW_CARD_CLASS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fileBrowserPreviewCardStyle",
    () => fileBrowserPreviewCardStyle,
    (value) => {
      fileBrowserPreviewCardStyle = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FileBrowserPreviewCard",
    () => FileBrowserPreviewCard,
  );
  bindRuntimeValue(
    runtime,
    "FILE_BROWSER_LOAD_ERROR_TEXT",
    () => FILE_BROWSER_LOAD_ERROR_TEXT,
    (value) => {
      FILE_BROWSER_LOAD_ERROR_TEXT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_BROWSER_LOADING_TEXT",
    () => FILE_BROWSER_LOADING_TEXT,
    (value) => {
      FILE_BROWSER_LOADING_TEXT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FileBrowserImagePreview",
    () => FileBrowserImagePreview,
  );
  bindRuntimeValue(
    runtime,
    "FileBrowserTextPreview",
    () => FileBrowserTextPreview,
  );
  return () => {
    jsxFilesBrowser = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    FILE_BROWSER_ROW_HEIGHT = 44;
    FILE_BROWSER_SELECTED_FORCED_COLORS_CLASS =
      "forced-colors:forced-color-adjust-none forced-colors:text-[color:HighlightText]";
    FILE_BROWSER_SECTION_HEIGHT = 32;
    FILE_BROWSER_ROW_ICON_SIZE = 28;
    FILE_BROWSER_PREVIEW_WIDTH = 1200;
    FILE_BROWSER_PREVIEW_HEIGHT = 800;
    FILE_BROWSER_OVERSCAN_PX = 5 * FILE_BROWSER_ROW_HEIGHT;
    FILE_BROWSER_FALLBACK_VIEWPORT_HEIGHT = 900;
    FILE_BROWSER_MOBILE_QUERY = "(max-width: 660px)";
    FILE_BROWSER_NO_HOVER_QUERY = "(hover: none)";
    FILE_BROWSER_ICON_COLORS = {
      surface: "var(--cds-surface-2)",
      hover: "var(--cds-fill-ghost-hover)",
      line: "var(--cds-border)",
    };
    encodeFilePathPart = (input: string) => {
      try {
        return encodeURIComponent(input);
      } catch {
        return encodeURIComponent(
          input.replace(/[\uD800-\uDFFF]/g, String.fromCharCode(65533)),
        );
      }
    };
    projectFileUrl = (input: string) =>
      runtime.PROJECT_FILE_PREFIX +
      input.split("/").map(encodeFilePathPart).join("/");
    fileBrowserDefaultSource = (input: BrowserFile) => ({
      url: projectFileUrl(input.path),
    });
    fileCountLabel = (input: number, options: string) =>
      input.toLocaleString("en-US") + " " + options + (input === 1 ? "" : "s");
    parentFolderPath = (input: string) =>
      input.includes("/") ? input.slice(0, input.lastIndexOf("/")) : "";
    fileBrowserEntryKey = (source: BrowserEntry) =>
      source.kind + ":" + source.path;
    fileBrowserEntryEncoder = new TextEncoder();
    fileBrowserEntryId = (input: string) =>
      Array.from<number, string>(
        fileBrowserEntryEncoder.encode(input),
        (input2: number) => input2.toString(16).padStart(2, "0"),
      ).join("");
    initialFileBrowserSelection = (
      input: BrowserFolder,
      options: (entry: BrowserEntry) => string | undefined,
    ) => {
      let value = (0, runtime.flattenFileBrowserTree)(input, new Set()).filter(
          (input2: BrowserRow) => input2.entry.kind === "file",
        ),
        value2 =
          value.find(
            (input2: BrowserRow) => options(input2.entry) === undefined,
          ) ?? value[0];
      if (value2) {
        return fileBrowserEntryKey(value2.entry);
      } else {
        return null;
      }
    };
    FILE_BROWSER_ICON_GRADIENTS = {
      html: "linear-gradient(135deg, #FDE8E0 0%, #F5D0C0 100%)",
      deck: "linear-gradient(135deg, #D8EEEA 0%, #C2E0D8 100%)",
      css: "linear-gradient(135deg, #DCEAF7 0%, #C8DAF0 100%)",
      jsx: "linear-gradient(135deg, #E0E8F0 0%, #D0D8E8 100%)",
      js: "linear-gradient(135deg, #FFF3D0 0%, #F0E4B8 100%)",
      image: "linear-gradient(135deg, #E0ECD8 0%, #D0DFC8 100%)",
      md: "linear-gradient(135deg, #EEEAF5 0%, #DED8EC 100%)",
      json: "linear-gradient(135deg, #F0EEE6 0%, #E5E2D8 100%)",
      other: "linear-gradient(135deg, #F0EEE6 0%, #E5E2D8 100%)",
    };
    FILE_BROWSER_ICON_SHADOW = "0 1px 2px rgba(0,0,0,0.04)";
    MAX_DOWNLOAD_EXTENSION_LABEL_LENGTH = 12;
    fileDownloadMimeMatchesName = (
      input: string,
      options: string,
      context?: string,
    ) => {
      let value = context ?? (0, runtime.downloadMimeTypeFromName)(input);
      if (value !== undefined) {
        return options === value;
      }
      let value2 = (0, runtime.fileMimeTypeFromPath)(
        (0, runtime.sanitizedFileName)(input),
      );
      return (
        value2 === undefined || options === value2 || options === "text/plain"
      );
    };
    responseMimeType = (input: Response) =>
      (input.headers.get("content-type") ?? "")
        .split(";")[0]
        .trim()
        .toLowerCase();
    fileFetchHttpError = (input: number) =>
      Object.assign(Error("HTTP " + String(input)), {
        status: input,
      });
    fileFetchRetryDelays = (input: number) => {
      let items: number[] = [];
      for (
        let index = 0, count = 150;
        index + count <= input;
        index += count, count = Math.min(count * 2, 2000)
      ) {
        items.push(count);
      }
      return items;
    };
    FILE_DOWNLOAD_MAX_RETRY_MS = 4000;
    FILE_BROWSER_PREVIEW_CARD_CLASS =
      "relative flex w-full items-center justify-center overflow-hidden rounded-lg border bg-fill-control shadow-[0_4px_16px_rgba(0,0,0,0.1),0_1px_4px_rgba(0,0,0,0.06)]";
    fileBrowserPreviewCardStyle = (input: boolean | undefined) =>
      input
        ? {
            height: "52vh",
          }
        : {
            aspectRatio:
              String(FILE_BROWSER_PREVIEW_WIDTH) +
              " / " +
              String(FILE_BROWSER_PREVIEW_HEIGHT),
          };
    FILE_BROWSER_LOAD_ERROR_TEXT = "Couldn’t load this file";
    FILE_BROWSER_LOADING_TEXT = "Loading…";
  };
}
