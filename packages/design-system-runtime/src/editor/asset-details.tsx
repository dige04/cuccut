import type * as React from "react";
import type * as Editor from "../contracts/editor-runtime";
import type * as Model from "../contracts";
import type * as Application from "../contracts/application";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installEditorAssetDetails(
  runtime: RuntimeBindings,
): () => void {
  var jsxAssetDetails: typeof import("react/jsx-runtime");
  function AssetDetailsPreview({
    asset: asset,
    files: files,
    storage: storage,
    size: size,
  }: Editor.AssetDetailsPreviewProps): React.ReactElement {
    let value =
        asset.kind === "image" || asset.kind === "svg" || asset.kind === "video"
          ? (0, runtime.filePreviewUrl)(files, asset.path, storage)
          : null,
      value2: string = "ds-thumb-media ds-thumb-" + size,
      value3 = (0, runtime.useAssetThumbnailSource)(files, asset.path);
    if ((asset.kind === "image" || asset.kind === "svg") && value !== null) {
      return (() => {
        const _Element = "img";
        const _elementProps = {
          className: value2,
          "data-kind":
            asset.kind === "svg" &&
            (0, runtime.isHeldFilePointer)(asset.path, files[asset.path] ?? "")
              ? "svg"
              : undefined,
          src: value3.src ?? value,
          alt: asset.name,
          draggable: false,
          loading: "lazy" as const,
          onLoad: value3.onLoad,
          onError: value3.onError,
        };
        const _elementKey = value3.part;
        return <_Element key={_elementKey} {..._elementProps} />;
      })();
    }
    if (asset.kind === "video" && value !== null) {
      if (size === "full") {
        return (() => {
          const _Element2 = "video";
          const _elementProps2 = {
            className: value2,
            src: value3.src ?? value,
            controls: true,
            muted: true,
            playsInline: true,
            onLoadedMetadata: value3.onLoad,
            onError: value3.onError,
          };
          const _elementKey2 = value3.part;
          return <_Element2 key={_elementKey2} {..._elementProps2} />;
        })();
      } else {
        return (() => {
          const _Element3 = "video";
          const _elementProps3 = {
            className: value2,
            src: value3.src ?? value,
            muted: true,
            playsInline: true,
            preload: "metadata",
            onLoadedMetadata: value3.onLoad,
            onError: value3.onError,
          };
          const _elementKey3 = value3.part;
          return <_Element3 key={_elementKey3} {..._elementProps3} />;
        })();
      }
    }
    if (asset.kind === "font") {
      return (
        <span
          className={
            value2 +
            " ds-thumb-font leading-none text-primary " +
            (size === "full" ? "p-6 text-[96px]" : "text-[28px]")
          }
          style={{
            fontFamily:
              '"' +
              (0, runtime.fontFileCssFamilyName)(asset.path) +
              '", system-ui, sans-serif',
          }}
        >
          {"Ag"}
        </span>
      );
    }
    let value4 = (0, runtime.assetKindLabel)(asset),
      value5 = (0, runtime.assetFileSizeLabel)(
        (0, runtime.resolvedAssetFileBytes)(files, asset.path, asset.bytes),
      );
    return (
      <span
        className={
          value2 +
          " ds-thumb-generic inline-flex flex-col items-center gap-sm text-muted"
        }
      >
        {[
          <runtime.KitIcon
            name={value4.icon}
            size={size === "full" ? 36 : 22}
          />,
          <span className={"font-mono text-caption"}>
            {value4.label +
              (size === "full" && value5 !== "" ? " · " + value5 : "")}
          </span>,
        ]}
      </span>
    );
  }
  function assetDownloadBlockedReason(
    asset: Application.EditorAsset,
    withheld?: boolean,
  ): string | undefined {
    if (withheld === true) {
      return runtime.DOWNLOADS_UNAVAILABLE_MESSAGE;
    }
    if (!(0, runtime.hasDownloadCapability)()) {
      return;
    }
    if (!(0, runtime.normalizeDownloadName)(asset.name)) {
      return (0, runtime.unsupportedDownloadMessage)(
        asset.name,
        "rejected_extension",
      );
    }
    return;
  }
  function AssetDetailsDialog({
    asset: asset,
    files: files,
    storage: storage,
    onClose: onClose,
    onDownload: onDownload,
    onRename: onRename,
    onRemove: onRemove,
    focusName = false,
  }: Editor.AssetDetailsDialogProps): React.ReactElement {
    (0, runtime.useAssetThumbnailSources)();
    let ref = (
        runtime.reactAssetUpload as typeof React
      ).useRef<HTMLInputElement | null>(null),
      value = assetDownloadBlockedReason(
        asset,
        (0, runtime.useDownloadsWithheld)(),
      ),
      [value2, value3] = (runtime.reactAssetUpload as typeof React).useState(
        asset.name,
      ),
      [value4, value5] = (runtime.reactAssetUpload as typeof React).useState<
        string | null
      >(null),
      ref2 = (runtime.reactAssetUpload as typeof React).useRef(false);
    (runtime.reactAssetUpload as typeof React).useEffect(
      () => value3(asset.name),
      [asset.name],
    );
    let callback = (): void => {
        let value7 = ref2.current ? asset.name : value2.trim();
        ref2.current = false;
        if (value7 === "" || value7 === asset.name) {
          value3(asset.name);
          value5(null);
          return;
        }
        if (onRename?.(value7) === false) {
          value5("That name is taken or not a file name.");
        } else {
          value5(null);
        }
      },
      value6 =
        asset.kind === "image" ||
        asset.kind === "svg" ||
        asset.kind === "video";
    return (
      <div className={"contents"} {...runtime.BLOCK_FILE_DROP_HANDLERS}>
        <runtime.CdsRoot density={"compact"} className={"contents"}>
          <runtime.Dialog.Root
            open={true}
            onOpenChange={(input: boolean): void => {
              if (!input) {
                onClose();
              }
            }}
          >
            <runtime.Dialog.Popup
              size={"lg"}
              data-testid={"ds-asset-lightbox"}
              aria-label={asset.name}
              {...(0, runtime.commentTargetProps)("lightbox", asset.path)}
              initialFocus={
                focusName && onRename !== undefined ? ref : undefined
              }
            >
              {[
                <runtime.Dialog.Header showClose={true}>
                  {value6
                    ? asset.kind === "video"
                      ? "Video"
                      : "Image"
                    : (0, runtime.assetKindLabel)(asset).label}
                </runtime.Dialog.Header>,
                <div className={"flex flex-col gap-md"}>
                  {[
                    <div
                      className={"ds-lb-prev" + (value6 ? "" : " ds-lb-file")}
                      data-tone={
                        value6 && (0, runtime.isReversedLogoAsset)(asset)
                          ? "dark"
                          : undefined
                      }
                    >
                      <AssetDetailsPreview
                        asset={asset}
                        files={files}
                        storage={storage}
                        size={"full"}
                      />
                    </div>,
                    onRename !== undefined ? (
                      <runtime.FieldComponents.TextInput
                        ref={ref}
                        label={"File name"}
                        onFocus={
                          focusName
                            ? (input: React.FocusEvent<HTMLInputElement>) =>
                                input.currentTarget.select()
                            : undefined
                        }
                        error={value4 ?? undefined}
                        hint={
                          value4 === null
                            ? (0, runtime.assetFileSizeLabel)(
                                (0, runtime.resolvedAssetFileBytes)(
                                  files,
                                  asset.path,
                                  asset.bytes,
                                ),
                              ) || undefined
                            : undefined
                        }
                        className={"font-mono"}
                        value={value2}
                        spellCheck={false}
                        data-testid={"ds-asset-name"}
                        onChange={(
                          input: React.ChangeEvent<HTMLInputElement>,
                        ): void => {
                          value3(input.currentTarget.value);
                          value5(null);
                        }}
                        onBlur={callback}
                        onKeyDown={(
                          event: React.KeyboardEvent<HTMLInputElement>,
                        ): void => {
                          if ((0, runtime.isComposingEvent)(event)) {
                            return;
                          }
                          if (event.key === "Enter") {
                            event.currentTarget.blur();
                          } else if (event.key === "Escape") {
                            event.preventDefault();
                            event.stopPropagation();
                            ref2.current = true;
                            event.currentTarget.blur();
                          }
                        }}
                      />
                    ) : (
                      <p className={"flex items-baseline gap-sm text-body"}>
                        {[
                          <span
                            className={
                              "min-w-0 truncate font-mono text-primary"
                            }
                            data-testid={"ds-asset-name"}
                            title={asset.path}
                          >
                            {asset.name}
                          </span>,
                          <span
                            className={"font-mono text-footnote text-muted"}
                          >
                            {(0, runtime.assetFileSizeLabel)(
                              (0, runtime.resolvedAssetFileBytes)(
                                files,
                                asset.path,
                                asset.bytes,
                              ),
                            )}
                          </span>,
                        ]}
                      </p>
                    ),
                  ]}
                </div>,
                <runtime.Dialog.Footer align={"between"}>
                  {[
                    onRemove !== undefined ? (
                      <runtime.Button
                        variant={"ghost"}
                        icon={"Trash"}
                        className={"text-danger"}
                        onClick={onRemove}
                        data-testid={"ds-asset-lb-remove"}
                      >
                        {"Delete"}
                      </runtime.Button>
                    ) : (
                      <span />
                    ),
                    onDownload !== undefined ? (
                      <runtime.DisabledReasonTooltip reason={value}>
                        <runtime.Button
                          icon={"Download"}
                          disabled={value !== undefined}
                          onClick={onDownload}
                          data-testid={"ds-asset-lb-download"}
                          data-why={value}
                        >
                          {"Download"}
                        </runtime.Button>
                      </runtime.DisabledReasonTooltip>
                    ) : null,
                  ]}
                </runtime.Dialog.Footer>,
              ]}
            </runtime.Dialog.Popup>
          </runtime.Dialog.Root>
        </runtime.CdsRoot>
      </div>
    );
  }
  bindRuntimeValue(
    runtime,
    "jsxAssetDetails",
    () => jsxAssetDetails,
    (value) => {
      jsxAssetDetails = value;
    },
  );
  bindRuntimeValue(runtime, "AssetDetailsPreview", () => AssetDetailsPreview);
  bindRuntimeValue(
    runtime,
    "assetDownloadBlockedReason",
    () => assetDownloadBlockedReason,
  );
  bindRuntimeValue(runtime, "AssetDetailsDialog", () => AssetDetailsDialog);
  return () => {
    jsxAssetDetails = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
  };
}
