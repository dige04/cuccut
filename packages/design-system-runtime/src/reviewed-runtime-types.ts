import type * as RuntimeTypes from "./runtime-types";
import type * as Application_Application from "./contracts/application";
import type * as Application_React from "react";
import type * as Application_Model from "./contracts";
import type * as Composition_Composition from "./contracts/composition";
import type * as Composition_React from "react";
import type * as FileBrowser_FileBrowser from "./contracts/file-browser";
import type * as FileBrowser_React from "react";
import type * as FileBrowser_FilesCore from "./contracts/files-core";
import type * as ColorControls_ColorControls from "./contracts/color-controls";
import type * as ColorControls_React from "react";
import type * as ColorControls_Controls from "./contracts/controls";
import type * as Preview_Preview from "./contracts/preview";
import type * as Preview_Model from "./contracts";
import type * as Preview_React from "react";
import type * as TokenEditors_TokenEditors from "./contracts/token-editors";
import type * as TokenEditors_Model from "./contracts";
import type * as TokenEditors_ColorControls from "./contracts/color-controls";
import type * as TokenEditors_React from "react";
import type * as TokenEditors_Controls from "./contracts/controls";
import type * as TokenEditors_Composition from "./contracts/composition";
import type * as Controls_C from "./contracts/controls";
import type * as Controls_React from "react";
import type * as ControlsExtra_Controls from "./contracts/controls";
import type * as ControlsExtra_React from "react";
import type * as Overlays_Overlays from "./contracts/overlays";
import type * as Overlays_React from "react";
import type * as Dom_Dom from "./contracts/dom";
import type * as Dom_React from "react";
import type * as Dom_Overlays from "./contracts/overlays";
import type * as Interactions_Interactions from "./contracts/interactions";
import type * as Interactions_Controls from "./contracts/controls";
import type * as Interactions_Overlays from "./contracts/overlays";
import type * as Interactions_Dom from "./contracts/dom";
import type * as Interactions_React from "react";
import type * as Layers_Layers from "./contracts/layers";
import type * as Layers_Dom from "./contracts/dom";
import type * as Layers_Overlays from "./contracts/overlays";
import type * as Layers_React from "react";
import type * as ModelCore_ModelCore from "./contracts/model-core";
import type * as ModelCore_Model from "./contracts";
import type * as ModelCore_Application from "./contracts/application";
import type * as ModelCore_StorageModel from "./contracts/model-storage";
import type * as Documentation_Documentation from "./contracts/documentation";
import type * as Documentation_Core from "./contracts";
import type * as Documentation_React from "react";
import type * as Documentation_FileBrowser from "./contracts/file-browser";
import type * as Documentation_Application from "./contracts/application";
import type * as EditorRuntime_EditorRuntime from "./contracts/editor-runtime";
import type * as EditorRuntime_Application from "./contracts/application";
import type * as EditorRuntime_Model from "./contracts";
import type * as EditorRuntime_React from "react";
import type * as EditorRuntime_TokenEditors from "./contracts/token-editors";
import type * as EditorRuntime_ColorControls from "./contracts/color-controls";
import type * as EditorRuntime_Composition from "./contracts/composition";
import type * as EditorRuntime_Controls from "./contracts/controls";
import type * as EditorRuntime_Storage from "./contracts/model-storage";
import type * as EditorRuntime_Preview from "./contracts/preview";
import type * as FilesCore_FilesCore from "./contracts/files-core";
import type * as FilesCore_FilesBoot from "./contracts";
import type * as FilesCore_Host from "./contracts/platform-host";
import type * as PlatformHost_Host from "./contracts/platform-host";
import type * as PlatformHost_React from "react";
import type * as ModelStorage_Storage from "./contracts/model-storage";
import type * as ModelStorage_StorageModel from "./contracts";
import type * as ModelStorage_Host from "./contracts/platform-host";
import type * as ModelStorage_React from "react";
import type * as ModelStorage_Application from "./contracts/application";
import type * as Boot_Boot from "./contracts/boot";
import type * as Boot_Model from "./contracts";
import type * as Boot_Storage from "./contracts/model-storage";
import type * as Boot_Host from "./contracts/platform-host";
import type * as Boot_FilesCore from "./contracts/files-core";
import type * as Boot_Docs from "./contracts/design-system-document";
import type * as Boot_React from "react";
import type * as Boot_Dom from "./contracts/dom";
import type * as Migration_Migration from "./contracts/migration";
import type * as Migration_Model from "./contracts";
import type * as Migration_Files from "./contracts/files-core";
import type * as Migration_Storage from "./contracts/model-storage";
import type * as DesignSystemDocument_DesignDocument from "./contracts/design-system-document";
import type * as DebugPanel_FilesDebug from "./contracts/debug-panel";
import type * as DebugPanel_FilesCore from "./contracts/files-core";
import type * as DebugPanel_Model from "./contracts";
/** Named module contracts prevent loss of React generics and DOM event types at the registry. */
export interface ReviewedRuntimeBindings
  extends Application_Application.ApplicationRuntime,
    Application_Application.NavigationRuntime,
    Application_Application.NavigationSearchRuntime,
    Application_Application.AddTokenDialogRuntime,
    ModelCore_ModelCore.ModelCoreRuntime,
    Migration_Migration.MigrationRuntime {
  absoluteHrefPattern: RegExp;
  acceptRemoteTextEdit: (arg0: string) => void;
  accessibleKeyShortcut: (
    shortcut: string,
    isMac: boolean,
  ) => string | undefined;
  accessiblePreviewDocument: (iframe: HTMLIFrameElement) => {
    d: EditorRuntime_EditorRuntime.PreviewAnimationDocument;
    fw: EditorRuntime_EditorRuntime.PreviewFrameWindow;
  } | null;
  activeArtifactDocument: PlatformHost_Host.ActiveArtifactRuntime | undefined;
  activeConvertingMarker: (
    arg0: unknown,
    arg1: number,
  ) => ModelStorage_Storage.ConvertingMarker | null;
  activeDesignSystemDocument: Boot_Boot.ActiveDocument | undefined;
  activeDesignSystemHasUnsentEdits: () => boolean;
  activeElementIsEditing: (document?: Document) => boolean;
  activeHotReloadSession: PlatformHost_Host.HotReloadBridge | undefined;
  activeIframePointerLocks: number;
  activeNumberScrubCleanup: (() => void) | null;
  activeTooltipActionsRef: Dom_React.RefObject<Dom_Overlays.TooltipInstantActions> | null;
  activityHideElementsContext: Interactions_React.Context<Set<Element> | null>;
  AdaptiveSheetPopupHost: Overlays_React.ComponentType<Overlays_Overlays.AdaptiveSheetPopupHostProps>;
  ADD_DIALOG_HELP_CLASS_NAME: string;
  ADD_DIALOG_ROW_CLASS_NAME: string;
  addAssetFile: (
    content: ModelCore_Model.DesignSystemContent,
    asset: ModelCore_Application.UploadAssetInput,
  ) => ModelCore_Model.DesignSystemContent;
  addCatalogAsset: (arg0: ModelStorage_Storage.ListedAsset) => void;
  addColorToken: (
    content: ModelCore_Model.DesignSystemContent,
    name: string,
    value: unknown,
    afterName?: string,
  ) => ModelCore_Model.DesignSystemContent;
  addConversionUpload: (
    arg0: ModelStorage_Storage.ConversionUpload[],
    arg1: string,
    arg2: string,
    arg3: Uint8Array<ArrayBuffer>,
    arg4?: string,
  ) => void;
  AddDialogField: (
    props: Application_Application.AddDialogFieldProps,
  ) => Application_React.ReactElement;
  AddDialogFieldGroup: (
    props: Application_Application.AddDialogFieldProps,
  ) => Application_React.ReactElement;
  ADDED_FILES_PREFIX: string;
  addedFilesSummary: (
    result: EditorRuntime_Application.AssetUploadSummary,
  ) => string;
  addFoldedDocumentToIndex: (
    index: Migration_Migration.MigrationWireIndex,
    path: string,
  ) => void;
  addFontFace: (
    content: ModelCore_Model.DesignSystemContent,
    font: ModelCore_Application.UploadFontInput,
  ) => ModelCore_Model.DesignSystemContent;
  additionalPassingGroundsMessage: (count: number) => string;
  addMediaQueryListener: (
    mediaQuery: MediaQueryList,
    listener: () => void,
  ) => void;
  ADDRESSED_VERSION_PATH_PATTERN: RegExp;
  addressedDownloadFileUrl: (
    files: EditorRuntime_Model.FileTable,
    path: string,
  ) => string | undefined;
  addressedFileEntry: (
    path: string,
  ) => EditorRuntime_Model.PublishedFileFacts | null | undefined;
  addressedFileSubscribers: Set<() => void>;
  addressedProjectFileUrl: (
    path: string,
    baseURI?: string | undefined,
  ) => string | undefined;
  addressedVersionFromPage: () => string;
  addressedVersionResolver: () => string | undefined;
  addScalarToken: (
    content: ModelCore_Model.DesignSystemContent,
    family: ModelCore_ModelCore.ScalarKind,
    name: string,
    value: unknown,
    afterName?: string,
    extraFamily?: string,
  ) => ModelCore_Model.DesignSystemContent;
  addShadowToken: (
    content: ModelCore_Model.DesignSystemContent,
    name: string,
    value: unknown,
  ) => ModelCore_Model.DesignSystemContent;
  AddTokenDialog: (
    props: Application_Application.AddTokenDialogProps,
  ) => Application_React.ReactElement;
  addTokenDialogTitle: (
    request: Application_Application.AddTokenRequest,
  ) => string;
  addTypographyGroup: (
    content: ModelCore_Model.DesignSystemContent,
    preferredName: string,
  ) => ModelCore_Model.DesignSystemContent;
  addTypographyStyle: (
    content: ModelCore_Model.DesignSystemContent,
    name: string,
    afterName?: string,
    groupName?: string,
  ) => ModelCore_Model.DesignSystemContent;
  ADMITTED_PREVIEW_CDN_PREFIXES: string[];
  advanceAddressedFileSource: (
    state: EditorRuntime_EditorRuntime.AddressedLoadState,
  ) => void;
  advanceShrinkWrapSearch: (
    input: Dom_Dom.ShrinkWrapJob,
    options: boolean,
  ) => number | null;
  afterCssTransitions: (
    input: HTMLElement,
    options: Window,
    context: () => void,
  ) => () => void;
  afterElementAnimations: (
    element: Element,
    onComplete: () => void,
  ) => () => void;
  afterTwoAnimationFrames: (callback: () => void) => void;
  afterTwoAnimationFramesUiToolbarControls: (
    callback: FrameRequestCallback,
  ) => void;
  ALL_SWATCH_HEAD_PIECES: "all";
  allColorTokens: (
    tokens: ModelCore_Model.NormalizedTokens,
  ) => ModelCore_Model.ColorToken[];
  allExtraTokens: (
    tokens: ModelCore_Model.NormalizedTokens,
  ) => ModelCore_Model.ScalarToken[];
  allowAllBinaryFilePointers: boolean;
  allowedEditorHrefPattern: RegExp;
  allowedHostOrigins: string[];
  allowedHrefSchemePattern: RegExp;
  allowedIntentPropertyNames: Set<string>;
  allowlistedStorePath: (
    entry: Migration_Model.FilesMigrationAllowlistEntry,
  ) => string;
  allTypographyStyles: (
    tokens: ModelCore_Model.NormalizedTokens,
  ) => ModelCore_Model.TypographyStyle[];
  ambientCloseReasons: Set<string>;
  androidIntentHrefPattern: RegExp;
  ANGLE_ICON: ColorControls_ColorControls.PropertyIconDefinition;
  animatedIconNames: string[] | undefined;
  animatedIcons: Set<string>;
  animateSegmentedControlThumb: (
    input: HTMLElement,
    options: HTMLElement,
    context: ControlsExtra_Controls.SegmentBounds | null,
    props3?: {
      correction?: boolean;
    },
  ) => () => void;
  animationDurations: Readonly<Record<string, number>>;
  animationEasings: Readonly<Record<string, string>>;
  animationExitDurations: Readonly<Record<string, number>>;
  announceAndWaitToReopen: (
    options: Boot_Boot.AnnounceReopenOptions,
  ) => Promise<void>;
  announceDesignSystemReopened: () => void;
  announceLiveMessage: (
    input: ControlsExtra_Controls.AnnouncementMessage,
    options?: ControlsExtra_Controls.AnnouncementOptions,
  ) => void;
  ANNOUNCEMENT_CLEAR_MS: number;
  ANNOUNCEMENT_SETTLE_MS: number;
  announceReloadRequired: (input?: string) => void;
  announceReopenedArtifact: (
    options: Boot_Boot.AnnounceReopenedOptions,
  ) => boolean;
  anyMenuOrPopoverOpen: (page?: ParentNode) => boolean;
  API_COLLECTION: string;
  APP_DENSITY: import("./contracts/controls").Density;
  AppDesignProvider: (
    props: Composition_React.PropsWithChildren,
  ) => Composition_React.ReactNode;
  appendDefaultLengthUnit: (value: string) => string;
  appendSerializedMarkdownInline: (
    output: FileBrowser_FileBrowser.MarkdownInlineOutput,
    text: string,
  ) => void;
  appendStoredFilesGuidance: (
    arg0: ModelStorage_Storage.ConversionPlan,
  ) => ModelStorage_Storage.ConversionPlan;
  appendTypeLiteral: (
    state: Documentation_Documentation.TypeInferenceState,
    literal: string,
    forceString?: boolean,
  ) => void;
  appleAriaModifierNames: Record<string, string>;
  appleKeyboardUserAgentPattern: RegExp;
  appleKeyLabels: Record<string, string>;
  appleModifierLabels: Record<Dom_Dom.ShortcutModifier, string>;
  applicableCommentOperations: (
    comments: readonly PlatformHost_Host.ArtifactComment[],
    operations: readonly PlatformHost_Host.CommentOperation[],
  ) => PlatformHost_Host.CommentOperation[];
  applyCommentOperations: (
    comments: PlatformHost_Host.ArtifactComment[],
    operations: readonly PlatformHost_Host.CommentOperation[],
  ) => PlatformHost_Host.ArtifactComment[];
  applyCrashStashEdits: (
    stash: FilesCore_FilesBoot.FilesCrashStash,
    currentText: (path: string) => string | null | undefined,
  ) => Promise<FilesCore_FilesCore.CrashStashOffer>;
  applyFileHomeReadAnswers: (
    homes: Boot_Boot.FileHomes,
    answers: Record<string, Boot_Boot.LegacyAnswerKind> | undefined,
  ) => Boot_Boot.FileHomes;
  applyKnownConversionUploads: (
    arg0: ModelStorage_Storage.ConversionPlan,
    arg1: ReadonlyMap<string, ModelStorage_Storage.KnownUploadInput | null>,
    arg2?: ModelStorage_Storage.UploadStamp,
  ) => ModelStorage_Storage.ConversionPlan;
  applyMarkdownFormat: (
    format: FileBrowser_FileBrowser.MarkdownCommand,
    document?: Document,
    currentBlock?: FileBrowser_FileBrowser.MarkdownBlockKind,
  ) => void;
  applyMarkdownLink: (
    input: string,
    document?: Document,
    root?: HTMLElement,
  ) => boolean;
  applyTabFlexCorrection: (
    element: HTMLElement,
    attribute: string | null,
    cssText: string,
  ) => void;
  approximatelyEqualPanelSize: (left: number, right: number) => boolean;
  archiveFileMimeType: (path: string, url: string) => string | null | undefined;
  arePopupPlacementsEqual: (
    arg0: Layers_Layers.PopupPlacement | null,
    arg1: Layers_Layers.PopupPlacement,
  ) => boolean;
  areTabMenuItemsEqual: (
    items: readonly Overlays_Overlays.TabMenuItem[],
    other: readonly Overlays_Overlays.TabMenuItem[],
  ) => boolean;
  arrayElementTypeExpression: (typeText: string) => string;
  ARTIFACT_CLIPBOARD_ATTRIBUTE: string;
  ARTIFACT_CLIPBOARD_PATTERN: RegExp;
  ARTIFACT_FILE_CAPACITY: {
    files: number;
    bytes: number;
  };
  ARTIFACT_FILE_LIMITS: {
    files: number;
    total: number;
    file: number;
    call: number;
    callBytes: number;
  };
  ARTIFACT_LOAD_DELAY_MS: number;
  ARTIFACT_LOAD_FAILURE_MESSAGE: string;
  ARTIFACT_READ_ONLY_PREFIX: string;
  ARTIFACT_REOPENED_STORAGE_KEY: string;
  ARTIFACT_STASH_PREFIX: string;
  artifactDownloadResultMessage: (
    name: string,
    result: Application_Application.ArtifactDownloadOutcome,
    suffix?: string,
  ) => string;
  artifactEditCount: number | undefined;
  artifactEditNow: () => number;
  artifactEditStorageKey: () => null | string;
  artifactEditSubscribers: Set<(count: number) => void>;
  ArtifactErrorBoundary: Composition_React.ComponentClass<
    Composition_React.PropsWithChildren,
    {
      error?: string;
    }
  >;
  artifactHealth: PlatformHost_Host.HealthReporter;
  ArtifactLoadBoundary: (
    props: Composition_Composition.ArtifactLoadBoundaryProps,
  ) => Composition_React.ReactNode;
  ArtifactLoadingSpinner: (props: {
    className?: string;
  }) => Composition_React.ReactNode;
  artifactPageAddress: (
    location2?: Pick<Location, "protocol" | "origin" | "pathname"> | undefined,
  ) => string;
  artifactPathWithoutFrameScope: (
    location?: Pick<Location, "pathname">,
  ) => string;
  ArtifactShell: <Seed>(
    props: Composition_Composition.ArtifactShellProps<Seed>,
  ) => Composition_React.ReactNode;
  ArtifactSkeleton: (props: {
    className?: string;
  }) => Composition_React.ReactNode;
  artifactStashKey: (input: string) => string;
  ArtifactToolbar: (
    props: Composition_Composition.ArtifactToolbarProps,
  ) => Composition_React.ReactNode;
  asciiCharacterCodes: (text: string) => number[];
  asElement: (value: EventTarget | null | undefined) => Element | null;
  assembleCompiledPage: (
    page: PlatformHost_Host.CompiledPage,
    appScript?: string,
  ) => string;
  assessAssetReclamation: (
    arg0: ModelStorage_StorageModel.FileTable,
    arg1?: ReadonlySet<string>,
  ) => ModelStorage_Storage.AssetReclamation | null;
  ASSET_DRAG_MAX_SCROLL_STEP_PX: number;
  ASSET_DRAG_SCROLL_EDGE_PX: number;
  ASSET_DRAG_START_DISTANCE_PX: number;
  ASSET_EXTENSION_ALIASES: Record<string, string>;
  ASSET_EXTENSION_MIME_TYPES: Record<string, string>;
  ASSET_LONG_PRESS_MOVE_TOLERANCE_PX: number;
  ASSET_LONG_PRESS_MS: number;
  ASSET_MIME_EXTENSIONS: Record<string, string>;
  ASSET_RATE_LIMIT_RETRY_MS: number;
  ASSET_RECLAIM_GRACE_PERIOD_MS: number;
  ASSET_SELECTION_CLASS_NAME: string;
  ASSET_STORE_RETRY_MS: number;
  ASSET_THUMBNAIL_RETRY_MS: number;
  ASSET_TILE_SIZES: string[];
  assetActionDisabledProps: (reason: string | undefined) => {
    disabled: boolean;
    disabledReason: string | null;
  };
  assetAddressRoot: (url: string) => string;
  assetCapabilityRequester: () => ((name: string) => Promise<unknown>) | null;
  assetCapabilityRuntime: () => ModelStorage_Storage.AssetSdk | undefined;
  assetCatalogUsage: (
    arg0: ReadonlyMap<string, ModelStorage_Storage.ListedAsset>,
    arg1: {
      maxFiles: number;
      maxBytes: number;
    },
  ) => ModelStorage_Storage.AssetUsage;
  AssetContextMenu: EditorRuntime_React.FunctionComponent<EditorRuntime_EditorRuntime.AssetContextMenuProps>;
  assetDeletionUnavailable: boolean;
  AssetDetailsDialog: EditorRuntime_React.FunctionComponent<EditorRuntime_EditorRuntime.AssetDetailsDialogProps>;
  AssetDetailsPreview: EditorRuntime_React.FunctionComponent<EditorRuntime_EditorRuntime.AssetDetailsPreviewProps>;
  assetDocumentationSlug: (name: string) => string;
  assetDownloadBlockedReason: (
    asset: EditorRuntime_Application.EditorAsset,
    withheld?: boolean,
  ) => string | undefined;
  AssetDragOverlay: EditorRuntime_React.FunctionComponent<EditorRuntime_EditorRuntime.AssetDragOverlayProps>;
  assetDragScrollDelta: (
    clientY: number,
    top: number,
    bottom: number,
  ) => number;
  assetDropTargetAtPoint: (
    document2: Document,
    clientX: number,
    clientY: number,
    leadIds: ReadonlySet<string>,
    allowNewGroup: EditorRuntime_Model.AssetDropTarget | null,
  ) => EditorRuntime_Model.AssetDropTarget | null;
  assetDropTargetsEqual: (
    left: EditorRuntime_Model.AssetDropTarget | null,
    right: EditorRuntime_Model.AssetDropTarget | null,
  ) => boolean;
  assetErrorCode: (arg0: unknown) => string;
  assetFileCountLabel: (count: number) => string;
  assetFileExtension: (fileName: string, mimeType: string) => string | null;
  assetFileIndexAddress: (path: string) => {
    group: string | null;
    key: string;
  } | null;
  assetFileSizeLabel: (bytes: number | undefined) => string;
  assetForEditor: (
    asset: EditorRuntime_Model.ParsedAsset,
  ) => EditorRuntime_Application.EditorAsset;
  assetGroupDirectory: (group: string) => string;
  assetGroupDisplayName: (group: string) => string;
  assetGroupFilePaths: (
    files: ModelCore_Model.FileTable,
    group: string,
  ) => string[];
  AssetGroupGrid: EditorRuntime_React.FunctionComponent<EditorRuntime_EditorRuntime.AssetGroupGridProps>;
  assetGroupPathParts: (path: string) => {
    key: string;
    rel: string;
  } | null;
  assetGroupRelativePath: (
    asset: EditorRuntime_Application.EditorAsset,
    group: EditorRuntime_Application.EditorAssetGroup,
  ) => string;
  assetGroupRenderTiles: (
    groups: EditorRuntime_Application.EditorAssetGroup[],
    drag: EditorRuntime_EditorRuntime.AssetDragView | null,
  ) => Map<string, EditorRuntime_EditorRuntime.AssetTile[]>;
  assetGroupsForEditor: (
    groups: EditorRuntime_Model.ParsedAssetGroup[],
  ) => EditorRuntime_Application.EditorAssetGroup[];
  AssetGroupsList: EditorRuntime_React.FunctionComponent<EditorRuntime_EditorRuntime.AssetGroupsListProps>;
  assetGroupSlug: (name: string, usedSlugs?: Set<string>) => string;
  assetKeyboardDestination: (
    key: string,
    id: string,
    order: string[],
    columns: (id: string) => DOMRect | null,
  ) => string | null;
  assetKindForPath: (
    path: string,
  ) => "svg" | "image" | "video" | "font" | "audio" | "other";
  assetKindLabel: (
    asset: Pick<EditorRuntime_Application.EditorAsset, "kind" | "ext">,
  ) => {
    label: string;
    icon: string;
  };
  assetNameFromFileName: (fileName: string) => string;
  assetPathGroup: (path: string) => {
    group: string;
    rel: string;
  } | null;
  assetRelativeGroupKey: (
    asset: Pick<ModelCore_Model.ParsedAsset, "name" | "subpath">,
  ) => string;
  ASSETS_COLLECTION: string;
  ASSETS_SECTION_LABEL: string;
  assetsCapabilityPromise: Promise<ModelStorage_Storage.AssetsCapability | null> | null;
  assetsCatalogState: ModelStorage_Storage.AssetsCatalogueState;
  assetSelectionRange: (order: string[], from: string, to2: string) => string[];
  assetsStateSubscribers: Set<() => void>;
  assetsTierState: ModelStorage_Storage.AssetsTierState | null;
  assetStorageUsageMessage: (
    arg0: ModelStorage_Storage.AssetsCatalogueState,
    arg1: {
      files: number;
      bytes: number;
    },
  ) => string;
  assetThumbnailGeneration: number;
  assetThumbnailRetryTimers: Map<
    string,
    Promise<EditorRuntime_EditorRuntime.ThumbnailProbeResult>
  >;
  assetThumbnailSourceSnapshot: () => number;
  assetThumbnailSubscribers: Set<() => void>;
  AssetTileThumbnail: (props: {
    a: EditorRuntime_EditorRuntime.AssetThumbnail;
    renderThumb: EditorRuntime_EditorRuntime.AssetGroupsListProps["renderThumb"];
  }) => EditorRuntime_React.ReactElement;
  assetUploadDestination: (
    fileName: string,
    mimeType: string,
    relativePath?: string,
  ) => EditorRuntime_EditorRuntime.UploadDestination;
  assetUploadFailureMessage: (
    arg0: ModelStorage_Storage.AssetUploadFailureKind | undefined,
    arg1: string,
    arg2: number,
    arg3?: string,
  ) => string;
  assetVisibleTileBoundary: (
    tiles: EditorRuntime_EditorRuntime.AssetTile[],
    count: number,
  ) => EditorRuntime_EditorRuntime.AssetTile[];
  assignReactRef: <T>(
    ref: Application_React.Ref<T> | undefined,
    element: T | null,
  ) => void;
  asTokenArray: (value: unknown) => unknown[];
  attachNumberScrubGesture: (
    gesture: ColorControls_ColorControls.NumberScrubGesture,
    ownWindow?: Window,
  ) => () => void;
  authoredIndexMergeConflicts: (
    merge: FilesCore_FilesCore.IndexMergeNotice,
  ) => string[];
  autoCreatedFontFamilyKeys: Set<string>;
  autoformatMarkdownBlock: (
    root: HTMLElement,
    event: Pick<InputEvent, "inputType" | "data">,
    serializeRoot: (root: HTMLElement) => string,
    allowedBlocks?: readonly Documentation_Documentation.MarkdownShortcutBlock[],
    extendedShortcuts?: boolean,
  ) => boolean;
  automaticColorModeScript: string;
  AUTOSAVE_IDLE_MS: number;
  AUTOSAVE_MAX_WAIT_MS: number;
  AUTOSAVE_RETRY_DELAYS_MS: number[];
  autosaveInstaller:
    | ((
        document: ModelStorage_Storage.SystemDocument,
        hold: () => boolean,
      ) => void)
    | undefined;
  availableConflictCopyName: (
    path: string,
    available: (name: string) => boolean,
  ) => string | null;
  awaitIndexedDbRequest: <Result>(
    request: IDBRequest<Result>,
  ) => Promise<Result>;
  BACKGROUND_COLOR_TOKEN_PATTERNS: RegExp[];
  Badge: Controls_C.ForwardComponent<HTMLSpanElement, Controls_C.BadgeProps>;
  badgeIconSpacingClasses: Record<"xs" | "sm" | "md", string>;
  badgeLineHeightClasses: string;
  badgeSizeByDensity: Record<
    Controls_C.Density,
    Record<Controls_C.ControlSize, "xs" | "sm" | "md">
  >;
  badgeVariantClasses: Record<Controls_C.BadgeVariant, string>;
  BASE64_ALPHABET: string;
  BASE64_ALPHABETModelStoredFileCodec: string;
  BASE64_ENCODE_CHUNK_BYTES: number;
  baseSheetPositionerStyle: Dom_Dom.CustomStyle;
  beginColorPickerPointerGesture: (
    event: ColorControls_React.PointerEvent<HTMLElement>,
    onMove: ColorControls_ColorControls.PointerMove,
    onEnd?: () => void,
  ) => () => void;
  beginPanelPointerGesture: (
    event: ColorControls_React.PointerEvent<HTMLElement>,
    onMove: "x" | "y",
    onDone: ColorControls_ColorControls.PanelResizeGesture,
    pointerMode?: "touch" | "all",
  ) => ColorControls_ColorControls.PanelGestureEnd;
  binaryDataUriHeader: (
    arg0: string,
    arg1: string,
  ) => ModelStorage_Storage.BinaryHeader | null;
  binaryFileBytes: (
    files: ModelCore_Model.FileTable,
    path: string,
    catalog: ModelCore_Model.StorageCatalog,
  ) => number;
  BLANK_THUMBNAIL_ATTRIBUTE: string;
  BLOB_FILE_COUNT_OVERFLOW_MESSAGE: string;
  BLOB_ID_PATTERN: RegExp;
  BLOB_POINTER_PREFIX: string;
  BLOB_READ_RETRY_DELAY_MS: number;
  BLOB_STORAGE_ACCEPTED_MIME_TYPES: Set<string>;
  BLOB_STORAGE_LIMITS: ModelStorage_Storage.StorageLimits;
  BLOB_STORAGE_MIME_TYPES: Record<string, string>;
  BLOB_STORE_UNAVAILABLE_MESSAGE: string;
  blobAbsoluteUrl: (arg0: string) => string;
  blobDataUrlCache: Map<string, string>;
  blobFilesOwedToFileStorage: (
    files: FilesCore_FilesBoot.FileTable,
    policy?: FilesCore_FilesCore.FileStoragePolicy,
  ) => {
    path: string;
    id: string;
  }[];
  blobIdFromReference: (arg0: string) => string | null;
  blobIdsInDocumentRecords: (
    arg0: ReadonlyMap<string, ModelStorage_Storage.DatabaseRecord>,
  ) => Set<string>;
  blobIdsInFileText: (arg0: ModelStorage_StorageModel.FileTable) => Set<string>;
  blobPointer: (blobId: string) => string;
  blobReadFailureCounts: Map<string, number>;
  blobReadPromises: Map<string, Promise<string | null>>;
  blobRecordForIndex: (
    name: string,
    record: FilesCore_FilesBoot.StorageRecord,
  ) => FilesCore_FilesBoot.IndexBlobRecord | null;
  blobRelativeUrl: (id: string) => string;
  blobRelativeUrlModelFilePolicy: (blobId: string) => string;
  blobResourceGeneration: number;
  blobResourceSubscribers: Set<() => void>;
  BLOCK_FILE_DROP_HANDLERS: Pick<
    TokenEditors_React.HTMLAttributes<HTMLElement>,
    "onDragEnter" | "onDragOver" | "onDragLeave" | "onDrop"
  >;
  BLOCKED_SCRIPT_IMPORT_GUIDANCE: string;
  BLOCKED_SCRIPT_SOURCE_GUIDANCE: string;
  blockedPreviewScriptReference: (
    html: string,
    cardPath: string,
    strict?: boolean,
  ) => boolean | string;
  blurActivePopupEditor: () => void;
  blurWithSafeRelatedTarget: (
    input: Interactions_Overlays.FocusableElement,
  ) => void;
  BOOT_FILE_READ_RETRY_DELAYS_MS: number[];
  BOOT_LIVE_ANNOUNCEMENT_MESSAGES: Map<string, string>;
  BOOT_LIVE_NOTICE_MESSAGES: Set<string>;
  bootDesignSystemFilesMode: () => Promise<void>;
  bootHealthOutcome: (
    arg0: ModelStorage_Storage.SystemBootResult & {
      errorAt?: string;
    },
    arg1?: boolean,
  ) => ModelStorage_Storage.HealthEvent;
  bootLegacyDesignSystemMode: (
    readOnlyReason?: string,
    storeHandle?: Boot_Boot.NativeLegacyDatabase | null,
    initialStatePromise?: Promise<Boot_Boot.LegacyInitialState>,
    renderReport?: Boot_Boot.HealthReport,
    storeFault?: string,
  ) => Promise<void>;
  bootPerFileDesignSystem: (
    outcome: Boot_Boot.LegacyInitialState,
    readOnlyReason?: string,
    storeHandle?: Boot_Boot.NativeLegacyDatabase | null,
    emptyIndex?: Boot_Model.FilesIndex,
  ) => Promise<void>;
  BootReadError: Boot_Boot.BootReadConstructor;
  BORDER_SIDES_ICON: ColorControls_ColorControls.PropertyIconDefinition;
  BORDER_WEIGHT_ICON: ColorControls_ColorControls.PropertyIconDefinition;
  boundedStorageBytes: (arg0: unknown, arg1?: number) => number;
  boundedStorageText: (arg0: unknown, arg1: number) => string | undefined;
  BOX_SHADOW_PATTERN: RegExp;
  boxShadowSummary: (shadow: string) => TokenEditors_TokenEditors.ShadowSummary;
  BRAND_STARTER_QUESTIONS: string;
  BRAND_UPLOAD_TEXT: Preview_Preview.BrandUploadText;
  BrandUploadGrid: Preview_React.FunctionComponent<Preview_Preview.BrandUploadGridProps>;
  BrandUploadPanel: Preview_React.FunctionComponent<Preview_Preview.BrandUploadPanelProps>;
  brandUploadStatusText: (intake: Preview_Preview.BrandUploadIntake) => string;
  browserIsAutomated: () => boolean;
  buildDesignSystemManifest: (
    system: ModelCore_Model.ParsedDesignSystem,
    name: string,
  ) => ModelCore_ModelCore.DesignSystemManifestResult;
  buildFileBrowserTree: (
    listing: readonly FileBrowser_FileBrowser.BrowserListingEntry[],
  ) => FileBrowser_FileBrowser.BrowserFolder;
  buildFilesIndex: (
    title: string,
    files: FilesCore_FilesBoot.FileTable,
    previous?: FilesCore_FilesBoot.FilesIndex,
  ) => FilesCore_FilesBoot.FilesIndex;
  buildSectionSearchIndex: (
    snapshot: Application_Application.SearchSnapshot,
    sections: Application_Application.SectionRow[],
    titles?: Readonly<Record<string, string>>,
  ) => Application_Application.SearchEntry[];
  BUILTIN_DESIGN_SYSTEM_SECTION_IDS: string[];
  BUILTIN_TOKEN_DOCUMENT_KEYS: string[];
  BUNDLE_PROJECT_REFERENCE_PATTERN: RegExp;
  bundleCssReadsTokens: (
    bundleCss: string | null,
    tokensText: string | null,
    files: Documentation_Core.FileTable,
  ) => boolean;
  bundlePageAddressReferenceCache: WeakMap<
    EditorRuntime_EditorRuntime.PreviewRuntimeHead,
    boolean
  >;
  Button: Controls_C.ForwardComponent<
    Controls_C.ButtonElement,
    Controls_C.ButtonProps
  >;
  buttonBackgroundLayerClasses: string;
  buttonBackgroundShadowClasses: string;
  buttonBackgroundVariants: Controls_C.VariantClasses<{
    variant?: Controls_C.ButtonVariant;
  }>;
  buttonFillLayerClasses: string;
  buttonFocusClasses: string;
  buttonGroupContext: Controls_React.Context<Controls_C.ButtonGroupState | null>;
  buttonIconSizeContext: Controls_React.Context<
    Controls_C.ResolvedIconSize | undefined
  >;
  buttonIndicatorMarginClass: string;
  buttonJoinedFillClasses: string;
  buttonOutsetClasses: Record<"start" | "end" | "both", string>;
  buttonOutsetStyle: Controls_C.DesignStyle;
  buttonPressedFillClasses: string;
  buttonSolidInsetClasses: string;
  buttonVariants: Controls_C.VariantClasses<{
    variant?: Controls_C.ButtonVariant;
    iconOnly?: boolean;
  }>;
  bytesMatchAt: (
    bytes: Uint8Array<ArrayBufferLike>,
    offset: number,
    signature: readonly number[],
  ) => boolean;
  bytesToFileDataUri: (
    bytes: Uint8Array<ArrayBufferLike>,
    mime: string,
  ) => string;
  bytesToFileDataUrl: (mimeType: string, bytes: Uint8Array) => string;
  cachedBlobDataUrl: (url: string) => string | undefined;
  cachedClaudeRoom: () => Promise<EditorRuntime_EditorRuntime.RoomCapability | null>;
  cachedComponentApiCards: Documentation_Documentation.CachedComponentApiCards | null;
  cachedDownloadsWithheld: boolean | undefined;
  cachedFileAvailability: (path: string, bytes: number) => boolean | undefined;
  cachedGeneratedTokensCss: {
    tokens: string;
    name: string;
    fonts: string;
    css: string | null;
  } | null;
  cachedRootRemSize: number | null;
  cachedTypeDeclarationResolver: Documentation_Documentation.ResolverCache | null;
  calculateIconFontWeight: (
    strokeWidth: number,
    masterSize: Interactions_Interactions.IconMasterSize,
    pixels: number,
  ) => number;
  calculateScrollbarThickness: (
    arg0: number,
    arg1: number,
    arg2: number,
  ) => number;
  calculateSheetBounds: (
    restHeight: number,
    availableHeight: number,
    maximumHeightFraction: number,
    canGrow?: boolean,
  ) => Dom_Dom.SheetBounds;
  calculateSheetDragGeometry: (
    bounds: Dom_Dom.SheetBounds,
    rawHeight: number,
  ) => Dom_Dom.SheetDragGeometry;
  Callout: (props: Controls_C.CalloutProps) => Controls_React.ReactElement;
  CALLOUT_PICTOGRAM_SIZE: number;
  calloutDefaultIcons: Record<"danger" | "neutral" | "warning", string>;
  calloutSizeByDensity: Record<Controls_C.Density, Controls_C.ControlSize>;
  calloutTextClasses: Record<"danger" | "neutral" | "warning", string>;
  calloutVariantClasses: Record<"danger" | "neutral" | "warning", string>;
  callSendToClaude: (
    namespace: object,
    payload: EditorRuntime_EditorRuntime.SessionPayload,
    request: EditorRuntime_EditorRuntime.SessionRequest,
  ) => Promise<unknown>;
  callValidatedUserMethod: <Value>(
    name: "id" | "name",
    validate: (value: unknown) => value is Value,
  ) => Promise<Value | null>;
  CAN_SEND_TO_CLAUDE_METHOD: "canSendToClaudeSession";
  cancelAnimations: (input: readonly Animation[]) => void;
  cancelInputDismissingTooltipOpen: (
    input: boolean,
    options: import("@base-ui/react/tooltip").TooltipRootChangeEventDetails,
  ) => boolean;
  cancelNestedMenuClose: (
    open: boolean,
    details: import("@base-ui/react/menu").Menu.Root.ChangeEventDetails,
    treeId?: string,
  ) => boolean;
  cancelShrinkWrapJob: (element: HTMLElement) => void;
  canDelayModalInertRelease: (arg0: Window) => boolean;
  canonicalFilePathWithinPrefix: (prefix: string, path: string) => string;
  canonicalJsonCache: WeakMap<object, string>;
  canonicalJsonString: (arg0: object) => string;
  canRestartArtifact: (
    hot?: FilesCore_FilesCore.FilesHotCapability | null,
    windowName?: string,
  ) => boolean;
  canUseHeldFilePointer: (path: string) => boolean;
  canUseStoragePointer: (path: string) => boolean;
  CanvasEditorJsx: typeof import("react/jsx-runtime");
  capabilitiesUseDatabase: (capabilities: string) => boolean;
  capabilityHasMethod: <Method extends string>(
    methodName: Method,
  ) => (
    input: unknown,
  ) => input is Record<Method, (...args: unknown[]) => unknown>;
  capabilityLoadTimeoutMs: number;
  CapturedDesignSystemCover: (arg0: {
    captured: Boot_Boot.CapturedCover;
    onPainted(): void;
  }) => Boot_React.ReactElement | null;
  captureDesignSystemAndHoldBoot: () => Promise<void>;
  captureFindBarClipboard: (event: ClipboardEvent) => void;
  captureFindBarKey: (event: KeyboardEvent) => void;
  captureNumberScrubPointer: (
    event: ColorControls_React.PointerEvent<HTMLElement>,
  ) => void;
  captureRenameFocusContext: (
    input: HTMLElement,
  ) => TokenEditors_TokenEditors.RenameFocusContext;
  captureShrinkWrapBaseline: (input: HTMLElement) => void;
  CARD_FLASH_DURATION_MS: number;
  CARD_PROJECT_REFERENCE_PATTERN: RegExp;
  CARD_RETRY_TIMEOUT_MS: number;
  CARRIED_DOCUMENTS_DIRECTORY: string;
  CARRIED_FILE_FORMS: ModelStorage_Storage.CarriedForm[];
  carriedDocumentPath: (path: string) => string;
  CdsLayer: (
    props: Interactions_Dom.LayerProps,
  ) => Interactions_React.ReactElement;
  CdsLayerVarBridge: (
    props: Interactions_React.PropsWithChildren<{
      className?: string;
    }>,
  ) => Interactions_React.ReactElement;
  CdsRoot: (arg0: Layers_Layers.CdsRootProps) => Layers_React.ReactElement;
  cdsRouterContext: Layers_React.Context<
    Layers_Overlays.LinkRouter | undefined
  >;
  ceilKilobytesString: (bytes: number) => string;
  CHANGE_EXTRA_KEY_PATTERN: RegExp;
  CHANGE_STANDARD_KEYS: Set<string>;
  CHANGE_UNSAFE_CHARACTER_PATTERN: RegExp;
  changedHeldFilePaths: (
    arg0: ModelStorage_StorageModel.FileTable,
    arg1: ModelStorage_StorageModel.FileTable,
    arg2: (path: string) => boolean,
  ) => string[];
  changedProjectFilePaths: (
    before: FilesCore_FilesBoot.FileTable,
    after: FilesCore_FilesBoot.FileTable,
    title: string,
  ) => {
    files: string[];
    index: boolean;
  };
  Checkbox: Controls_C.ForwardComponent<HTMLElement, Controls_C.CheckboxProps>;
  CHECKBOX_INDICATOR_CLASS: string;
  CHECKBOX_LABEL_ALIGNMENT_CLASS: string;
  CheckboxGlyph: (
    props: Controls_C.CheckboxGlyphProps,
  ) => Controls_React.ReactElement;
  CheckboxVisual: (
    props: Controls_C.CheckboxVisualProps,
  ) => Controls_React.ReactElement;
  checkboxVisualClasses: string;
  checkLayerBase: (input: number, options: number) => void;
  checkShrinkWrapCandidate: (
    input: Dom_Dom.ShrinkWrapJob,
  ) => boolean | "shrank";
  CHIP_FIELD_BUTTON_CLASS: string;
  chooseClaudeDeliveryRoad: (
    request: EditorRuntime_Application.ClaudeRequest,
    context: EditorRuntime_Application.ClaudeDeliveryContext,
    holdOwnerChat: boolean,
  ) => EditorRuntime_Application.ClaudeDeliveryRoad;
  chooseDesignSystemBootMode: (
    options: Boot_Boot.BootModeOptions,
  ) => Promise<"files" | "tree" | "start-tree" | "readonly-store">;
  chooseDesignSystemBootModeModelBoot: (
    arg0: ModelStorage_Storage.SystemBootResult,
    arg1: boolean | null | undefined,
    arg2?: boolean,
  ) => ModelStorage_Storage.SystemBootMode;
  chooseDesignSystemFileHome: (
    homes: Boot_Boot.FileHomes,
  ) => Boot_Boot.FileHomeDecision;
  chooseFileStorageRoute: (
    arg0: ModelStorage_Storage.UploadCandidate,
    arg1: ModelStorage_Storage.UploadBudget,
  ) => ModelStorage_Storage.UploadRoute;
  choosePopoverSide: (
    anchor: Element | null | undefined,
    expectedHeight: number,
    preferredSide?: Composition_Composition.PopoverSide,
    minimumHeight?: number,
  ) => Composition_Composition.PopoverPlacement;
  chooseRegularFontFace: (
    fonts: readonly Documentation_Core.FontFace[],
  ) => Documentation_Core.FontFace | undefined;
  chooseSessionRoute: (
    namespace: EditorRuntime_EditorRuntime.SessionSender,
    availability: unknown,
    confirmed: boolean,
  ) => EditorRuntime_EditorRuntime.SessionRoute | null;
  chooseStoredConversionRoute: (
    arg0: string,
    arg1: string,
    arg2?: number,
  ) => ModelStorage_Storage.StoredConversionRoute;
  chooseTreeBootOutcome: (
    options: Boot_Boot.TreeBootOptions,
  ) => Boot_Boot.TreeBootOutcome;
  ChromeContextMenuConstant: number;
  chunkPublishChanges: (
    arg0: ModelStorage_StorageModel.FilePublishEntries,
  ) => ModelStorage_StorageModel.FilePublishEntries[];
  claimCrashStashTabLock: (tab: string) => () => Promise<Set<string>>;
  clampColorChannel_di: (channel: number) => number;
  clampComponentStageHeight: (height: number | undefined) => number;
  clampFloatingPanelPosition: (
    position: ColorControls_ColorControls.PanelPosition,
    element: HTMLElement | null,
    width?: number,
  ) => ColorControls_ColorControls.PanelPosition;
  clampPanelHeight: (height: number, inset?: number) => number;
  clampPanelWidth: (width: number) => number;
  clampPreviewHeight: (height: number) => number;
  clampSingleLineText: (text: string, maxLength: number) => string;
  clampTypographyNumber: (
    value: number,
    minimum: number,
    maximum: number,
  ) => number;
  classifyAssetUpload: (
    fileName: string,
    extension: string | null,
    bytes: number,
  ) => EditorRuntime_EditorRuntime.UploadClassification;
  classifyDesignSystemFile: (path: string) => ModelCore_Model.FileKind;
  classifyExternalLink: (
    url: string,
    options?: Documentation_Core.EditorLinkOptions,
  ) => string | null;
  classifyFilesBootFailure: (error: unknown) => Boot_Boot.BootFailureClass;
  classifyFileStorage: (
    path: string,
    contents: string,
    policy?: FilesCore_FilesCore.FileStoragePolicy,
  ) => FilesCore_FilesBoot.FileStorageClassification;
  classifyHrefOrigin: (arg0: string, arg1: string) => Layers_Dom.HrefOrigin;
  classifyOpenInputType: (arg0?: Event) => Layers_Layers.PopupInputKind;
  classifyPreviewMessage: (
    event: Pick<MessageEvent<unknown>, "source" | "origin" | "data">,
    frameWindow: Window | null,
    origin: string,
    navigated: boolean,
  ) => EditorRuntime_EditorRuntime.PreviewMessageKind;
  classifySingleFileMigrationSentinel: (
    files: Migration_Migration.MigrationFilesPort,
    listing: Migration_Model.FileListing,
  ) => Promise<string | undefined>;
  classifySyncErrorCode: (arg0: string | undefined) => string;
  classMergeThemeKeys: Record<Interactions_Dom.ThemeClassGroup, string[]>;
  classMergeTypographyScale: string[];
  classMergeTypographyWeights: string[];
  CLAUDE_COMMENT_SENT_MESSAGE: string;
  CLAUDE_PAYLOAD_MAX: number;
  CLAUDE_REQUEST_MAX: number;
  CLAUDE_SELECTION_LABEL_MAX: number;
  CLAUDE_SELECTION_TEXT_MAX: number;
  CLAUDE_SEND_TIMEOUT_MS: number;
  claudeDeliveryStatusMessage: (
    outcome: EditorRuntime_Application.ClaudeDeliveryKind,
    ownerChat?: boolean,
  ) => string;
  claudePayloadLength: (payload: unknown) => number;
  ClaudeRequestButton: EditorRuntime_React.FunctionComponent<EditorRuntime_EditorRuntime.ClaudeRequestButtonProps>;
  ClaudeRequestTimeoutError: new (message?: string) => Error;
  claudeSendResultMessage: PlatformHost_Host.ClaudeSendMessage;
  clearAllToasts: () => void;
  clearColorThemeOverride: (
    content: ModelCore_Model.DesignSystemContent,
    name: string,
    themeId: string,
  ) => ModelCore_Model.DesignSystemContent;
  clearedPreviewStorageWindows: WeakSet<object>;
  clearNonActionToasts: () => void;
  clearPreviewStorageOnce: (
    environment: Pick<Window, "localStorage" | "sessionStorage">,
  ) => void;
  clearRemoteTextUploadFailure: (arg0: string) => void;
  clearSkeletonElapsedStyle: (input: HTMLElement) => void;
  clearTooltipBody: Dom_Overlays.TooltipBodyUpdate;
  clippedOklchColor: (
    lightness: number,
    chroma: number,
    hue: number,
    alpha?: number,
  ) => ColorControls_ColorControls.RgbaColor;
  cloneJsonValue: <T extends FilesCore_FilesCore.JsonMergeValue>(value: T) => T;
  cloneMergeValue: <T>(value: T) => T;
  closedTooltipState: Dom_Overlays.TooltipBodyState;
  CloseOnActivityHideProvider: (
    props: Interactions_Interactions.ActivityHideProviderProps,
  ) => Interactions_React.ReactElement;
  closePreviousTooltip: (
    input: Dom_React.RefObject<Dom_Overlays.TooltipInstantActions>,
  ) => void;
  closestWithinElement: (arg0: Element, arg1: string, arg2: Element) => boolean;
  closeToast: (id: number) => void;
  closeTooltipState: Dom_Overlays.TooltipBodyUpdate;
  cn: (...classValues: import("clsx").ClassValue[]) => string;
  COARSE_PANEL_WIDTH: number;
  COARSE_POINTER_QUERY: string;
  COARSE_POINTER_QUERY_rG: string;
  coarsePointerStores: WeakMap<
    Dom_Dom.MediaQueryWindow,
    Dom_Dom.CoarsePointerStore
  >;
  coarseToolbarPointer: () => boolean;
  codeSpanText: (
    markdown: string,
    span: Documentation_Core.MarkdownCodeSpan,
  ) => string;
  coerceControlOption: (
    control: Documentation_Documentation.InferredControl,
    option: string,
  ) => string | number | boolean;
  coerceMarkdownStringArray: (value: unknown, limit: number) => string[];
  COLLABORATOR_TINTS: (
    | "categorical-1"
    | "categorical-2"
    | "categorical-3"
    | "categorical-4"
    | "categorical-5"
    | "categorical-6"
    | "categorical-7"
    | "categorical-8"
  )[];
  COLLABORATOR_TINTS_WITH_MUTED: (
    | "categorical-1"
    | "categorical-2"
    | "categorical-3"
    | "categorical-4"
    | "categorical-5"
    | "categorical-6"
    | "categorical-7"
    | "categorical-8"
    | "muted"
  )[];
  collapsedBottomMargin: (element: Element, frameWindow: Window) => number;
  collectDownloadFiles: (
    files: EditorRuntime_Model.FileTable,
    paths: EditorRuntime_Model.NormalizedTokens,
    storage: string,
    prefix: EditorRuntime_Model.StorageCatalog,
    fetchBytes?: EditorRuntime_EditorRuntime.DownloadBytesFetcher,
  ) => Promise<{
    entries: EditorRuntime_Application.ZipEntry[];
    skipped: string[];
  }>;
  collectDroppedDirectories: (
    entries: EditorRuntime_EditorRuntime.DroppedEntry[],
    files?: File[],
  ) => Promise<EditorRuntime_EditorRuntime.DroppedFiles>;
  collectFocusableDescendants: (root: Element) => HTMLElement[];
  collectionAndIdForFilePath: (arg0: string) => {
    collection: string;
    id: string;
  };
  collectionFileOverflowMessage: (collection: string) => string;
  collectionOverflowConversionMessage: (collection: string) => string;
  collectTabValues: (
    element: HTMLElement | null,
    tabs: ReadonlyMap<unknown, HTMLElement>,
  ) => Overlays_Overlays.TabMenuItem[];
  collisionPaddingContext: Interactions_React.Context<Interactions_Interactions.CollisionPaddingContext | null>;
  CollisionPaddingProvider: (
    props: Interactions_Interactions.CollisionPaddingProviderProps,
  ) => Interactions_React.ReactNode;
  COLOR_ALIAS_PATTERN: RegExp;
  COLOR_ALPHA_CHECKERBOARD: string;
  COLOR_BORDER_ROLE: number;
  COLOR_CHIP_PATTERN: RegExp;
  COLOR_DOCUMENTATION_GROUPS: Documentation_Documentation.ColorDocumentationGroup[];
  COLOR_FIX_LABEL: string;
  COLOR_FUNCTION_PATTERN: RegExp;
  COLOR_INTERACTION_SUFFIX_PATTERN: RegExp;
  COLOR_LABEL: string;
  COLOR_ON_ROLE: number;
  COLOR_PICKER_POPOVER_CLASS: string;
  COLOR_PICKER_POPOVER_HEIGHT: number;
  COLOR_REQUEST_PENDING_MESSAGE: string;
  COLOR_ROLE_WORDS: string[][];
  COLOR_SEARCH_LABEL: string;
  COLOR_SURFACE_ROLE: number;
  COLOR_SWATCH_BUTTON_CLASS: string;
  COLOR_SWATCH_CLASS: string;
  COLOR_TEXT_ROLE: number;
  colorAliasTarget: (value: string | undefined) => string | undefined;
  ColorChip: (
    props: Composition_Composition.ColorChipProps,
  ) => Composition_React.ReactNode;
  colorContrastFixDescription: (
    request: EditorRuntime_EditorRuntime.ColorContrastFixRequest,
    address: string,
    pronouns: {
      me: string;
      my: string;
    },
  ) => string;
  colorContrastResults: (
    color: string | ColorControls_ColorControls.RgbaColor,
    contrast: ColorControls_ColorControls.ContrastOptions,
  ) => ColorControls_ColorControls.ContrastResult[] | undefined;
  colorContrastSummary: (
    token: string,
    theme: TokenEditors_Model.ColorTheme,
    themes: TokenEditors_Model.ColorTheme[],
    checks: TokenEditors_ColorControls.ContrastResult[],
  ) => TokenEditors_TokenEditors.ContrastRequest;
  colorCssConversionCache: Map<string, string | undefined>;
  colorCssForPicker: (css: string | undefined) => string | undefined;
  colorCssToRgba: (css: string) => string;
  colorGroupsForEditor: (
    tokens: EditorRuntime_Model.NormalizedTokens,
  ) => EditorRuntime_Application.EditorColorGroup[];
  ColorHexInput: ColorControls_React.FunctionComponent<ColorControls_ColorControls.ColorHexInputProps>;
  colorModeBootstrapScript: (mode?: "light" | "dark") => string;
  colorModeStoreContext: Layers_React.Context<
    Layers_Layers.ColorModeStore | undefined
  >;
  ColorPicker: ColorControls_React.FunctionComponent<ColorControls_ColorControls.ColorPickerProps>;
  ColorPickerGroup: ColorControls_React.FunctionComponent<ColorControls_ColorControls.ColorPickerGroupProps>;
  ColorPickerHeader: ColorControls_React.FunctionComponent<ColorControls_ColorControls.ColorPickerLabelProps>;
  ColorPickerLabel: ColorControls_React.FunctionComponent<ColorControls_ColorControls.ColorPickerLabelProps>;
  ColorPropertyRow: (
    props: Composition_Composition.ColorPropertyRowProps,
  ) => Composition_React.ReactNode;
  COLORS_SECTION_LABEL: string;
  ColorSelect: ColorControls_React.FunctionComponent<ColorControls_ColorControls.ColorSelectProps>;
  ColorSelectJsx: typeof import("react/jsx-runtime");
  ColorSelectReact: typeof import("react");
  ColorsSection: TokenEditors_React.FunctionComponent<TokenEditors_TokenEditors.ColorsSectionProps>;
  ColorsSectionHeader: TokenEditors_React.FunctionComponent<
    TokenEditors_TokenEditors.EditorSectionHeaderProps<TokenEditors_TokenEditors.ColorEdit>
  >;
  ColorSwatch: TokenEditors_React.FunctionComponent<TokenEditors_TokenEditors.ColorSwatchProps>;
  ColorTextPropertyRow: (
    props: Composition_Composition.ColorTextPropertyRowProps,
  ) => Composition_React.ReactNode;
  colorThemeGridStyle: (themeCount: number) => {
    style: TokenEditors_Controls.DesignStyle;
  };
  colorTokenIndex: (
    tokens: ModelCore_Model.NormalizedTokens,
  ) => Map<string, ModelCore_Model.ColorToken>;
  colorTokenIndexCache: WeakMap<
    ModelCore_Model.ColorToken[],
    Map<string, ModelCore_Model.ColorToken>
  >;
  colorTokenRole: (name: string, namespace: string) => number;
  ColorTokenRow: TokenEditors_React.FunctionComponent<TokenEditors_TokenEditors.ColorTokenRowProps>;
  colorTrackFraction: (
    clientX: number,
    rectangle: Pick<DOMRect, "left" | "width">,
  ) => number;
  ColorValueCell: TokenEditors_React.FunctionComponent<TokenEditors_TokenEditors.ColorValueCellProps>;
  colorValueForTheme: (
    token: TokenEditors_TokenEditors.EditorColorToken,
    theme: string,
    firstThemeId?: string,
  ) => TokenEditors_TokenEditors.ThemeColorValue;
  colorValueForThemeModelTokens: (
    token: ModelCore_Model.ColorToken,
    themeId: string,
    tokens: ModelCore_Model.NormalizedTokens,
  ) => string;
  Combobox: <Value extends Overlays_Overlays.ComboboxKey>(
    props: Overlays_Overlays.ComboboxProps<Value>,
  ) => Overlays_React.ReactElement;
  ComboboxComponents: Overlays_Overlays.ComboboxComponents;
  comboboxGroupMetadata: <Value extends Overlays_Overlays.ComboboxKey>(
    items: readonly Overlays_Overlays.ComboboxOption<Value>[],
    filter: (item: Overlays_Overlays.ComboboxOption<Value>) => boolean,
    includeGroups: boolean,
  ) => Overlays_Overlays.ComboboxGroupMap<Value>;
  comboboxItemMatchesQuery: <Value extends Overlays_Overlays.ComboboxKey>(
    item: Overlays_Overlays.ComboboxOption<Value>,
    query: string,
  ) => boolean;
  ComboboxOptionRow: Overlays_Overlays.GenericComboboxRow;
  ComboboxRegistrationContext: Overlays_React.Context<Overlays_Overlays.ComboboxRegistration | null>;
  ComboboxRoot: Overlays_Overlays.ComboboxRootComponent;
  comboboxSelectionLabel: <Value extends Overlays_Overlays.ComboboxKey>(
    items: readonly Overlays_Overlays.ComboboxOption<Value>[],
    noun?: string,
    labels?: Overlays_Overlays.LabelResolver,
  ) => string;
  ComboboxStatus: Overlays_Overlays.ForwardComponent<
    HTMLDivElement,
    Overlays_Overlays.ComboboxStatusProps
  >;
  commandCapableDocument: (
    document: ModelStorage_Storage.SystemDocument,
  ) => ModelStorage_Storage.CommandDocument | null;
  COMMENT_AREA_RESIZE_MIN_PX: number;
  COMMENT_DOCUMENT_PREFIX: string;
  COMMENT_TARGET_PROPS: {
    "data-comment-target": string;
  };
  commentAnchorHash: (text: string) => string;
  commentTargetId: (prefix: string, name: string) => string;
  commentTargetProps: (
    prefix: string,
    name: string,
  ) => {
    "data-id": string;
    "data-comment-target": string;
    "data-comment-name": string;
  };
  CommitTextInput: (
    props: Composition_Composition.CommitTextInputProps,
  ) => Composition_React.ReactNode;
  commitUploadedAsset: (
    uploaded: EditorRuntime_Model.UploadedAssetFile,
    result: EditorRuntime_EditorRuntime.UploadedBlob,
    mimeType: string,
    options: EditorRuntime_EditorRuntime.AssetFileUploadOptions,
  ) => EditorRuntime_EditorRuntime.FileUploadResult;
  commitUploadedAssetChange: (
    change: (mutate: EditorRuntime_Application.ContentMutation) => boolean,
    mutate: EditorRuntime_Application.ContentMutation,
    validateFile?: (
      path: string,
      value: string,
    ) => EditorRuntime_Application.FileSaveProblem | undefined,
  ) => EditorRuntime_Application.UploadCommitResult;
  commonTokenNamePrefix: (names: readonly string[]) => string;
  COMPACTABLE_ATTRIBUTE: string;
  compactableControlContext: Overlays_React.Context<Overlays_Overlays.CompactableControlState>;
  compareFileNames: (first: string, second: string) => number;
  compareReferencedAndStoredBlobs: (
    arg0: ModelStorage_StorageModel.FileTable,
    arg1: ReadonlySet<string>,
  ) => ModelStorage_Storage.StorageComparison;
  compiledPageAppId: string;
  compiledPageCapabilitiesMetaName: string;
  compiledPageDocumentId: string;
  compiledPageHtmlAttributes: (capabilities: string) => string;
  compiledPageMaxBytes: number;
  compiledPageModeId: string;
  compiledPageStyleId: string;
  completedToolbarPointerSession: (
    session: ColorControls_ColorControls.ToolbarPointerSession | null,
    allowStray?: boolean,
  ) => ColorControls_ColorControls.CompletedToolbarPointerSession | null;
  completeSingleFileMigrationBoot: (
    options: Boot_Boot.CompleteMigrationOptions,
  ) => void;
  COMPONENT_CARD_ATTRIBUTE_PATTERN: RegExp;
  COMPONENT_CARD_HEADER_PATTERN: RegExp;
  COMPONENT_FILENAMES: {
    preview: string;
    readme: string;
  };
  COMPONENT_NAME_PATTERN: RegExp;
  componentCardMetadata: (
    html: string,
  ) => Documentation_Core.ComponentCardMetadata | null;
  componentFileReferences: (arg0: string, arg1: string) => string[];
  ComponentGuidelines: EditorRuntime_React.FunctionComponent<EditorRuntime_EditorRuntime.ComponentGuidelinesProps>;
  componentGuidelinesPath: (
    system: ModelCore_Model.ParsedDesignSystem,
    componentName: string,
  ) => string;
  componentGuidelineSummary: (markdown: string | null) => string;
  componentManifestEntry: (
    component: ModelCore_Model.ParsedComponent,
  ) => ModelCore_ModelCore.ComponentManifestEntry;
  ComponentPreview: EditorRuntime_React.FunctionComponent<EditorRuntime_EditorRuntime.ComponentPreviewProps>;
  componentPreviewPath: (name: string) => string;
  componentPreviewSource: (
    component: Preview_Preview.PreviewComponent,
    previewHead: Preview_Preview.PreviewHeadResult,
    stage?: Preview_Preview.ComponentPreviewStage,
  ) => Preview_Preview.ComponentPreviewSource;
  ComponentPropField: EditorRuntime_React.FunctionComponent<EditorRuntime_EditorRuntime.ComponentPropFieldProps>;
  ComponentPropsEditor: EditorRuntime_React.FunctionComponent<EditorRuntime_EditorRuntime.ComponentPropsEditorProps>;
  COMPONENTS_COLLECTION: string;
  componentsForEditor: (
    components: EditorRuntime_Model.ParsedComponent[],
  ) => EditorRuntime_Application.EditorComponent[];
  ComponentsSection: EditorRuntime_React.FunctionComponent<EditorRuntime_EditorRuntime.ComponentsSectionProps>;
  ComponentStage: EditorRuntime_React.FunctionComponent<EditorRuntime_EditorRuntime.ComponentStageProps>;
  componentStageStyle: (
    component: EditorRuntime_Application.EditorComponent,
  ) => EditorRuntime_React.CSSProperties;
  composeCommentDocuments: (
    arg0: ReadonlyMap<string, ModelStorage_Storage.DatabaseRecord>,
  ) => ModelStorage_Host.ArtifactComment[];
  composeDesignSystemDocuments: (
    arg0: ModelStorage_Storage.DocumentRecords,
    arg1?: unknown,
  ) => ModelStorage_Storage.ComposedDocument;
  composeLinkEventHandlers: <
    Event extends Layers_React.SyntheticEvent<HTMLElement>,
  >(
    arg0: Layers_React.EventHandler<Event> | undefined,
    arg1: Layers_React.EventHandler<Event> | undefined,
    arg2?: boolean,
  ) => ((event: Event) => void) | undefined;
  composeStoredSystemFiles: (
    arg0: ReadonlyMap<string, ModelStorage_Storage.DatabaseRecord>,
  ) => ModelStorage_Storage.StoredSystemFiles;
  compositeContrastColor: (
    foreground: ColorControls_ColorControls.RgbaColor,
    background: ColorControls_ColorControls.RgbaColor,
  ) => ColorControls_ColorControls.RgbaColor;
  COMPOSITION_TIME_SENTINEL: number;
  compositionLineBreakInputTypes: Set<string>;
  compositionSuppressionResetEvents: string[];
  computeFileBudgetUsage: (
    files: ModelCore_Model.FileTable,
    storedBytesForPath?: (path: string) => number,
    inlineBytesForPath?: (path: string) => number | undefined,
  ) => ModelCore_Model.FileBudgetUsage;
  computeMirrorChanges: (
    arg0: ModelStorage_StorageModel.FileTable,
    arg1: ModelStorage_StorageModel.FileTable,
    arg2?: boolean,
  ) => ModelStorage_StorageModel.FilePublishEntries;
  concealedPopupStyle: Controls_React.CSSProperties;
  concealedSheetHost: Dom_Overlays.SheetRenderState;
  conciseTypeDescription: (typeText: string) => string;
  configureLegacyDesignSystemBoot: (
    outcome: Boot_Boot.LegacyInitialState,
    emptyWriteAccess?: boolean | null,
    readOnlyReason?: string,
  ) => void;
  ConfirmationDialog: (
    props: Overlays_Overlays.ConfirmationDialogProps,
  ) => Overlays_React.ReactElement;
  ConfirmRemoveDialog: TokenEditors_React.FunctionComponent<TokenEditors_TokenEditors.ConfirmRemoveDialogProps>;
  CONFLICT_COPIED_DURATION_MS: number;
  conflictBannerDescription: (
    flag: EditorRuntime_EditorRuntime.ConflictFlag,
  ) => string;
  conflictFileSummary: (path: string, value: string | null) => string;
  conflictingTokenNames: (
    tokens: ModelCore_Model.NormalizedTokens,
    family: ModelCore_ModelCore.TokenKind,
  ) => string[];
  conflictTextDiff: (
    ours: string | null,
    theirs: string | null,
    context?: number,
  ) => EditorRuntime_EditorRuntime.ConflictDiffLine[] | null;
  constantReadOnlyReasonSlot: <Reason>(reason: Reason) => {
    read: () => Reason;
    write: () => boolean;
    clear(): void;
  };
  consumeMigrationNotice: () => string | null;
  consumeMigrationRunningNote: () => null | number | undefined;
  consumeReopenMessage: (
    storage:
      | Pick<globalThis.Storage, "getItem" | "removeItem">
      | null
      | undefined,
    now: number,
  ) => Boot_Boot.ReopenNote | undefined;
  consumeSingleFileMoveNote: () => null | number | undefined;
  consumptionDocumentationCache: Documentation_Documentation.ConsumptionDocumentationCache[];
  consumptionDocumentationForFiles: (
    files: Documentation_Core.FileTable,
    root?: string,
  ) => Documentation_Core.ConsumptionDocumentation;
  containedSegmentThumbClasses: string;
  CONTENT_DESIGN_SYSTEM_SECTIONS: Application_Application.SectionRow[];
  CONTENT_SIGN_IN_REQUIRED_MESSAGE: string;
  contentWithFiles: (
    previousContent: ModelCore_Model.DesignSystemContent,
    files: ModelCore_Model.FileTable,
  ) => ModelCore_Model.DesignSystemContent;
  ContextMenu: (
    props: Composition_Composition.ContextMenuProps,
  ) => Composition_React.ReactNode;
  contextMenuContext: Interactions_React.Context<boolean>;
  contextMenuPopupClasses: string;
  ContextMenuPopupFrame: Layers_Layers.ForwardComponent<
    HTMLDivElement,
    Layers_Layers.MenuPopupElementProps
  >;
  ContextMenuSheetBackdrop: (arg0: {
    sheetPopup: Layers_Overlays.SheetRenderState;
  }) => Layers_React.ReactElement;
  CONTRAST_CLAUSE_BOUNDARIES_PATTERN: RegExp;
  CONTRAST_CLAUSE_BOUNDARY_PATTERN: RegExp;
  CONTRAST_EXCLUDED_TOKEN_WORDS: Set<string>;
  CONTRAST_FAILS_LABEL: string;
  CONTRAST_GROUND_PREPOSITION: string;
  CONTRAST_HEX_PATTERN: RegExp;
  CONTRAST_HIGHLIGHT_WORDS: Set<string>;
  CONTRAST_MINIMUMS: Record<
    NonNullable<"text" | "largeText" | "graphic" | undefined>,
    number
  >;
  CONTRAST_NEGATION_WORDS: Set<string>;
  CONTRAST_ON_VERB_WORDS: Set<string>;
  CONTRAST_ON_WORD_PATTERN: RegExp;
  CONTRAST_PASSES_LABEL: string;
  CONTRAST_POOR_GROUND_PREPOSITION: string;
  CONTRAST_RATIO_EPSILON: number;
  CONTRAST_RGB_PATTERN: RegExp;
  CONTRAST_SURFACE_MODIFIER_WORDS: Set<string>;
  CONTRAST_TEXT_USAGE_PATTERN: RegExp;
  CONTRAST_TOKEN_JOIN_PATTERN: RegExp;
  contrastBackgroundsInUsage: (
    usage: string | undefined,
    name: string,
    matchers: EditorRuntime_EditorRuntime.ContrastMatcher[],
  ) => string[];
  ContrastCaption: ColorControls_React.FunctionComponent<ColorControls_ColorControls.ContrastCaptionProps>;
  ContrastColorDetails: ColorControls_React.FunctionComponent<ColorControls_ColorControls.ContrastColorDetailsProps>;
  contrastColorFix: (
    color: string | ColorControls_ColorControls.RgbaColor,
    contrast: ColorControls_ColorControls.ContrastOptions,
  ) => ColorControls_ColorControls.ContrastFix | undefined;
  contrastColorHex: (color: ColorControls_ColorControls.RgbaColor) => string;
  contrastDisplayInfo: (
    results: ColorControls_ColorControls.ContrastResult[],
  ) => ColorControls_ColorControls.ContrastDisplayInfo;
  ContrastFixButton: ColorControls_React.FunctionComponent<ColorControls_ColorControls.ContrastFixButtonProps>;
  contrastFixDescription: (fix: {
    hex: string;
    ratio: string;
    ground: string;
  }) => string;
  ContrastLockup: ColorControls_React.FunctionComponent<ColorControls_ColorControls.ContrastLockupProps>;
  ContrastMark: ColorControls_React.FunctionComponent<ColorControls_ColorControls.ContrastMarkProps>;
  contrastRatio: (
    foreground: ColorControls_ColorControls.RgbaColor,
    background: ColorControls_ColorControls.RgbaColor,
  ) => number;
  contrastRatioReadout: (ratio: number) => string;
  contrastRatioSpoken: (ratio: number) => string;
  contrastResultCountSummary: (
    result: ColorControls_ColorControls.ContrastCountSentence,
  ) => string;
  contrastResultDetails: (
    result: ColorControls_ColorControls.ContrastDetailsSentence,
  ) => string;
  contrastResultSummary: (
    result: ColorControls_ColorControls.ContrastSentence,
  ) => string;
  contrastRgbCss: (
    color: ColorControls_ColorControls.RgbaColor | undefined,
  ) => string | undefined;
  contrastTokenMatchers: (
    names: Iterable<string>,
    namespace: string,
  ) => EditorRuntime_EditorRuntime.ContrastMatcher[];
  contrastVerdictClass: (passes: boolean) => string;
  CONTROL_LABEL_CLASS: string;
  controlSizeOffsets: Partial<Record<Layers_Layers.ControlSize, number>>;
  conversionFilePriority: (
    arg0: ModelStorage_Storage.ConversionPlan,
    arg1?: ReadonlyMap<string, string[]>,
  ) => Map<string, number>;
  conversionFileReferrers: (
    arg0: ModelStorage_Storage.ConversionPlan,
  ) => Map<string, string[]>;
  CONVERTED_FROM_FIELD: string;
  CONVERTED_FROM_MARKER_KEY: string;
  convertedFromMarker: (
    arg0: ModelStorage_Storage.MigrationStamp,
  ) => ModelStorage_Storage.ConvertedMarker;
  CONVERTING_MARKER_KEY: string;
  copyTextToClipboard: (text: string) => Promise<boolean>;
  CORE_DESIGN_SYSTEM_SECTIONS: Application_Application.SectionRow[];
  CORNER_RADIUS_ICON: ColorControls_ColorControls.PropertyIconDefinition;
  countedChangeNoun: (count: number, noun: string) => string;
  countedFileLabel: (count: number) => string;
  countedPromptNoun: (
    count: number,
    singular: string,
    plural: string,
  ) => string;
  Counter: Controls_C.ForwardComponent<
    HTMLSpanElement,
    Controls_C.CounterProps
  >;
  counterFillClasses: Record<
    "danger" | "neutral" | "accent" | "success" | "warning",
    string
  >;
  counterVariantClasses: Record<
    "danger" | "neutral" | "accent" | "success" | "warning",
    string
  >;
  countMirrorFiles: (arg0: ModelStorage_StorageModel.FileTable) => number;
  countSubstring: (text: string, part: string) => number;
  countSuccessfulUploads: (
    result: EditorRuntime_Application.AssetUploadSummary,
  ) => number;
  COVER_CAPTURE_FETCH_TIMEOUT_MS: number;
  COVER_CAPTURE_FONT_LIMITS: Boot_Boot.CoverFontLimits;
  COVER_CAPTURE_PAGE_WIDTH: number;
  COVER_CAPTURE_REQUIRED_PATHS: string[];
  COVER_CAPTURE_TIMEOUT_MS: number;
  COVER_CAPTURE_VIEWPORT_RATIO: {
    width: number;
    height: number;
  };
  COVER_COMPONENT_DIRECTORY: string;
  COVER_COMPONENT_NAME: string;
  COVER_PREVIEW_WIDTH: number;
  coverCaptureFitWidth: (
    viewportWidth: number,
    viewportHeight: number,
    pageHeight: number,
  ) => number;
  coveredMenuSheetOwners: Layers_Layers.CoveredMenuSheetOwners;
  coverFontDataUri: (bytes: Uint8Array, mime: string) => string;
  coverHtmlContainsScript: (html: string) => boolean;
  coverParentMenuSheet: (arg0: Element, arg1: object) => void;
  CoverPreview: EditorRuntime_React.FunctionComponent<EditorRuntime_EditorRuntime.CoverPreviewProps>;
  coverPreviewHead: (
    cover: EditorRuntime_Preview.PreviewHeadResult,
  ) => EditorRuntime_Preview.PreviewHead;
  CRASH_STASH_DATABASE_NAME: string;
  CRASH_STASH_MAX_AGE_MS: number;
  CRASH_STASH_MAX_ARTIFACT_CHARS: number;
  CRASH_STASH_MAX_ENTRIES: number;
  CRASH_STASH_MAX_TOTAL_CHARS: number;
  CRASH_STASH_OBJECT_STORE: string;
  CRASH_STASH_RETENTION_LABEL: string;
  CRASH_STASH_TAB_LOCK_PREFIX: string;
  crashStashEntrySize: (edit: FilesCore_FilesBoot.StashedFileEdit) => number;
  crashStashIdentityKey: (
    artifact: string,
    viewer: string,
    tab: string,
  ) => string;
  createAddressedFileLoadState: (
    version?: string,
    src?: string,
  ) => EditorRuntime_EditorRuntime.AddressedLoadState;
  createAnalyticsEmitter: (
    transport: EditorRuntime_EditorRuntime.AnalyticsTransport,
  ) => (event: string) => void;
  createAnnouncedHistory: <Command, Seed>(
    history: Composition_Composition.AnnounceHistory<Command, Seed>,
    announce?: (message: string) => void,
  ) => Composition_Composition.AnnounceHistory<Command, Seed>;
  createArtifactDocument: <Content>(
    options: PlatformHost_Host.DocumentOptions<Content>,
  ) => PlatformHost_Host.ArtifactDocument<Content>;
  createArtifactLocalFlag: (flagName: string) => PlatformHost_Host.StorageSlot;
  createBlankThumbnailOverlay: (document2: Document) => void;
  createBrowserFilesPort: (
    options?: FilesCore_FilesCore.BrowserFilesPortOptions,
  ) => FilesCore_FilesCore.BrowserFilesPortExtended;
  createClaudeDeliveryContextStore: (
    resolveContext?: () => Promise<EditorRuntime_Application.ClaudeDeliveryContext>,
  ) => EditorRuntime_Application.ClaudeDeliveryContextStore;
  createCoarsePointerStore: (
    windowObject: Dom_Dom.MediaQueryWindow,
    previousStore: Dom_Dom.CoarsePointerStore | undefined,
  ) => Dom_Dom.CoarsePointerStore;
  createCodeSpanScanner: (
    markdown: string,
  ) => (offset: number) => Documentation_Core.MarkdownCodeSpan | undefined;
  createColorModeStore: (
    arg0: Layers_Layers.ConfiguredColorMode | undefined,
  ) => Layers_Layers.ColorModeStore;
  createCrashStashKit: (
    storage: FilesCore_FilesCore.CrashStashStorageRaw,
    artifact: string,
    viewer: string,
    tab: string,
    now: () => number,
    liveTabs: () => Promise<Set<string>>,
  ) => FilesCore_FilesBoot.FilesCrashStash;
  createCurrentArtifactCrashStash: (
    scope?: string,
  ) => Promise<FilesCore_FilesBoot.FilesCrashStash | null>;
  CREATED_ON_FILES_FIELD: string;
  CREATED_ON_FILES_MARKER_KEY: string;
  createDatabaseAdapter: (
    arg0: ModelStorage_Storage.NativeDatabase,
  ) => ModelStorage_Storage.DatabasePort;
  createDesignSystemCommands: (
    arg0: ModelStorage_Storage.SystemDocument,
    arg1: ModelStorage_Application.FileEditHistory,
    arg2?: ModelStorage_Application.FileEditHistory,
    arg3?: {
      readGivesUpMs?: number;
    },
  ) => ModelStorage_Storage.SystemCommands;
  createDesignSystemFilesDocument: (
    options: DesignSystemDocument_DesignDocument.DesignSystemFilesDocumentOptions,
  ) => DesignSystemDocument_DesignDocument.DesignSystemFilesDocument;
  createDesignSystemFilesPort: (
    port: Migration_Model.BrowserFilesPort,
    options?: Migration_Migration.DesignSystemPortOptions,
  ) => Migration_Migration.DesignSystemFilesPort;
  createDesignSystemMigrationAdapter: (
    fetchBlob: Migration_Migration.FetchMigrationBlob,
    indexPath?: string,
  ) => Migration_Migration.MigrationAdapter;
  createDesignSystemMigrationCodec: (
    fetchBlob: Migration_Migration.FetchMigrationBlob,
  ) => Migration_Migration.MigrationCodec;
  createDirectionalClassGroups: (
    prefix: string,
    tokens: string[],
  ) => Record<string, Record<string, string[]>[]>;
  createdOnFilesMarker: (
    arg0: ModelStorage_Storage.MigrationStamp,
  ) => ModelStorage_Storage.CreatedMarker;
  createEditorSectionNavigationActions: (
    props: Documentation_Application.EditorSectionNavigationActionOptions,
  ) => Documentation_Application.EditorSectionNavigationActions;
  createEmptyFilesIndex: () => FilesCore_FilesBoot.FilesIndex;
  createFileDropHandlers: (
    options: Composition_Composition.FileDropHandlerOptions,
  ) => {
    onDragEnter: Composition_React.DragEventHandler<HTMLElement>;
    onDragOver: Composition_React.DragEventHandler<HTMLElement>;
    onDragLeave: Composition_React.DragEventHandler<HTMLElement>;
    onDrop: Composition_React.DragEventHandler<HTMLElement>;
  };
  createFileMutationBatch: <Mutation extends FilesCore_FilesCore.FileMutation>(
    limit?: number,
  ) => FilesCore_FilesCore.FileMutationBatch<Mutation>;
  createFilesDebugger: (
    options: DebugPanel_FilesCore.FilesDebuggerOptions,
  ) => DebugPanel_FilesCore.FilesDebugger;
  createFilesDebugPanel: (
    options: DebugPanel_FilesCore.FilesDebuggerOptions,
  ) => DebugPanel_FilesCore.FilesDebugger;
  createFilesDebugTabId: () => string;
  createFilesDocument: <
    Index extends {
      v: number;
    },
    Content,
  >(
    options: FilesCore_FilesCore.FilesDocumentOptions<Index, Content>,
  ) => FilesCore_FilesCore.FilesDocument<Index, Content>;
  createFilesHotUpdateController: (
    options: FilesCore_FilesCore.FilesHotOptions,
  ) => FilesCore_FilesCore.FilesHotController;
  createFilesSaveQueue: (
    options: FilesCore_FilesCore.FilesSaveQueueOptions,
  ) => FilesCore_FilesCore.FilesSaveQueue;
  createFocusRegionController: (
    regions: () => Application_Application.FocusRegion[],
    options?: Application_Application.FocusRegionOptions,
  ) => Application_Application.FocusRegionController;
  createFontAttributeStore: () => Dom_Dom.ExternalStore<
    Dom_Dom.DocumentFont | undefined
  >;
  createHealthAndAnalyticsReporter: (
    report: (...args: EditorRuntime_EditorRuntime.HealthReportArgs) => void,
    notify: (event: string) => void,
  ) => EditorRuntime_EditorRuntime.HealthAnalyticsReporter;
  createHostFrameBridge: (
    options: PlatformHost_Host.HostFrameOptions,
  ) => PlatformHost_Host.HostFrameBridge;
  createHotReloadBridge: (
    options?: PlatformHost_Host.HotReloadOptions,
  ) => PlatformHost_Host.HotReloadBridge;
  createIconSizeStyles: (
    size: Interactions_Controls.ResolvedIconSize,
  ) => Interactions_Interactions.IconSizeStyles;
  createInactiveHotReloadBridge: () => PlatformHost_Host.HotReloadBridge;
  createIndexedDbCrashStashKit: (
    options: FilesCore_FilesCore.IndexedCrashStashOptions,
  ) => FilesCore_FilesBoot.FilesCrashStash | null;
  createIndexedDbCrashStashStorage: (
    factory: IDBFactory,
  ) => FilesCore_FilesCore.CrashStashStorageRaw;
  createIndexFileStore: <
    Index extends {
      v: number;
    },
  >(
    options: FilesCore_FilesCore.IndexFileStoreOptions<Index>,
  ) => FilesCore_FilesCore.IndexFileStore<Index>;
  createLegacyDatabasePort: (
    handle: Boot_Boot.NativeLegacyDatabase,
  ) => Boot_Model.FilesMigrationStore;
  createLinkEnterHandler: (
    requiresModifier: boolean,
  ) => Documentation_React.KeyboardEventHandler<HTMLElement>;
  createLiveSwatch: (
    options: EditorRuntime_EditorRuntime.LiveSwatchOptions,
  ) => EditorRuntime_EditorRuntime.LiveSwatch;
  createMarkdownCommitQueue: <Value>(
    delay: number,
    maxDelay: number,
    clock?: Documentation_Core.MarkdownCommitClock,
  ) => Documentation_Core.MarkdownCommitQueue<Value>;
  createMenuVirtualAnchor: (
    input: Pick<Interactions_Overlays.MenuRootState, "triggerRef">,
  ) => {
    readonly contextElement: HTMLElement | undefined;
    getBoundingClientRect(): Omit<DOMRectReadOnly, "toJSON">;
  };
  createMigrationEditingHold: (host: Window) => Boot_Boot.EditingHold;
  createMigrationPublisher: (
    files: Migration_Migration.MigrationFilesPort,
    timers: Migration_Model.FilesTimers,
    stillOwnsLease?: () => boolean | Promise<boolean>,
  ) => {
    calls: () => number;
    publish(
      input: Migration_Model.FilePublishEntries,
      options?: Migration_Model.FilePublishPreconditions,
    ): Promise<Migration_Model.FilePublishResult>;
  };
  createMutableValue: <Value>() => Dom_Dom.MutableCell<Value>;
  createNavigationPillActivity: (
    hold: number,
    onChange: (active: boolean) => void,
    clock?: Application_Application.NavigationPillClock,
  ) => Application_Application.NavigationPillActivity;
  createNoopFilesDebugger: () => DebugPanel_FilesCore.FilesDebugger;
  createNumberScrubGesture: (
    getOptions: () => ColorControls_ColorControls.NumberScrubOptions,
    startX: number,
  ) => ColorControls_ColorControls.NumberScrubGesture;
  createOptionalRefCallback: <Args extends unknown[], Result>(
    input: Dom_React.RefObject<((...args: Args) => Result) | undefined>,
  ) => (...args: Args) => Result | undefined;
  createOptionListKeyHandler: (
    selector: string,
    options?: {
      across?: boolean;
    },
  ) => Composition_React.KeyboardEventHandler<HTMLElement>;
  createOverlayStack: () => Layers_Dom.OverlayStack;
  createPageMirrorPublisher: (
    arg0?: ModelStorage_Storage.MirrorPublisherOptions,
    arg1?: () => Promise<ModelStorage_Storage.SelfPublishCapability | null>,
  ) => ModelStorage_Host.Publisher;
  createParseReport: () => {
    dropped: never[];
    warnings: never[];
  };
  createPassiveOpenState: () => Layers_Layers.PassiveOpenGateState;
  createPinnedSheetMeasurement: (
    element: HTMLElement,
    height: number,
    canGrow: boolean,
  ) => {
    contentHeight: number;
    written: number;
    chromeAtPin: number;
    chromeSettled: number;
    grows: boolean;
  };
  createPreviewHead: (
    system: Preview_Preview.PreviewSystem,
    mode?: Preview_Preview.PreviewMode,
    themeId?: string,
    transparent?: boolean,
    ground?: string,
    preferUrl?: boolean,
  ) => Preview_Preview.PreviewHeadResult;
  createPreviewLifecycleScript: (
    admittedCdnPrefixes: readonly string[],
  ) => string;
  createPublishedFilesRegistry: (
    options?: EditorRuntime_EditorRuntime.PublishedRegistryOptions,
  ) => EditorRuntime_EditorRuntime.PublishedFilesRegistry;
  createPublishedPreviewCache: (
    options?: EditorRuntime_EditorRuntime.PublishedPreviewCacheOptions,
  ) => EditorRuntime_EditorRuntime.PublishedPreviewCache;
  createRequiredRefCallback: <Args extends unknown[], Result>(
    input: Dom_React.RefObject<(...args: Args) => Result>,
  ) => (...args: Args) => Result;
  createResolvedThemeSnapshot: (
    configuration?: Interactions_Interactions.ThemeConfiguration | null,
    previous?: Interactions_Interactions.ThemeSnapshot,
  ) => Interactions_Interactions.ThemeSnapshot | undefined;
  createRuntimeArtifactDocument: <Content>(
    options: PlatformHost_Host.RuntimeDocumentOptions<Content>,
  ) => PlatformHost_Host.ArtifactDocument<Content>;
  createSafeMutationObserver: (
    ObserverConstructor: typeof MutationObserver,
    callback: MutationCallback,
  ) => Dom_Dom.SafeMutationObserver;
  createSafeObserver: <Observer>(
    constructObserver: () => Observer,
  ) => Dom_Dom.SafeObserver<Observer>;
  createSafeResizeObserver: (
    ObserverConstructor: typeof ResizeObserver,
    callback: ResizeObserverCallback,
  ) => Dom_Dom.SafeResizeObserver;
  createSelfPublisher: () => PlatformHost_Host.Publisher;
  createSessionStorageSlot: (key: string) => PlatformHost_Host.StorageSlot;
  createSheetUncoverGate: (
    element: HTMLElement,
    onReady: () => void,
  ) => {
    ready: () => boolean;
    dispose: () => void;
  };
  createShrinkWrapJob: (
    input: HTMLElement,
    options: (width: number | null) => void,
  ) => Dom_Dom.ShrinkWrapJob;
  createSingleFileMigrationAdapter: (
    fetchBlob: Migration_Migration.FetchMigrationBlob,
  ) => Migration_Migration.SingleFileMigrationAdapter;
  createSingleFileMigrationFiles: (
    files: Migration_Migration.MigrationFilesPort,
    adapter: Migration_Migration.SingleFileMigrationAdapter,
    readSingleFile: Migration_Migration.ReadSingleFile,
    timers?: Migration_Model.FilesTimers,
  ) => Migration_Migration.MigrationFilesPort;
  createSingleFileMigrationStore: (
    store: Migration_Model.FilesMigrationStore,
    readSingleFile: Migration_Migration.ReadSingleFile,
  ) => Migration_Model.FilesMigrationStore;
  createSkeletonShownStore: () => Controls_C.SkeletonShownStore;
  createStoredZip: (
    entries: EditorRuntime_Application.ZipEntry[],
  ) => Uint8Array;
  createStoreToFilesFoldController: <
    Index extends object = Migration_Migration.MigrationWireIndex,
  >(
    options: Migration_Migration.StoreFoldOptions<Index>,
  ) => Migration_Migration.StoreFoldController;
  createSystemFilesPublisher: (
    arg0?: ModelStorage_Storage.MirrorPublisherOptions,
    arg1?: () => Promise<ModelStorage_Storage.SelfPublishCapability | null>,
  ) => ModelStorage_Host.Publisher;
  createTabMenuItem: (
    value: unknown,
    element: Element,
  ) => Overlays_Overlays.TabMenuItem;
  createTextCommitController: (
    options: Composition_Composition.TextCommitOptions,
  ) => Composition_Composition.TextCommitController;
  createThemeStore: (
    configuration?: Interactions_Interactions.ThemeConfiguration | null,
  ) => Interactions_Interactions.ThemeStore;
  createTypeInferenceState: () => Documentation_Documentation.TypeInferenceState;
  createUndoKeyHandler: (
    history: Composition_Composition.UndoActions,
  ) => (event: KeyboardEvent) => void;
  createUploadBatchState: () => EditorRuntime_Model.AssetUploadBatchState;
  CSS_FILE_REFERENCE_PATTERN: RegExp;
  CSS_GENERIC_FONT_FAMILIES: Set<string>;
  CSS_LENGTH_PATTERN: RegExp;
  CSS_PROPERTY_DECLARATION_PATTERN: RegExp;
  CSS_VAR_DECLARATION_PATTERN: RegExp;
  CSS_VAR_REFERENCE_PATTERN: RegExp;
  CSS_VARIABLE_TOKEN_FAMILIES: ModelCore_ModelCore.ValueTokenKind[];
  cssLengthInputBounds: (
    unit: string,
    minimum: number,
    maximum: number,
  ) => [number, number];
  cssLengthInputStep: (unit: string) => number;
  cssLengthPreviewPixels: (value: string) => number | null;
  cssReadsTokensCache: Documentation_Documentation.CssReadsTokensCache[];
  CURRENCY_NUMBER_PART_TYPES: Set<keyof Intl.NumberFormatPartTypeRegistry>;
  currencyDisplayParts: (
    currency: string,
    locale?: Intl.LocalesArgument,
  ) => ControlsExtra_Controls.CurrencyDisplayParts;
  currentAddressedFileSource: (
    state: EditorRuntime_EditorRuntime.AddressedLoadState,
    getSource: EditorRuntime_EditorRuntime.FileSource,
  ) => string | undefined;
  currentArtifactReadOnlySlot: () => PlatformHost_Host.StorageSlot;
  currentArtifactStash: () => PlatformHost_Host.StorageSlot;
  currentDesignSystemArtifactPath: (
    location?: Pick<Location, "pathname">,
  ) => string;
  currentHotReloadBridge: (
    hot?: PlatformHost_Host.HotCapability | null,
  ) => PlatformHost_Host.ActiveHotReloadBridge | undefined;
  currentStoredSystemMetadata: ModelStorage_Storage.StoredSystemMetadata | null;
  currentSystemDocumentRecords: ModelStorage_Storage.DocumentRecords;
  currentUserCan: (capability: string) => Promise<boolean | null>;
  currentUserCanEdit: () => Promise<null | boolean | undefined>;
  currentUserCanEditAsync: () => Promise<null | boolean | undefined>;
  currentUserId: () => Promise<string | null>;
  CUSTOM_FONT_FAMILY_SENTINEL: string;
  customIconBaseStyle: Interactions_React.CSSProperties;
  DAMAGED_FILE_REPLACEMENT_CHARACTER: string;
  damagedDerivedProjectPaths: (
    files: FilesCore_FilesBoot.FileTable,
  ) => string[];
  damagedTextFiles: (tree: {
    files: Map<string, FilesCore_FilesBoot.FilePublishInput>;
  }) => {
    path: string;
    why: string;
  }[];
  dangerButtonFocusClasses: string;
  dangerFocusShadowByMode: Record<"light" | "dark", string>;
  DARK_COLOR_SCHEME_QUERY: string;
  darkThemeId: (system: Preview_Preview.PreviewSystem) => string | undefined;
  DarkTooltipScope: (
    props0: Dom_React.PropsWithChildren,
  ) => Dom_React.ReactElement;
  DASHED_STROKE_ICON: ColorControls_ColorControls.PropertyIconDefinition;
  DATA_URI_HEADER_PATTERN: RegExp;
  databaseCapabilityKey: string;
  dataTransferHasFiles: (data: DataTransfer | null) => data is DataTransfer;
  DB_ERROR_CODES: string[];
  decimalPlaces: (value: number) => number;
  declinesInitialFocus: (
    arg0: Layers_Layers.InitialPopupFocus | undefined,
    arg1: Layers_Layers.PopupInputKind,
  ) => boolean;
  decodeBase64Bytes: (arg0: string) => Uint8Array<ArrayBuffer>;
  decodeBytesBase64: (text: string) => Uint8Array<ArrayBuffer>;
  decodeCleanUtf8: (bytes: Uint8Array<ArrayBufferLike>) => string | null;
  decodeFileDataUri: (
    uri: string,
  ) => FileBrowser_FileBrowser.DownloadData | null;
  decodeFileDataUrl: (url: string) => Uint8Array<ArrayBuffer> | null;
  decodeFileIndexKey: (key: string) => string;
  decodeFontDataUrl: (dataUrl: string) => ArrayBuffer | null;
  decodeHeldFileDataUri: (uri: string) => FilesCore_FilesCore.FileData | null;
  decodeMarkdownEscapes: (
    markdown: string,
    preserveBackslashes?: boolean,
  ) => string;
  decomposeCommentDocuments: (
    arg0: readonly ModelStorage_Host.ArtifactComment[],
    arg1: ReadonlyMap<string, ModelStorage_Storage.DatabaseRecord> | undefined,
    arg2: ModelStorage_Storage.DocumentRecords,
  ) => void;
  decomposeDesignSystemDocuments: (
    arg0: ModelStorage_Host.ArtifactEnvelope<ModelStorage_StorageModel.DesignSystemContent>,
    arg1?: ReadonlyMap<string, ModelStorage_Storage.DatabaseRecord>,
    arg2?: ModelStorage_Storage.SystemCarry,
  ) => ModelStorage_Storage.DocumentRecords;
  DECREASE_LABEL: string;
  deduplicatedUploadedAsset: (
    file: EditorRuntime_Model.StorageCatalog,
    bytes: string,
    existingIds: ReadonlySet<string>,
  ) => EditorRuntime_EditorRuntime.UploadedBlob | null;
  DEFAULT_ASSET_TILE_SIZE: ModelCore_Model.AssetTileSize;
  DEFAULT_BOX_SHADOW: string;
  DEFAULT_BOX_SHADOW_VALUES: TokenEditors_TokenEditors.SingleBoxShadow;
  DEFAULT_CLOSE_LABEL: string;
  DEFAULT_COLLISION_PADDING: number;
  DEFAULT_COMPONENT_PREVIEW_HEIGHT: number;
  DEFAULT_COMPONENT_STAGE_HEIGHT: number;
  DEFAULT_COVER_PREVIEW_HEIGHT: number;
  DEFAULT_DESIGN_SYSTEM_FILES_CODEC: FilesCore_FilesCore.DesignFilesCodec;
  DEFAULT_EDITOR_FEATURE_FLAGS: Partial<Record<string, boolean>>;
  DEFAULT_FILE_STORAGE_POLICY: FilesCore_FilesCore.FileStoragePolicy;
  DEFAULT_FILE_VERSION_CAPS: FilesCore_FilesCore.FileVersionCaps;
  DEFAULT_HOST_ORIGINS: string[];
  DEFAULT_ICON_SIZE: Interactions_Controls.IconSize;
  DEFAULT_PREVIEW_HEIGHT: number;
  DEFAULT_RELOAD_MESSAGE: string;
  DEFAULT_ROOT_FONT_SIZE: number;
  DEFAULT_SHOWCASE_PREVIEW_WIDTH: number;
  DEFAULT_SKELETON_MOTION: Controls_C.SkeletonMotion;
  DEFAULT_STATIC_PREVIEW_PAGE_WIDTH: number;
  DEFAULT_TOKEN_CARD_MODE: string;
  DEFAULT_TYPE_SAMPLE: string;
  defaultColorModeStore: Layers_Layers.ColorModeStore;
  defaultCompiledPageCapabilities: string;
  defaultCoverCaptureReader: Boot_Boot.CoverCaptureReader;
  defaultFilesSaveTimers: () => FilesCore_FilesBoot.FilesTimers;
  defaultFloatingPanelTop: (element: HTMLElement | null) => number;
  defaultFontFamilyStack: (name: string) => string;
  defaultPreviewThemeId: (
    system: Preview_Preview.PreviewSystem,
    mode: Preview_Preview.PreviewMode,
  ) => string | undefined;
  defaultSheetHost: Dom_Overlays.SheetRenderState;
  defaultSheetState: Dom_Dom.SheetState;
  defaultSubmenuState: Interactions_Overlays.MenuItemState;
  defaultThemeStore: Interactions_Interactions.ThemeStore;
  defaultTooltipImplementation: Dom_Overlays.TooltipImplementation;
  DeferredDisabledReasonTooltip: (
    props: Overlays_Overlays.DisabledTooltipProps,
  ) => Overlays_React.ReactElement;
  DeferredTooltip: (
    props: Overlays_Overlays.TooltipProps,
  ) => Overlays_React.ReactElement;
  deferredTooltipImplementationContext: Overlays_React.Context<Overlays_Overlays.DeferredTooltipScope | null>;
  defineOwnEnumerableProperty: (
    target: object,
    key: PropertyKey,
    value: unknown,
  ) => void;
  DelayedScreenReaderLabel: (
    props: Overlays_Overlays.DelayedSpinnerProps,
  ) => Overlays_React.ReactNode;
  DELETE_DOCUMENT_RECORD: symbol;
  deleteAssetFile: (
    content: ModelCore_Model.DesignSystemContent,
    path: string,
  ) => ModelCore_Model.DesignSystemContent;
  deleteAssetFiles: (
    content: ModelCore_Model.DesignSystemContent,
    paths: string[],
  ) => ModelCore_Model.DesignSystemContent;
  deleteColorTokens: (
    content: ModelCore_Model.DesignSystemContent,
    names: string[],
  ) => ModelCore_Model.DesignSystemContent;
  deleteDesignSystemFiles: (
    content: ModelCore_Model.DesignSystemContent,
    paths: string[],
  ) => ModelCore_Model.DesignSystemContent;
  deleteFontFace: (
    content: ModelCore_Model.DesignSystemContent,
    path: string,
  ) => ModelCore_Model.DesignSystemContent;
  deleteStoredAssets: (
    assetsToDelete: readonly ModelStorage_Storage.OrphanedAsset[],
    providedAssets?: Pick<
      ModelStorage_Storage.AssetsCapability,
      "delete"
    > | null,
    options?: ModelStorage_Storage.AssetRetryOptions,
  ) => Promise<ModelStorage_Storage.AssetDeletionResult>;
  deleteToken: (
    content: ModelCore_Model.DesignSystemContent,
    family: ModelCore_ModelCore.TokenKind,
    name: string,
  ) => ModelCore_Model.DesignSystemContent;
  deleteTypographyGroup: (
    content: ModelCore_Model.DesignSystemContent,
    name: string,
  ) => ModelCore_Model.DesignSystemContent;
  deliverClaudePrompt: (
    request: EditorRuntime_Application.ClaudeRequest,
    anchor: Element | null | undefined,
    sender?: object | null,
    environment?: EditorRuntime_EditorRuntime.ClaudeEnvironment,
    copy?: (text: string) => Promise<boolean>,
  ) => Promise<EditorRuntime_Application.ClaudeDeliveryResult>;
  deliverClaudeRequest: (
    request: EditorRuntime_Application.ClaudeRequest,
    anchor: Element | null | undefined,
    context: EditorRuntime_Application.ClaudeDeliveryContext,
    holdOwnerChat?: boolean,
    environment?: EditorRuntime_EditorRuntime.ClaudeEnvironment,
    copy?: (text: string) => Promise<boolean>,
  ) => Promise<EditorRuntime_Application.ClaudeDeliveryResult>;
  densityContext: Layers_React.Context<Layers_Layers.Density>;
  densityOverrideContext: Layers_React.Context<
    Layers_Layers.Density | undefined
  >;
  densitySizeIndices: Record<Layers_Layers.Density, number>;
  DERIVED_REFRESH_DELAY_MS: number;
  derivedProjectFiles: (
    files: FilesCore_FilesBoot.FileTable,
  ) => Map<string, string>;
  describeHotChangedPaths: (
    changes: FilesCore_Host.HotFileChange[] | null,
    isCode: (path: string) => boolean,
  ) =>
    | {
        path: string;
        kind: string;
        klass: string;
      }[]
    | null;
  describeIndexConflictPath: (
    path: string,
    index: FilesCore_FilesBoot.FilesIndex,
  ) => string;
  describeIndexConflicts: (
    paths: readonly string[],
    index: FilesCore_FilesBoot.FilesIndex,
  ) => string[];
  describeStuckSave: (stuck: Boot_Boot.StuckSave, now?: number) => string;
  describeUploadProblem: (
    props: EditorRuntime_EditorRuntime.UploadProblem,
  ) => string;
  DESIGN_SYSTEM_CHANGED_MESSAGE: string;
  DESIGN_SYSTEM_COLLECTIONS: string[];
  DESIGN_SYSTEM_CONTENT_PROMPT_SUFFIX: string;
  DESIGN_SYSTEM_COVER_PREVIEW_PATH: string;
  DESIGN_SYSTEM_DEMO_PATH: string;
  DESIGN_SYSTEM_DOCUMENT_CODEC: ModelStorage_Storage.SystemDocumentCodec;
  DESIGN_SYSTEM_ENVELOPE_PATH: string;
  DESIGN_SYSTEM_INLINE_LIMITS: {
    readme: number;
    tokens: number;
    manifest: number;
    bundleJs: number;
    bundleCss: number;
    dtsTotal: number;
    preview: number;
    componentReadme: number;
    componentLib: number;
    font: number;
    asset: number;
    other: number;
    imageSlotState: number;
    total: number;
  };
  DESIGN_SYSTEM_MANIFEST_VERSION: number;
  DESIGN_SYSTEM_MIGRATION_LOCK_PATH: string;
  DESIGN_SYSTEM_PATHS: {
    readme: string;
    tokens: string;
    manifest: string;
    componentsDir: string;
    libDir: string;
    bundleJs: string;
    bundleCss: string;
    indexDts: string;
    fontsDir: string;
    assetsDir: string;
    archivedDir: string;
  };
  DESIGN_SYSTEM_READONLY_MESSAGE: string;
  DESIGN_SYSTEM_REOPEN_WATCHDOG_MS: number;
  DESIGN_SYSTEM_REOPENED_MESSAGE: string;
  DESIGN_SYSTEM_SETUP_MESSAGE: string;
  DESIGN_SYSTEM_STORE_ALLOWLIST: Migration_Model.FilesMigrationAllowlistEntry[];
  DESIGN_SYSTEM_TYPE_DEMO_STATE: ModelStorage_Storage.RawDocumentSeed;
  DESIGN_SYSTEM_TYPE_HOST_IDS: Set<string>;
  DESIGN_SYSTEM_UPDATE_PROMPT_SUFFIX: string;
  DesignSystemApp: () => Application_React.ReactElement;
  designSystemBootStartedAt: number;
  designSystemCarryKey: (
    viewer: string | null | undefined,
    artifactPath?: string,
  ) => string;
  designSystemDocumentIsReadonly: (
    doc: FileBrowser_FileBrowser.DesignFilesDocument,
  ) => boolean;
  designSystemEditorView: (
    model: EditorRuntime_Model.ParsedDesignSystem,
  ) => EditorRuntime_Application.ApplicationView;
  designSystemFileHome: (
    path: string,
    context: FileBrowser_FileBrowser.FileHomeContext,
  ) => FileBrowser_FileBrowser.FileHome;
  designSystemFileHomeDecision: Boot_Boot.FileHomeDecision;
  designSystemFileHomes: Boot_Boot.FileHomes;
  designSystemFilesCodec: (
    indexPath: string,
    lazy?: FilesCore_FilesCore.LazyReadState,
  ) => FilesCore_FilesCore.DesignFilesCodec;
  designSystemFilesDebugger: Boot_FilesCore.FilesDebugger | undefined;
  DesignSystemFilesLayer: (
    props: FileBrowser_FileBrowser.DesignFilesLayerProps,
  ) => FileBrowser_React.ReactNode;
  designSystemFilesMigrationTree: (
    system: Migration_Migration.LegacyMigrationSystem,
    sourcesFor: (path: string) => string[],
  ) => {
    files: Map<string, Migration_Model.FilePublishInput>;
    index: Migration_Model.FilesIndex;
    sources: Map<string, string[]>;
  };
  designSystemFirstPaint: Promise<void>;
  designSystemMigrationDbRules: () => Migration_Migration.DatabaseRule[];
  DesignSystemMigrationError: new (code: string) => Error & {
    code: string;
  };
  designSystemMigrationNextAction: (
    outcome: Migration_Migration.MigrationOutcome,
  ) => Migration_Migration.MigrationNextAction;
  designSystemMigrationTimers: Boot_Model.FilesTimers;
  DesignSystemReactRuntime: typeof import("react");
  designSystemReopenPending: boolean;
  designSystemRestartFunction: () =>
    | ((options: { note: string }) => void)
    | undefined;
  designSystemSections: (
    extra: Application_Application.EditorExtraScale[],
  ) => Application_Application.SectionRow[];
  designSystemStateLayout: (
    input: Boot_Boot.RawEnvelope,
  ) => "tree" | "envelope";
  DesignSystemStore: new (
    document?: ModelStorage_Storage.SystemDocument,
    options?: ModelStorage_Storage.StoreOptions,
  ) => ModelStorage_Storage.DesignSystemStore;
  designSystemTypeReadonlyReason: () => string;
  designSystemTypingListenerInstalled: boolean;
  desktopPlatformUserAgentPattern: RegExp;
  desktopTitlebarStores: WeakMap<
    Document,
    Interactions_Dom.ExternalStore<number>
  >;
  detectAutoSavingArtifactRuntime: () => Promise<void>;
  detectCdsPlatform: () => Layers_Layers.CdsPlatform;
  detectColorAliasCycle: (
    tokens: ModelCore_Model.NormalizedTokens,
    name: string,
    themeId: string,
    proposedValue: string,
  ) =>
    | {
        theme: string;
        via: string[] | "deep";
      }
    | undefined;
  detectCompiledPageStorageMode: (
    document2: Document,
  ) => "db" | "page" | "files";
  detectNonCodeText: (text: string) => string | undefined;
  determineSheetRelease: (
    bounds: Dom_Dom.SheetBounds,
    release: Dom_Dom.SheetDragRelease,
  ) => Dom_Dom.SheetRelease;
  determineSlidesWriteAccess: () => Promise<PlatformHost_Host.WriteAccess>;
  Dialog: Overlays_Overlays.DialogComponents;
  DIRECT_PATH_COLLECTIONS: string[];
  DISABLED_REASON_ATTRIBUTE: string;
  disabledMarkdownFormats: (
    format: Documentation_Core.MarkdownFormatState,
    hasSelection: boolean,
    selectedStyles?: Documentation_Documentation.SelectionStyleState,
  ) => {
    bold: string | undefined;
    italic: string | undefined;
    link: string | undefined;
  };
  DisabledReasonAnnouncement: (props0: {
    id?: string;
    reason?: Dom_React.ReactNode;
  }) => Dom_React.ReactElement;
  disabledReasonFocusClasses: string;
  DisabledReasonTooltip: (
    props0: Dom_Overlays.DisabledTooltipProps,
  ) => Dom_React.ReactElement;
  DISAMBIGUATED_CURRENCY_CODES: Set<string>;
  discardRemoteTextEdit: (arg0: string) => void;
  dismissalKeys: Set<string>;
  disposeThemeApplication: (
    cleanupRef: Interactions_React.RefObject<(() => void) | void>,
  ) => void;
  DOCS_GLOBAL_IDENTIFIER_PATTERN: RegExp;
  DOCUMENT_NODE_TYPE: number;
  documentationManifestFacts: (
    manifest: Documentation_Documentation.RawDocManifest,
  ) => Documentation_Documentation.ManifestDocumentationFacts;
  documentBootOptions: Partial<
    ModelStorage_Host.DocumentOptions<ModelStorage_StorageModel.DesignSystemContent>
  >;
  documentCollectionPath: (arg0: string) => string;
  documentOptionsForBootMode: (
    arg0: ModelStorage_Storage.SystemBootMode,
    arg1?: string,
  ) => ModelStorage_Storage.DocumentBootConfiguration;
  documentPathForFile: (arg0: string) => string;
  documentRecordsEqual: (arg0: unknown, arg1: unknown) => boolean;
  DocumentSections: (
    props: Documentation_Documentation.DocumentSectionsProps,
  ) => Documentation_React.ReactElement;
  documentSectionsForEditor: (
    docs: EditorRuntime_Model.ParsedDesignSystem["docs"],
  ) => EditorRuntime_Application.ApplicationView["docs"];
  documentTextRanges: WeakMap<Document, Range>;
  dotSegmentPattern: RegExp;
  DOTTED_STROKE_ICON: ColorControls_ColorControls.PropertyIconDefinition;
  DOWNLOAD_ERROR_HEALTH: Record<string, ModelStorage_Storage.HealthEvent>;
  DOWNLOAD_INTERNAL_FAILURE: ModelStorage_Storage.HealthEvent;
  DOWNLOAD_MIME_TYPES_BY_EXTENSION: Record<string, string>;
  DOWNLOAD_NAME_IGNORABLE_PATTERN: RegExp;
  DOWNLOAD_OUTCOME_HEALTH: Record<string, ModelStorage_Storage.HealthEvent>;
  downloadDataUrlBytes: (dataUrl: string) => Uint8Array | null;
  downloadHealthOutcome: (
    arg0: ModelStorage_Storage.DownloadOutcome,
  ) => ModelStorage_Storage.HealthEvent | undefined;
  downloadMimeTypeFromName: (name: string) => string | undefined;
  DOWNLOADS_UNAVAILABLE_MESSAGE: string;
  downloadsWithheld: (input?: number) => Promise<boolean | undefined>;
  downloadZipBaseName: (name: string) => string;
  DRAGGABLE_ELEMENT_SELECTOR: string;
  drainShrinkWrapQueue: (
    input: Window,
    options: Dom_Dom.ShrinkWrapQueue,
    items: Dom_Dom.ShrinkWrapJob[],
  ) => void;
  dropMissingBlobDigests: (
    arg0: ModelStorage_StorageModel.StorageCatalog,
    arg1: ReadonlySet<string>,
  ) => ModelStorage_StorageModel.StorageCatalog;
  DUPLICATE_FILE_INDEX_MESSAGE: string;
  eagerAssetsCapability: () => ModelStorage_Storage.AssetsCapability | null;
  EDIT_COUNT_STORAGE_PATTERN: RegExp;
  EDITABLE_CSS_LENGTH_PATTERN: RegExp;
  EDITABLE_DESIGN_SYSTEM_REOPENED_MESSAGE: string;
  EDITABLE_ELEMENT_SELECTOR: string;
  EDITABLE_MARKDOWN_BLOCK_TYPES: ("h2" | "h3" | "p" | "quote")[];
  EDITABLE_MARKDOWN_IMAGE_DATA_URL_PATTERN: RegExp;
  EditableName: TokenEditors_React.FunctionComponent<TokenEditors_TokenEditors.EditableNameProps>;
  EditableText: (
    props: Composition_Composition.EditableTextProps,
  ) => Composition_React.ReactNode;
  editableTokensForFamily: (
    tokens: ModelCore_Model.NormalizedTokens,
    family: ModelCore_ModelCore.ValueTokenKind,
  ) => ModelCore_Model.ColorToken[] | ModelCore_Model.ScalarToken[];
  EDITING_OFF_BANNER_EXPLANATION: string;
  EDITING_OFF_BANNER_TITLE: string;
  EDITING_UNAVAILABLE_MESSAGE: string;
  editingOffTransition: (options: {
    offAtBoot: boolean;
    offNow: boolean;
    canWrite: boolean;
  }) => "on" | "off" | null;
  EditorActionButton: TokenEditors_React.FunctionComponent<TokenEditors_TokenEditors.EditorActionButtonProps>;
  editorCardKey: (kind: string, key: string) => string;
  editorFeatureFlags: {
    componentProps: boolean;
  };
  editorHrefSchemePattern: RegExp;
  effectiveToolbarDensity: (
    density?: import("./contracts/controls").Density,
  ) => import("./contracts/controls").Density;
  ELECTRON_USER_AGENT_TOKEN: string;
  ELEMENT_NODE_TYPE: number;
  elementDocumentBottom: (element: Element, frameWindow: Window) => number;
  elementHasUnavailableWindow: (arg0: Element | undefined) => boolean;
  elementIsWithin: (arg0: Node | null, arg1: Node | null) => boolean;
  elevationShadowClasses: Record<"popover" | "panel", string>;
  elevationSurfaceNames: Record<
    "popover" | "panel",
    Interactions_Controls.SurfaceBackground
  >;
  embeddedStringCacheCharacters: number;
  embeddedStringSizeCache: Map<string, number>;
  emitAnalyticsOnce: (event: string) => void;
  EMPTY_ASSET_SELECTION: EditorRuntime_Model.AssetSelection;
  EMPTY_ASSET_SELECTION_SET: ReadonlySet<string>;
  EMPTY_BROWSER_FILE_LIST: FileBrowser_FileBrowser.BrowserListingEntry[];
  EMPTY_CLAUDE_DELIVERY_CONTEXT: EditorRuntime_Application.ClaudeDeliveryContext;
  EMPTY_COMPONENT_PROPS: EditorRuntime_Model.InferredPropControl[];
  EMPTY_CONFLICT_FLAGS: ReadonlyMap<
    string,
    EditorRuntime_EditorRuntime.ConflictFlag
  >;
  EMPTY_DESIGN_SYSTEM_CONTENT: ModelStorage_StorageModel.DesignSystemContent;
  EMPTY_DOC_LINKS: Set<string>;
  EMPTY_EDITOR_TOOL_OPTIONS: symbol[];
  EMPTY_EMBEDDED_PAGE_PARTS: {
    title: string;
    readme: string;
    readmeMeta: string;
    css: string;
    js: string;
    emulator: boolean;
  };
  EMPTY_FILES_PEER_SOURCE: FilesCore_FilesCore.FilesPeerSource;
  EMPTY_INSTANCE_STATE: ModelStorage_Storage.RawDocumentSeed;
  EMPTY_MARKDOWN_FORMAT_STATE: import("./contracts").MarkdownFormatState;
  EMPTY_ROOM_PEERS: readonly EditorRuntime_EditorRuntime.RoomPeer[];
  EMPTY_SECTION_HINTS: Record<
    TokenEditors_TokenEditors.EmptySectionKind,
    string
  >;
  EMPTY_SELECTION_STYLE_STATE: Documentation_Documentation.SelectionStyleState;
  EMPTY_STATIC_PREVIEW_HTML: string;
  EMPTY_STORAGE_CATALOG: ModelStorage_StorageModel.StorageCatalog;
  EMPTY_STORED_SYSTEM_STATUS: ModelStorage_Storage.StoredSystemStatus;
  EMPTY_SYSTEM_READONLY_REASON: string;
  EmptyComponentPreview: (props: {
    name: string;
  }) => EditorRuntime_React.ReactElement;
  EmptyDesignSystem: () => Preview_React.ReactElement;
  emptyDesignSystemSections: (
    view: EditorRuntime_Application.ApplicationView,
    storage: {
      storedBytes: number;
    },
  ) => Set<string>;
  EmptyEditorList: (props: {
    text: TokenEditors_React.ReactNode;
  }) => TokenEditors_React.ReactElement;
  EmptySectionHint: (props: {
    kind: TokenEditors_TokenEditors.EmptySectionKind;
    readOnly?: boolean;
  }) => TokenEditors_React.ReactElement;
  emptySheetRef: Dom_React.RefCallback<HTMLDivElement>;
  emptySwatchValue: string;
  emulatorBuildMetaName: () => string;
  emulatorHostMetaName: () => string;
  emulatorPageDetected: boolean | undefined;
  emulatorShimId: string;
  enablePreviewRunner: (
    environment?: object,
    signal?: AbortSignal,
    pauses?: number[],
  ) => void;
  encodeBytesBase64: (bytes: Uint8Array<ArrayBufferLike>) => string;
  encodeDocumentId: (arg0: string) => string;
  encodedOrBackslashPathPattern: RegExp;
  encodedPreviewPathname: (path: string, baseURI: string) => string;
  encodeFileIndexKey: (key: string) => string;
  encodeFilePathPart: (path: string) => string;
  encodeFileUrlPath: (path: string) => string;
  encodeFileUtf8: (text: string) => Uint8Array<ArrayBuffer>;
  encodeMarkdownEscapes: (markdown: string) => string;
  encodeRelativeUrlPath: (path: string) => string;
  enforceConversionBudgets: (
    arg0: ModelStorage_Storage.ConversionPlan,
    arg1?: (bytes: Uint8Array) => string,
  ) => ModelStorage_Storage.ConversionPlan;
  enqueueShrinkWrapJob: (
    element: HTMLElement,
    options: (width: number | null) => void,
    context: Dom_Dom.ShrinkWrapSchedule,
  ) => void;
  ensureComponentGuidelinesHeading: (
    markdown: string,
    name: string,
    heading: string,
  ) => string;
  ensureFoldedAssetGroup: (
    index: Migration_Migration.MigrationWireIndex,
    key: string,
    name: string,
  ) => Migration_Migration.MigrationWireAssetGroup;
  ensureGoogleFonts: (families: string[], document2?: Document) => void;
  ensurePositionedSkeletonHost: (input: HTMLElement) => boolean;
  enumControlFromLiterals: (
    values: readonly string[],
  ) => Documentation_Documentation.InferredControl;
  errorHttpStatus: (input: unknown) => number | undefined;
  errorMessage: (input: unknown) => string;
  escapeContrastRegex: (input: string) => string;
  escapeHtmlAttribute: (text: string) => string;
  escapeHtmlComment: (text: string) => string;
  escapeMarkdownTableCell: (text: string) => string;
  escapePageHtmlAttribute: (text: string) => string;
  escapeRegexPattern: (text: string) => string;
  escapeScriptJson: (json: string) => string;
  escapeTokenCssComment: (usage: string) => string;
  escapeTokenCssIdentifier: (name: string) => string;
  estimateBase64StringBytes: (arg0: number) => number;
  estimateDataUriBytes: (content: string) => number;
  estimateEmbeddedJsonBytes: (arg0: unknown) => number;
  estimateEmbeddedStringBytes: (value: string) => number;
  estimatePublishContentBytes: (
    arg0: ModelStorage_StorageModel.FilePublishEntries,
  ) => number;
  evaluateTooltipContent: (
    input: () => Dom_React.ReactNode,
  ) => Dom_React.ReactNode | Dom_Overlays.EmptyTooltipContent;
  excludePublishedAssets: (
    arg0: readonly ModelStorage_Storage.OrphanedAsset[],
    arg1: ReadonlySet<string> | null,
  ) => ModelStorage_Storage.OrphanedAsset[];
  EXECUTABLE_SCRIPT_TYPE_PATTERN: RegExp;
  executeMarkdownBlockFormat: (
    document2: Document,
    blockType: Documentation_Documentation.MarkdownShortcutBlock,
  ) => void;
  executeMarkdownCommand: (
    document: Document,
    command: string,
    value?: string,
  ) => void;
  existingBrowsingContextNames: Set<string>;
  existingFontUploadFiles: (
    files: EditorRuntime_Model.FileTable,
    storage: EditorRuntime_EditorRuntime.AssetFileUploadOptions,
    options: (
      path: string,
      previous: string,
      next: string,
      record: EditorRuntime_Model.AssetUploadRecord,
    ) => boolean,
  ) => Promise<number>;
  explainColorAliasError: (
    token: ModelCore_Model.ColorToken,
    themeId: string,
    baseThemeId: string,
    tokensByName: Map<string, ModelCore_Model.ColorToken>,
  ) =>
    | {
        why: string;
        own: boolean;
      }
    | undefined;
  explainGeneratedOrRetiredPath: (path: string) => string | null;
  explainReservedSystemPath: (path: string) => string | null;
  explainToolConfigurationPath: (path: string) => string | null;
  explainUnpublishableFile: (
    path: string,
    contents: string | undefined,
  ) => FilesCore_FilesCore.FilePublishRejection | null;
  explainUnsafeMirrorPath: (path: string) => string | null;
  explainUploadSize: (arg0: number, arg1: number, arg2?: string) => string;
  EXPORT_FORMAT_PATTERN: RegExp;
  EXTERNAL_CHANGES_FOLDED_MESSAGE: string;
  EXTERNAL_LINK_CLASS_NAME: string;
  EXTERNAL_LINK_OPEN_HINT: string;
  EXTERNAL_LINK_PATTERN: RegExp;
  EXTERNAL_URL_SCHEME_PATTERN: RegExp;
  externalLinkDisplayLabel: (url: string) => string;
  externalLinkProps: (
    url: string,
    mode?: Documentation_Core.EditorLinkMode,
  ) => Documentation_Documentation.ExternalLinkProps;
  EXTRA_TOKEN_FAMILY_PATTERN: RegExp;
  EXTRA_TOKEN_VALUE_PATTERN: RegExp;
  extractDroppedFiles: (
    dataTransfer: DataTransfer,
  ) => Promise<EditorRuntime_EditorRuntime.DroppedFiles>;
  extractPublishedDocumentJson: (arg0: string) => string | null;
  extractVisibleElementText: (element: Element, excluded: string) => string;
  extraRetainedBlobIdsProvider: () => Iterable<string>;
  extraTokenFamiliesForEditor: (
    tokens: EditorRuntime_Model.NormalizedTokens,
  ) => EditorRuntime_Application.EditorExtraScale[];
  extraTokenFamilySectionId: (key: string) => string;
  extraTokenScaleGroups: (
    families: TokenEditors_TokenEditors.ExtraScaleFamily[],
  ) => TokenEditors_TokenEditors.ScaleGroup[];
  FAILED_CONVERSION_UPLOAD_MESSAGE: string;
  failedAssetUploadResult: (
    result: Extract<
      EditorRuntime_Storage.UploadRoute,
      {
        to: "refuse";
      }
    >,
  ) => EditorRuntime_EditorRuntime.FileUploadResult;
  failedLegacyStateOutcome: (error: unknown) => Boot_Boot.LegacyInitialState;
  failedRemoteTextReference: (arg0: string) => string | undefined;
  failedRemoteTextReferenceByPath: Map<string, string | undefined>;
  failedRemoteTextTimes: Map<string, number>;
  failedRemoteTextUploadKeys: Set<string>;
  failedUploadSummary: (
    result: string | undefined,
    files: EditorRuntime_Application.RefusedUpload[],
  ) => string;
  featureFlagContext: Dom_React.Context<string | undefined>;
  fetchCoverCaptureFile: (url: string) => Promise<Response | null>;
  fetchDownloadFileBytes: EditorRuntime_EditorRuntime.DownloadBytesFetcher;
  fetchFileWithRetries: (
    url: string,
    retryMs: number,
    signal?: AbortSignal,
    fresh?: boolean,
  ) => Promise<Response>;
  fetchingRemoteTextReferences: Set<string>;
  fetchProjectFilesListing: () => Promise<unknown>;
  fetchRemoteFileText: (
    arg0: string,
    arg1: ModelStorage_Storage.RemoteTextFetch,
  ) => Promise<string | undefined>;
  FIELD_DISABLED_INVALID_STATES: Record<
    "false" | "true",
    Record<"false" | "true", Controls_C.FieldState>
  >;
  FIELD_SURFACE_CLASS: string;
  FieldButton: Composition_React.ForwardRefExoticComponent<
    Composition_Composition.FieldButtonProps &
      Composition_React.RefAttributes<HTMLButtonElement>
  >;
  FieldCheckbox: Controls_C.ForwardComponent<
    HTMLElement,
    Controls_C.FieldCheckboxProps
  >;
  FieldCombobox: (
    props: Overlays_Overlays.FieldComboboxProps,
  ) => Overlays_React.ReactElement;
  FieldComponents: Controls_C.FieldComponents;
  FieldDescription: Controls_C.ForwardComponent<
    HTMLParagraphElement,
    Controls_C.FieldDescriptionProps
  >;
  FieldError: Controls_C.ForwardComponent<
    HTMLDivElement,
    Controls_C.FieldErrorProps
  >;
  fieldHoverClasses: string;
  FieldLabel: Controls_C.ForwardComponent<
    HTMLLabelElement,
    Controls_C.FieldLabelProps
  >;
  FieldNumberInput: Controls_C.ForwardComponent<
    HTMLInputElement,
    Controls_C.FieldNumberInputProps
  >;
  fieldRingClasses: string;
  FieldRoot: Controls_C.ForwardComponent<
    HTMLDivElement,
    Controls_C.FieldRootProps
  >;
  FieldRootWithLabel: typeof import("@base-ui/react/field").Field.Control;
  FieldRow: typeof import("@base-ui/react/field").Field.Validity;
  FieldTextArea: Controls_C.ForwardComponent<
    HTMLTextAreaElement,
    Controls_C.FieldTextAreaProps
  >;
  FieldTextInput: Controls_C.ForwardComponent<
    HTMLInputElement,
    Controls_C.FieldTextInputProps
  >;
  FieldWrapper: Controls_React.FunctionComponent<Controls_C.FieldWrapperProps>;
  FIGMA_FILE_REFUSAL_MESSAGE: string;
  FILE_ALLOWED_MIME_TYPES: Set<string>;
  FILE_BINARY_MIME_TYPES: Set<string>;
  FILE_BROWSER_FALLBACK_VIEWPORT_HEIGHT: number;
  FILE_BROWSER_ICON_COLORS: Record<"surface" | "hover" | "line", string>;
  FILE_BROWSER_ICON_GRADIENTS: Record<
    FileBrowser_FileBrowser.BrowserFileType,
    string
  >;
  FILE_BROWSER_ICON_SHADOW: string;
  FILE_BROWSER_KIND_LABELS: Record<
    FileBrowser_FileBrowser.BrowserEntryType,
    string
  >;
  FILE_BROWSER_LOAD_ERROR_TEXT: string;
  FILE_BROWSER_LOADING_TEXT: string;
  FILE_BROWSER_MOBILE_QUERY: string;
  FILE_BROWSER_NO_HOVER_QUERY: string;
  FILE_BROWSER_OVERSCAN_PX: number;
  FILE_BROWSER_PREVIEW_CARD_CLASS: string;
  FILE_BROWSER_PREVIEW_HEIGHT: number;
  FILE_BROWSER_PREVIEW_WIDTH: number;
  FILE_BROWSER_ROW_HEIGHT: number;
  FILE_BROWSER_ROW_ICON_SIZE: number;
  FILE_BROWSER_SECTION_BY_TYPE: Record<
    FileBrowser_FileBrowser.BrowserEntryType,
    FileBrowser_FileBrowser.BrowserSection
  >;
  FILE_BROWSER_SECTION_HEIGHT: number;
  FILE_BROWSER_SECTION_ORDER: FileBrowser_FileBrowser.BrowserSection[];
  FILE_BROWSER_SELECTED_FORCED_COLORS_CLASS: string;
  FILE_CONFLICT_CHOICE_SUFFIX: string;
  FILE_DOWNLOAD_MAX_RETRY_MS: number;
  FILE_DROP_FADE_CLASS: string;
  FILE_DROP_ICON_ENTER_CLASS: string;
  FILE_DROP_LABEL_ENTER_CLASS: string;
  FILE_DROP_RING_CLASS: string;
  FILE_DROP_RING_ENTER_CLASS: string;
  FILE_FETCH_RETRY_DELAYS_MS: number[];
  FILE_FETCH_TIMEOUT_MS: number;
  FILE_INDEX_KEY_SAFE_CHARACTER: RegExp;
  FILE_LIST_UNAVAILABLE_MESSAGE: string;
  FILE_LISTING_PATH: string;
  FILE_MIGRATION_MARKER_FIELDS: string[];
  FILE_MIME_TYPES: Record<string, string>;
  FILE_MIME_TYPES_BY_EXTENSION: Map<string, string>;
  FILE_POINTER_PREFIX: string;
  FILE_PUBLISH_ERROR_CODE_MAP: Record<
    string,
    FilesCore_FilesBoot.FilePublishFailureCode
  >;
  FILE_PUBLISH_WRITE_REVOKED_CODES: Set<FilesCore_FilesBoot.FilePublishFailureCode>;
  FILE_SAVE_BACKPRESSURE_DELAY_MS: number;
  FILE_SAVE_CONFLICT_BACKOFF_MS: [number, number];
  FILE_SAVE_CONFLICT_RETRY_MS: number;
  FILE_SAVE_DEBOUNCE_POLICY: {
    solo: {
      gapMs: number;
      maxWaitMs: number;
    };
    shared: {
      gapMs: number;
      maxWaitMs: number;
    };
    recentMs: number;
  };
  FILE_SAVE_LONG_REQUEST_MS: number;
  FILE_SAVE_MAX_BATCH_CONFLICTS: number;
  FILE_SAVE_MAX_CONFLICT_PATHS: number;
  FILE_SAVE_MAX_CONFLICT_RETRIES: number;
  FILE_SAVE_MAX_TRANSIENT_RETRIES: number;
  FILE_SAVE_QUICK_RETRY_MS: number;
  FILE_SAVE_READ_RETRY_DELAYS_MS: number[];
  FILE_SAVE_RECENT_ACTIVITY_WINDOW_MS: number;
  FILE_SAVE_RECENT_PEER_WINDOW_MS: number;
  FILE_SAVE_RETRY_JITTER_MS: number;
  FILE_SAVE_RETRY_MAX_MS: number;
  FILE_SAVE_RETRY_MIN_MS: number;
  FILE_SAVE_SHARED_ACTIVITY_TIMEOUT_MS: number;
  FILE_SAVE_STUCK_TIMEOUT_MS: number;
  FILE_SAVE_TERMINAL_ERROR_CODES: Set<string>;
  FILE_SAVE_TOTAL_RETRY_WINDOW_MS: number;
  FILE_SCOPE_PATH_PATTERN: RegExp;
  FILE_SEARCH_MATCH_LIMIT: number;
  FILE_SECTION_BY_CONTENT_KIND: FileBrowser_FileBrowser.FileContentSections;
  FILE_SHA256_PATTERN: RegExp;
  FILE_SHA256_PATTERNEditorPublishedPreview: RegExp;
  FILE_UNPAIRED_SURROGATE_PATTERN: RegExp;
  fileAvailabilityCache: Map<string, boolean>;
  fileAvailabilityCacheKey: (path: string, bytes: number) => string;
  fileAvailabilityNotifyPending: boolean;
  fileAvailabilityPending: Set<string>;
  fileAvailabilityRevision: number;
  fileAvailabilitySubscribers: Set<() => void>;
  fileAvailabilityUrlPath: (path: string) => string;
  fileBaseName: (path: string) => string;
  FileBrowserBreadcrumbs: (
    props: FileBrowser_FileBrowser.BrowserBreadcrumbProps,
  ) => FileBrowser_React.ReactNode;
  fileBrowserContentType: (value: unknown) => string | undefined;
  fileBrowserDefaultSource: (
    file: FileBrowser_FileBrowser.BrowserFile,
  ) => FileBrowser_FileBrowser.FileBrowserSource;
  FileBrowserDownloadButton: (
    props: FileBrowser_FileBrowser.BrowserDownloadButtonProps,
  ) => FileBrowser_React.ReactNode;
  fileBrowserEntryEncoder: TextEncoder;
  fileBrowserEntryId: (path: string) => string;
  fileBrowserEntryKey: (entry: FileBrowser_FileBrowser.BrowserEntry) => string;
  fileBrowserFolder: (
    tree: FileBrowser_FileBrowser.BrowserFolder,
    path: string,
  ) => FileBrowser_FileBrowser.BrowserFolder | null;
  fileBrowserFolderLabel: (folder: string) => string;
  fileBrowserFolderSections: (
    folder: FileBrowser_FileBrowser.BrowserFolder,
  ) => {
    label: FileBrowser_FileBrowser.BrowserSection;
    entries: FileBrowser_FileBrowser.BrowserEntry[];
  }[];
  FileBrowserIcon: (
    props: FileBrowser_FileBrowser.BrowserIconProps,
  ) => FileBrowser_React.ReactNode;
  FileBrowserImagePreview: (
    props: FileBrowser_FileBrowser.BrowserImagePreviewProps,
  ) => FileBrowser_React.ReactNode;
  fileBrowserMetadataText: (
    entry: FileBrowser_FileBrowser.BrowserEntry,
  ) => string;
  fileBrowserNoPreviewReason: (
    entry: FileBrowser_FileBrowser.BrowserFile,
    options?: FileBrowser_FileBrowser.BrowserPreviewOptions,
  ) => string;
  FileBrowserPreview: (
    props: FileBrowser_FileBrowser.BrowserPreviewProps,
  ) => FileBrowser_React.ReactNode;
  FileBrowserPreviewCard: (
    props: FileBrowser_FileBrowser.BrowserPreviewCardProps,
  ) => FileBrowser_React.ReactNode;
  fileBrowserPreviewCardStyle: (
    tall: boolean | undefined,
  ) => FileBrowser_React.CSSProperties;
  fileBrowserPreviewKind: (
    entry: FileBrowser_FileBrowser.BrowserFile,
    options?: FileBrowser_FileBrowser.BrowserPreviewOptions,
  ) => "none" | "text" | "image";
  FileBrowserRow: (
    props: FileBrowser_FileBrowser.BrowserRowProps,
  ) => FileBrowser_React.ReactNode;
  FileBrowserSectionHeading: (
    props: FileBrowser_FileBrowser.BrowserHeadingProps,
  ) => FileBrowser_React.ReactNode;
  fileBrowserSize: (value: unknown) => number | undefined;
  FileBrowserTextPreview: (
    props: FileBrowser_FileBrowser.BrowserTextPreviewProps,
  ) => FileBrowser_React.ReactNode;
  fileBrowserTypeFromName: (
    name: string,
  ) => FileBrowser_FileBrowser.BrowserFileType;
  fileBudgetEncoder: TextEncoder;
  FileConflictBanner: (props: {
    doc: EditorRuntime_EditorRuntime.ConflictDocument;
    flag: EditorRuntime_EditorRuntime.ConflictFlag;
  }) => EditorRuntime_React.ReactElement;
  fileContentBytes: (
    content: FilesCore_FilesBoot.FileContents,
  ) => Promise<Uint8Array<ArrayBuffer>>;
  fileContentBytesModelStoredFileCodec: (
    arg0: string,
    arg1: string,
  ) => Uint8Array<ArrayBuffer>;
  fileContentContainsRuntimeMarkers: (
    input: FilesCore_FilesBoot.FilePublishInput,
  ) => boolean;
  fileContentsSemanticallyEqual: (
    path: string,
    left: string,
    right: string,
  ) => boolean;
  fileCountLabel: (count: number, label: string) => string;
  fileDownloadDisabledReason: (
    name: string,
    withheld: boolean,
  ) => string | undefined;
  fileDownloadFailureMessage: (
    name: string,
    code: string | undefined,
  ) => string;
  fileDownloadMimeMatchesName: (
    name: string,
    mime: string,
    expected?: string,
  ) => boolean;
  FileDropOverlay: (
    props: Composition_Composition.FileDropOverlayProps,
  ) => Composition_React.ReactNode;
  FileDropZone: EditorRuntime_React.FunctionComponent<EditorRuntime_EditorRuntime.FileDropZoneProps>;
  fileExtension: (path: string) => string;
  fileFetchHttpError: (status: number) => FileBrowser_FileBrowser.HttpError;
  fileFetchRetryDelays: (milliseconds: number) => number[];
  fileFitsInlineBudgets: (
    content: ModelCore_Model.DesignSystemContent,
    path: string,
    value: string,
  ) => boolean;
  fileIndexDecoder: TextDecoder;
  fileIndexEncoder: TextEncoder;
  fileInputDebugText: (input: FilesCore_FilesBoot.FilePublishInput) => string;
  fileKindDescription: (path: string) => string;
  fileListingIsNarrowed: (
    listing: FilesCore_FilesBoot.FileListing,
    port: FilesCore_FilesBoot.BrowserFilesPort,
  ) => boolean;
  fileMayStayByReference: (
    path: string,
    relative: string,
    lazy?: Migration_Files.LazyReadState,
  ) => boolean;
  fileMimeTypeFromPath: (path: string) => string | undefined;
  fileNameCollator: Intl.Collator;
  filePointer: (relativePath?: string) => string;
  filePreviewUrl: (
    files: ModelCore_Model.FileTable,
    path: string,
    catalog?: ModelCore_Model.StorageCatalog,
  ) => string | null;
  filePublishContent: (
    input: Exclude<FilesCore_FilesBoot.FilePublishInput, null>,
  ) => FilesCore_FilesBoot.FileContents;
  filePublishEncodedBytes: (
    input: FilesCore_FilesBoot.FilePublishInput,
  ) => number;
  filePublishRawBytes: (input: FilesCore_FilesBoot.FilePublishInput) => number;
  filePublishRejection: (
    path: string,
    input: FilesCore_FilesBoot.FilePublishInput,
  ) => FilesCore_FilesCore.FilePublishRejection | undefined;
  filePublishRejectionReason: (
    path: string,
    input: FilesCore_FilesBoot.FilePublishInput,
  ) => string | undefined;
  filePublishSizeRejection: (
    input: FilesCore_FilesBoot.FilePublishInput,
  ) => string | undefined;
  fileRelativePathOverrides: WeakMap<File, string>;
  FILES_BOOT_PERMANENT_RETRY_MS: number;
  FILES_BOOT_RECOVERY_DELAYS_MS: number[];
  FILES_BROWSER_CONFLICT_REASON: string;
  FILES_BROWSER_NOTE_CLASS: string;
  FILES_BROWSER_READ_RETRY_MS: number;
  FILES_COLLECTION: string;
  FILES_DEBUG_EVENT_STAGGER_MS: number;
  FILES_DEBUG_PANEL_DEFAULT_SIZE: Record<
    DebugPanel_FilesDebug.DebugSide,
    number
  >;
  FILES_DEBUG_PANEL_MIN_SIZE: Record<DebugPanel_FilesDebug.DebugSide, number>;
  FILES_DEBUG_REFRESH_MS: number;
  FILES_DEBUG_TOGGLE_SHORTCUT: string;
  FILES_DEBUG_VIEW_REFRESH_MS: number;
  FILES_DOCUMENT_FETCH_TIMEOUT_MS: number;
  FILES_INDEX_MERGE_SCHEMA: FilesCore_FilesCore.MergeSchema;
  FILES_INDEX_NAME: string;
  FILES_INDEX_PATH: string;
  FILES_INDEX_PROJECT_PATH: string;
  FILES_INDEX_VERSION: number;
  FILES_LISTING_CONTENT_REFRESH_MS: number;
  FILES_LISTING_EMPTY_MESSAGES: Record<"failed" | "narrowed", string>;
  FILES_LISTING_EXHAUSTED_RETRY_MS: number;
  FILES_LISTING_LAZY_START_MS: number;
  FILES_LISTING_MAX_ATTEMPTS: number;
  FILES_LISTING_NAME: string;
  FILES_LISTING_NARROWED_RETRY_DELAYS_MS: number[];
  FILES_LISTING_RETRY_MS: number;
  FILES_LISTING_TIMEOUT_MS: number;
  FILES_LISTING_UNCERTAIN_MESSAGES: Record<
    FileBrowser_FileBrowser.ListingUncertainty,
    string
  >;
  FILES_LISTING_URL: string;
  FILES_MIGRATION_CAPABILITIES_JSON: string;
  FILES_SECTION_ID: string;
  FILES_SECTION_LABEL: string;
  FILES_UNREADABLE_MESSAGE: string;
  filesBootRetryDelayForHotUpdate: (
    error: unknown,
    change: Boot_Model.FileRemoteChange,
    indexPath: string,
    elapsedMs: number,
  ) => number | undefined;
  FilesBrowser: (
    props: FileBrowser_FileBrowser.FilesBrowserProps,
  ) => FileBrowser_React.ReactNode;
  filesDebugEnabled: (
    getStorage?: () => Pick<Storage, "getItem"> | null | undefined,
  ) => boolean;
  filesDebugEventLevel: (
    input: DebugPanel_FilesDebug.DebugEvent,
  ) => DebugPanel_FilesDebug.DebugEventLevel;
  filesIndexWithoutDocumentMetadata: (
    index: FilesCore_FilesBoot.FilesIndex,
  ) => Omit<FilesCore_FilesBoot.FilesIndex, "docs" | "title">;
  filesLeftOutOfMigration: (files: FilesCore_FilesBoot.FileTable) => {
    path: string;
    reason: string;
  }[];
  filesModeDebugEnabled: (
    mode: string,
    storage?: () => Pick<Storage, "getItem"> | null | undefined,
  ) => boolean;
  filesPortExtensions: <Port extends FilesCore_FilesBoot.BrowserFilesPort>(
    port: Port,
  ) => Port;
  fileSystemDocumentFactory:
    | ((
        parser: ModelStorage_Host.ArtifactParser<ModelStorage_StorageModel.DesignSystemContent>,
      ) => ModelStorage_Storage.SystemDocument)
    | undefined;
  fileTableBytesCache: WeakMap<Readonly<Record<string, string>>, number>;
  fileTableInlineBytes: (files: ModelCore_Model.FileTable) => number;
  fileTableOrNull: (
    arg0: unknown,
  ) => ModelStorage_StorageModel.FileTable | null;
  fileTextDecoder: TextDecoder;
  fileVersionResolver: (path: string) => string | undefined;
  FILL_MODE_ICONS: Partial<
    Record<string, ColorControls_ColorControls.PropertyIconDefinition>
  >;
  fillModeOption: (
    mode: string,
    tooltip: string,
    disabled?: boolean,
  ) => ColorControls_ColorControls.FillModeOption;
  finalizeContentChange: (
    previous: ModelCore_Model.DesignSystemContent,
    next: ModelCore_Model.DesignSystemContent,
    title: string,
  ) => ModelCore_Model.DesignSystemContent;
  finalizeMigrationFiles: (
    files: Record<string, string>,
    title: string,
  ) => Migration_Model.FileTable;
  FIND_BAR_ATTRIBUTE: string;
  FIND_BAR_EDIT_SHORTCUTS: string[];
  findAssetTile: (root: HTMLElement | null, id: string) => HTMLElement | null;
  findBarGuardedWindows: WeakSet<Window>;
  findBarKeyHandlers: WeakMap<Element, (event: KeyboardEvent) => boolean>;
  findBarListenerWindows: WeakSet<Document>;
  findCommentTarget: (
    root: ParentNode | null | undefined,
    id: string,
  ) => HTMLElement | null;
  findEditorCard: (
    root: ParentNode | null,
    target: Documentation_Documentation.EditorCardTarget,
  ) => HTMLElement | null;
  findFontFamilyKey: (
    families: Record<string, string>,
    fontName: string,
  ) => string | undefined;
  findLegacyReadmeTail: (readme: string) => number;
  findOverlayPortalContainer: (arg0: HTMLElement) => HTMLElement | null;
  findPackagedLibrary: (
    name: string,
    catalog?: ModelCore_ModelCore.PackagedLibrary[],
  ) => ModelCore_ModelCore.PackagedLibrary | undefined;
  findStoredBlobByDigest: (
    arg0: ModelStorage_StorageModel.StorageCatalog,
    arg1: string,
    arg2: ReadonlySet<string> | null | undefined,
  ) => ModelStorage_Storage.KnownStoredBlob | null;
  findTypeDeclaration: (
    texts: readonly string[],
    name: string,
  ) => Documentation_Documentation.TypeDeclaration | null;
  finishFileAvailabilityProbe: (key: string, available: boolean) => void;
  finishMigrationTombstone: (
    options: Pick<
      Migration_Migration.MigrationOptions<object>,
      "files" | "store" | "timers" | "artifactId"
    > & {
      indexPath: string;
      metaPath: string;
    },
  ) => Promise<boolean | undefined>;
  firstCssFontFamily: (value: string) => string | null;
  firstDraftFromFilesPrompt: (count: number, address: string) => string;
  firstMarkdownParagraphLines: (markdown: string) => string[];
  firstMarkdownTitle: (markdown: string) => {
    line: number;
    text: string;
  } | null;
  firstRegexCaptureValues: (text: string, pattern: RegExp) => string[];
  fitClaudePayload: (
    payload: EditorRuntime_EditorRuntime.SessionPayload,
  ) => EditorRuntime_EditorRuntime.SessionPayload;
  FIX_WITH_CLAUDE_LABEL: string;
  flaggedDesignSystemFiles: (
    doc: FileBrowser_FileBrowser.DesignFilesDocument,
  ) => Set<string>;
  flattenFileBrowserTree: (
    folder: FileBrowser_FileBrowser.BrowserFolder,
    expanded: ReadonlySet<string>,
  ) => FileBrowser_FileBrowser.BrowserRow[];
  FLIP_HELD_MARKER: string;
  FLIP_PAUSE_DURATION_MS: number;
  FloatingPositionRenderProp: <
    Details extends Dom_Overlays.OverlayEventDetails,
  >(
    props: Dom_Overlays.SheetPopupOptions<Details> & {
      children(
        value: Dom_Overlays.SheetPopupResult<Details>,
      ): Dom_React.ReactNode;
    },
  ) => Dom_React.ReactElement;
  FloatingSectionNavigation: (
    props: Application_Application.FloatingNavigationProps,
  ) => Application_React.ReactElement;
  FluidComponentPreview: Preview_React.FunctionComponent<Preview_Preview.FluidComponentPreviewProps>;
  flushMarkdownCommitQueues: () => void;
  flushShimmerSynchronization: () => void;
  flushShrinkWrapMicrotask: (input: Window) => void;
  flushShrinkWrapResizeJobs: (input: Window) => void;
  FOCUS_REGION_FOCUSABLE_SELECTOR: string;
  FOCUS_REGION_HINT_INTERVAL_MS: number;
  focusAndSelectSearchInput: (input: HTMLInputElement | null) => boolean;
  FOCUSES_NOTHING_ATTRIBUTE: string;
  focusIsEditingElsewhere: (section: HTMLElement) => boolean;
  focusRegionElementIsVisible: (
    element: HTMLElement,
    rendered: (element: HTMLElement) => boolean,
  ) => boolean;
  focusRegionHint: (name: string, shortcut?: string) => string;
  focusRegionSelf: (element: HTMLElement) => boolean;
  focusShadowByMode: Record<"light" | "dark", string>;
  focusUsageEditorBackground: FileBrowser_React.MouseEventHandler<HTMLDivElement>;
  folderFileCount: (folder: FileBrowser_FileBrowser.BrowserFolder) => number;
  folderFileCountCache: WeakMap<FileBrowser_FileBrowser.BrowserFolder, number>;
  foldLegacyMetaFields: (
    index: Migration_Migration.MigrationWireIndex,
    meta: Record<string, unknown>,
    recordedFields?: Record<string, string>,
  ) => Promise<void>;
  foldLegacyStoreChangesIntoFiles: (
    context: Migration_Migration.FoldContext,
    fetchBlob: Migration_Migration.FetchMigrationBlob,
  ) => Promise<Migration_Migration.FoldTree>;
  foldLegacyTokenChanges: (
    fileText: string,
    storeTokens: Record<string, unknown>,
    recordedFields?: Record<string, string>,
    recordedSha?: string,
  ) => Promise<{
    text: string;
    clashed: boolean;
  } | null>;
  FONT_DATA_URL_PATTERN: RegExp;
  FONT_FACE_FORMAT_NAMES: Record<string, string>;
  FONT_FILE_ACCEPT: string;
  FONT_FILE_EXTENSIONS: string[];
  FONT_FILE_WEIGHT_PATTERNS: [RegExp, string][];
  FONT_INSTALL_PATH_PATTERN: RegExp;
  FONT_INSTALL_PATH_SEGMENT_PATTERN: string;
  FONT_STACK_PATTERN: RegExp;
  FONT_WEIGHT_LABELS: [number, string][];
  FONT_WEIGHT_PATTERN: RegExp;
  fontConsumptionGuide: (
    canvas: boolean,
    slides: boolean,
    fontPaths: readonly string[],
  ) => string[];
  fontContext: Layers_React.Context<Layers_Layers.CdsFont | undefined>;
  fontFamiliesForEditor: (
    families: Record<string, string>,
    fonts: EditorRuntime_Model.ParsedFont[],
  ) => Record<string, string>;
  FontFamilyPicker: TokenEditors_React.FunctionComponent<TokenEditors_TokenEditors.FontFamilyPickerProps>;
  fontFamilySlug: (family: string) => string;
  fontFamilyStack: (family: string, fontPaths?: string[]) => string;
  fontFileCssFamilyName: (path: string) => string;
  fontFileDisplayPath: (path: string) => string;
  fontFilesForEditor: (
    fonts: EditorRuntime_Model.ParsedFont[],
    assetFonts?: EditorRuntime_Model.ParsedFont[],
  ) => EditorRuntime_Application.EditorFont[];
  fontFileSlantLabel: (style: string) => string;
  FontFilesList: TokenEditors_React.FunctionComponent<TokenEditors_TokenEditors.FontFilesListProps>;
  fontFileUrl: (font: EditorRuntime_Model.ParsedFont) => string;
  FONTS_COLLECTION: string;
  fontWeightLabel: (weight: string | number) => string;
  forbiddenHrefControlCharacterPattern: RegExp;
  FORM_POINTER_FOCUS_SELECTOR: string;
  formatAssetBytes: (arg0: number) => string;
  formatCardCharacterCount: (count: number) => string;
  formatCommandShortcut: (
    key: string,
    props1?: {
      shift?: boolean | undefined;
    },
  ) => string;
  formatContrastRatio: (ratio: number) => string;
  formatFileBrowserBytes: (bytes: number | undefined) => string;
  formatFilesDebugTimestamp: (timestamp: number) => string;
  formatFileSize: (bytes: number) => string;
  formatInlineBudgetBytes: (bytes: number) => string;
  formatNumberWithUnit: (value: number, unit: string) => string;
  formatStoredFileKilobytes: (bytes: number) => string;
  formatUnsendableFilesMessage: (
    leftOut: readonly Boot_Boot.UnsavedFile[],
    options?: {
      stashed?: boolean;
      restSaved?: boolean;
    },
  ) => string;
  formatUploadBytes: (arg0: number) => string;
  FRAME_RUNTIME_BLOCK_END: string;
  FRAME_RUNTIME_BLOCK_START: string;
  FRAME_SCOPE_PATH_PATTERN: RegExp;
  frameAnalyticsTransport: EditorRuntime_EditorRuntime.AnalyticsTransport;
  freezeSortedFileTable: (
    files: ModelCore_Model.FileTable,
  ) => Readonly<Record<string, string>>;
  fromCodeGuidePrompt: (address: string, task: string) => string;
  gapTokenNames: string[];
  generateComponentApiCards: (
    declarationText: string | null,
    facts: Documentation_Documentation.ManifestDocumentationFacts,
  ) => Documentation_Documentation.ComponentApiCards;
  generateComponentMountHtml: (
    componentName: string,
    options: Documentation_Documentation.ComponentMountOptions,
  ) => string;
  generateConsumptionDocumentation: (
    options: Documentation_Documentation.ConsumptionDocumentationOptions,
  ) => Documentation_Core.ConsumptionDocumentation;
  GENERATED_API_DIRECTORY: string;
  GENERATED_API_FILE_HEADER: string;
  GENERATED_API_PATH_PATTERN: RegExp;
  GENERATED_CONSUMPTION_HEADING: string;
  GENERATED_INDEX_HEADING: string;
  GENERATED_INLINE_TOKENS_HEADING: string;
  GENERATED_README_HEADING_PATTERN_SOURCE: string;
  GENERATED_README_SEPARATOR: string;
  GENERATED_README_START_PATTERN: RegExp;
  GENERATED_TOKENS_CSS_PATH: string;
  generatedConsumptionReadme: (
    files: Documentation_Core.FileTable,
    root?: string,
  ) => string;
  generatedReadmeTail: (arg0: string) => string;
  generatedReadmeTailOffset: (readme: string) => number;
  generatedTokensCssForFiles: (
    files: ModelCore_Model.FileTable,
  ) => string | null;
  generateFontFaceRules: (
    tokens: ModelCore_Model.NormalizedTokens,
    fontSource?: (path: string) => string | null,
  ) => string[];
  generateFontFacesCss: (
    tokens: ModelCore_Model.NormalizedTokens,
    fontSource?: (path: string) => string | null,
  ) => string;
  generateNamedTokensCss: (
    tokens: ModelCore_Model.NormalizedTokens,
    name: string,
    fontSource?: (path: string) => string | null,
  ) => string;
  generateStoredFilesGuidance: (
    arg0: ReadonlyMap<string, ModelStorage_Storage.DatabaseRecord>,
  ) => string;
  generateTokensCss: (
    tokens: ModelCore_Model.NormalizedTokens,
    options?: ModelCore_Model.TokenCssOptions,
  ) => string;
  getArtifactEditCount: () => number;
  getArtifactHealthReporter: () => PlatformHost_Host.HealthReporter | undefined;
  getAssetsCapability: () => Promise<PlatformHost_Host.AssetsCapability | null>;
  getAssetsCatalogState: () => ModelStorage_Storage.AssetsCatalogueState;
  getAssetsTierState: () => ModelStorage_Storage.AssetsTierState;
  getAutomaticLinkRel: (
    arg0: string | undefined,
    arg1: string | null | undefined,
  ) => string | undefined;
  getAutoSavingArtifactRuntime: () =>
    | PlatformHost_Host.ActiveArtifactRuntime
    | undefined;
  getBootstrapRetryDelay: (
    input: unknown,
    options: number,
  ) => number | undefined;
  getButtonBackgroundLayerClasses: (input: {
    joined?: boolean;
    solid?: boolean;
  }) => string;
  getButtonIconSize: (input?: Controls_C.ControlSize) => Controls_C.IconSize;
  getButtonIconVerticalPadding: (input: Controls_C.ResolvedIconSize) => string;
  getClassMergeThemeValues: (
    name: Interactions_Dom.ThemeClassGroup,
  ) => string[];
  getClaudeBridge: () => PlatformHost_Host.ClaudeBridge | undefined;
  getClaudeCapability: (name: string) => unknown;
  getClosestIconSize: (
    pixels: number,
  ) => Interactions_Controls.ResolvedIconSize;
  getCoarsePointerServerSnapshot: () => boolean;
  getCoarsePointerSnapshot: (
    windowOverride?: Dom_Dom.MediaQueryWindow,
  ) => boolean;
  getCompanionModalCatcher: (
    input: HTMLElement,
    options: EventTarget | null,
  ) => HTMLElement | null;
  getConnectedElementWindow: (arg0: Element | undefined) => Window | undefined;
  getControlSizeAttributes: (arg0?: Layers_Layers.ControlSize) => {
    "data-size"?: Exclude<Layers_Layers.ControlSize, "base">;
  };
  getCurrentUserName: () => Promise<string | null>;
  getCustomIconFontStyle: (
    pixels: number,
    strokeWidth: number,
  ) => {
    fontSize: string;
    fontWeight: number;
  };
  getDensitySizeIndex: (
    arg0: Layers_Layers.Density,
    arg1?: Layers_Layers.ControlSize,
  ) => number;
  getDesktopTitlebarStore: (
    doc: Document,
  ) => Interactions_Dom.ExternalStore<number>;
  getDisabledReasonWrapperProps: (
    input: Dom_React.ReactNode,
    options: string | undefined,
    context: string | undefined,
  ) => Dom_React.HTMLAttributes<HTMLSpanElement> & {
    "data-cds-disabled-reason-wrapper": string;
  };
  getDocumentIfAvailable: () => Document | undefined;
  getElementAnimations: (input: Element) => Animation[];
  getElementNamespace: (input?: unknown) => string | null | undefined;
  getElementWindow: (arg0: Element | null | undefined) => Window | undefined;
  getFalseSheetImplementationSnapshot: () => false;
  getFalseSnapshot: () => boolean;
  getFeatureFlag: <T extends EditorRuntime_EditorRuntime.FeatureFlagValue>(
    name: string,
    fallback: T,
  ) => EditorRuntime_EditorRuntime.WidenFlag<T>;
  getFeatureFlagAsync: <T extends EditorRuntime_EditorRuntime.FeatureFlagValue>(
    name: string,
    fallback: T,
  ) => Promise<EditorRuntime_EditorRuntime.WidenFlag<T>>;
  getFileAvailabilityRevision: () => number;
  getFilesPublishCapability: () => Promise<FilesCore_FilesCore.FilesPublishCapability | null>;
  getFiniteRunningAnimations: (element: Element) => Animation[];
  getFocusedElement: (arg0: Document | undefined) => HTMLElement | null;
  getHostFrameBridge: () => PlatformHost_Host.HostFrameBridge;
  getHotCapability: () => FilesCore_FilesCore.FilesHotCapability | null;
  getHotWindowName: () => string;
  getHrefPathBeforeQuery: (arg0: string) => string;
  getInertProps: (inert: boolean) => {
    inert?: boolean | "";
  };
  getInnerElementWidth: (input: HTMLElement) => number;
  getKeyboardAdjustedDialogStyle: (
    keyboard: Overlays_Overlays.KeyboardInset | null,
  ) =>
    | {
        top: string;
        maxHeight: string;
      }
    | undefined;
  getKeycapClasses: (input: string | undefined) => string;
  getLocalRemoteTextEdits: () => ReadonlyMap<string, string>;
  getMediaQueryStore: (
    windowObject: Dom_Dom.MediaQueryWindow,
    query: string,
  ) => Dom_Dom.ExternalStore<boolean> | null;
  getMonospaceOverrideStyle: (
    arg0?: string | null,
  ) => Layers_Layers.DesignStyle;
  getNavigatorLocks: () => LockManager | undefined;
  getNullSheetImplementationSnapshot: () => null;
  getObjectProperty: (object: unknown, key: string) => unknown;
  getOrCreatePreviewDocumentRegistry: <Doc, State extends object>(
    environment: object,
    options: EditorRuntime_EditorRuntime.PreviewRegistryOptions,
    createState: () => State,
  ) => EditorRuntime_EditorRuntime.StatefulPreviewRegistry<Doc, State>;
  getOrLoadClaudeCapability: <Capability>(
    name: string,
    validate: (value: unknown) => value is Capability,
    timeoutMs?: number,
  ) => Promise<Capability | null>;
  getOverlayOwnerAncestors: (
    input: Element | null,
  ) => Interactions_Overlays.FocusableElement[];
  getPassiveOffSnapshot: () => "off";
  getPreviewFramePool: () => EditorRuntime_EditorRuntime.PreviewFramePool;
  getRecentOrphanedAssets: () => readonly ModelStorage_Storage.OrphanedAsset[];
  getRelativeSegmentBounds: (
    input: HTMLElement,
    options: HTMLElement,
  ) => {
    left: number;
    width: number;
  };
  getRemoteTextEntries: () => ReadonlyMap<
    string,
    ModelStorage_Storage.RemoteTextEntry
  >;
  getRemoteTextProblems: () => ReadonlyMap<string, string>;
  getResizeObserverConstructor: (
    element?: Element | null,
  ) => typeof ResizeObserver | undefined;
  getSelfPublishCapability: () => Promise<PlatformHost_Host.SelfCapability | null>;
  getSeparateContextRel: (arg0: string | undefined) => string;
  getSheetAvailableHeight: (
    windowObject: Pick<Window, "innerHeight" | "getComputedStyle">,
    sheetElement: Element | null | undefined,
  ) => number;
  getSheetFrameHeight: (
    frame: Dom_Dom.SheetFrame | null,
    windowObject: Pick<Window, "innerHeight" | "getComputedStyle"> | undefined,
    element: Element | null | undefined,
  ) => number | undefined;
  getSheetImplementationFailedSnapshot: () => boolean;
  getSheetImplementationLoadedSnapshot: () => boolean;
  getSheetImplementationSnapshot: () => Layers_Overlays.MobileSheetParts | null;
  getSheetInertReleaseTiming: (
    arg0?: Layers_Overlays.OverlayEventDetails | null,
  ) => "now" | "after-paint";
  getSheetMinimumHeight: (
    viewportHeight: number,
    hasHalfHeightFloor: boolean,
  ) => number;
  getSheetPopupStyle: (
    frame: Interactions_Dom.SheetFrame | null,
    options: {
      floor?: "half" | "content";
      parentFrameHeight?: number;
    },
  ) => Interactions_Dom.CustomStyle;
  getSheetPositionerStyle: (
    frame?: Dom_Dom.SheetFrame | null | undefined,
  ) => Dom_Dom.CustomStyle;
  getShortcutKeyLabel: (items: string, options: boolean) => string;
  getShrinkWrapQueue: (input: Window) => Dom_Dom.ShrinkWrapQueue;
  getStackedSheetCanGrow: (levels: readonly Dom_Dom.SheetLevel[]) => boolean;
  getStackedSheetHeight: (
    levels: readonly Dom_Dom.SheetLevel[],
  ) => number | undefined;
  getStoredSystemStatus: () => ModelStorage_Storage.StoredSystemStatus;
  getSurfaceBackgroundStyle: (arg0?: string) => Layers_Layers.DesignStyle;
  getSurfaceClasses: (
    input: Interactions_Controls.SurfaceProps["elevation"],
  ) => string;
  getTabLabelText: (element: Element) => string;
  getTabOverflowWidth: (
    input: HTMLElement,
    options: HTMLElement,
    context: number,
  ) => number;
  getTabScreenReaderText: (element: Element) => string;
  getThumbnailPageBackground: (document2: Document) => string;
  getTypeDeclarationResolver: (
    texts: readonly string[],
  ) => Documentation_Documentation.TypeDeclarationResolver;
  getUndefinedFontSnapshot: () => undefined;
  getUnscaledBorderBoxWidth: (input: HTMLElement) => number;
  getUploadedRemoteTextEntries: () => ReadonlyMap<
    string,
    ModelStorage_Storage.UploadedRemoteText
  >;
  getWebPlatformSnapshot: () => "web";
  getZeroInsetSnapshot: () => number;
  ghostSegmentHoverClasses: string;
  ghostSegmentThumbClasses: string;
  githubStarterPrompt: (address: string) => string;
  GOOGLE_FONT_CATALOG: EditorRuntime_EditorRuntime.FontCatalogEntry[];
  GOOGLE_FONT_FAMILY_NAMES: string[];
  GOOGLE_FONT_VARIANTS: Record<
    string,
    {
      italic?: boolean;
      wght?: number[];
      statics?: number[];
    }
  >;
  googleFontStylesheetUrl: (family: string) => string;
  GRADIENT_FILL_ICON: ColorControls_ColorControls.PropertyIconDefinition;
  gradientStopKeyboardHandlers: {
    onKeyDownCapture: ColorControls_React.KeyboardEventHandler<HTMLElement>;
  };
  GROUPABLE_TOKEN_SCALE_KINDS: Set<TokenEditors_TokenEditors.ScaleKind>;
  groupAdjacentSelectOptions: <Option extends Controls_C.SelectOption>(
    options: readonly Option[],
  ) => Option[][];
  groupColorPaletteTokens: (
    tokens: Documentation_Core.NormalizedTokens,
  ) => Documentation_Documentation.ColorPaletteGroup[];
  groupDocumentedComponents: (
    facts: Documentation_Documentation.ManifestDocumentationFacts,
  ) => Documentation_Documentation.DocumentationComponent[][];
  groupedTokenScale: (
    kind: TokenEditors_TokenEditors.ScaleKind,
    tokens: TokenEditors_TokenEditors.EditorScalarToken[],
  ) =>
    | TokenEditors_TokenEditors.TokenNameGroup<TokenEditors_TokenEditors.EditorScalarToken>[]
    | null;
  groupFontsByFamily: (
    fonts: TokenEditors_TokenEditors.EditorFont[],
  ) => [string, TokenEditors_TokenEditors.EditorFont[]][];
  groupTokensByName: <
    Token extends {
      name: string;
    },
  >(
    tokens: readonly Token[],
  ) => Documentation_Documentation.TokenNameGroup<Token>[];
  handleModalCatcherDragStart: (
    event: Interactions_React.DragEvent<HTMLElement>,
  ) => void;
  handleModalCatcherMouseDown: (
    event: Interactions_React.MouseEvent<HTMLElement>,
  ) => void;
  handleModalCatcherPointerDown: (
    event: Interactions_React.PointerEvent<HTMLElement>,
  ) => void;
  handleNavigationRowKey: Application_React.KeyboardEventHandler<HTMLElement>;
  HANDOFF_TARGET_STORAGE_KEY: string;
  HANDOFF_TARGETS: PlatformHost_Host.HandoffTarget[];
  HANDOFF_TEXT_RESERVE: number;
  handoffFileLabels: (
    files: EditorRuntime_EditorRuntime.HandoffFile[],
  ) => string;
  HandoffNotice: Preview_React.FunctionComponent<Preview_Preview.HandoffNoticeProps>;
  hasAddressDependentPreviewCode: (
    contents: string,
    kind: EditorRuntime_EditorRuntime.PublishedFileKind,
  ) => boolean;
  hasBundleMetadata: (
    bundle: Pick<
      ModelCore_Model.ParsedDesignSystem["bundle"],
      "namespace" | "declared"
    >,
  ) => boolean;
  hasCdsHtmlFontSizing: (arg0: HTMLElement) => boolean;
  hasClaudeCapabilityLoader: () => boolean;
  hasConfiguredDocumentFactory: () => boolean;
  hasDamagedUnicode: (text: string) => boolean;
  hasDisabledReason: (input: Dom_React.ReactNode) => boolean;
  hasDownloadCapability: () => boolean;
  hasEditableSheetContent: (element: Element) => boolean;
  hasEditorFlagInLocation: (
    location2: Pick<Location, "search" | "hash"> | undefined,
    key: string,
  ) => boolean;
  hasEditorFlagInParentLocation: (key: string) => boolean;
  hasEditorFlagInStorage: (key: string) => boolean;
  hasFilesMigrationMarker: (value: unknown) => boolean;
  hasFlipAnimationMarker: (input: HTMLElement) => boolean;
  hasFullCollectionWindow: (
    arg0: ReadonlyMap<string, ModelStorage_Storage.DatabaseRecord>,
  ) => boolean;
  hasGeneratedSystemHeader: (path: string, content: string) => boolean;
  hashArtifactState: (text: string) => string;
  hashCanonicalIndex: (value: unknown) => Promise<string>;
  hashDocumentId: (arg0: string) => string;
  hashFilePublishEntries: (
    entries: FilesCore_FilesBoot.FilePublishEntries,
  ) => Promise<Record<string, string>>;
  hashMigrationFileInput: (
    path: string,
    input: Migration_Model.FilePublishInput,
  ) => Promise<string>;
  hasHotRestartKey: (windowName?: string) => boolean;
  hashPreviewContent: (text: string) => string;
  hashStoreDocument: (
    document2: Record<string, unknown>,
    secretFields?: string[],
  ) => Promise<string>;
  hashStoreFields: (
    document2: Record<string, unknown>,
    secretFields?: string[],
  ) => Promise<Record<string, string>>;
  hashStoreSnapshot: (
    snapshot: Migration_Migration.StoreSnapshot,
    adapter?: Pick<
      Migration_Migration.MigrationAdapter<object>,
      "secretFields" | "digestView"
    >,
  ) => Promise<Map<string, string>>;
  hasIgnoredLegacyRootFile: boolean;
  hasMigratedHtmlFontSizing: boolean;
  hasOnlyManifestFile: (files: EditorRuntime_Model.FileTable) => boolean;
  hasOpenChild: (input: Element) => boolean;
  hasOpenOverlay: (page?: ParentNode) => boolean;
  hasOtherOpenOverlay: (input: HTMLInputElement | null) => boolean;
  hasPendingRemoteTextUploads: () => boolean;
  hasPreviewRunnerDocument: (environment: object, token: string) => boolean;
  hasRawProjectReferences: (text: string, kind: "card" | "bundle") => boolean;
  hasRunningAnimations: (input: Element) => boolean;
  hasSelectionModifier: (
    event: Pick<
      EditorRuntime_EditorRuntime.SelectionKeys,
      "metaKey" | "ctrlKey" | "altKey"
    >,
  ) => boolean;
  hasTallSheetDetent: (bounds: Dom_Dom.SheetBounds) => boolean;
  hasUnhydratedRemoteText: () => boolean;
  hasUnsafeRelativePath: (arg0: string) => boolean;
  hasUsageNote: (value: string | undefined) => boolean;
  hasValidSvgRoot: (text: string, offset: number) => boolean;
  hasVisibleToolbarContent: (
    element: Element,
    options?: Composition_Composition.ToolbarContentOptions,
  ) => boolean;
  hasWindowedSystemCollection: boolean;
  HELD_BINARY_MIME_TYPES: Record<string, string>;
  heldBrowserFileByteSize: (path: string, content: string) => number;
  heldFileBaseUrl: string | undefined;
  heldFileBrowserSource: (
    path: string,
    content: string | undefined,
  ) => FileBrowser_FileBrowser.FileBrowserSource;
  heldPopupClasses: string;
  heldPositionerClasses: string;
  heldUndoPointerIds: WeakMap<HTMLElement, Set<number>>;
  HEX_COLOR_PATTERN: RegExp;
  HIDDEN_SELECTION_TOOLBAR_STYLE: Composition_React.CSSProperties;
  holdCleanSingleFileForMigration: (options: {
    clean(): boolean;
    leaveNote(): boolean | undefined;
    hold(): void;
  }) => boolean;
  holdEditingForMigration: (input: string) => void;
  holdIframePointerLock: () => () => void;
  HOST_BACKGROUND_HEX_PATTERN: RegExp;
  HOST_COMMAND_PATTERN: RegExp;
  HOST_DESTINATION_PATTERN: RegExp;
  HOST_REQUEST_ID_PATTERN: RegExp;
  hostDrawsReadOnly: () => boolean;
  hostDrawsSave: () => boolean;
  hostFrameBridge: PlatformHost_Host.HostFrameBridge | null;
  hostOrigins: (ownWindow: PlatformHost_Host.ProtocolGlobal) => string[];
  hostSaveStatus: (
    status: PlatformHost_Host.SaveState["status"],
  ) => null | string | undefined;
  hostTakesRetry: () => boolean;
  HOT_CARRY_MAX_AGE_MS: number;
  HOT_CARRY_MAX_FILES: number;
  HOT_CARRY_MAX_INLINE_CHARS: number;
  HOT_CARRY_MAX_TOTAL_CHARS: number;
  HOT_CARRY_PROTOCOL_FIELD: string;
  HOT_CARRY_STORAGE_PREFIX: string;
  HOT_EVENT_HISTORY_LIMIT: number;
  HOT_INDEX_RECHECK_DELAY_MS: number;
  HOT_RESTARTS_PER_WINDOW: number;
  HOT_UPDATE_MAX_DEFER_MS: number;
  hotAdoptMethodKind: (update: FilesCore_Host.HotUpdate) => string;
  hotChangedPathSha: (
    change: FilesCore_FilesCore.FilesHotChange,
  ) => string | null;
  hotListingDescriptor: (
    version: FilesCore_Host.HotVersion,
  ) => FilesCore_FilesBoot.FileVersion;
  hotReloadBridges: WeakMap<object, PlatformHost_Host.ActiveHotReloadBridge>;
  hotReloadCopyExports: Dom_Dom.HotReloadCopyExports;
  hsvaToCssColor: (input: ColorControls_ColorControls.HsvaColor) => string;
  hsvaToHexColor: (input: ColorControls_ColorControls.HsvaColor) => string;
  HTML_FILE_REFERENCE_PATTERN: RegExp;
  HTML_NAMESPACE: string;
  HTTP_RELATIVE_HREF_BASE: string;
  HTTPS_RELATIVE_HREF_BASE: string;
  humanizeDocumentFilename: (path: string) => string;
  humanizeFamilyName: (key: string) => string;
  humanizeTokenFamily: (key: string) => string;
  hydratedRemoteTexts: () => Map<string, string>;
  hydrateStoredSystemText: (
    arg0: ModelStorage_Storage.StoredSystemFiles,
    arg1: ReadonlyMap<string, string>,
  ) => ModelStorage_StorageModel.FileTable;
  Icon: (
    input: Interactions_Interactions.IconProps,
  ) => Interactions_React.ReactElement;
  iconAnimationDurations: Readonly<Record<string, number>> | undefined;
  iconAnimationEasings: Readonly<Record<string, string>> | undefined;
  iconAnimationExitDurations: Readonly<Record<string, number>> | undefined;
  iconCodepoints: Readonly<Record<string, number>>;
  iconFontManifest: Interactions_Interactions.IconFontManifest;
  iconFontStyles: Readonly<
    Record<
      Interactions_Controls.ResolvedIconSize,
      Interactions_Interactions.IconSizeStyles
    >
  >;
  iconManifest: Interactions_Interactions.IconFontManifest;
  iconMasterWeights: Record<
    "16" | "20",
    Interactions_Interactions.IconWeightBounds
  >;
  iconSizeMetrics: Record<
    Interactions_Controls.ResolvedIconSize,
    Interactions_Interactions.IconSizeMetric
  >;
  iconSizes: Interactions_Controls.ResolvedIconSize[];
  IconSlot: (props: {
    icon?: Interactions_React.ReactNode;
  }) => Interactions_React.ReactElement;
  iconStrokePath: (
    path: string,
    strokeWidth?: number,
  ) => ColorControls_ColorControls.PropertyIconPath;
  iconWeightBounds: Record<
    "16" | "20",
    Interactions_Interactions.IconWeightBounds
  >;
  IFRAME_POINTER_LOCK_CLASS: string;
  IGNORED_LEGACY_ROOT_FILE_MESSAGE: string;
  IGNORED_UPLOAD_FILE_NAME_PATTERN: RegExp;
  ignorePasswordManagerForInput: (element: HTMLInputElement | null) => void;
  IMAGE_SLOT_STATE_FILENAME: string;
  INCREASE_LABEL: string;
  indexAuthoredFieldsEqual: (
    left: FilesCore_FilesCore.CarriedFilesIndex,
    right: FilesCore_FilesCore.CarriedFilesIndex,
  ) => boolean;
  IndexFileError: FilesCore_FilesCore.IndexFileErrorConstructor;
  indexPresentationField: (
    index: FilesCore_FilesBoot.FilesIndex,
    path: string,
  ) => string | undefined;
  IndexRecoveryBanner: () => EditorRuntime_React.ReactElement | null;
  indexUndoForeignChanges: (
    changes: FilesCore_FilesCore.FileIndexDelta[],
    conflicts: Iterable<string>,
    index: FilesCore_FilesBoot.FilesIndex,
  ) => FilesCore_FilesCore.IndexPresentationDelta;
  indexWithoutTitleAndDocs: (
    index: FilesCore_FilesBoot.FilesIndex,
  ) => Omit<FilesCore_FilesBoot.FilesIndex, "title" | "docs">;
  INDIVIDUAL_CORNERS_ICON: ColorControls_ColorControls.PropertyIconDefinition;
  inertElementProps: {
    inert?: boolean | "";
  };
  inertExcludedTags: Set<string>;
  inferColorContrastPairs: (
    tokens: Pick<
      EditorRuntime_Application.EditorColorToken,
      "name" | "usage"
    >[],
  ) => Map<string, EditorRuntime_EditorRuntime.InferredContrastPair>;
  inferComponentPropControls: (
    componentName: string,
    texts: readonly (string | undefined)[],
    options?: {
      keep?: readonly string[];
    },
  ) => Documentation_Core.InferredPropControl[];
  inferDeclaredLibraries: (
    declared: ModelCore_Model.DeclaredLibrary[],
    hasFile: (path: string) => boolean,
    catalog?: ModelCore_ModelCore.PackagedLibrary[],
  ) => {
    name: string;
    version: string;
  }[];
  inferEnumDeclaration: (
    body: string,
  ) => Documentation_Documentation.InferredControl | null;
  inferFontFamilyFromFilename: (name: string) => string;
  inferFontMetadata: (
    fileName: string,
  ) => EditorRuntime_EditorRuntime.InferredFontMetadata;
  inferVariantPropsType: (
    typeText: string,
    resolver: Documentation_Documentation.TypeDeclarationResolver,
  ) => string | null;
  inheritedTextLinkColorClasses: string;
  initialDesignSystemSection: () => string;
  initialFileBrowserSelection: (
    folder: FileBrowser_FileBrowser.BrowserFolder,
    whyNot: (entry: FileBrowser_FileBrowser.BrowserEntry) => string | undefined,
  ) => string | null;
  initializeAccentColors: () => void;
  initializeAdaptiveSheets: () => void;
  initializeAndroidCloseWatcher: () => void;
  initializeCancelableTimeout: () => void;
  initializeCdsLink: () => void;
  initializeCdsPlatform: () => void;
  initializeCdsRoot: () => void;
  initializeClassNames: () => void;
  initializeClickToFocus: () => void;
  initializeCloseOnActivityHide: () => void;
  initializeCoarsePointerStores: () => void;
  initializeCollisionPadding: () => void;
  initializeComboboxSheetBackdrop: () => void;
  initializeContextMenuPopup: () => void;
  initializeDesignSystemFilesDebugger: () => void;
  initializeDisabledReason: () => void;
  initializeDisabledReasonDebug: () => void;
  initializeDocumentColorMode: (document2: Document) => () => void;
  initializeDocumentFont: () => void;
  initializeElementAccess: () => void;
  initializeElementNamespaces: () => void;
  initializeElementWindow: () => void;
  initializeEmptyFilesStore: (
    options: Boot_Boot.InitializeStoreOptions,
  ) => Promise<Boot_Boot.InitializeStoreResult>;
  initializeErrorReporting: () => void;
  initializeEventCallbacks: () => void;
  initializeExperimentalTheme: () => void;
  initializeFeatureFlags: () => void;
  initializeHostSupport: () => void;
  initializeHrefWhitespace: () => void;
  initializeIconAccessibility: () => void;
  initializeIconManifest: () => void;
  initializeIcons: () => void;
  initializeIconSupport: () => void;
  initializeInertProps: () => void;
  initializeInputDismissalTracking: () => void;
  initializeIsomorphicLayoutEffect: () => void;
  initializeKeyboardContextMenuFocus: () => void;
  initializeLayers: () => void;
  initializeLinkTargets: () => void;
  initializeLinkWarnings: () => void;
  initializeMediaQueryStores: () => void;
  initializeMenuContexts: () => void;
  initializeMenuItemVariants: () => void;
  initializeMenuOpener: () => void;
  initializeMenuOverlayRegistration: () => void;
  initializeMenuPopupElement: () => void;
  initializeMenuScrollContent: () => void;
  initializeMenuSheetPopup: () => void;
  initializeMergedRefs: () => void;
  initializeMobileSheetExports: () => void;
  initializeModalCatcher: () => void;
  initializeModalPortalInert: () => void;
  initializeModalReleasePlatform: () => void;
  initializeOverlayActions: () => void;
  initializeOverlayFocus: () => void;
  initializeOverlayOwners: () => void;
  initializeOverlaySelector: () => void;
  initializeOverlayStack: () => void;
  initializePassiveOpen: () => void;
  initializePointerDismissal: () => void;
  initializePopoverSheetContent: () => void;
  initializePopupPointerFocus: () => void;
  initializePortalRoot: () => void;
  initializePreloadSheets: () => void;
  initializePresentationMode: () => void;
  initializeReducedMotion: () => void;
  initializeRemScale: () => void;
  initializeSafeBlur: () => void;
  initializeSafeObservers: () => void;
  initializeSheetChrome: () => void;
  initializeSheetClassNames: () => void;
  initializeSheetDrag: () => void;
  initializeSheetDragSettings: () => void;
  initializeSheetFocusSupport: () => void;
  initializeSheetImplementation: () => void;
  initializeSheetMeasurement: () => void;
  initializeSheetPopupHost: () => void;
  initializeSheetStyles: () => void;
  initializeShortcuts: () => void;
  initializeShrinkWrap: () => void;
  initializeShrinkWrapMeasurement: () => void;
  initializeSkeletonContexts: () => void;
  initializeStablePopupPlacement: () => void;
  initializeSurfaces: () => void;
  initializeTextClipping: () => void;
  initializeTextEntrySelector: () => void;
  initializeThemeTokenManifest: () => void;
  initializeTooltip: () => void;
  initializeTooltipClasses: () => void;
  initializeTooltipContext: () => void;
  initializeTransitionRunner: () => void;
  initializeTranslations: () => void;
  initializeVisualKeyboard: () => void;
  initialSectionFromHash: (
    sections: string[] | ((section: string) => boolean),
    fallback: string,
  ) => string;
  INLINE_MARKDOWN_PATTERN: RegExp;
  INLINE_NO_ROOM_MESSAGE: string;
  INLINE_STORAGE_UNAVAILABLE_DESCRIPTION: string;
  inlineLimitForFileKind: (fileKind: ModelCore_Model.FileKind) => number;
  inlineLimitForPath: (
    path: string,
    fileKind?: ModelCore_Model.FileKind,
  ) => number;
  inlineLimitLabelForPath: (
    path: string,
    fileKind?: ModelCore_Model.FileKind,
  ) => ModelCore_Model.FileKind | "image-slot state";
  inlineStorageFallbackMessage: (arg0: string) => string;
  inlineTextLinkClasses: string;
  inlineTypeObjectBodies: (head: string) => string[];
  inputContainerClasses: string;
  inputDismissalStates: WeakMap<Document, Dom_Dom.DocumentInputState>;
  inputElementClasses: string;
  inspectStandaloneMigrationGuide: (readme: string) => {
    both: boolean;
    script: boolean;
  };
  installDesignSystemTypingListener: () => void;
  installedToolbarPointerDocuments: WeakSet<Document>;
  installFilesSaveLifecycle: (
    queue: FilesCore_FilesCore.SaveLifecycleQueue,
    host?: FilesCore_FilesCore.SaveLifecycleHost,
  ) => () => void;
  installFindBarEventGuards: (window: Window) => void;
  installInternalFileDragTracking: (
    target: Window,
    onDrop: () => void,
    internal: Composition_React.RefObject<boolean>,
  ) => () => void;
  installToolbarPointerTracking: (document2: Document) => void;
  instanceUsesFilesPublisher: boolean;
  instrumentFilesPort: <Port extends DebugPanel_Model.BrowserFilesPort>(
    port: Port,
    debug: DebugPanel_FilesCore.FilesDebugger,
  ) => Port;
  IntakeProgressDot: () => Preview_React.ReactElement;
  IntakeProgressStatus: Preview_React.FunctionComponent<Preview_Preview.IntakeProgressStatusProps>;
  INTERACTIVE_CLICK_TARGET_SELECTOR: string;
  InteractiveLinkElement: (
    props: ControlsExtra_Controls.InteractiveLinkElementProps,
  ) => ControlsExtra_React.ReactElement | null;
  interactiveLinkReservedProps: (
    | "rel"
    | "href"
    | "routerOptions"
    | "target"
    | "download"
  )[];
  interceptEscapeForInnerOverlay: (
    arg0: Layers_Dom.OverlayStack,
    arg1: boolean,
    arg2: Layers_Dom.OverlayCloseDetails,
  ) => boolean;
  interpolateTranslation: (
    template: string,
    values?: Interactions_Interactions.TranslationValues,
  ) => string;
  introducedHeldFilePaths: (
    arg0: ModelStorage_StorageModel.FileTable,
    arg1: ModelStorage_StorageModel.FileTable,
  ) => string[];
  INVALID_PROJECT_INDEX_MESSAGE: string;
  invalidAssetGroupOrders: (
    index: FilesCore_FilesBoot.FilesIndex,
    known?: (name: string) => ReadonlySet<string>,
  ) => Record<string, string[]>;
  inverseRubberBandDistance: (
    distance: number,
    overshootRoom: number,
  ) => number;
  INVISIBLE_PATH_CHARACTER_PATTERN: RegExp;
  invokeAndReportError: (input: () => void) => void;
  isAdditionalMarkdownPath: (path: string) => boolean;
  isAllowedAndroidIntentHref: (arg0: string) => boolean;
  isAllowedEditorHref: (arg0: string) => boolean;
  isAllowedHostOrigin: (
    origin: string,
    allowedOrigins: readonly string[],
  ) => boolean;
  isAndroidWindow: (windowObject: Dom_Dom.BrowserWindow) => boolean;
  isAppCodePath: (path: string) => boolean;
  isAppleBrowser: () => boolean;
  isApplePlatform: () => boolean;
  isArtifactAddress: (value: string) => boolean;
  isArtifactOwner: () => Promise<boolean | undefined>;
  isAssetGroupName: (name: unknown) => name is string;
  isAssetOrderKey: (key: unknown) => key is string;
  isAssetTileSize: (value: unknown) => value is ModelCore_Model.AssetTileSize;
  isBadgeVariant: (
    input: Controls_C.BadgeVariant | Controls_C.AccentColor,
  ) => input is Controls_C.BadgeVariant;
  isBaseUiFocusGuardEvent: (details: {
    trigger?: Element;
    event?: {
      target: EventTarget | null;
    };
  }) => boolean;
  isBinaryProjectFilePath: (path: string) => boolean;
  isBlankPreviewFrame: (iframe: HTMLIFrameElement) => boolean;
  isButtonActivationKey: (
    input: Pick<Controls_C.ButtonKeyEvent, "key">,
  ) => boolean;
  isCanceledOpenWithinTrigger: (
    arg0: import("@base-ui/react/menu").Menu.Root.ChangeEventDetails,
  ) => boolean;
  isCanonicalJsonObject: (
    arg0: unknown,
  ) => arg0 is ModelStorage_Storage.DatabaseRecord;
  isCarriedFileIndex: (
    value: unknown,
  ) => value is FilesCore_FilesCore.CarriedFilesIndex;
  isChangeMetadataObject: (input: unknown) => input is Record<string, unknown>;
  isCiLastChange: (change: ModelCore_Model.LastChange | null) => boolean;
  isClaudeEmulator: () => boolean;
  isClaudeSessionDestination: (value: unknown) => boolean;
  isCleanUtf8DataUrl: (url: string) => boolean;
  isColorLiteral: (value: unknown) => boolean;
  isColorOrAlias: (value: unknown) => boolean;
  isComposingEvent: (event: FileBrowser_FileBrowser.ComposingEvent) => boolean;
  isConflictTextFile: (path: string, value: string | null) => boolean;
  isContrastBackgroundToken: (name: string, namespace: string) => boolean;
  isCrashStashEntry: (
    value: unknown,
  ) => value is FilesCore_FilesBoot.CrashStashEntry;
  isCssLength: (value: unknown) => boolean;
  isDarkThemeName: (name: string) => boolean;
  isDataUriUrl: (url: string) => boolean;
  isDerivedProjectPath: (path: string) => boolean;
  isDerivedSystemDocument: (path: string) => boolean;
  isDesignSystemContentObject: (
    input: unknown,
  ) => input is Record<string, unknown>;
  isDesignSystemSection: (section: string) => boolean;
  isDesignSystemTypeHost: boolean;
  isDesignSystemTypeHostModelBoot: (arg0: string) => boolean;
  isDisallowedRelativeScriptSource: (src: string, cardPath: string) => boolean;
  isDocumentCurrentTarget: (
    arg0: Layers_Dom.OverlayEvent | undefined,
  ) => boolean;
  isDownloadOnlyPublishInput: (
    input: Migration_Model.FilePublishInput,
  ) => boolean;
  isEditableElement: (element: Element | null | undefined) => boolean;
  isEditableMarkdownBlock: (
    kind: Documentation_Core.MarkdownFormatState["block"],
  ) => boolean;
  isEditorFeatureEnabled: (flag: string, queryKey: string) => boolean;
  isEmptySwatch: (swatch: ColorControls_ColorControls.ColorSwatch) => boolean;
  isEmptyTooltipContent: (input: unknown) => boolean;
  isEmulatorBlobUrl: (url: string) => boolean;
  isEmulatorPage: () => boolean;
  isExpensiveHeldImagePath: (path: string) => boolean;
  isExtraTokenSection: (section: string) => boolean;
  isEyeDropperAvailable: () => boolean;
  isFigmaFile: (arg0: string) => boolean;
  isFileIconAsset: (
    asset: Pick<EditorRuntime_Application.EditorAsset, "kind">,
  ) => boolean;
  isFileMigrationMarkerObject: (
    input: unknown,
  ) => input is ModelStorage_Storage.DatabaseRecord;
  isFilesIndex: (value: unknown) => value is FilesCore_FilesBoot.FilesIndex;
  isFilesIndexObject: (value: unknown) => value is Record<string, unknown>;
  isFilesMergeObject: (
    value: unknown,
  ) => value is FilesCore_FilesCore.JsonRecord;
  isFilesMergeStringArray: (value: unknown) => value is string[];
  isFileTableObject: (input: unknown) => input is Record<string, unknown>;
  isFindShortcut: (event: KeyboardEvent, mac?: boolean) => boolean;
  isFinitePanelNumber: (value: unknown) => value is number;
  isFiniteRunningAnimation: (animation: Animation) => boolean;
  isFocusableRegionElement: (
    element: HTMLElement,
    rendered: (element: HTMLElement) => boolean,
  ) => boolean;
  isFocusVisible: (element: Element | null) => boolean;
  isFocusVisibleUiArtifactToolbar: (element: Element) => boolean;
  isFontFile: (fileName: string, mimeType: string) => boolean;
  isFrameCaptureMode: (document2?: Document) => boolean;
  isGeneralSurfaceToken: (name: string, namespace: string) => boolean;
  isGeneratedApiPath: (path: string) => boolean;
  isGeneratedIndexField: (path: string) => boolean;
  isGeneratedSystemPath: (path: string) => boolean;
  isHeldFilePointer: (path: string, content: string) => boolean;
  isHiddenBrowserPath: (path: string) => boolean;
  isHiddenByInlineDisplay: (input: Element) => boolean;
  isHtmlElement: (input?: unknown) => input is HTMLElement;
  isHtmlFilePath: (path: string) => boolean;
  isIconName: (input: unknown) => input is string;
  isIgnoredUploadFile: (file: File) => boolean;
  isIgnoredUploadFileName: (name: string) => boolean;
  isImageSlotStatePath: (path: string) => boolean;
  isImmediateFlipMarker: (input: HTMLElement) => boolean;
  isIndexFileSaveError: (code: string | undefined) => boolean;
  isInputTriggeredBlur: (event: Dom_Dom.InputFocusEvent) => boolean;
  isInstallableFontPath: (path: string) => boolean;
  isKeyboardContextMenuEvent: (
    input?: Interactions_Interactions.ContextMenuInputEvent,
  ) => boolean;
  isLegacyEnvelopeCurrent: (
    arg0?: string,
    arg1?: typeof fetch | undefined,
  ) => Promise<null | boolean | undefined>;
  isLiveRegionEvent: (event: Event | undefined) => boolean;
  isLocalFileReference: (arg0: string) => boolean;
  isManifestMetadataObject: (
    input: unknown,
  ) => input is Record<string, unknown>;
  isMenuSearchEditingKey: (event: Overlays_Overlays.SearchKeyEvent) => boolean;
  isMergeObject: (value: unknown) => value is FilesCore_FilesCore.JsonRecord;
  isMigratedBannerDismissed: () => boolean;
  isMigrationExemptHost: (arg0: string) => boolean;
  isMirrorEligibleFile: (path: string, content: string) => boolean;
  isMirrorEligiblePath: (path: string) => boolean;
  isModifiedLinkClick: (arg0: Layers_Layers.LinkClickEvent) => boolean;
  isNonemptyUserString: (value: unknown) => value is string;
  isNormalFlowStyle: (style: CSSStyleDeclaration) => boolean;
  isOrderSubsequence: (
    order: readonly string[],
    subset: readonly string[],
  ) => boolean;
  isOriginStableHref: (arg0: string | undefined) => boolean;
  isOverlayClosed: (element: Element) => boolean;
  isOwnedImportantStyle: (
    style: CSSStyleDeclaration,
    property: string,
    value: string | undefined,
  ) => boolean;
  isPanelDockMode: (
    value: unknown,
  ) => value is ColorControls_ColorControls.PanelDockMode;
  isPanelPosition: (
    value: unknown,
  ) => value is ColorControls_ColorControls.PanelPosition;
  isPendingBlobId: (id: string) => boolean;
  isPermanentFilesBootFailure: (input: unknown) => boolean;
  isPictogramComponent: (
    input: Controls_C.PictogramComponent | null | undefined,
  ) => boolean;
  isPictogramElement: (input: Controls_React.ReactNode) => boolean;
  isPipelineBannerDismissed: (timestamp: string) => boolean;
  isPlainMergeRecord: (
    value: unknown,
  ) => value is FilesCore_FilesCore.JsonRecord;
  isPopoverArrow: (node: Overlays_React.ReactNode) => boolean;
  isPortalRootContext: Layers_React.Context<boolean>;
  isPreviewRunnerAvailable: (environment: object) => boolean;
  isPreviewRunnerCoolingDown: (environment: object) => boolean;
  isPreviewRunnerEnabled: (environment: object) => boolean;
  isPrimaryShortcutModifier: (
    event: Pick<KeyboardEvent, "altKey" | "ctrlKey" | "metaKey">,
    mac: boolean,
  ) => boolean;
  isPrivateProjectFile: (
    type: FilesCore_FilesCore.FileArtifactType,
    path: string,
  ) => boolean;
  isProjectContentPath: (path: string) => boolean;
  isProjectIndexFilePath: (path: string) => boolean;
  isPublishableFilePath: (path: string) => boolean;
  isPublishableFilePathModelFileTable: (path: string) => boolean;
  isPublishableSvgText: (text: string) => boolean;
  isPublishedPreviewStillOffered: (url: string) => boolean;
  isRecentMigrationAttempt: (options: {
    runningAt: number | null | undefined;
    now: number;
  }) => boolean;
  isRecentSingleFileMoveNote: (options: {
    singleFileHere: boolean;
    canReopen: boolean;
    noteAt: number | null | undefined;
    now: number;
  }) => boolean;
  isReducedMotion: () => boolean;
  isRepairableDamagedText: (path: string, contents: string) => boolean;
  isReservedProjectFile: (
    type: FilesCore_FilesCore.FileArtifactType,
    path: string,
  ) => boolean;
  isRetryableFileReadAccessError: (error: unknown) => boolean;
  isReversedLogoAsset: (
    asset: Pick<EditorRuntime_Application.EditorAsset, "name">,
  ) => boolean;
  isRuntimeInternalFilePath: (path: string) => boolean;
  isSafeBoxShadow: (value: unknown) => boolean;
  isSafeFileIndexKey: (key: string) => boolean;
  isSafeFontStack: (stack: string) => boolean;
  isSameOriginHref: (arg0: string) => boolean;
  isSanitizedHrefFallback: (
    arg0: string | undefined,
    arg1: string | undefined,
  ) => boolean;
  isScrollbarPointerPosition: (
    arg0: number,
    arg1: number,
    arg2: HTMLElement,
  ) => boolean;
  isScrollContentReplacement: (
    records: readonly MutationRecord[],
    hadOverflow: boolean,
  ) => boolean;
  isSectionHeadBackgroundEvent: (
    event: TokenEditors_React.MouseEvent<HTMLElement>,
  ) => boolean;
  isSessionBannerDismissed: (key: string) => boolean;
  isSheetImplementationLoaded: () => boolean;
  isShimmerAnimation: (input: Controls_C.NamedAnimation) => boolean;
  isShortcutModifier: (input: string) => input is Dom_Dom.ShortcutModifier;
  isShrinkWrapAtomicElement: (
    input: Element,
    options: CSSStyleDeclaration,
  ) => boolean;
  isStorageCatalogObject: (
    input: unknown,
  ) => input is ModelStorage_Storage.DatabaseRecord;
  isStoredBlobReference: (url: string) => boolean;
  isStoredDocumentObject: (
    input: unknown,
  ) => input is ModelStorage_Storage.DatabaseRecord;
  isStringArray: (value: unknown) => value is string[];
  isSupportedFont: (input: string) => input is Dom_Dom.DocumentFont;
  isSurfaceToken: (arg0: string) => boolean;
  isSvgElement: (input?: unknown) => input is SVGElement;
  isSystemCollectionWindowed: () => boolean;
  isSystemEditingDisabled: (arg0: { editing?: unknown }) => boolean;
  isTextEntryTarget: (arg0: Element) => boolean;
  isTextFileListingRow: (row: Boot_Model.FileListingRow) => boolean;
  isTextFilePath: (path: string) => boolean;
  isTextFileWithInvalidUnicode: (
    path: string,
    input: FilesCore_FilesBoot.FilePublishInput,
  ) => boolean;
  isTextMimeType: (mime: string) => boolean;
  isTextRangeClipped: (element: HTMLElement) => boolean;
  isTintedFillSurface: (arg0: string) => boolean;
  isTokenFilePath: (path: string) => boolean;
  isTokenObject: (value: unknown) => value is Record<string, unknown>;
  isToolbarClickThrough: (
    event: ColorControls_ColorControls.ToolbarClickEvent,
  ) => boolean;
  isToolbarSaveIndicator: (element: Element) => boolean;
  isToolConfigurationPath: (path: string) => boolean;
  isUnboundedFileParsing: () => boolean;
  isUndoEditingTarget: (target: EventTarget | null) => boolean;
  isUnmodifiedButtonActivation: (input: Controls_C.ButtonKeyEvent) => boolean;
  isUnsupportedBinaryFile: (path: string, contents: string) => boolean;
  isUnwrappedHorizontalFlex: (input: HTMLElement) => boolean;
  isValidCommentImage: (source: string) => boolean;
  isValidDesignSystemPath: (path: string) => boolean;
  isValidTypeDeclarationName: (name: string) => boolean;
  isWallAssetKind: (kind: ModelCore_Model.AssetKind) => kind is "svg" | "image";
  isXmlWhitespace: (character: string | undefined) => boolean;
  joinBoxShadowLayers: (layers: string[]) => string;
  joinClassNames: (...classes: (string | false | null | undefined)[]) => string;
  joinedButtonRadiusClasses: Record<"start" | "middle" | "end", string>;
  joinEnglishList: (items: readonly string[]) => string;
  joinLimitedUploadMessages: (messages: string[]) => string;
  joinPickerClasses: (
    ...input: (string | false | null | undefined)[]
  ) => string;
  JSON_HTML_ESCAPE_PATTERN: RegExp;
  JSON_LINE_SEPARATOR_ESCAPE_PATTERN: RegExp;
  JSON_STRING_ESCAPE_PATTERN: RegExp;
  jsonForInlineScript: (value: Documentation_Documentation.JsonValue) => string;
  jsonValueDepth: (arg0: unknown, arg1?: number) => number;
  jsxActivityHide: typeof import("react/jsx-runtime");
  jsxAdaptiveSheets: typeof import("react/jsx-runtime");
  jsxAddTokenDialog: typeof import("react/jsx-runtime");
  jsxAssetActions: typeof import("react/jsx-runtime");
  jsxAssetDetails: typeof import("react/jsx-runtime");
  jsxAssetGroupEditor: typeof import("react/jsx-runtime");
  jsxAssetGroups: typeof import("react/jsx-runtime");
  jsxaZ: typeof import("react/jsx-runtime");
  jsxBrandUpload: typeof import("react/jsx-runtime");
  jsxcC: typeof import("react/jsx-runtime");
  jsxCdsRoot: typeof import("react/jsx-runtime");
  jsxCheckbox: typeof import("react/jsx-runtime");
  jsxChromeContextMenu: typeof import("react/jsx-runtime");
  jsxCollaboratorTints: typeof import("react/jsx-runtime");
  jsxCollisionPadding: typeof import("react/jsx-runtime");
  jsxColorEditors: typeof import("react/jsx-runtime");
  jsxColorMode: typeof import("react/jsx-runtime");
  jsxColorModePrimitives: typeof import("react/jsx-runtime");
  jsxColorSelectPrimitives: typeof import("react/jsx-runtime");
  jsxComboboxSheetBackdrop: typeof import("react/jsx-runtime");
  jsxComboboxStatus: typeof import("react/jsx-runtime");
  jsxCommentSelection: typeof import("react/jsx-runtime");
  jsxComponentPreviews: typeof import("react/jsx-runtime");
  jsxComponentsSection: typeof import("react/jsx-runtime");
  jsxConfirmDialog: typeof import("react/jsx-runtime");
  jsxConflictBanners: typeof import("react/jsx-runtime");
  jsxContextMenuPopup: typeof import("react/jsx-runtime");
  jsxCoverCapture: typeof import("react/jsx-runtime");
  jsxCoverPreview: typeof import("react/jsx-runtime");
  jsxDesignSystemApp: typeof import("react/jsx-runtime");
  jsxDesignSystemBootstrap: typeof import("react/jsx-runtime");
  jsxDesignSystemFiles: typeof import("react/jsx-runtime");
  jsxDisabledReason: typeof import("react/jsx-runtime");
  jsxDocumentSections: typeof import("react/jsx-runtime");
  jsxEditableMarkdown: typeof import("react/jsx-runtime");
  jsxEditorEmptyStates: typeof import("react/jsx-runtime");
  jsxeJ: typeof import("react/jsx-runtime");
  jsxEq: typeof import("react/jsx-runtime");
  jsxField: typeof import("react/jsx-runtime");
  jsxFieldCheckbox: typeof import("react/jsx-runtime");
  jsxFieldNumberInput: typeof import("react/jsx-runtime");
  jsxFieldTextArea: typeof import("react/jsx-runtime");
  jsxFieldTextInput: typeof import("react/jsx-runtime");
  jsxFileDrop: typeof import("react/jsx-runtime");
  jsxFileDropContent: typeof import("react/jsx-runtime");
  jsxFileDropHints: typeof import("react/jsx-runtime");
  jsxFileDropOverlay: typeof import("react/jsx-runtime");
  jsxFileDropTarget: typeof import("react/jsx-runtime");
  jsxFileDropUiFileDrop: typeof import("react/jsx-runtime");
  jsxFilesBrowser: typeof import("react/jsx-runtime");
  jsxForUiAnnouncements: typeof import("react/jsx-runtime");
  jsxForUiArtifactLoadBoundary: typeof import("react/jsx-runtime");
  jsxForUiArtifactShell: typeof import("react/jsx-runtime");
  jsxForUiArtifactToolbar: typeof import("react/jsx-runtime");
  jsxForUiButtons: typeof import("react/jsx-runtime");
  jsxForUiColorPicker: typeof import("react/jsx-runtime");
  jsxForUiCommitTextInput: typeof import("react/jsx-runtime");
  jsxForUiContrastControls: typeof import("react/jsx-runtime");
  jsxForUiDisclosure: typeof import("react/jsx-runtime");
  jsxForUiIcons: typeof import("react/jsx-runtime");
  jsxForUiInputs23: typeof import("react/jsx-runtime");
  jsxForUiInputs24: typeof import("react/jsx-runtime");
  jsxForUiInputs25: typeof import("react/jsx-runtime");
  jsxForUiLinks: typeof import("react/jsx-runtime");
  jsxForUiLinks2: typeof import("react/jsx-runtime");
  jsxForUiMenu: typeof import("react/jsx-runtime");
  jsxForUiNumberControls: typeof import("react/jsx-runtime");
  jsxForUiPopover: typeof import("react/jsx-runtime");
  jsxForUiPropertyIcons: typeof import("react/jsx-runtime");
  jsxForUiPropertyPopover: typeof import("react/jsx-runtime");
  jsxForUiPropertyRow2: typeof import("react/jsx-runtime");
  jsxForUiSegmentedControl: typeof import("react/jsx-runtime");
  jsxForUiSidePanels: typeof import("react/jsx-runtime");
  jsxForUiSidePanels2: typeof import("react/jsx-runtime");
  jsxForUiSkeleton: typeof import("react/jsx-runtime");
  jsxForUiTabs: typeof import("react/jsx-runtime");
  jsxForUiToast: typeof import("react/jsx-runtime");
  jsxForUiToolbarControls: typeof import("react/jsx-runtime");
  jsxForUiToolbarControls2: typeof import("react/jsx-runtime");
  jsxForUiTooltips: typeof import("react/jsx-runtime");
  jsxFu: typeof import("react/jsx-runtime");
  jsxGP: typeof import("react/jsx-runtime");
  jsxGradientStopKeyboardHandlers: typeof import("react/jsx-runtime");
  jsxHandoff: typeof import("react/jsx-runtime");
  jsxHandoffTargets: typeof import("react/jsx-runtime");
  jsxIcons: typeof import("react/jsx-runtime");
  jsxInlineMarkdown: typeof import("react/jsx-runtime");
  jsxLayers: typeof import("react/jsx-runtime");
  jsxLazySection: typeof import("react/jsx-runtime");
  jsxMarkdownBlocks: typeof import("react/jsx-runtime");
  jsxMarkdownToolbar: typeof import("react/jsx-runtime");
  jsxMenuPopupElement: typeof import("react/jsx-runtime");
  jsxMenuScrollContent: typeof import("react/jsx-runtime");
  jsxMenuSheetPopup: typeof import("react/jsx-runtime");
  jsxMigrationBanners: typeof import("react/jsx-runtime");
  jsxmq: typeof import("react/jsx-runtime");
  jsxMu: typeof import("react/jsx-runtime");
  jsxNewAssetGroupDialog: typeof import("react/jsx-runtime");
  jsxNumberInput: typeof import("react/jsx-runtime");
  jsxo_: typeof import("react/jsx-runtime");
  jsxPassiveOpen: typeof import("react/jsx-runtime");
  jsxPipelineBanners: typeof import("react/jsx-runtime");
  jsxPlatformShortcuts: typeof import("react/jsx-runtime");
  jsxPointerDismissal: typeof import("react/jsx-runtime");
  jsxPopoverSheetBody: typeof import("react/jsx-runtime");
  jsxPortalRoot: typeof import("react/jsx-runtime");
  jsxPreviewFit: typeof import("react/jsx-runtime");
  jsxPreviewThemeMenu: typeof import("react/jsx-runtime");
  jsxPropertyPopoverActions: typeof import("react/jsx-runtime");
  jsxPropertyPopoverControls: typeof import("react/jsx-runtime");
  jsxPropertyRowHelpers: typeof import("react/jsx-runtime");
  jsxReadmeArticle: typeof import("react/jsx-runtime");
  jsxrm: typeof import("react/jsx-runtime");
  jsxRowContextMenu: typeof import("react/jsx-runtime");
  jsxrZ: typeof import("react/jsx-runtime");
  jsxs_: typeof import("react/jsx-runtime");
  jsxSC: typeof import("react/jsx-runtime");
  jsxSectionCard: typeof import("react/jsx-runtime");
  jsxSectionHeaders: typeof import("react/jsx-runtime");
  jsxSectionNavigation: typeof import("react/jsx-runtime");
  jsxShadowEditors: typeof import("react/jsx-runtime");
  jsxSheetChrome: typeof import("react/jsx-runtime");
  jsxShortcut: typeof import("react/jsx-runtime");
  jsxShrinkWrap: typeof import("react/jsx-runtime");
  jsxSkeletonContexts: typeof import("react/jsx-runtime");
  jsxsM: typeof import("react/jsx-runtime");
  jsxStaticPreview: typeof import("react/jsx-runtime");
  jsxSwatchPreview: typeof import("react/jsx-runtime");
  jsxSwitch: typeof import("react/jsx-runtime");
  jsxT_: typeof import("react/jsx-runtime");
  jsxtK: typeof import("react/jsx-runtime");
  jsxToasts: typeof import("react/jsx-runtime");
  jsxTokenRename: typeof import("react/jsx-runtime");
  jsxTokenScales: typeof import("react/jsx-runtime");
  jsxToolbarButtons: typeof import("react/jsx-runtime");
  jsxToolbarIndicators: typeof import("react/jsx-runtime");
  jsxToolbarLabels: typeof import("react/jsx-runtime");
  jsxToolbarLayout: typeof import("react/jsx-runtime");
  jsxToolbarPicker: typeof import("react/jsx-runtime");
  jsxToolbarSeparators: typeof import("react/jsx-runtime");
  jsxTooltip: typeof import("react/jsx-runtime");
  jsxTooltipClasses: typeof import("react/jsx-runtime");
  jsxTypographyEditors: typeof import("react/jsx-runtime");
  jsxUsageEditor: typeof import("react/jsx-runtime");
  jsxWelcome: typeof import("react/jsx-runtime");
  jsxWelcomeIcons: typeof import("react/jsx-runtime");
  jsxX_: typeof import("react/jsx-runtime");
  jsxZu: typeof import("react/jsx-runtime");
  KEYBOARD_MINIMUM_HEIGHT: number;
  keyboardContextMenuRoots: WeakMap<object, boolean>;
  keyedListToMergeObject: (
    value: FilesCore_FilesCore.JsonMergeValue,
    key: string,
  ) => Record<string, FilesCore_FilesCore.JsonRecord>;
  KIBIBYTE: number;
  KitIcon: ColorControls_React.FunctionComponent<ColorControls_ColorControls.KitIconProps>;
  KNOWN_FONT_FAMILY_MAP: Map<
    string,
    EditorRuntime_EditorRuntime.FontCatalogEntry
  >;
  knownFontFamily: (
    family: string,
  ) => EditorRuntime_EditorRuntime.FontCatalogEntry | undefined;
  knownRemoteUploadsByText: () => Map<string, ModelStorage_Storage.KnownUpload>;
  knownRemoteUploadsForFiles: (
    arg0: ModelStorage_StorageModel.FileTable,
  ) => Map<string, ModelStorage_Storage.KnownUpload>;
  knownUploadForRemoteText: (
    arg0: string,
    arg1: string,
  ) => ModelStorage_Storage.KnownUpload | undefined;
  knownUploadFromRemoteRecord: (
    arg0: ModelStorage_Storage.RemoteFileRecord,
  ) => ModelStorage_Storage.KnownUpload;
  knownWebFontFamily: (family: string) => string | undefined;
  lastArtifactEditTime: number;
  lastChangeFromManifest: (
    manifestInput: unknown,
    report?: ModelCore_Model.ParseReport,
  ) => ModelCore_Model.LastChange | null;
  lastChangeIsImported: (lastChange: unknown) => boolean;
  lastCompositionEndTime: number;
  lastDesignSystemTypingAt: number;
  lastStoreFoldSummary: Migration_Migration.FoldSummary;
  lastToolbarTouchRelease: number | null;
  lastUnpublishableMigrationPaths: string[];
  LAYER_BAND_SIZE: number;
  layerBaseContext: Interactions_React.Context<number>;
  LAZY_READ_SKIPPED_CONTENT_KINDS: Set<FilesCore_FilesBoot.FileKind>;
  lazyFileReadMode: (
    lazy: FilesCore_FilesCore.LazyReadState,
    path: string,
  ) => "read" | "skipped" | "held";
  lazyReadLastDocumentPath: (
    listing: FilesCore_FilesBoot.FileListingRow[],
  ) => string | undefined;
  LazySection: (
    props: Application_Application.LazySectionProps,
  ) => Application_React.ReactElement;
  leadingGlyphOutsetClass: string;
  leadingGlyphSpacingClass: string;
  leadingHrefWhitespacePattern: RegExp;
  leadingIconInsetClasses: Record<"text" | "glyph", string>;
  leadingIconOutsetClasses: Record<"text" | "glyph", string>;
  leadingIconSpacingClasses: Record<"text" | "glyph", string>;
  LEAF_MERGE_SCHEMA: FilesCore_FilesCore.MergeSchema;
  LEFT_OUT_BANNER_STORAGE_PREFIX: string;
  LEGACY_DATABASE_FRESH_READ_ATTEMPTS: number;
  LEGACY_DATABASE_FRESH_READ_DELAY_MS: number;
  LEGACY_DATABASE_LIST_LIMIT: number;
  LEGACY_GENERATED_SECTION_PATTERN: RegExp;
  LEGACY_MANIFEST_FENCE_PATTERN: RegExp;
  LEGACY_MANIFEST_FENCE_PATTERN_SOURCE: string;
  LEGACY_MARKDOWN_FENCE: string;
  LEGACY_PROJECT_INDEX_PATHS: {
    designSystem: string;
  };
  LEGACY_QUICK_START_HEADING: string;
  LEGACY_README_INSTRUCTIONS: string;
  LEGACY_README_SECTION_PATTERN: RegExp;
  LEGACY_STATE_AMBIGUOUS_RETRY_MS: number;
  legacyCleanupGate:
    | (() => Promise<boolean | "later" | null | undefined>)
    | undefined;
  legacyDesignSystemDocument: Boot_Boot.ActiveDocument | undefined;
  legacyDesignSystemIsBusy: () => boolean;
  LegacyStateReadFailure: Boot_Boot.LegacyFailureConstructor;
  legacyStoreChangedAfterMigration: (
    meta: unknown,
    index: Boot_Model.FilesIndex | undefined,
  ) => boolean;
  legacyStoreSnapshotToFiles: (
    snapshot: Migration_Migration.StoreSnapshot,
    fetchBlob: Migration_Migration.FetchMigrationBlob,
  ) => Promise<Migration_Migration.LegacyMigrationSystem>;
  LengthTokenValueEditor: TokenEditors_React.FunctionComponent<TokenEditors_TokenEditors.LengthTokenValueEditorProps>;
  LetterSpacingIcon: () => TokenEditors_React.ReactElement;
  LIBRARY_NAME_PATTERN: RegExp;
  LIBRARY_VERSION_PATTERN: RegExp;
  linearToSrgbChannel: (channel: number) => number;
  LineHeightIcon: () => TokenEditors_React.ReactElement;
  linkEventPropNames: Layers_Layers.LinkEventName[];
  linkPrefetchEventKinds: Record<Layers_Layers.LinkIntentEventName, boolean>;
  linkPrefetchEventNames: Layers_Layers.LinkIntentEventName[];
  linkUrlFromElement: (anchor: Element) => string;
  linkWarningLimitReached: boolean;
  linkWhitespacePattern: RegExp;
  listedAssetIds: () => Set<string> | null;
  listingRowIsSvg: (
    row: FilesCore_FilesBoot.FileListingRow | undefined,
  ) => boolean;
  listWritableFiles: (
    port: FilesCore_FilesBoot.BrowserFilesPort,
  ) => Promise<FilesCore_FilesBoot.FileListing>;
  LIVE_READ_ONLY_MESSAGE: string;
  LIVE_REGION_SELECTOR: string;
  liveAnnouncementListeners: Set<ControlsExtra_Controls.AnnouncementListener>;
  LiveAnnouncer: (
    props: ControlsExtra_Controls.LiveAnnouncerProps,
  ) => ControlsExtra_React.ReactElement;
  LOADABLE_FONT_FAMILY_PATTERN: RegExp;
  loadClaudeCapability: (name: string) => Promise<unknown>;
  loadClaudeCapabilityWithTimeout: <Capability>(
    name: string,
    validate: (value: unknown) => value is Capability,
    timeoutMs?: number,
  ) => Promise<Capability | null>;
  loadCoverCaptureFontFaces: (
    arg0: Boot_Boot.CapturedCover,
  ) => Promise<void | PromiseSettledResult<FontFace>[]>;
  loadedSheetImplementation: Layers_Overlays.MobileSheetParts | null;
  loadSheetImplementation: () => Promise<Layers_Overlays.MobileSheetParts | null>;
  loadTooltipImplementation: () => Promise<Overlays_Overlays.TooltipImplementation>;
  localeContext: Layers_React.Context<string | undefined>;
  localRemoteTextEdits: Map<string, string>;
  LocalStashRecoveryOffer: <Seed>(props: {
    doc: Composition_Composition.ArtifactShellDocument<Seed>;
    undo?: Composition_Composition.ArtifactShellUndo<Seed> | null;
  }) => Composition_React.ReactNode;
  localSystemMetadataChanges: Partial<ModelStorage_Storage.StoredSystemMetadata>;
  loopingIconNames: string[] | undefined;
  loopingIcons: Set<string>;
  lottieDataUrlMimeType: (url: string) => string | null;
  makeApiDocumentationCard: (
    kind: string,
    name: string,
    purpose: string,
    path: string,
    lines: readonly string[],
  ) => Documentation_Documentation.ApiDocumentationCard;
  makeLoadFailureState: (arg0: string) => ModelStorage_Storage.RawDocumentSeed;
  makeOutsidePortalInert: (arg0: HTMLElement) => () => void;
  makePublishSizeError: (
    arg0: string,
  ) => ModelStorage_Storage.MirrorPublishError;
  makeRemoteFileRecord: (
    arg0: string,
    arg1: string,
    arg2: ModelStorage_Storage.RemoteFileMetadata,
  ) => ModelStorage_Storage.RemoteFileRecord;
  makeStoredSystemMetadata: (
    arg0: string,
    arg1: ModelStorage_StorageModel.FileTable,
    arg2?: Pick<
      ModelStorage_Storage.StoredSystemMetadata,
      "convertedFrom" | "snapshot"
    >,
  ) => ModelStorage_Storage.StoredSystemMetadata;
  manifestMirrorFilePaths: (files: ModelCore_Model.FileTable) => string[];
  marginTokenNames: string[];
  MARKDOWN_BLOCK_LABELS: Record<
    "h1" | "h2" | "h3" | "p" | "pre" | "quote",
    string
  >;
  MARKDOWN_BLOCK_SHORTCUTS: [
    string,
    Documentation_Documentation.MarkdownShortcutBlock,
  ][];
  MARKDOWN_CODE_FENCE: string;
  MARKDOWN_COMMIT_DELAY_MS: number;
  MARKDOWN_COMMIT_MAX_DELAY_MS: number;
  MARKDOWN_ESCAPABLE_CHARACTERS: string;
  MARKDOWN_ESCAPE_SENTINEL_PATTERN: RegExp;
  MARKDOWN_IMAGE_DATA_URL_PATTERN: RegExp;
  MARKDOWN_IMAGE_LINE_PATTERN: RegExp;
  MARKDOWN_IMAGE_REFERENCE_PATTERN: RegExp;
  MARKDOWN_ORDERED_LIST_PATTERN: RegExp;
  markdownAutoformatCache: WeakMap<
    HTMLElement,
    Documentation_Documentation.MarkdownAutoformatState
  >;
  markdownAutoformatExecuting: boolean;
  markdownBlockAtNode: (
    node: Node,
    root: HTMLElement,
  ) => FileBrowser_FileBrowser.MarkdownBlockKind;
  markdownCodeSpan: (text: string) => string;
  markdownCommitClock: Documentation_Core.MarkdownCommitClock;
  markdownCommitQueues: Set<Documentation_Documentation.CommitQueueRegistration>;
  markdownDocumentTitle: (markdown: string) => string;
  MarkdownEditor: (
    props: FileBrowser_FileBrowser.MarkdownEditorProps,
  ) => FileBrowser_React.ReactNode;
  MarkdownFormattingToolbar: (
    props: Documentation_Documentation.MarkdownFormattingToolbarProps,
  ) => Documentation_React.ReactPortal;
  MarkdownLinkPopover: (
    props: Documentation_Documentation.MarkdownLinkPopoverProps,
  ) => Documentation_React.ReactPortal | null;
  markdownTableCell: (text: string) => string;
  MARKED_INDEX_STORAGE_PREFIX: string;
  markedIndexSeenBefore: () => boolean | undefined;
  markHeldUndoPointer: Composition_React.PointerEventHandler<HTMLElement>;
  markSkeletonShownAfterCallback: (
    input: (() => void) | undefined,
    options: Controls_C.SkeletonShownStore,
  ) => void;
  markThumbnailReady: (document2?: Document) => void;
  matchesLatinShortcut: (
    event: Pick<KeyboardEvent, "key" | "code">,
    letter: string,
  ) => boolean;
  matchesLibraryVersion: (
    availableVersion: string,
    requestedVersion: string,
  ) => boolean;
  matchesToolbarPointerEvent: (
    event: Pick<MouseEvent, "timeStamp" | "clientX" | "clientY">,
    timestamp: number,
    x: number,
    y: number,
  ) => boolean;
  matchesWindowMediaQuery: (arg0: string, arg1?: Window) => boolean;
  materializeMigrationBlobFiles: (
    files: Record<string, string>,
    title: string,
    fetchBlob: Migration_Migration.FetchMigrationBlob,
  ) => Promise<Migration_Model.FileTable>;
  MAX_ADDRESS_REFUSAL_ROUNDS: number;
  MAX_ANNOUNCEMENT_LENGTH: number;
  MAX_ARTIFACT_COMMENTS: number;
  MAX_ASSET_GROUP_NAME_LENGTH: number;
  MAX_AUTO_PREVIEW_HEIGHT: number;
  MAX_BLOB_READ_ATTEMPTS: number;
  MAX_BLOB_READ_BYTES: number;
  MAX_BOOT_EARLY_FILE_READ_PASSES: number;
  MAX_BUNDLE_HEADER_COMPONENTS: number;
  MAX_CARRIED_FILE_REFERRERS: number;
  MAX_CARRIED_FILES_METADATA: number;
  MAX_CHANGE_AUTHOR_LENGTH: number;
  MAX_CHANGE_EXTRA_KEYS: number;
  MAX_CHANGE_EXTRA_VALUE_LENGTH: number;
  MAX_CHANGE_NOTE_LENGTH: number;
  MAX_CHANGE_VIA_LENGTH: number;
  MAX_COLLECTION_DOCUMENTS: number;
  MAX_COLOR_ALIAS_DEPTH: number;
  MAX_COLOR_FIX_REQUESTS: number;
  MAX_COLOR_THEMES: number;
  MAX_COLOR_TOKENS: number;
  MAX_COMMENT_IMAGES: number;
  MAX_COMMENT_TEXT_LENGTH: number;
  MAX_COMPONENT_GROUP_LABEL_LENGTH: number;
  MAX_COMPONENT_STAGE_HEIGHT: number;
  MAX_COMPONENT_SUMMARY_LENGTH: number;
  MAX_DELETE_PUBLISH_PATHS: number;
  MAX_DESIGN_SYSTEM_FILES: number;
  MAX_DESIGN_SYSTEM_INDEX_CHARS: number;
  MAX_DESIGN_SYSTEM_PATH_LENGTH: number;
  MAX_DISPLAYED_DOCUMENTS: number;
  MAX_DOCUMENTED_COMPONENTS: number;
  MAX_DOWNLOAD_EXTENSION_LABEL_LENGTH: number;
  MAX_DROPPED_FILES: number;
  MAX_EDITABLE_CSS_LENGTH: number;
  MAX_EMBEDDED_STRING_CACHE_CHARACTERS: number;
  MAX_ENUM_CONTROL_OPTIONS: number;
  MAX_EXTRA_TOKEN_FAMILIES: number;
  MAX_FILE_BATCH_ENCODED_BYTES: number;
  MAX_FILE_BATCH_ENTRIES: number;
  MAX_FILE_BROWSER_TEXT_BYTES: number;
  MAX_FILE_PATH_UTF8_BYTES: number;
  MAX_FILE_PUBLISH_ENCODED_BYTES: number;
  MAX_FILES_PER_COLLECTION: number;
  MAX_FONT_FAMILIES: number;
  MAX_HANDOFF_FILE_NAME_CHARACTERS: number;
  MAX_HANDOFF_FILE_NAMES: number;
  MAX_HOST_COMMANDS: number;
  MAX_HOST_DESTINATIONS: number;
  MAX_HOST_EXPORT_FORMATS: number;
  MAX_HOST_FOOT_INSET: number;
  MAX_HOT_FETCH_RETRIES: number;
  MAX_ICON_FONT_WEIGHT: number;
  MAX_INFERRED_COMPONENT_PROPS: number;
  MAX_INLINE_ASSET_BYTES: number;
  MAX_INLINE_ASSET_BYTESModelStorage: number;
  MAX_INLINE_DATA_URI_BUDGET_FRACTION: number;
  MAX_INLINE_FONT_BYTES: number;
  MAX_INLINE_FONT_BYTESModelStorage: number;
  MAX_INLINE_VIDEO_BYTES: number;
  MAX_KEYED_MERGE_LIST_ITEMS: number;
  MAX_LINK_DEBUG_LENGTH: number;
  MAX_LINK_DEBUG_WARNINGS: number;
  MAX_MANIFEST_ASSET_GROUPS: number;
  MAX_MANIFEST_LIBRARIES: number;
  MAX_MARKDOWN_LIST_ITEMS: number;
  MAX_MARKDOWN_TABLE_COLUMNS: number;
  MAX_MARKDOWN_TABLE_ROWS: number;
  MAX_OVERLAY_OWNER_DEPTH: number;
  MAX_PARSED_FONT_FACES: number;
  MAX_PARSED_MARKDOWN_BLOCKS: number;
  MAX_PRETTY_MANIFEST_BYTES: number;
  MAX_PREVIEW_HEAD_STALL_RETRIES: number;
  MAX_PROPS_INHERITANCE_DEPTH: number;
  MAX_PUBLISH_BATCH_BYTES: number;
  MAX_PUBLISHED_LISTING_FAILURES: number;
  MAX_REFERENCED_TYPE_NAMES: number;
  MAX_RESPONSIVE_PREVIEW_HEIGHT: number;
  MAX_SHEET_HEIGHT_CSS: string;
  MAX_SHEET_HEIGHT_FRACTION: number;
  MAX_SHEET_OVERSHOOT_HEIGHT_CSS: string;
  MAX_SYNC_COLLECTION_BYTES: number;
  MAX_SYNC_DOCUMENT_BYTES: number;
  MAX_SYNC_DOCUMENT_DEPTH: number;
  MAX_SYSTEM_MIRROR_BYTES: number;
  MAX_SYSTEM_MIRROR_FILES: number;
  MAX_TEMPLATE_TYPE_EXPANSIONS: number;
  MAX_TOKEN_LABEL_LENGTH: number;
  MAX_TOKEN_NOTE_LENGTH: number;
  MAX_TOKEN_USAGE_LENGTH: number;
  MAX_TOKENS_PER_FAMILY: number;
  MAX_TYPE_BODY_MEMBERS: number;
  MAX_TYPE_INFERENCE_SCANNED_CHARACTERS: number;
  MAX_TYPE_INFERENCE_WORK: number;
  MAX_TYPE_RESOLUTION_DEPTH: number;
  MAX_TYPE_SAMPLE_LENGTH: number;
  MAX_TYPE_SAMPLE_LENGTHModelTokens: number;
  MAX_TYPOGRAPHY_GROUPS: number;
  MAX_TYPOGRAPHY_STYLES: number;
  MAX_UPLOAD_ERROR_DETAILS: number;
  MAX_UPLOAD_SUMMARY_ITEMS: number;
  maximumPanelHeight: (height?: number) => number;
  maximumPanelWidth: () => number;
  mayInitializeEmptyFilesStore: (
    options: Boot_Boot.MayInitializeOptions,
  ) => Promise<boolean>;
  mayMigrateDesignSystem: (
    options: Boot_Boot.MayMigrateOptions,
  ) => Promise<boolean>;
  mayMigrateLegacyDesignSystem: (
    state: Boot_Boot.RawEnvelope,
    proceeding?: boolean,
  ) => Promise<boolean>;
  mayStartEmptyFilesSystem: () => Promise<boolean>;
  measureNaturalSheetHeight: (element: HTMLElement) => number;
  measurePreviewDocumentHeight: (
    document2: Document,
    frameWindow: Window,
  ) => number;
  measureRootRemScale: (element: Element) => number;
  measureScaledElementWidth: (
    input: HTMLElement,
  ) => ControlsExtra_Controls.SegmentWidth;
  measureSheetControlOverflow: (
    sheetElement: HTMLElement,
    controlElement: Element | null,
  ) => number;
  measureSheetScrollContent: (element: HTMLElement) => {
    visible: number;
    overflowContent: number;
  };
  measureShrinkWrapLayout: (
    element: HTMLElement,
    props1: Dom_Dom.ShrinkWrapMeasurement,
  ) => Dom_Dom.ShrinkWrapLayout;
  measureShrinkWrapLineRects: (
    element: HTMLElement,
    options?: (width: number) => boolean,
  ) => Dom_Dom.ShrinkWrapMeasurement;
  measureTabStripContents: (element: HTMLElement) => number;
  measureVisibleSiblingWidth: (
    input: HTMLElement,
    options: HTMLElement,
    context: number,
  ) => number;
  measureVisualKeyboard: (
    windowObject: Pick<Window, "visualViewport" | "document">,
  ) => Dom_Dom.KeyboardInset | null;
  MEBIBYTE: number;
  mediaQueryStores: WeakMap<
    Dom_Dom.MediaQueryWindow,
    Map<string, Dom_Dom.ExternalStore<boolean>>
  >;
  Menu: Overlays_Overlays.MenuComponents;
  MENU_ANCHOR_SELECTOR: string;
  MENU_ITEM_HEIGHT_CSS: string;
  MENU_POPOVER_OPEN_SELECTORS: string;
  menuBarContext: Interactions_React.Context<boolean>;
  menuBodyScrollClasses: string;
  menuFooterClasses: string;
  menuHeaderClasses: string;
  menuIsOpenContext: Interactions_React.Context<Interactions_React.RefObject<Interactions_Overlays.OverlayActions | null> | null>;
  MenuItem: Overlays_Overlays.ForwardComponent<
    HTMLDivElement,
    Overlays_Overlays.MenuItemProps
  >;
  menuItemDescriptionPaddingClass: string;
  menuItemVariants: (props?: { variant?: "default" | "danger" }) => string;
  MenuOpenerProvider: Layers_React.Provider<
    Layers_React.RefObject<HTMLElement | null> | undefined
  >;
  menuOpenerRefContext: Layers_React.Context<
    Layers_React.RefObject<HTMLElement | null> | undefined
  >;
  menuOverlayAttributes: {
    "data-cds-overlay": string;
  };
  MenuPendingList: (
    props: Overlays_Overlays.MenuPendingProps,
  ) => Overlays_React.ReactElement;
  MenuPopup: Overlays_Overlays.ForwardComponent<
    HTMLDivElement,
    Overlays_Overlays.MenuPopupProps
  >;
  MenuPopupElement: Layers_Layers.ForwardComponent<
    HTMLDivElement,
    Layers_Layers.MenuPopupElementProps
  >;
  MenuRoot: (
    props: Overlays_Overlays.MenuRootProps,
  ) => Overlays_React.ReactElement;
  menuRootIdentityContext: Interactions_React.Context<Interactions_React.RefObject<Interactions_Overlays.OverlayActions | null> | null>;
  menuScrollClasses: string;
  MenuScrollContent: (
    props: Interactions_Overlays.PopupScrollAreaProps,
  ) => Interactions_React.ReactElement;
  MenuSearchablePopup: (
    props: Overlays_Overlays.MenuSearchProps,
  ) => Overlays_React.ReactElement;
  MenuSheetCloseButton: () => Layers_React.ReactElement;
  menuSheetLabelsContext: Interactions_React.Context<Interactions_Overlays.MenuLabels>;
  MenuSheetPopup: Layers_Layers.ForwardComponent<
    HTMLDivElement,
    Layers_Layers.MenuPopupProps
  >;
  MenuSheetTitleBar: (arg0: { nested: boolean }) => Layers_React.ReactElement;
  MenuSubmenu: (
    props: Overlays_Overlays.MenuSubmenuProps,
  ) => Overlays_React.ReactElement;
  MenuTriggerButton: Overlays_Overlays.ForwardComponent<
    HTMLButtonElement,
    Overlays_Overlays.MenuTriggerButtonProps
  >;
  menuTriggerContext: Interactions_React.Context<Interactions_Overlays.MenuRootState | null>;
  MERGE_ARRAY_ID_FIELDS: string[];
  mergeArrayIdentityField: (
    ...arrays: FilesCore_FilesCore.JsonMergeValue[]
  ) => string | null;
  mergeAssetUploadResults: (
    left: EditorRuntime_Application.AssetUploadSummary,
    right: EditorRuntime_Application.AssetUploadSummary,
  ) => EditorRuntime_Application.AssetUploadSummary;
  mergeDesignSystemFiles: (
    current: FilesCore_FilesBoot.FileTable,
    title: string,
    before: FilesCore_FilesBoot.FileTable,
    after: FilesCore_FilesBoot.FileTable,
    options?: FilesCore_FilesCore.FileMergeOptions,
  ) => FilesCore_FilesCore.FileMergeResult;
  mergeDocumentValues: <T>(
    base: T,
    ours: T,
    theirs: T,
    schema: FilesCore_FilesCore.MergeSchema,
    options?: FilesCore_FilesCore.MergeDocumentOptions,
  ) => T;
  mergeFeatureFlagNames: (
    existingNames: string | undefined,
    additionalNames: readonly string[] | undefined,
  ) => string | undefined;
  mergeFilesIndex: (
    base:
      | Partial<FilesCore_FilesBoot.FilesIndex>
      | FilesCore_FilesCore.IndexPresentationPatch,
    ours:
      | Partial<FilesCore_FilesBoot.FilesIndex>
      | FilesCore_FilesCore.IndexPresentationPatch,
    theirs: FilesCore_FilesBoot.FilesIndex,
  ) => {
    index: FilesCore_FilesBoot.FilesIndex;
    kept: string[];
  };
  mergeFilesIndexKeepingLocal: (
    base: FilesCore_FilesCore.JsonMergeValue,
    ours: FilesCore_FilesCore.JsonMergeValue,
    theirs: FilesCore_FilesCore.JsonMergeValue,
    schema: FilesCore_FilesCore.MergeSchema,
    path: string,
    kept: string[],
  ) => FilesCore_FilesCore.JsonMergeValue;
  mergeIdentifiedArrayThreeWays: (
    base: FilesCore_FilesCore.JsonRecord[],
    mine: FilesCore_FilesCore.JsonRecord[],
    theirs: FilesCore_FilesCore.JsonRecord[],
    identity: string,
    path: string,
    conflicts: string[],
    choice: FilesCore_FilesCore.MergeChoice,
  ) => FilesCore_FilesCore.JsonMergeValue[];
  mergeInferredControl: (
    state: Documentation_Documentation.TypeInferenceState,
    control: Documentation_Documentation.InferredControl | null,
  ) => void;
  mergeJsonThreeWays: (
    base: FilesCore_FilesCore.JsonMergeValue,
    mine: FilesCore_FilesCore.JsonMergeValue,
    theirs: FilesCore_FilesCore.JsonMergeValue,
    choice?: FilesCore_FilesCore.MergeChoice,
  ) => FilesCore_FilesCore.JsonMergeResult;
  mergeJsonValueThreeWays: (
    base: FilesCore_FilesCore.JsonMergeValue,
    mine: FilesCore_FilesCore.JsonMergeValue,
    theirs: FilesCore_FilesCore.JsonMergeValue,
    path: string,
    conflicts: string[],
    choice: FilesCore_FilesCore.MergeChoice,
  ) => FilesCore_FilesCore.JsonMergeValue;
  mergeLeafValue: (
    base: FilesCore_FilesCore.JsonMergeValue,
    ours: FilesCore_FilesCore.JsonMergeValue,
    theirs: FilesCore_FilesCore.JsonMergeValue,
    path: string,
    options: FilesCore_FilesCore.MergeDocumentOptions,
  ) => FilesCore_FilesCore.JsonMergeValue;
  mergeObjectValues: (
    base: FilesCore_FilesCore.JsonRecord | undefined,
    ours: FilesCore_FilesCore.JsonRecord,
    theirs: FilesCore_FilesCore.JsonRecord,
    schema: FilesCore_FilesCore.MergeSchema,
    path: string,
    options: FilesCore_FilesCore.MergeDocumentOptions,
  ) => FilesCore_FilesCore.JsonRecord;
  mergeOrderedStringList: (
    base: readonly string[],
    ours: readonly string[],
    theirs: readonly string[],
    allowed?: ReadonlySet<string> | readonly string[],
  ) => string[];
  mergeReadmeWithGeneratedTail: (arg0: string, arg1: string) => string;
  mergeRefs: <Value>(
    ...refs: Interactions_Dom.CallbackRef<Value>[]
  ) => Interactions_React.RefCallback<Value>;
  mergeSupportedFileThreeWays: (
    path: string,
    base: string,
    mine: string,
    theirs: string,
    choice?: FilesCore_FilesCore.MergeChoice,
  ) => FilesCore_FilesCore.TokenMergeResult | null;
  mergeTailwindClasses: (classes: string) => string;
  mergeTokenFileThreeWays: (
    base: string,
    mine: string,
    theirs: string,
    choice?: FilesCore_FilesCore.MergeChoice,
  ) => FilesCore_FilesCore.TokenMergeResult;
  mergeValuesEqual: (left: unknown, right: unknown) => boolean;
  META_DOCUMENT_ID: string;
  metadataWithCarriedFiles: (
    arg0: ModelStorage_Storage.DatabaseRecord,
    arg1: readonly ModelStorage_Storage.CarriedFile[],
  ) => ModelStorage_Storage.DatabaseRecord;
  migrateCdsHtmlFontSizing: () => void;
  MIGRATED_BANNER_EXPLANATION: string;
  MIGRATED_BANNER_STORAGE_PREFIX: string;
  MIGRATED_READONLY_MESSAGE: string;
  migratedBannerStorageKey: () => string;
  migrateDesignSystemStoreToFiles: (
    options: Migration_Migration.DesignSystemMigrationOptions,
  ) => Promise<Migration_Migration.MigrationOutcome>;
  migrateSingleFileDesignSystem: (
    options: Migration_Migration.DesignSystemMigrationOptions,
  ) => Promise<Migration_Migration.MigrationOutcome>;
  migrateStoreToFiles: <Index extends object = Migration_Model.FilesIndex>(
    options: Migration_Migration.MigrationOptions<Index>,
  ) => Promise<Migration_Migration.MigrationOutcome>;
  MIGRATION_ANALYTICS_EVENTS: EditorRuntime_EditorRuntime.MigrationAnalyticsEvents;
  MIGRATION_BATCH_MAX_BYTES: number;
  MIGRATION_BATCH_MAX_FILES: number;
  MIGRATION_CLAUDE_PENDING_MESSAGE: string;
  MIGRATION_CLEANUP_FEATURE_FLAG: string;
  MIGRATION_CLEANUP_LABEL: string;
  MIGRATION_DONE_REOPEN_MESSAGE: string;
  MIGRATION_EMPTY_PAGE_MESSAGE: string;
  MIGRATION_EMPTY_PAGE_TITLE: string;
  MIGRATION_ENDED_REOPEN_MESSAGE: string;
  MIGRATION_EXEMPT_HOST_IDS: Set<string>;
  MIGRATION_FILES_REORGANIZATION_PROMPT: string;
  MIGRATION_FORMAT_PROMPT: string;
  MIGRATION_GREW_TOO_LARGE_MESSAGE: string;
  MIGRATION_HOLD_BLOCKED_EVENTS: string[];
  MIGRATION_INTERNAL_META_FIELDS: string[];
  MIGRATION_INTERRUPTED_MESSAGE: string;
  MIGRATION_LEASE_RENEWAL_MS: number;
  MIGRATION_LEASE_TTL_MS: number;
  MIGRATION_LOCK_TTL_MS: number;
  MIGRATION_MANIFEST_PATH: string;
  MIGRATION_MAX_STORE_RECHECKS: number;
  MIGRATION_NOTICE_STORAGE_PREFIX: string;
  MIGRATION_OTHER_TAB_TIMEOUT_MESSAGE: string;
  MIGRATION_OTHER_TAB_WAIT_MS: number;
  MIGRATION_PUBLISH_RETRY_WINDOW_MS: number;
  MIGRATION_PUBLISH_SPACING_MS: number;
  MIGRATION_READ_ONLY_MESSAGE: string;
  MIGRATION_REOPEN_UNAVAILABLE_MESSAGE: string;
  MIGRATION_RETRY_INITIAL_MS: number;
  MIGRATION_RETRY_MAX_MS: number;
  MIGRATION_RUNNING_MESSAGE: string;
  MIGRATION_RUNNING_STORAGE_PREFIX: string;
  MIGRATION_SENTINEL_PATH: string;
  MIGRATION_SIZE_NOTICE_STORAGE_PREFIX: string;
  MIGRATION_SKIP_STORAGE_PREFIX: string;
  MIGRATION_STARTING_REOPEN_MESSAGE: string;
  MIGRATION_STOPPED_RELOAD_MESSAGE: string;
  MIGRATION_STOPPED_REOPEN_MESSAGE: string;
  MIGRATION_STOPPED_STORAGE_PREFIX: string;
  MIGRATION_STOPPED_TTL_MS: number;
  MIGRATION_TOO_LARGE_MESSAGE: string;
  MIGRATION_UNAVAILABLE_MESSAGE: string;
  MIGRATION_UNCHANGED_MESSAGE: string;
  MIGRATION_UNREADABLE_FILE_MESSAGE: string;
  MIGRATION_UPSTREAM_RETRY_WINDOW_MS: number;
  migrationAnalyticsEmitter: (event: string) => void;
  MigrationCleanupBanner: EditorRuntime_React.FunctionComponent<EditorRuntime_EditorRuntime.MigrationCleanupBannerProps>;
  MigrationCleanupButton: EditorRuntime_React.FunctionComponent<EditorRuntime_EditorRuntime.MigrationCleanupButtonProps>;
  migrationCleanupRequest: (
    address: string,
  ) => EditorRuntime_EditorRuntime.TrackedClaudeRequest;
  MigrationConfigError: new (message: string) => Error;
  migrationEditingHold: Boot_Boot.EditingHold | undefined;
  migrationErrorCode: (error: unknown) => string;
  migrationFileSourceDocuments: (
    path: string,
    snapshot: Migration_Migration.StoreSnapshot,
  ) => string[];
  migrationHoldAllowsKey: (event: { key?: string }) => boolean;
  migrationIndexSourceDocuments: (
    index: Pick<Migration_Model.FilesIndex, "source" | "upgraded">,
    snapshot: Migration_Migration.StoreSnapshot,
  ) => string[];
  migrationIsSkipped: () => boolean;
  MigrationLeftOutBanner: () => EditorRuntime_React.ReactElement | null;
  MigrationLimitError: new (code: string) => Error & {
    code: string;
  };
  migrationOpenedAnalyticsEvents: (
    state: EditorRuntime_EditorRuntime.MigrationContext,
  ) => string[];
  migrationOtherTabWaitOutcome: (options: {
    movedTo: boolean;
    waitedMs: number;
  }) => "landed" | "wait" | "gave-up";
  migrationPublishInput: (
    path: string,
    content: string,
  ) =>
    | {
        content: string;
        contentType: string;
      }
    | {
        content: Blob;
        contentType: string;
      };
  migrationSentinelMatchesArtifact: (
    sentinel: Migration_Model.FilesMigrationSentinel,
    artifactId?: string,
  ) => boolean;
  migrationSkippedInMemory: boolean;
  migrationStoppedForChange: (changeKey: string) => boolean;
  migrationTabHolder: () => string;
  migrationTabHolderId: string | undefined;
  migrationTelemetryFailureKind: (code: unknown) => string;
  migrationVersionSize: (
    listing: Pick<Migration_Model.FileListingRow, "path" | "size">[],
    tree: Pick<Migration_Migration.MigrationTree<object>, "files">,
    indexPath: string,
    indexContent: Migration_Model.FilePublishInput,
  ) => {
    files: number;
    bytes: number;
    oversized: string[];
  };
  mimeTypeForPath: (path: string) => string;
  MIN_ASSET_TILE_SIZE: number;
  MIN_CACHED_STRING_LENGTH: number;
  MIN_ICON_FONT_WEIGHT: number;
  MIN_NUMERIC_ENUM_OPTIONS: number;
  MIN_PANEL_HEIGHT: number;
  MIN_PANEL_WIDTH: number;
  MIN_SHEET_HEIGHT_CSS: string;
  MIN_SHEET_HEIGHT_FRACTION: number;
  minimumPanelHeight: (inset: number, height?: number) => number;
  MIRROR_MIME_TYPES: Record<string, string>;
  mirrorContentEncoder: TextEncoder;
  mirrorFileContent: (
    arg0: string,
    arg1: string,
  ) => {
    content: string | Blob;
    contentType: string;
  } | null;
  mirrorMimeTypeForPath: (path: string) => string | null;
  MISSING_REACT_ERROR_PATTERN: RegExp;
  missingAssetsMessage: (arg0: readonly string[]) => string;
  MissingFontNotice: TokenEditors_React.FunctionComponent<TokenEditors_TokenEditors.MissingFontNoticeProps>;
  missingStoredBlobIds: (
    arg0: ModelStorage_StorageModel.FileTable,
  ) => Set<string>;
  MIXED_LABEL: string;
  MOBILE_COARSE_POINTER_QUERY: string;
  MOBILE_PREVIEW_HEIGHTS: Set<number>;
  MOBILE_PREVIEW_LABEL_PATTERN: RegExp;
  mobileSheetExports: Layers_Overlays.MobileSheetParts;
  MODAL_INERT_LIVE_REGION_SELECTOR: string;
  modalCatcherDragEndEvents: string[];
  modalCatcherDragSession: Interactions_Interactions.ModalCatcherDragSession | null;
  modalInertRefCounts: Layers_Layers.InertRefCounts;
  MODIFIER_KEY_LABEL: string;
  monitorSyncLoadHealth: (
    arg0: ModelStorage_Storage.MonitoredSyncDocument,
    arg1: ModelStorage_Storage.SyncHealthReporter,
  ) => () => void;
  monitorSyncSaveHealth: (
    arg0: ModelStorage_Storage.MonitoredSyncDocument,
    arg1: ModelStorage_Storage.SyncHealthReporter,
  ) => () => void;
  monospaceFontContext: Layers_React.Context<string | null | undefined>;
  monotonicNow: () => number | null;
  MORE_ACTIONS_LABEL: string;
  MOTION_DURATION_PATTERN: RegExp;
  MOTION_EASING_PATTERN: RegExp;
  motionValueKind: (value: string) => string | undefined;
  mountInitializedFilesOutcome: (options: {
    started: string;
    mount(message: string): void;
    reopen(): void;
    reload(): void;
  }) => boolean;
  moveAssetsToGroup: (
    content: ModelCore_Model.DesignSystemContent,
    paths: string[],
    targetGroup: string,
    beforePath?: string | null,
  ) => ModelCore_Model.DesignSystemContent;
  MOVED_RELOAD_MESSAGE: string;
  MOVED_TO_MARKER_KEY: string;
  movedToMarker: (
    stamp: ModelStorage_Storage.MovedMarkerStamp,
  ) => ModelStorage_Storage.DatabaseRecord;
  multilineTooltipArrowClass: string;
  multilineTooltipBaseClasses: string;
  multilineTooltipClasses: string;
  multipleCharacterKeycapClasses: string;
  mutableManifest: (
    content: ModelCore_Model.DesignSystemContent,
  ) => ModelCore_ModelCore.ManifestObject & {
    manifestVersion: number;
  };
  naturalImageTilesContext: Layers_React.Context<boolean | undefined>;
  NAV_ESCAPE_COMPOSITION_GRACE_MS: number;
  NAV_PILL_ACTIVITY_MS: number;
  NAV_PILL_INITIAL_ACTIVITY_MS: number;
  NAV_SEARCH_BROWSER_FIND_HINT: string;
  NAV_SEARCH_MATCH_LIMIT: number;
  NAV_SECTION_LIST_CLASS: string;
  NavigationConflictMark: () => Application_React.ReactElement;
  navigationPillInitialHintShown: boolean;
  nearestScrollableAncestor: (element: HTMLElement) => HTMLElement;
  networkPathHrefPattern: RegExp;
  NEW_ASSET_GROUP_INPUT_PROPS: {
    autoComplete: string;
    [attribute: `data-${string}`]: string;
  };
  NEW_ASSET_GROUP_PLACEHOLDER: string;
  NEW_ASSET_GROUP_SENTINEL: symbol;
  NEW_TOKEN_GROUP_SENTINEL: string;
  NewAssetGroupDialog: EditorRuntime_React.FunctionComponent<EditorRuntime_EditorRuntime.NewAssetGroupDialogProps>;
  NewAssetGroupDropZone: (props: {
    targeted: boolean;
    count: number;
  }) => EditorRuntime_React.ReactElement;
  NewTabAnnouncement: (props: {
    id: string;
  }) => ControlsExtra_React.ReactElement;
  nextAssetGroupName: (names: string[]) => string;
  nextIconCodepoint: number;
  nextSwatchHeadId: (environment: object) => string;
  nextToastId: number;
  nextUploadedFileIdentityId: number;
  NO_COLOR_MATCHES_LABEL: string;
  NON_EDITABLE_REACT_TYPES: Set<string>;
  NON_LAYOUT_TRANSITION_PROPERTIES: RegExp;
  NON_TEXT_INPUT_TYPES: RegExp;
  nonnegativeIntegerOrFallback: (arg0: unknown, arg1: number) => number;
  noopFlipCleanup: () => void;
  normalFlowChildren: (
    element: Element,
    frameWindow: Window,
    depth?: number,
  ) => Generator<Element, void, unknown>;
  normalizeArtifactSessionPath: (path: string) => string;
  normalizeArtifactTitle: (title: unknown) => string | undefined;
  normalizeAssetGroupName: (name: string) => string | null;
  normalizeBoxShadow: (value: unknown) => string | undefined;
  normalizeColorEditorInput: (input: string) => string;
  normalizeColorMode: (
    mode: string | null | undefined,
  ) => Layers_Layers.ConfiguredColorMode | undefined;
  normalizeColorOrAlias: (value: unknown) => string | undefined;
  normalizeColorSwatches: (
    swatches: ColorControls_ColorControls.ColorSwatchInput[] | undefined,
    allowEmpty?: boolean,
    disabledReason?: ColorControls_React.ReactNode,
  ) => ColorControls_ColorControls.ColorSwatch[];
  normalizeCommentOperations: (
    operations: unknown,
  ) => PlatformHost_Host.CommentOperation[];
  normalizeComments: (comments: unknown) => PlatformHost_Host.ArtifactComment[];
  normalizeCssLength: (
    value: unknown,
    allowFullRadius: boolean,
  ) => string | undefined;
  normalizeDatabaseError: (arg0: unknown) => ModelStorage_Storage.DatabaseError;
  normalizedComponentTitle: (title: string) => string;
  normalizeDecodedFilePath: (path: string) => string | null;
  normalizeDesignSystemPath: (path: string) => string;
  normalizeDownloadName: (name: string) => boolean;
  normalizedPreviewHeight: (height: number) => number;
  normalizedRgbToHsva: (
    input: number,
    options: number,
    context: number,
    value: number,
  ) => ColorControls_ColorControls.HsvaColor;
  normalizeExternalLinkInput: (input: string) => string | null;
  normalizeExtraTokenValue: (value: unknown) => string | undefined;
  normalizeFilePublishInput: (
    path: string,
    input: FilesCore_FilesBoot.FilePublishInput,
  ) => FilesCore_FilesCore.NormalizedFilePublishInput | string | null;
  normalizeFileSha256: (value: unknown) => string | null | undefined;
  normalizeFilesPublishError: (
    error: unknown,
  ) => FilesCore_FilesBoot.FilePublishFailure;
  normalizeFontWeight: (value: unknown) => string | undefined;
  normalizeHostCommands: (
    commands: readonly {
      id?: unknown;
      disabled?: unknown;
    }[],
  ) => PlatformHost_Host.HostDestination[];
  normalizeHostDestinations: (
    destinations: readonly (
      | {
          id?: unknown;
          disabled?: unknown;
        }
      | null
      | undefined
    )[],
  ) => PlatformHost_Host.HostDestination[];
  normalizeHostExportFormats: (
    formats: readonly {
      format?: unknown;
      disabled?: unknown;
      handoff?: unknown;
      interactive?: unknown;
      bundle?: unknown;
      variants?: unknown;
    }[],
  ) => PlatformHost_Host.HostExport[];
  normalizeHostTips: (tips: unknown) => string[];
  normalizeHrefWhitespace: (arg0: string) => string;
  normalizeKnownUpload: (
    arg0: ModelStorage_Storage.KnownUploadInput,
  ) => ModelStorage_Storage.KnownUpload | null;
  normalizeLetterSpacing: (value: string) => string | null;
  normalizeLineHeight: (value: unknown) => string | undefined;
  normalizeLinkRel: (
    arg0: string | null | undefined,
    arg1: string | null | undefined,
    arg2: () => string,
  ) => string | undefined;
  normalizeLocalFileReference: (arg0: string) => string | null;
  normalizeMarkdownBlock: {
    (value: Documentation_Core.MarkdownBlock): Documentation_Core.MarkdownBlock;
    (value?: unknown): Documentation_Documentation.NormalizedMarkdownBlock;
  };
  normalizeMotionValue: (value: unknown) => string | undefined;
  normalizeNewColorValue: (value: string) => string;
  normalizeNewTokenName: (value: string) => string;
  normalizePathForComparison: (path: string) => string;
  normalizePathSegmentForComparison: (segment: string) => string;
  normalizeRoomPeers: (
    value: unknown,
  ) => readonly EditorRuntime_EditorRuntime.RoomPeer[];
  normalizeRouterHref: (arg0: string) => string;
  normalizeSaveHome: (arg0: unknown) => "page" | "files";
  normalizeScalarTokenValue: (
    family: ModelCore_ModelCore.ScalarKind,
    value: unknown,
  ) => string | undefined;
  normalizeSectionTitle: (title: string, defaultTitle?: string) => string;
  normalizeSectionTitleModelManifestMetadata: (title: string) => string;
  normalizeSelfPublishError: (error: unknown) => PlatformHost_Host.PublishError;
  normalizeTextNewlines: (text: string) => string;
  normalizeThemeColorValue: (value: unknown) => string | undefined;
  normalizeThemeId: (value: string) => string;
  normalizeTitleInput: (title: string) => string;
  normalizeToastTimeout: (timeout?: number) => number | undefined;
  normalizeTokenName: (name: string) => string;
  normalizeTypographyProperty: <
    K extends ModelCore_ModelCore.TypographyProperty,
  >(
    property: K,
    value: unknown,
    families: Record<string, string>,
  ) => ModelCore_Model.TypographyStyle[K] | undefined;
  noteAutoformatShortcut: (
    text: string,
    trimIndent?: boolean,
  ) => Documentation_Documentation.MarkdownShortcutBlock | null;
  notePublishedPreviewFailure: (
    url: string,
    label: string | undefined,
    timeoutSeconds?: string | number,
  ) => void;
  NotesPopoverEditor: (
    props: FileBrowser_FileBrowser.NotesPopoverEditorProps,
  ) => FileBrowser_React.ReactNode;
  notificationsFocusRegion: () => Application_Application.FocusRegion;
  notifyAddressedFiles: () => void;
  notifyAssetsStateSubscribers: () => void;
  notifyAssetThumbnailSources: () => void;
  notifyBlobResources: () => void;
  notifySubscribers: (subscribers: Set<() => void>) => void;
  notifyToastSubscribers: () => void;
  NUMBER_INPUT_SELECTOR: string;
  numberChangeRefusalMessage: (label?: string, unit?: string) => string;
  numberFieldHydrationNoop: () => void;
  NumberInput: ControlsExtra_Controls.ForwardComponent<
    HTMLInputElement,
    ControlsExtra_Controls.NumberInputProps
  >;
  numberInputDecimalPlaces: (value: number) => number;
  NumberPropertyRow: (
    props: Composition_Composition.NumberPropertyRowProps,
  ) => Composition_React.ReactNode;
  NUMERIC_TOKEN_SUFFIX_PATTERN: RegExp;
  NUMERIC_TYPE_LITERAL_PATTERN: RegExp;
  objectProperty: (value: unknown, key: PropertyKey) => unknown;
  observeAutoResizeTextarea: (
    element: Composition_Composition.TextEditorElement | null,
  ) => void;
  observedAutoResizeTextareas: WeakSet<Element>;
  observeDocumentThumbnailReadiness: (
    input: Boot_Boot.ThumbnailLoadDocument,
    options?: Boot_Boot.ThumbnailOptions,
  ) => () => void;
  observePreviewHeight: (
    iframe: HTMLIFrameElement,
    onHeight: (height: number) => void,
    options?: number,
  ) => () => void;
  observeSegmentedControlSize: (
    input: HTMLElement,
    options: typeof ResizeObserver,
    context: ControlsExtra_Controls.SegmentMeasure,
  ) => () => void;
  observeShrinkWrap: (
    element: HTMLElement,
    props1?: Pick<Dom_Dom.ShrinkWrapOptions, "immediate">,
  ) => () => void;
  observeTextAreaValue: (
    input: HTMLTextAreaElement,
    options: () => void,
  ) => (() => void) | undefined;
  obsoleteMirrorDeletions: (
    arg0: ModelStorage_StorageModel.FileTable,
  ) => Record<string, null>;
  oklchToRgb: (
    lightness: number,
    chroma: number,
    hue: number,
  ) => [number, number, number];
  OLDER_COPY_READONLY_MESSAGE: string;
  OLDER_SINGLE_FILE_COPY_MESSAGE: string;
  omitLinkEventProps: <Props extends Layers_Overlays.RouterEvents>(
    arg0: Props,
  ) => Omit<Props, Layers_Layers.LinkEventName>;
  omitProps: <Props extends object, Key extends string>(
    input: Props,
    options: readonly Key[],
  ) => Omit<Props, Extract<keyof Props, Key>>;
  OMITTED_API_CARDS_NOTICE: string;
  OMITTED_COMPONENT_PROPS: Set<string>;
  onContentButtonBackgroundClasses: string;
  onContentButtonTextClasses: string;
  onLinkEnter: Documentation_React.KeyboardEventHandler<HTMLElement>;
  onModifiedLinkEnter: Documentation_React.KeyboardEventHandler<HTMLElement>;
  opaqueContrastColor: (
    color: ColorControls_ColorControls.RgbaColor | undefined,
  ) => ColorControls_ColorControls.RgbaColor | undefined;
  opaqueTintOverrides: Layers_Layers.DesignStyle;
  OPEN_FIND_COMMAND: string;
  OPEN_OVERLAY_SELECTOR: string;
  OPEN_OVERLAY_SELECTOR_VQ5: string;
  openExternalLink: (
    url: string,
    options?: Documentation_Core.EditorLinkOptions,
  ) => void;
  opensInSeparateBrowsingContext: (arg0: string | null | undefined) => boolean;
  openTooltipState: Dom_Overlays.TooltipBodyUpdate;
  openTooltipWithBody: (
    body: Dom_React.ReactNode,
  ) => Dom_Overlays.TooltipBodyUpdate;
  optionalNonemptyText: (text: string | undefined) => string | undefined;
  OptionList: (
    props: Composition_Composition.OptionListProps,
  ) => Composition_React.ReactNode;
  optionMatchesQuery: (
    query: string,
    ...values: (string | undefined)[]
  ) => boolean;
  optionTypeaheadMatch: (text: string, options: readonly string[]) => number;
  orderAssetTiles: <
    Asset extends {
      key: string;
      wall: boolean;
    },
  >(
    assets: Asset[],
    order: string[],
  ) => Asset[];
  OTHER_PAGE_FONT_GUIDANCE: string;
  OTHER_VERSION_COPY_SUFFIX: string;
  otherAriaModifierNames: Record<string, string>;
  otherKeyLabels: Record<string, string>;
  otherModifierLabels: Record<Dom_Dom.ShortcutModifier, string>;
  otherVersionFileName: (path: string) => string;
  otherVersionProjectPath: (path: string) => string;
  OverflowTooltip: Dom_React.ForwardRefExoticComponent<
    Dom_Overlays.OverflowTooltipProps & Dom_React.RefAttributes<HTMLSpanElement>
  >;
  OVERLAY_ATTRIBUTE: "data-cds-overlay";
  OVERLAY_CLOSE_FALLBACK_MS: number;
  overlayLayerOffsets: Record<Interactions_Dom.OverlayKind, number>;
  overlayOwnerResolvers: WeakMap<
    Element,
    () => Layers_Layers.FocusableElement | null
  >;
  overlaysBlockUndo: (page?: ParentNode) => boolean;
  overlayStackContext: Layers_React.Context<Layers_Dom.OverlayStack | null>;
  overrideInlineStyles: (
    element: HTMLElement,
    styles: Readonly<Record<string, string>>,
  ) => () => void;
  ownerBuildFromFilesPrompt: (
    files: EditorRuntime_EditorRuntime.HandoffFile[],
    address: string,
    action: string,
  ) => string;
  ownerColorContrastFixPrompt: (
    request: EditorRuntime_EditorRuntime.ColorContrastFixRequest,
    address: string,
  ) => string;
  ownerEmptySystemPrompt: (address: string, action: string) => string;
  ownerHandoffFilesPrompt: (
    files: EditorRuntime_EditorRuntime.HandoffFile[],
    address: string,
  ) => string;
  ownerMigrationCleanupPrompt: (address: string) => string;
  ownMergeProperty: (
    object: FilesCore_FilesCore.JsonRecord | undefined,
    key: string,
  ) => FilesCore_FilesCore.JsonMergeValue;
  ownPropertyOrUndefined: <Value>(
    object: Record<string, Value>,
    key: string,
  ) => Value | undefined;
  ownPropertyValue: <Value>(
    input: Readonly<Record<string, Value>>,
    options: string,
  ) => Value | undefined;
  ownShortcutMapping: <T>(
    mapping: Record<string, T>,
    key: string,
  ) => T | undefined;
  PACKAGED_LIBRARY_CATALOG: ModelCore_ModelCore.PackagedLibrary[];
  PACKAGED_LIBRARY_PATH_PATTERN: RegExp;
  paddingTokenNames: string[];
  pageBackgroundContext: Layers_React.Context<string | undefined>;
  pageDeclaresDownloads: () => boolean;
  PALETTE_GROUP_NAME: string;
  PALETTE_RAMP_TOKEN_PATTERN: RegExp;
  PanedLayout: ColorControls_React.FunctionComponent<ColorControls_ColorControls.PanedLayoutProps>;
  PANEL_ELEVATION: "panel";
  PANEL_HEADER_CLASS: string;
  PANEL_SHEET_MAX_HEIGHT: string;
  PANEL_STORAGE_PREFIX: string;
  panelBottomPadding: (element: HTMLElement | null) => number;
  PanelHeader: (
    props: ColorControls_ColorControls.PanelHeaderProps,
  ) => ColorControls_React.ReactElement;
  PanelHeaderContent: ColorControls_React.FunctionComponent<ColorControls_ColorControls.PanelHeaderProps>;
  PanelIconButton: ColorControls_React.ForwardRefExoticComponent<
    ColorControls_Controls.ButtonProps &
      ColorControls_React.RefAttributes<HTMLButtonElement>
  >;
  PanelResizeHandle: ColorControls_React.FunctionComponent<ColorControls_ColorControls.PanelResizeHandleProps>;
  PanelWidthResizeHandle: ColorControls_React.FunctionComponent<ColorControls_ColorControls.PanelWidthHandleProps>;
  parentFolderPath: (path: string) => string;
  parseArtifactStash: (
    text: string | null,
  ) => PlatformHost_Host.ParsedStash | undefined;
  parseAssetGroupMetadata: (
    manifestInput: unknown,
    report?: ModelCore_Model.ParseReport,
  ) => ModelCore_Model.AssetGroupMetadata;
  parseAssetGroupPath: (path: string) => {
    group: string;
    key: string;
  } | null;
  parseAssetsListResponse: (
    arg0: unknown,
  ) => ModelStorage_Storage.AssetsCatalogueState;
  parseBundleHeader: (script: string) => {
    format: number | null;
    namespace: string | null;
    components: string[];
    inlinedExternals: string[];
  } | null;
  parseCarriedFileEdit: (
    value: unknown,
  ) => FilesCore_FilesCore.CarriedFileEdit | undefined;
  parseComponentCardHeader: (
    html: string,
  ) => Documentation_Core.ComponentCardMetadata | null;
  parseContrastColor: (
    text: string,
  ) => ColorControls_ColorControls.RgbaColor | undefined;
  parseCssColorToHsva: (input: string) => ColorControls_ColorControls.HsvaColor;
  parseDataUriHeader: (content: string) => {
    mime: string;
    base64: boolean;
    payloadOffset: number;
  } | null;
  parsedDesignSystem: (
    content: ModelCore_Model.DesignSystemContent,
    budgetProvider?: {
      pageBytes?(path: string): number | undefined;
    },
  ) => ModelCore_Model.ParsedDesignSystem;
  parsedDesignSystemBudgetCache: WeakMap<
    ModelCore_Model.DesignSystemContent,
    WeakMap<
      ModelCore_ModelCore.PageBudgetProvider,
      ModelCore_Model.ParsedDesignSystem
    >
  >;
  parsedDesignSystemCache: WeakMap<
    ModelCore_Model.DesignSystemContent,
    ModelCore_Model.ParsedDesignSystem
  >;
  parseDesignSystemContent: (
    input: unknown,
    report?: ModelCore_Model.ParseReport,
    options?: {
      unbounded?: boolean;
    },
  ) => ModelCore_Model.DesignSystemContent;
  parseDesignSystemEnvelope: (text: string) =>
    | "not JSON"
    | "not a design-system.json envelope"
    | {
        envelope: ModelCore_ModelCore.DesignSystemEnvelopeObject;
      };
  parseDesignSystemFiles: (
    files: ModelCore_Model.FileTable,
    budgetProvider?: {
      pageBytes?(path: string): number | undefined;
    },
  ) => ModelCore_Model.ParsedDesignSystem;
  parseEditableCssLength: (
    value: string,
  ) => TokenEditors_TokenEditors.EditableLength | null;
  parseEmbeddedArtifactState: <Content>(
    state: unknown,
    options: PlatformHost_Host.ArtifactParser<Content>,
  ) => PlatformHost_Host.ArtifactEnvelope<Content>;
  parseFilePublishConflicts: (
    value: unknown,
  ) => NonNullable<FilesCore_FilesBoot.FilePublishFailure["paths"]> | undefined;
  parseFileShaListing: (
    value: unknown,
  ) => FilesCore_FilesBoot.ChangedFileRow[] | undefined;
  parseFilesIndex: (text: string) => FilesCore_FilesBoot.FilesIndex | null;
  parseFileTable: (
    input: unknown,
    report?: ModelCore_Model.ParseReport,
    options?: {
      unbounded?: boolean;
    },
  ) => ModelCore_Model.FileTable;
  parseIndexBlobRecord: (value: unknown) => {
    name: string;
    rec: FilesCore_FilesBoot.StorageRecord & {
      store: "blob";
      id: string;
    };
  } | null;
  parseJSDocDefault: (
    doc: string,
    control: Documentation_Documentation.InferredControl,
  ) => string | number | boolean | undefined;
  parseJsonObjectOrNull: (
    arg0: unknown,
  ) => ModelStorage_Storage.DatabaseRecord | null;
  parseJsonOrNull: (text: string) => unknown;
  parseLastChange: (input: unknown) => {
    value: ModelCore_Model.LastChange | null;
    warnings: string[];
  };
  parseLegacyComponentPath: (path: string) => {
    group: string;
    name: string;
    ext: string;
  } | null;
  parseManifest: (
    input: unknown,
    report?: ModelCore_Model.ParseReport,
  ) => ModelCore_ModelCore.ManifestObject;
  parseManifestBundleMetadata: (
    manifestInput: unknown,
    report?: ModelCore_Model.ParseReport,
  ) => {
    namespace: string | null;
    libraries: ModelCore_Model.DeclaredLibrary[] | null;
  };
  parseManifestLibraries: (
    input: unknown,
    sourceLabel: string,
    report: ModelCore_Model.ParseReport,
  ) => ModelCore_Model.DeclaredLibrary[];
  parseMarkdownBlocks: (
    markdown: string,
  ) => Documentation_Core.MarkdownParseResult;
  parseMarkdownFence: (line: string) => [string, string];
  parseMergeableTokens: (
    text: string,
    strict: boolean,
  ) => FilesCore_FilesCore.JsonMergeValue | null;
  parseMigrationSentinel: (
    text: string | null,
  ) => Migration_Model.FilesMigrationSentinel | null;
  parsePixelCssValue: (input: string) => number;
  parseRemoteFileRecord: (
    arg0: string,
    arg1: ModelStorage_Storage.DatabaseRecord,
  ) => ModelStorage_Storage.RemoteFileRecord | null;
  parseShortcutChord: (
    input: string,
    options: boolean | undefined,
  ) => Dom_Dom.ShortcutChord;
  parseShortcutSequence: (input: string) => string[];
  parseSingleBoxShadow: (
    shadow: string,
  ) => TokenEditors_TokenEditors.SingleBoxShadow | null;
  parseSingleFileDesignSystem: (text: string) => {
    title: string;
    files: {
      [x: string]: string;
    };
  } | null;
  parseStoragePointer: (value: string) => ModelCore_Model.StoragePointer | null;
  parseStorageRecord: (
    arg0: string,
    arg1: unknown,
    arg2: ModelStorage_StorageModel.ParseReport,
  ) => ModelStorage_StorageModel.StorageRecord | null;
  parseStoredSystemMetadata: (
    arg0: unknown,
  ) => ModelStorage_Storage.StoredSystemMetadata | null;
  parseTokens: (
    input: unknown,
    report?: ModelCore_Model.ParseReport,
  ) => ModelCore_Model.NormalizedTokens;
  parseTypeBodyMembers: (
    body: string,
  ) => Documentation_Documentation.TypeBodyMember[];
  parseTypographyLength: (value: string, fallback: number) => number;
  PARTIAL_DESIGN_SYSTEM_MESSAGE: string;
  PASSIVE_FOCUS_OUT_REASON: string;
  PASSIVE_HOVER_OPEN_REASON: string;
  passiveDeclinedFocusProps: Pick<Layers_Layers.PassivePopupProps, "tabIndex">;
  passiveDefaultFocusProps: Pick<Layers_Layers.PassivePopupProps, "tabIndex">;
  passiveFocusDeclinedContext: Layers_React.Context<boolean>;
  passiveOpenEngagementKeys: Set<string>;
  PassiveOpenGate: (
    arg0: Layers_Layers.PassiveGateProps,
  ) => Layers_React.ReactElement;
  PassiveOpenKeyboardBridge: (arg0: {
    cell: Layers_Layers.PassiveOpenCell;
  }) => null;
  passiveOpenModifierKeys: Set<string>;
  passiveOpenStateContext: Layers_React.Context<Layers_Layers.PassiveOpenCell | null>;
  PASSWORD_MANAGER_IGNORE_PROPS: Record<string, string>;
  PATH_CONTROL_CHARACTER_PATTERN: RegExp;
  PATH_RESERVED_CHARACTER_PATTERN: RegExp;
  pathBasename: (path: string) => string;
  PathCheckError: FilesCore_FilesCore.PathCheckErrorConstructor;
  pathDirname: (path: string) => string;
  pausedFlipAnimations: WeakMap<HTMLElement, Animation>;
  pauseFlipAnimationAtProgress: (
    input: HTMLElement,
    options: number,
    context: () => ControlsExtra_Controls.SegmentBounds[],
  ) => void;
  pauseShrinkWrapResizeObservation: (
    input: Dom_Dom.BrowserWindow,
    options: Element,
  ) => void;
  PENDING_DESIGN_SYSTEM_SECTIONS: Application_Application.SectionRow[];
  pendingPopupFocusReturn: Composition_Composition.UndoPointerProps;
  PendingSectionRow: (
    props: Application_Application.PendingSectionRowProps,
  ) => Application_React.ReactElement;
  PendingSheetBackdrop: (props: {
    kind: Controls_C.OverlayKind;
  }) => Controls_React.ReactPortal | null;
  pendingShimmerElements: Set<Element>;
  pendingSystemDocumentRecords: ModelStorage_Storage.DocumentRecords;
  PendingUploadFiles: EditorRuntime_React.FunctionComponent<EditorRuntime_EditorRuntime.PendingUploadFilesProps>;
  perFileDesignSystemBooted: boolean;
  performDesignSystemEdit: (
    document2: EditorRuntime_EditorRuntime.DesignSystemEditPreparation,
    edit: EditorRuntime_Application.ContentMutation,
    ready: (options?: { withoutBytes: string[] }) => boolean | void,
    options: EditorRuntime_EditorRuntime.EditPreparationOptions,
    verb?: string,
  ) => boolean | void;
  pickLinkEventProps: (
    arg0: Layers_Overlays.RouterEvents,
  ) => Layers_Overlays.RouterEvents;
  pickScreenColor: () => Promise<string | null>;
  pickUploadFiles: (multiple?: boolean, accept?: string) => Promise<File[]>;
  pictogramCardRadiusClass: string;
  pinnedToast: Composition_Composition.PinnedToast | null;
  pinnedToastSubscribers: Set<
    (toast: Composition_Composition.PinnedToast | null) => void
  >;
  PIPELINE_BANNER_STORAGE_PREFIX: string;
  PIPELINE_READONLY_MESSAGE: string;
  PipelineChangeBanner: (props: {
    change: EditorRuntime_Model.LastChange;
    now?: number;
  }) => EditorRuntime_React.ReactElement | null;
  PipelineChangeSummary: (props: {
    change: EditorRuntime_Model.LastChange | null;
    now?: number;
  }) => EditorRuntime_React.ReactElement | null;
  pixelsToScaledRem: (pixels: number) => string;
  placementNeedsBottomHold: (
    arg0: Layers_Layers.PopupPlacement | null,
  ) => boolean;
  PlainTokenValueEditor: TokenEditors_React.FunctionComponent<TokenEditors_TokenEditors.PlainTokenValueEditorProps>;
  planSystemStoreConversion: (
    arg0: string,
    arg1: ModelStorage_StorageModel.FileTable,
    arg2?: ModelStorage_Storage.ConversionOptions,
  ) => ModelStorage_Storage.ConversionPlan;
  platformContext: Layers_React.Context<Layers_Layers.CdsPlatform | undefined>;
  PlatformFileContentAlias_2: typeof Dom_React;
  pointerDismissalContext: Interactions_React.Context<boolean>;
  pointInsideElement: (element: Element, x: number, y: number) => boolean;
  POPOVER_ELEVATION: "popover";
  PopoverComponents: Overlays_Overlays.PopoverComponents;
  popoverControlledStateContext: Overlays_React.Context<Overlays_Overlays.InnerOverlayStack | null>;
  PopoverPopup: Overlays_Overlays.ForwardComponent<
    HTMLDivElement,
    Overlays_Overlays.PopoverPopupProps
  >;
  popoverRefusesFocusOut: (
    state: Overlays_Overlays.PopoverAnchorState,
  ) => boolean;
  PopoverRoot: <Payload = void>(
    props: Overlays_Overlays.PopoverRootProps<Payload>,
  ) => Overlays_React.ReactElement;
  PopoverSheetBackdrop: (arg0: {
    sheetPopup: Layers_Overlays.SheetRenderState;
  }) => Layers_React.ReactElement;
  PopoverSheetBody: (
    arg0: Layers_Layers.PopoverSheetBodyProps,
  ) => Layers_React.ReactElement;
  popoverStateContext: Overlays_React.Context<Overlays_Overlays.PopoverAnchorStore | null>;
  POPUP_PLACEMENT_SETTLE_FRAMES: number;
  popupFocusReturnTimer: number;
  popupPointerEvent: Composition_React.KeyboardEventHandler<HTMLElement>;
  PopupScrim: (props: { onClose(): void }) => Composition_React.ReactNode;
  portalDensityContext: Layers_React.Context<Layers_Layers.Density>;
  portalLayerClasses: string;
  PortalRoot: (
    props: Interactions_Interactions.PortalRootProps,
  ) => Interactions_React.ReactElement;
  preferLivePreviewUrls: boolean;
  preferredHandoffTarget: PlatformHost_Host.HandoffTarget | null;
  prefersCoarsePointer: () => boolean;
  preflightDownloadFiles: (
    paths: (string | null | undefined)[],
    files: EditorRuntime_EditorRuntime.DownloadBytesFetcher,
  ) => Promise<Uint8Array | null>;
  preflightLegacyStoreMigration: (
    options: Pick<
      Migration_Migration.DesignSystemMigrationOptions,
      "files" | "store"
    >,
  ) => Promise<Migration_Migration.MigrationPreflight>;
  preflightSingleFileMigration: (options: {
    files: Migration_Migration.MigrationFilesPort;
    text: string;
  }) => Promise<
    | Migration_Migration.MigrationPreflight
    | "not_single_file"
    | "not_now"
    | "moved_before"
  >;
  preloadSheetImplementation: () => void;
  prepareDesignSystemThumbnailCapture: (document2?: Document) => void;
  prepareEditableLinks: (root: ParentNode) => void;
  prepareSingleFileMigrationReopen: (
    state: Boot_Boot.RawEnvelope,
  ) => Promise<void>;
  presentationModeContext: Dom_React.Context<Dom_Dom.OverlayPresentation>;
  presentStoreMeta: (input: unknown) => Boot_Boot.MetaOutcome;
  preserveFieldCheckboxFocus: (
    event: Controls_React.MouseEvent<HTMLLabelElement>,
  ) => void;
  preserveFileMigrationMarkers: <T>(value: T, ...previous: unknown[]) => T;
  preservePopupSelection: Composition_React.MouseEventHandler<HTMLElement>;
  preventAndStopEvent: (event: Controls_React.SyntheticEvent) => void;
  preventDefaultEvent: (event: Composition_React.SyntheticEvent) => void;
  preventModalTabNavigation: (
    arg0: Layers_React.KeyboardEvent<HTMLElement>,
  ) => void;
  preventPendingSheetFocus: (event: Pick<Event, "preventDefault">) => void;
  preventRepeatedClickSelection: (
    event: Overlays_Overlays.SelectionMouseEvent,
  ) => void;
  preventRepeatedSwitchEnter: (
    event: import("@base-ui/react/types").BaseUIEvent<
      Controls_React.KeyboardEvent<HTMLSpanElement>
    >,
  ) => void;
  PREVIEW_BOOT_TIMEOUT_MS: number;
  PREVIEW_FILE_MIME_PREDICATES: Record<
    EditorRuntime_EditorRuntime.PublishedFileKind,
    (mime: string) => boolean
  >;
  PREVIEW_FONT_WAIT_TIMEOUT_MS: number;
  PREVIEW_HEAD_STALL_TIMEOUT_MS: number;
  PREVIEW_IFRAME_SANDBOX: string;
  PREVIEW_LIFECYCLE_SCRIPT: string;
  PREVIEW_POOL_ENABLED_BY_DEFAULT: boolean;
  PREVIEW_POOL_IDLE_TTL_MS: number;
  PREVIEW_PROJECT_PREFIX: string;
  PREVIEW_RESIZE_ACTIVITY_EVENTS: (keyof DocumentEventMap)[];
  PREVIEW_RESIZE_ANIMATION_WINDOW_MS: number;
  PREVIEW_RESIZE_MARGIN_PX: number;
  PREVIEW_RESIZE_MAX_HEIGHT: number;
  PREVIEW_RESIZE_MIN_DELAY_MS: number;
  PREVIEW_RESIZE_SETTLE_MS: number;
  PREVIEW_RUNNER_BACKOFF_MS: number[];
  PREVIEW_RUNNER_GLOBAL: string;
  PREVIEW_RUNNER_PATH: string;
  PREVIEW_RUNNER_REGISTRY_OPTIONS: EditorRuntime_EditorRuntime.PreviewRegistryOptions;
  PREVIEW_SCOPED_STORAGE_SCRIPT: string;
  PREVIEW_STORAGE_PREFIX: string;
  PREVIEW_UPDATE_DEBOUNCE_MS: number;
  PREVIEW_VALIDATION_BASE_URL: string;
  previewColorSchemeCss: (
    mode: Preview_Preview.PreviewMode,
    hasDarkTheme: boolean,
    transparent?: boolean,
  ) => string;
  PreviewFitBox: EditorRuntime_React.FunctionComponent<EditorRuntime_EditorRuntime.PreviewFitBoxProps>;
  previewFitScale: (containerWidth: number, previewWidth: number) => number;
  previewFontIdentity: (
    system: Preview_Preview.PreviewSystem,
    path: string,
  ) => string;
  previewFontSource: (
    system: Preview_Preview.PreviewSystem,
    path: string,
    preferUrl?: boolean,
  ) => string | null;
  previewFramePathname: (iframe: HTMLIFrameElement) => string | undefined;
  PreviewFramePool: new (
    maxLive?: number,
    now?: () => number,
  ) => EditorRuntime_EditorRuntime.PreviewFramePool;
  previewHeadCache: Preview_Preview.PreviewHeadCache;
  previewIsolationScript: () => string;
  previewLibraries: (
    system: Preview_Preview.PreviewSystem,
  ) => Preview_Preview.PreviewLibraryResult;
  previewLibraryScripts: (
    libraries: {
      load: readonly {
        file: string;
      }[];
    },
    files: Readonly<Record<string, string | undefined>>,
  ) => string[];
  previewMessageHeight: (message: unknown) => number | undefined;
  previewOwnerSequence: number;
  previewRunnerAddresses: (
    path: string,
    baseURI: string,
  ) => {
    runner: string;
    card: string;
  } | null;
  previewRunnerRegistry: (
    environment: object,
  ) => EditorRuntime_EditorRuntime.PreviewRunnerRegistry;
  PREVIEWS_COLLECTION: string;
  previewStaticNoticeShown: boolean;
  previewStaticNoticeSnapshot: () => boolean;
  previewStaticNoticeSubscribers: Set<() => void>;
  previewStaticStatus: (
    system: Preview_Preview.PreviewSystem,
    libraries?: Preview_Model.ResolvedLibraries,
  ) => Preview_Preview.PreviewStaticStatus;
  previewThemeDisabledReason: (
    themeCount: number,
    components: Preview_Preview.PreviewComponent[],
    runnable: boolean,
  ) => string | undefined;
  previewThemeGroundColors: (
    tokens: Application_Model.NormalizedTokens,
    themes: Application_Model.ColorTheme[],
  ) => Record<
    string,
    {
      well: string;
      card: string;
    }
  >;
  PreviewThemeMenu: Preview_React.FunctionComponent<Preview_Preview.PreviewThemeMenuProps>;
  primaryIconGlyphs: Readonly<Record<string, number>>;
  prioritizeStashedTextEdits: (
    stash: FilesCore_FilesBoot.FilesCrashStash,
  ) => FilesCore_FilesBoot.FilesCrashStash;
  probeFileAvailability: (
    path: string,
    mimePrefix: string,
    bytes: number,
    headFetch?: Preview_Preview.FileHeadFetch,
  ) => boolean | undefined;
  probeLegacyDesignSystemWriteAccess: () => Promise<boolean | null>;
  PROJECT_FILE_PREFIX: string;
  PROJECT_FILE_PREFIXEditorFilesIndex: string;
  PROJECT_INDEX_PATHS: Record<"design" | "slides" | "designSystem", string>;
  projectFilePath: (path: string) => string;
  projectFilesForSave: (
    files: FilesCore_FilesBoot.FileTable,
  ) => Map<string, string>;
  projectFileUrl: (path: string) => string;
  projectListingFiles: (
    files: Record<string, unknown>,
    type: FileBrowser_FilesCore.FileArtifactType,
  ) => FileBrowser_FileBrowser.BrowserListingEntry[];
  PROPERTY_ACTIONS_CLASS: string;
  PROPERTY_NUMBER_FORMAT_OPTIONS: Intl.NumberFormatOptions;
  PROPERTY_NUMBER_INPUT_CLASS: string;
  PROPERTY_NUMBER_STEPPER_CLASS: string;
  PROPERTY_NUMBER_UNIT_CLASS: string;
  PROPERTY_ROW_INTERACTIVE_SELECTOR: string;
  PROPERTY_SECTION_GUTTER_CLASS: string;
  PropertyColorPreview: (
    props: Composition_Composition.PropertyColorPreviewProps,
  ) => Composition_React.ReactNode;
  PropertyIcon: ColorControls_React.FunctionComponent<ColorControls_ColorControls.PropertyIconProps>;
  propertyNumberFormatter: Intl.NumberFormat;
  PropertyNumberInput: ColorControls_React.FunctionComponent<ColorControls_ColorControls.PropertyNumberInputProps>;
  PropertyPopover: (
    props: Composition_Composition.PropertyPopoverProps,
  ) => Composition_React.ReactNode;
  PropertyPopoverPanel: (
    props: Composition_Composition.PropertyPopoverPanelProps,
  ) => Composition_React.ReactNode;
  PropertyPopoverTrigger: Composition_React.ForwardRefExoticComponent<
    Composition_Composition.PropertyPopoverTriggerProps &
      Composition_React.RefAttributes<HTMLButtonElement>
  >;
  PropertyPopup: (
    props: Composition_Composition.PropertyPopupProps,
  ) => Composition_React.ReactNode;
  PropertyRow: (
    props: Composition_Composition.PropertyRowProps,
  ) => Composition_React.ReactNode;
  propertyRowPressShouldIgnore: (row: HTMLElement, target: Element) => boolean;
  PropertySectionHeader: (
    props: Composition_Composition.PropertySectionHeaderProps,
  ) => Composition_React.ReactNode;
  protectedFilePathPredicate: (path: string) => boolean;
  provideDesignSystemFilesDebugState: (
    document2: Boot_Docs.DesignSystemFilesDocument,
    files: Boot_Model.BrowserFilesPort,
    indexPath?: string,
  ) => void;
  pruneAssetSelection: (
    selection: EditorRuntime_Model.AssetSelection,
    order: string[],
  ) => EditorRuntime_Model.AssetSelection;
  pruneUnusedFontFamilies: (tokens: ModelCore_Model.NormalizedTokens) => void;
  pruneUnusedFontFamily: (
    tokens: ModelCore_Model.NormalizedTokens,
    key: string,
  ) => void;
  PUBLIC_PROJECT_FILES_BY_TYPE: Partial<
    Record<FilesCore_FilesCore.FileArtifactType, string[]>
  >;
  PUBLIC_STORE_READ_LEVELS: string[];
  PUBLISHABLE_MIME_TYPES: Set<string>;
  publishableFileMimeType: (path: string, contents?: string) => string | null;
  publishableProjectFiles: (
    files: FilesCore_FilesBoot.FileTable,
  ) => Map<string, string>;
  PUBLISHED_FILE_ADDRESS_ROOT_PATTERN: RegExp;
  publishedFileBytes: (
    contents: string,
    kind: EditorRuntime_EditorRuntime.PublishedFileKind,
  ) => string | Uint8Array | null;
  publishedFilesRegistry: EditorRuntime_EditorRuntime.PublishedFilesRegistry;
  publishedPageBlobIds: (
    arg0?: ModelStorage_Storage.PublishedAssetProbe,
  ) => Promise<Set<string> | null>;
  publishedPreviewCache: EditorRuntime_EditorRuntime.PublishedPreviewCache;
  publishedPreviewGeneration: () => number;
  publishedPreviewUrl: (
    path: string,
    contents: string,
    kind: EditorRuntime_EditorRuntime.PublishedFileKind,
  ) => EditorRuntime_Model.PublishedFileReference | undefined;
  purgeOtherViewerCarryEntries: (
    storage: Storage,
    viewer: string | null | undefined,
    artifactPath?: string,
  ) => void;
  quoteCssFontFamily: (family: string) => string;
  QUOTED_TYPE_LITERAL_PATTERN: RegExp;
  RAIL_THUMB_RESIZE_SETTLE_MS: number;
  rankSectionSearchResults: (
    index: Application_Application.SearchEntry[],
    query: string,
    limit?: number,
  ) => Application_Application.SearchResult;
  RAW_PROJECT_REFERENCE_GUIDANCE: string;
  RAW_TOKENS_DOCUMENT_PATH: string;
  rawDocumentPathForFile: (path: string) => string;
  REACT_FORWARD_REF_SYMBOL: symbol;
  react_k: typeof import("react");
  REACT_LIBRARY_CATALOG: ModelCore_ModelCore.PackagedLibrary[];
  REACT_MEMO_SYMBOL: symbol;
  react_z: typeof PlatformHost_React;
  reactAC: typeof Controls_React;
  reactActivityHide: typeof Interactions_React;
  reactAdaptiveSheets: typeof Dom_React;
  reactAndroidCloseWatcher: typeof Dom_React;
  reactArtifactClipboard: typeof PlatformHost_React;
  reactArtifactRoot: typeof import("react");
  reactAssetDrag: typeof import("react");
  reactAssetFileDrop: typeof import("react");
  reactAssetGroupEditor: typeof import("react");
  reactAssetGroups: typeof import("react");
  reactAssetInteractions: typeof import("react");
  reactAssetSelection: typeof import("react");
  reactAssetThumbnail: typeof import("react");
  reactAssetUpload: typeof import("react");
  reactBlobResource: typeof import("react");
  reactBootWarnings: typeof Application_React;
  reactBrandUpload: typeof import("react");
  reactCancelableTimeout: typeof Dom_React;
  reactCdsLink: typeof Layers_React;
  reactCdsRoot: typeof Layers_React;
  reactCheckbox: typeof Controls_React;
  reactcK: typeof import("react");
  reactClickToFocus: typeof Layers_React;
  reactCollisionPadding: typeof Interactions_React;
  reactColorEditors: typeof import("react");
  reactColorMode: typeof import("react");
  reactComboboxStatus: typeof import("react");
  reactComponentPreviews: typeof import("react");
  reactComponentsSection: typeof import("react");
  reactConflictBanners: typeof import("react");
  reactContextMenu: typeof import("react");
  reactContextMenuPopup: typeof Layers_React;
  reactCoverCapture: typeof Boot_React;
  reactdC: typeof import("react");
  reactDesignSystemEditors: typeof import("react");
  reactDesignSystemFiles: typeof import("react");
  reactDisabledReason: typeof Dom_React;
  reactDocumentFont: typeof Dom_React;
  reactDomAssetGroups: typeof import("react-dom");
  reactDOMClientForUiDisclosure: typeof import("react-dom/client");
  reactDomColorMode: typeof import("react-dom");
  reactDomCoverCapture: typeof import("react-dom/client");
  reactDomDesignSystemFiles: typeof import("react-dom");
  reactDomFilesBrowser: typeof import("react-dom");
  reactDOMForUiDisclosure: typeof import("react/jsx-runtime");
  reactDOMForUiPropertyPopover: typeof import("react-dom");
  reactDOMForUiTextInputOverlay: typeof import("react-dom");
  reactDomHandoff: typeof import("react-dom");
  reactDomMarkdownToolbar: typeof import("react-dom");
  reactDomPassiveOpen: typeof import("react-dom");
  reactDomShadowEditors: typeof import("react-dom");
  reactDomSidePanels: typeof import("react-dom");
  ReactDownloadsPermission: typeof import("react");
  reactEventCallbacks: typeof Dom_React;
  reactExperimentalTheme: typeof Interactions_React;
  reactField: typeof Controls_React;
  reactFieldCheckbox: typeof Controls_React;
  reactFieldNumberInput: typeof Controls_React;
  reactFieldTextArea: typeof Controls_React;
  reactFieldTextInput: typeof Controls_React;
  reactFileAvailability: typeof import("react");
  reactFileDrop: typeof import("react");
  reactFileDropTarget: typeof import("react");
  reactFileDropUiFileDrop: typeof import("react");
  reactFilesBrowser: typeof import("react");
  reactfk: typeof import("react");
  reactFocusRegions: typeof Application_React;
  reactFontFaces: typeof import("react");
  reactForPlatformFrameChrome: typeof PlatformHost_React;
  reactForPlatformFrameChrome2: typeof PlatformHost_React;
  reactForUiArtifactToolbar: typeof import("react");
  reactForUiBadges: typeof Controls_React;
  reactForUiColorPicker: typeof ControlsExtra_React;
  reactForUiContrastControls: typeof import("react");
  reactForUiDisclosure: typeof import("react");
  reactForUiDisclosure2: typeof import("react");
  reactForUiDisclosure3: typeof import("react");
  reactForUiDisclosure4: typeof import("react");
  reactForUiIcons: typeof Controls_React;
  reactForUiIcons2: typeof Controls_React;
  reactForUiInputs222: typeof import("react");
  reactForUiInputs24: typeof import("react");
  reactForUiInputs25: typeof import("react");
  reactForUiInspectorIcons: typeof import("react");
  reactForUiInteractions: typeof Interactions_React;
  reactForUiMenu: typeof import("react");
  reactForUiNumberControls: typeof import("react");
  reactForUiNumberControls2: typeof import("react");
  reactForUiPopover: typeof import("react");
  reactForUiPropertyPopover: typeof import("react");
  reactForUiPropertyPopover2: typeof import("react");
  reactForUiPropertyRow2: typeof import("react");
  reactForUiPropertyRows: typeof import("react");
  reactForUiSegmentedControl: typeof ControlsExtra_React;
  reactForUiSegmentedControl2: typeof ControlsExtra_React;
  reactForUiSidePanels: typeof import("react");
  reactForUiSidePanels2: typeof import("react");
  reactForUiSkeleton: typeof Controls_React;
  reactForUiSurfaces: typeof Controls_React;
  reactForUiTable3: typeof ControlsExtra_React;
  reactForUiTabs: typeof import("react");
  reactForUiTabs2: typeof import("react");
  reactForUiTextArea: typeof Controls_React;
  reactForUiToast: typeof import("react");
  reactForUiToolbarControls: typeof import("react");
  reactForUiToolbarControls2: typeof import("react");
  reactForUiTooltips: typeof import("react");
  reactForUiTooltips2: typeof import("react");
  reactGoogleFontCatalog: typeof import("react");
  reactGQ: typeof import("react");
  reactHandoff: typeof PlatformHost_React;
  reactHandoffTargets: typeof PlatformHost_React;
  reactHostTheme: typeof import("react");
  reactHu: typeof Controls_React;
  reactiK: typeof Controls_React;
  reactInertProps: typeof Dom_React;
  reactInspectorIcons: typeof import("react");
  reactIsomorphicLayoutEffect: typeof Dom_React;
  reactiZ: typeof Controls_React;
  reactJW: typeof import("react");
  reactk_: typeof import("react");
  reactKeyboardContextMenuFocus: typeof Interactions_React;
  reactLayers: typeof Interactions_React;
  reactLC: typeof ControlsExtra_React;
  reactMajorVersion: number;
  reactMarkdownToolbar: typeof import("react");
  reactMediaQuery: typeof Dom_React;
  reactMenuContexts: typeof Interactions_React;
  reactMenuOpener: typeof Layers_React;
  reactMenuOverlayRegistration: typeof Layers_React;
  reactMenuPopupElement: typeof Layers_React;
  reactMenuSheetPopup: typeof Layers_React;
  reactMergedRefs: typeof Interactions_React;
  reactMigrationBanners: typeof import("react");
  reactModalPortalInert: typeof Layers_React;
  reactoK: typeof Controls_React;
  reactOverlayActions: typeof Dom_React;
  reactOverlayFocus: typeof Layers_React;
  reactOverlayStack: typeof Layers_React;
  reactPassiveOpen: typeof Layers_React;
  reactpC: typeof import("react");
  reactPipelineBanners: typeof import("react");
  reactPlatformShortcuts: typeof ControlsExtra_React;
  reactPointerDismissal: typeof Interactions_React;
  reactPreloadSheets: typeof Layers_React;
  reactPresentationMode: typeof Dom_React;
  reactPreviewComponents: typeof import("react");
  reactPreviewFit: typeof import("react");
  reactPreviewNotice: typeof import("react");
  reactPreviewThemeMenu: typeof import("react");
  reactPropertyPopoverControls: typeof import("react");
  reactPropertyRowHelpers: typeof import("react");
  reactPublishedPreview: typeof import("react");
  reactReducedMotion: typeof Dom_React;
  reactRowContextMenu: typeof import("react");
  reactSectionCollapse: typeof import("react");
  reactSectionNavigation: typeof Application_React;
  reactSectionNavigationEditorSectionNavigation: typeof Documentation_React;
  reactSectionScroller: typeof Application_React;
  reactSelectionToolbar: typeof import("react");
  reactShadowEditors: typeof import("react");
  reactSheetChrome: typeof Interactions_React;
  reactSheetDrag: typeof Dom_React;
  reactSheetImplementation: typeof Layers_React;
  reactSheetMeasurement: typeof Interactions_React;
  reactSheetPopupHost: typeof Interactions_React;
  reactShortcut: typeof Dom_React;
  reactShrinkWrap: typeof Dom_React;
  reactSkeletonContexts: typeof Interactions_React;
  reactStablePopupPlacement: typeof Layers_React;
  reactStaticPreview: typeof import("react");
  reactSwatchPreview: typeof import("react");
  reactSwitch: typeof Controls_React;
  reactTextCommit: typeof import("react");
  reactTextCommitController: typeof import("react");
  reactTextOverflow: typeof Dom_React;
  reacttJ: typeof Controls_React;
  reacttM: typeof import("react");
  reactTokenRename: typeof import("react");
  reactToolbarButtons: typeof import("react");
  reactToolbarControls: typeof import("react");
  reactToolbarLayout: typeof import("react");
  reactToolbarPicker: typeof import("react");
  reactTooltip: typeof Dom_React;
  reactTooltipContext: typeof Dom_React;
  reactTranslations: typeof Interactions_React;
  reactuP: typeof import("react");
  reactUsageEditor: typeof import("react");
  reactVisualKeyboard: typeof Dom_React;
  reactWelcome: typeof import("react");
  reactXk: typeof import("react");
  reactyq: typeof ControlsExtra_React;
  reactZQ: typeof Controls_React;
  reactzV: typeof Controls_React;
  READ_ONLY_ARTIFACT_MESSAGE: string;
  READ_ONLY_EMPTY_SECTION_HINTS: Record<
    TokenEditors_TokenEditors.EmptySectionKind,
    string
  >;
  readAllowlistedStoreDocuments: (
    store: Migration_Model.FilesMigrationStore,
    allowlist: Migration_Model.FilesMigrationAllowlistEntry[],
  ) => Promise<Migration_Migration.StoreSnapshot>;
  readArtifactBlobDownload: (
    url: string,
    signal?: AbortSignal,
  ) => Promise<FileBrowser_FileBrowser.DownloadData>;
  readArtifactEditCount: () => number;
  readAuthoritativeStoreMeta: (
    options: Boot_Boot.MetaReadOptions,
    timeoutMs?: number,
    timers?: Boot_Boot.TimerPair,
  ) => Promise<Boot_Boot.MetaOutcome>;
  readBlobDataUrl: (
    url: string,
    mimeType: string,
    fetcher?: EditorRuntime_EditorRuntime.BlobFetcher,
    expectedBytes?: number,
  ) => Promise<string | null>;
  readCarriedFileEdits: (
    snapshot: unknown,
    field?: string,
  ) => Map<string, FilesCore_FilesCore.CarriedFileEdit>;
  readCarriedIndexEdit: (
    value: unknown,
  ) => FilesCore_FilesCore.CarriedIndexEdit | undefined;
  readCompiledPageAnatomy: (
    document2: Document,
  ) => PlatformHost_Host.CompiledPage;
  readCompiledPageDocument: (document2: Document) => unknown;
  readConvertingMarker: (
    arg0: unknown,
  ) => ModelStorage_Storage.ConvertingMarker | null;
  readCoverCaptureFonts: (
    paths: string[],
    reader: Boot_Boot.CoverCaptureReader,
    limits: Boot_Boot.CoverFontLimits,
  ) => Promise<Record<string, string>>;
  readCoverCaptureSystem: (
    reader?: Boot_Boot.CoverCaptureReader,
    limits?: Boot_Boot.CoverFontLimits,
  ) => Promise<Boot_Boot.CapturedCover | null>;
  readCssDuration: (input: CSSStyleDeclaration, options: string) => number;
  readCurrentArtifactReadOnlyReason: () => string | null;
  readDataUrlSignature: (
    url: string,
  ) => FilesCore_FilesCore.DataUrlSignature | null;
  readDesignSystemBootStateFile: (
    text: string,
    path: string,
    homes: Boot_Boot.FileHomes,
  ) => Boot_Boot.LegacyReadSuccess | string;
  readDesignSystemInitialState: (
    onOwn?: (
      state: Boot_Boot.RawEnvelope | "missing" | "unreadable",
      homes: Boot_Boot.FileHomeDecision,
    ) => void,
  ) => Promise<Boot_Boot.LegacyInitialState>;
  readDesktopTitlebarInset: (doc: Document) => number;
  readDocumentFont: () => Dom_Dom.DocumentFont | undefined;
  readDownloadFileBytes: (
    files: EditorRuntime_Model.FileTable,
    path: string,
    storage: EditorRuntime_Model.StorageCatalog,
    fetchBytes?: EditorRuntime_EditorRuntime.DownloadBytesFetcher,
  ) => Promise<Uint8Array | null>;
  readFileBrowserDownload: (
    name: string,
    source: FileBrowser_FileBrowser.FileBrowserSource,
    reads: FileBrowser_FileBrowser.FileBrowserReads,
    signal?: AbortSignal,
  ) => Promise<FileBrowser_FileBrowser.DownloadData>;
  readFileMigrationMarker: (
    arg0: unknown,
  ) => ModelStorage_Storage.MigrationMarker | null;
  readFilesBootState: (
    options: Boot_Boot.BootReaderOptions,
  ) => Promise<Boot_Boot.BootReadResult>;
  readFreshDatabaseSnapshot: <
    Snapshot extends Boot_Boot.NativeAuthoritySnapshot,
  >(
    read: () => Promise<Snapshot>,
  ) => Promise<Snapshot>;
  readHostThemeMode: () => Preview_Preview.PreviewMode;
  readInlineStyleProperty: (
    style: CSSStyleDeclaration,
    property: string,
  ) => Overlays_Overlays.InlineStyleProperty;
  readJsonFileState: (
    files: FilesCore_FilesBoot.BrowserFilesPort,
    path: string,
    timers?: Pick<FilesCore_FilesBoot.FilesTimers, "setTimeout">,
  ) => Promise<FilesCore_FilesCore.JsonFileState>;
  readLegacyDesignSystemState: (
    options: Boot_Boot.LegacyReadOptions,
  ) => Promise<Boot_Boot.LegacyInitialState>;
  readLegacyStateFile: (
    fetchFile: NonNullable<Boot_Boot.LegacyReadOptions["fetch"]>,
    path: string,
    read: Boot_Boot.LegacyReadOptions["read"],
    readPath?: string,
  ) => Promise<Boot_Boot.LegacyReadAnswer>;
  readMarkdownSelectionFormat: (
    root: HTMLElement,
  ) => import("./contracts").MarkdownFormatState | null;
  README_DOCUMENT_PATH: string;
  README_MEASURE_CLASS_NAME: string;
  README_SEPARATOR_PATTERN_SOURCE: string;
  README_SIZE_EXCEEDED_MESSAGE: string;
  README_STARTER_TEXT: string;
  README_TOOLBAR_MENU_ATTRIBUTE: string;
  README_TOOLBAR_MENU_PROPS: {
    [attribute: `data-${string}`]: string;
  };
  ReadmeArticle: (
    props: Documentation_React.PropsWithChildren,
  ) => Documentation_React.ReactElement;
  readMigrationArtifactBlob: (
    input: string,
  ) => Promise<Boot_FilesCore.FileData | null>;
  readMigrationBlob: (
    fetchBlob: Migration_Migration.FetchMigrationBlob,
    blobId: string | null,
    expectedBytes?: number,
  ) => Promise<Uint8Array<ArrayBuffer>>;
  readMovedToMarker: (arg0: unknown) => ModelStorage_Storage.MovedMarker | null;
  readOwedArtifactBlob: (
    id: string,
  ) => Promise<FilesCore_FilesCore.FileData | null>;
  readPanelPreference: <T>(
    key: string,
    validate: (value: unknown) => value is T,
  ) => T | undefined;
  readPopupPlacement: (arg0: Element) => Layers_Layers.PopupPlacement;
  readRecentMigrationNotice: (
    text: string | null,
    now: number,
  ) => string | null;
  readRootRemSize: () => number;
  readShrinkWrapNaturalLayout: (input: Dom_Dom.ShrinkWrapJob) => void;
  readStoreMetaThroughSubscription: (
    port: Boot_Storage.DatabasePort,
    timeoutMs: number,
    timers: Boot_Boot.TimerPair,
  ) => Promise<Boot_Boot.MetaOutcome>;
  readTreeIndex: (
    value: Record<string, unknown>,
  ) => FilesCore_FilesBoot.FilesIndex | undefined;
  readUploadedFileValue: (
    file: EditorRuntime_Model.UploadedAssetFile,
    bytes: Uint8Array,
  ) => EditorRuntime_EditorRuntime.UploadedFileValue;
  RECENT_PUBLISH_CLASH_NOTICE_MS: number;
  RECENT_PUBLISH_HEAL_WINDOW_MS: number;
  recentOrphanedAssets: ModelStorage_Storage.OrphanedAsset[];
  RECLAIM_LIST_FAILED_MESSAGE: string;
  RECLAIM_NOTHING_UNUSED_MESSAGE: string;
  RECLAIM_RECONNECTING_MESSAGE: string;
  RECLAIM_SAVE_FIRST_MESSAGE: string;
  RECLAIM_SAVING_MESSAGE: string;
  RECLAIM_WINDOWED_COLLECTION_MESSAGE: string;
  reclaimAssetsButtonLabel: (
    arg0: number,
    arg1: number,
    arg2?: boolean,
    arg3?: boolean,
  ) => string;
  reclaimAssetsConfirmation: (arg0: number, arg1: number) => string;
  reclaimAssetsResultMessage: (
    arg0: ModelStorage_Storage.AssetDeletionResult,
  ) => string;
  reconcileStorageCatalog: (
    arg0: ModelStorage_StorageModel.FileTable,
    arg1: ModelStorage_StorageModel.StorageCatalog,
  ) => ModelStorage_StorageModel.StorageCatalog;
  recordArtifactEdit: () => void;
  recordCompositionEnd: (input: number) => void;
  recordDesignSystemFileHomeDecision: (
    outcome: Boot_Boot.LegacyInitialState,
    decision: Boot_Boot.FileHomeDecision,
  ) => void;
  recordKeyboardContextMenuOpen: (
    input: object,
    options: boolean,
    context: Interactions_Interactions.ContextMenuChange,
  ) => void;
  recordMarkedIndexSeen: () => boolean | undefined;
  recordMigrationStoppedForChange: (changeKey: string) => void;
  recordPreviewRunnerOutcome: (
    environment: object,
    outcome: string,
    token: string,
  ) => {
    tell: boolean;
  };
  recordRemoteTextUploadFailure: (
    arg0: string,
    arg1: string,
    arg2: string,
  ) => void;
  recoverRawSheetHeight: (
    bounds: Dom_Dom.SheetBounds,
    height: number,
    slide: number,
  ) => number;
  REDO_COMPLETE_LABEL: string;
  REDO_UNAVAILABLE_LABEL: string;
  REDUCED_MOTION_ATTRIBUTE: string;
  REDUCED_MOTION_QUERY: string;
  referencedBlobIds: (arg0: ModelStorage_StorageModel.FileTable) => Set<string>;
  referencedTypeNames: (head: string) => string[];
  refreshAddressedFileVersion: (
    state: EditorRuntime_EditorRuntime.AddressedLoadState,
    version: string | undefined,
    getSource?: EditorRuntime_EditorRuntime.FileSource,
  ) => number;
  refreshAssetsCatalog: (
    arg0?: Pick<ModelStorage_Storage.AssetsCapability, "list"> | null,
  ) => Promise<ModelStorage_Storage.AssetsCatalogueState>;
  refreshManifest: (
    content: ModelCore_Model.DesignSystemContent,
    title: string,
  ) => ModelCore_Model.DesignSystemContent;
  refreshNonemptyManifest: (
    arg0: ModelStorage_StorageModel.DesignSystemContent,
    arg1: string,
  ) => ModelStorage_StorageModel.DesignSystemContent;
  refuseAddressedFileSource: (
    state: EditorRuntime_EditorRuntime.AddressedLoadState,
    getSource: EditorRuntime_EditorRuntime.FileSource,
  ) => void;
  REFUSED_TOOL_DIRECTORIES: Set<string>;
  REFUSED_TOOL_FILENAMES: Set<string>;
  refuseOversizedSystemDocument: (
    arg0: string,
    arg1: ModelStorage_Storage.DatabaseRecord,
    arg2: number,
  ) => string | undefined;
  regenerateStoredDerivedFiles: boolean;
  registeredCssPropertyNames: (css: string) => string[];
  registeredSwatchHeadIds: WeakMap<
    EditorRuntime_EditorRuntime.PreviewRuntimeHead,
    string
  >;
  registerInputDismissalTracking: (documentObject?: Document) => void;
  registerOverlayOwner: (
    input: Element,
    options: () => Interactions_Overlays.FocusableElement | null,
  ) => void;
  registerPreviewDocument: <Doc>(
    registry: EditorRuntime_EditorRuntime.PreviewDocumentRegistry<Doc>,
    options: EditorRuntime_EditorRuntime.PreviewRegistryOptions,
    document2: Doc,
    waiting?: EditorRuntime_EditorRuntime.PreviewWaiting,
  ) => string;
  registerPreviewRunnerDocument: (
    environment: object,
    url: string,
    html: string,
    waiting?: EditorRuntime_EditorRuntime.PreviewWaiting,
  ) => string;
  registerShrinkWrapResizeHandler: (
    input: Dom_Dom.BrowserWindow,
    options: Element,
    context: (entry: ResizeObserverEntry) => void,
  ) => void;
  rejectUnsafeHref: (arg0: string, arg1: string) => string;
  RELATIVE_IMPORT_MAP_PATTERN: RegExp;
  RELATIVE_SCRIPT_IMPORT_PATTERN: RegExp;
  relativeChangeTime: (timestamp: string, now?: number) => string;
  relativeLuminance: (color: ColorControls_ColorControls.RgbaColor) => number;
  relativePathDotSegmentPattern: RegExp;
  relativeProjectFilePath: (path: string) => string | undefined;
  relativeProjectFilesForMerge: (
    files: FilesCore_FilesBoot.FileTable,
  ) => Map<string, string>;
  releaseEarlyHotUpdatesForLegacyMode: () => void;
  releaseInertAfterPaint: (
    arg0: Window,
    arg1: () => void,
    arg2: () => void,
  ) => () => void;
  releaseMigrationEditingHold: () => void;
  releaseSwatchHead: (environment: object, id: string) => void;
  REM_SCALE_VARIABLE: string;
  rememberOrphanedAsset: (arg0: ModelStorage_Storage.OrphanedAsset) => void;
  REMOTE_FILE_MIME_TYPE_PATTERN: RegExp;
  REMOTE_FILE_SHA256_PATTERN: RegExp;
  REMOTE_TEXT_RETRY_DELAY_MS: number;
  remoteFileRecordAtPath: (
    arg0: ReadonlyMap<string, ModelStorage_Storage.DatabaseRecord>,
    arg1: string,
  ) => ModelStorage_Storage.RemoteFileRecord | null;
  remoteTextDocumentRecords: ModelStorage_Storage.DocumentRecords;
  remoteTextEntries: Map<string, ModelStorage_Storage.RemoteTextEntry>;
  remoteTextEntry: (
    arg0: string,
  ) => ModelStorage_Storage.RemoteTextEntry | undefined;
  remoteTextHydrator: ModelStorage_Storage.RemoteTextHydrator | undefined;
  remoteTextLostLocalLines: (
    base: string,
    mine: string,
    theirs: string,
  ) => boolean;
  remoteTextProblemSnapshot: ReadonlyMap<string, string>;
  remoteTextProblemSubscribers: Set<() => void>;
  remoteTextRetryTimer: ReturnType<typeof setTimeout> | undefined;
  remoteTextUploadedCallback: (() => void) | undefined;
  remoteTextUploadProblems: Map<string, string>;
  removeCatalogAssets: (arg0: ReadonlySet<string>) => void;
  removeDroppedFiles: (
    files: FilesCore_FilesBoot.FileTable,
    previous: ReadonlyMap<string, string>,
    next: ReadonlyMap<string, string>,
  ) => FilesCore_FilesBoot.FileTable;
  removeFoldedBlobReference: (
    index: Migration_Migration.MigrationWireIndex,
    path: string,
  ) => void;
  removeInvalidColorAliases: (
    themes: ModelCore_Model.ColorTheme[],
    tokens: ModelCore_Model.ColorToken[],
    report: ModelCore_Model.ParseReport,
  ) => void;
  removeMarkdownModelNodes: (
    root: HTMLElement,
    blockModels: Map<Node, FileBrowser_FileBrowser.MarkdownSource>,
    removedNodes: MutationRecord[],
  ) => void;
  removeMediaQueryListener: (
    mediaQuery: MediaQueryList,
    listener: () => void,
  ) => void;
  removeMissingFontReferences: (
    content: ModelCore_Model.DesignSystemContent,
  ) => ModelCore_Model.DesignSystemContent;
  removeMissingMergeProperties: (
    record: FilesCore_FilesCore.JsonRecord,
    source: FilesCore_FilesCore.JsonRecord,
  ) => void;
  removeMissingStorageDigests: (
    content: ModelCore_Model.DesignSystemContent,
    missingIds: ReadonlySet<string>,
  ) => ModelCore_Model.DesignSystemContent;
  removePreviewDocument: (
    registry: EditorRuntime_EditorRuntime.PreviewDocumentRegistry<unknown>,
    token: string,
  ) => void;
  removePreviewRunnerDocument: (environment: object, token: string) => void;
  RemovePropertyButton: (
    props: Composition_Composition.RemovePropertyButtonProps,
  ) => Composition_React.ReactNode;
  RemoveRowButton: TokenEditors_React.FunctionComponent<TokenEditors_TokenEditors.RemoveRowButtonProps>;
  RemoveSectionButton: TokenEditors_React.FunctionComponent<TokenEditors_TokenEditors.RemoveSectionButtonProps>;
  removeTokenShortcutComments: (markdown: string) => string;
  removeUnpublishableMigrationFiles: (
    files: Map<string, FilesCore_FilesBoot.FilePublishInput>,
    type?: FilesCore_FilesCore.FileArtifactType,
  ) => {
    path: string;
    why: string;
  }[];
  RENAME_BUTTON_SELECTOR: string;
  RENAME_NAME_SELECTOR: string;
  renameAssetFile: (
    content: ModelCore_Model.DesignSystemContent,
    path: string,
    newName: string,
  ) => ModelCore_Model.DesignSystemContent;
  renameAssetFilePath: (
    content: ModelCore_Model.DesignSystemContent,
    oldPath: string,
    newPath: string,
  ) => ModelCore_Model.DesignSystemContent;
  renameAssetGroup: (
    content: ModelCore_Model.DesignSystemContent,
    oldName: string,
    newName: string,
  ) => ModelCore_Model.DesignSystemContent;
  renameColorTokensAtomically: (
    content: ModelCore_Model.DesignSystemContent,
    renames: [string, string][],
  ) => ModelCore_Model.DesignSystemContent;
  renameDesignSystemFile: (
    content: ModelCore_Model.DesignSystemContent,
    oldPath: string,
    newPath: string,
  ) => ModelCore_Model.DesignSystemContent;
  renameReadmeTokenCodeSpans: (
    readme: string,
    oldName: string,
    newName: string,
  ) => string;
  renameToken: (
    content: ModelCore_Model.DesignSystemContent,
    family: ModelCore_ModelCore.TokenKind,
    oldName: string,
    newName: string,
  ) => ModelCore_Model.DesignSystemContent;
  renameTokenInTokens: (
    content: ModelCore_Model.DesignSystemContent,
    family: ModelCore_ModelCore.TokenKind,
    oldName: string,
    newName: string,
  ) => ModelCore_Model.DesignSystemContent;
  renameTypographyGroup: (
    content: ModelCore_Model.DesignSystemContent,
    oldName: string,
    newName: string,
  ) => ModelCore_Model.DesignSystemContent;
  renderCodeSpans: (markdown: string) => Documentation_React.ReactNode;
  renderComponentPreview: (
    component: Preview_Preview.PreviewComponent,
    dimensions: {
      height: number;
    },
    previewHead: Preview_Preview.PreviewHeadResult,
    stage?: Preview_Preview.ComponentPreviewStage,
  ) => Preview_React.ReactElement | null;
  renderDesignSystemCoverCapture: (
    root?: HTMLElement | null,
    reader?: Boot_Boot.CoverCaptureReader,
    timeoutMs?: number,
  ) => Promise<void>;
  renderInlineCode: (
    key: number,
    text: string,
  ) => Documentation_React.ReactElement;
  renderInlineMarkdown: (
    markdown: string,
    options?: Documentation_Core.InlineMarkdownOptions,
  ) => string | (string | Documentation_React.ReactElement)[];
  renderMarkdownBlock: (
    block: Documentation_Core.MarkdownBlock,
    index?: number,
    options?: Documentation_Core.InlineMarkdownOptions,
  ) => Documentation_React.ReactElement;
  renderShortcutChord: (
    input: string,
    options: boolean,
  ) => Dom_Dom.ShortcutLabel[];
  REOPEN_FAILED_MESSAGE: string;
  REOPEN_FOCUS_HOLD_MS: number;
  reopenAfterFilesMigration: (
    why: string,
    restart?: boolean,
    message?: string,
    fallbackMessage?: string,
  ) => void;
  reopenForEditingTransition: (transition: "on" | "off") => void;
  replaceInlineFileWithPointer: (
    content: ModelCore_Model.DesignSystemContent,
    path: string,
    expectedValue: string,
    pointer: string,
    record: ModelCore_Model.StorageRecord,
  ) => ModelCore_Model.DesignSystemContent;
  replaceMarkdownTitle: (markdown: string, title: string) => string;
  replaceSectionHash: (section: string) => void;
  replaceTooltipBody: (
    body: Dom_React.ReactNode,
  ) => Dom_Overlays.TooltipBodyUpdate;
  reportAsyncError: (input: unknown) => void;
  reportBlobReadFailure: (url: string, bytes: number) => void;
  reportedAssetThumbnailFailures: Set<string>;
  reportedBlobReadFailures: Set<string>;
  reportedLinkWarnings: Set<string>;
  reportedPageAddressReasons: WeakMap<object, Set<string>>;
  reportedThemeErrors: Set<string>;
  reportHealthAndAnalytics: EditorRuntime_EditorRuntime.HealthAnalyticsReporter;
  reportLinkSanitizationDebug: (
    arg0: string,
    arg1: string,
    arg2: string,
  ) => void;
  reportMigrationAnalytics: (event: string) => void;
  reportMigrationCleanupPressed: (
    request: EditorRuntime_EditorRuntime.TrackedClaudeRequest,
    road: EditorRuntime_Application.ClaudeDeliveryRoad,
  ) => void;
  reportMigrationCleanupResult: (
    request: EditorRuntime_EditorRuntime.TrackedClaudeRequest,
    road: EditorRuntime_Application.ClaudeDeliveryRoad,
    outcome: EditorRuntime_Application.ClaudeDeliveryKind,
  ) => void;
  reportMigrationFailure: <
    Outcome extends {
      result: string;
      code?: unknown;
    },
  >(
    outcome: Outcome,
  ) => void;
  reportPublisherOutcome: (
    arg0: ModelStorage_Host.Publisher,
    arg1: (result: string) => void,
  ) => ModelStorage_Host.Publisher;
  reportThemeApplicationError: (themeId: string, error: unknown) => void;
  reportThemeErrorOnce: (message: string) => void;
  reportToHost: (state: string | null | undefined, reason?: boolean) => void;
  requestStoredDerivedRegeneration: () => void;
  requireFileWithinPrefix: (
    prefix: string,
    normalized: string | null,
    original: string,
  ) => string;
  RESERVED_MIGRATION_FILE_NAMES: string[];
  RESERVED_PROJECT_FILES_BY_TYPE: Record<
    FilesCore_FilesCore.FileArtifactType,
    string[]
  >;
  RESERVED_PROTOTYPE_NAMES: Set<string>;
  RESERVED_XML_NAMESPACES: string[];
  RESET_LABEL: string;
  resetAddressedFileLoadState: (
    state: EditorRuntime_EditorRuntime.AddressedLoadState,
  ) => void;
  resetCompositionSuppression: (
    event: Controls_C.CompositionKeyboardEvent,
  ) => void;
  ResetSheetContexts: (
    props0: Dom_React.PropsWithChildren,
  ) => Dom_React.ReactElement;
  resetSheetDragStyle: (input: HTMLElement) => void;
  ResetSkeletonContexts: (
    props: Interactions_React.PropsWithChildren,
  ) => Interactions_React.ReactElement;
  resetTooltipState: Dom_Overlays.TooltipBodyUpdate;
  RESIZE_DRAG_THRESHOLD_PX: number;
  RESIZE_KEYBOARD_LARGE_STEP_PX: number;
  RESIZE_KEYBOARD_STEP_PX: number;
  ResizeHandle: ControlsExtra_Controls.ForwardComponent<
    HTMLDivElement,
    ControlsExtra_Controls.ResizeHandleProps
  >;
  resizeHandleSideClasses: Record<
    NonNullable<"inline-start" | "inline-end" | "top" | "bottom" | undefined>,
    string
  >;
  resizeTextareaToContent: (
    textarea: Composition_Composition.TextEditorElement,
  ) => void;
  resizeTextAreaToContent: (
    input: HTMLTextAreaElement,
    options: Controls_React.RefObject<string>,
  ) => void;
  resolveAliasesBeforeTokenDeletion: (
    tokens: ModelCore_Model.NormalizedTokens,
    deletedNames: ReadonlySet<string>,
  ) => void;
  resolveAssetsCapability: () => Promise<ModelStorage_Storage.AssetsCapability | null>;
  resolveAssetStorageApi: (
    options: EditorRuntime_EditorRuntime.AssetFileUploadOptions,
  ) => Promise<EditorRuntime_EditorRuntime.AssetUploadApi | null>;
  resolveAssetUploadRoute: (
    options: EditorRuntime_EditorRuntime.AssetFileUploadOptions,
    file: EditorRuntime_EditorRuntime.AssetUploadApi | null,
  ) => EditorRuntime_EditorRuntime.AssetUploadRoute;
  resolveChildMergeSchema: (
    schema: FilesCore_FilesCore.MergeSchema,
    key: string,
    ...context: FilesCore_FilesCore.JsonMergeValue[]
  ) => FilesCore_FilesCore.MergeSchema;
  resolveClaudeDeliveryContext: (
    resolveSession?: () => Promise<EditorRuntime_EditorRuntime.SessionRoute | null>,
    resolveOwnerChat?: () => Promise<boolean | undefined> | boolean | undefined,
  ) => Promise<EditorRuntime_Application.ClaudeDeliveryContext>;
  resolveClaudeHotApi: () => PlatformHost_Host.HotCapability | null;
  resolveClaudeRoom: () => Promise<EditorRuntime_EditorRuntime.RoomCapability | null>;
  resolveClaudeSessionCapability: <T>(
    options: EditorRuntime_EditorRuntime.SessionRouteOptions,
    choose: (
      namespace: EditorRuntime_EditorRuntime.SessionSender,
      availability: unknown,
    ) => T,
  ) => Promise<T | null>;
  resolveColorTokenValue: (
    token: ModelCore_Model.ColorToken,
    themeId: string,
    tokens: ModelCore_Model.NormalizedTokens,
  ) => string | undefined;
  resolveConnectedRefElement: (
    arg0: Layers_React.RefObject<HTMLElement | null> | null | undefined,
  ) => HTMLElement | null;
  resolveContainerElement: (
    input?: Interactions_Interactions.ContainerInput,
  ) => Interactions_Interactions.ContainerElement | null;
  resolvedAssetFileBytes: (
    files: EditorRuntime_Model.FileTable,
    path: string,
    bytes?: number,
  ) => number;
  resolveDesignSystemFirstPaint: () => void;
  resolvedFontDataUrl: (font: EditorRuntime_Model.ParsedFont) => string;
  resolveExperimentalTheme: (
    configuration: Interactions_Interactions.ThemeConfiguration,
  ) => unknown;
  resolveFeatureFlagApi: () =>
    | EditorRuntime_EditorRuntime.FeatureFlagApi
    | undefined;
  resolveFilesMergeSchema: (
    schema: FilesCore_FilesCore.MergeSchema | undefined,
    key: string,
    ...context: FilesCore_FilesCore.JsonMergeValue[]
  ) => FilesCore_FilesCore.MergeSchema;
  resolveFileVersion: (path: string) => string | undefined;
  resolveFinalFocusTarget: (
    arg0: Layers_Layers.FocusableElement | null | undefined,
    arg1: HTMLElement | null | undefined,
  ) => Layers_Layers.FocusableElement | false;
  resolveIconSize: (
    size: Interactions_Controls.IconSize,
    densitySize: Interactions_Controls.ResolvedIconSize,
  ) => Interactions_Controls.ResolvedIconSize;
  resolveLocalFileReference: (arg0: string, arg1: string) => string | null;
  resolveMigratedReadonlyReason: (
    reason: string | undefined,
    access: Boot_Host.WriteAccess | undefined,
  ) => string | undefined;
  resolveOwnerChatCapability: (
    environment?: EditorRuntime_EditorRuntime.ClaudeEnvironment,
  ) => Promise<EditorRuntime_EditorRuntime.OwnerChatCapability | null>;
  resolvePassiveFinalFocus: (
    arg0: Layers_Layers.PopupFocus | null | undefined,
    arg1: Layers_Layers.FocusableElement | null,
  ) => Layers_Layers.FocusableElement | null;
  resolvePlatformWindow: (arg0?: Window) => Window | undefined;
  resolvePopoverAnchor: (
    state: Overlays_Overlays.PopoverAnchorState,
  ) => Element | null | "virtual";
  resolvePreviewLibraries: (
    declared: ModelCore_Model.DeclaredLibrary[],
    hasFile?: (path: string) => boolean,
    catalog?: ModelCore_ModelCore.PackagedLibrary[],
    allowCdn?: boolean,
  ) => {
    load: ModelCore_Model.LoadedLibrary[];
    fetch: ModelCore_Model.FetchLibrary[];
    missing: string[];
    missingFiles: string[];
  };
  resolvePreviewTheme: (
    themes: Preview_Preview.PreviewTheme[],
    hostMode: Preview_Preview.PreviewMode,
    selectedId?: string | null,
  ) => Preview_Preview.PreviewThemeResolution;
  resolvePromptSuggestion: (
    environment?: unknown,
  ) => ((prompt: string) => Promise<void>) | undefined;
  resolveSessionRoute: (
    options?: EditorRuntime_EditorRuntime.SessionRouteOptions,
  ) => Promise<EditorRuntime_EditorRuntime.SessionRoute | null>;
  resolveUserMethod: <Name extends keyof PlatformHost_Host.UserCapability>(
    name: Name,
  ) => Promise<PlatformHost_Host.UserCapability[Name] | undefined>;
  resolveWindow: (
    windowOverride?: Dom_Dom.MediaQueryWindow,
  ) => Dom_Dom.MediaQueryWindow | undefined;
  responseMimeType: (response: Response) => string;
  responsivePreviewHeight: (height: number, width: number) => number;
  restartDesignSystemWithFallback: (message?: string) => void;
  restartWithReloadFallback: (options: Boot_Boot.RestartFallback) => void;
  restoreDesignSystemView: (
    snapshot: unknown,
    host?: Pick<Window, "location" | "history" | "dispatchEvent">,
  ) => string[];
  restoreDialogStyleOverride: (
    state: Overlays_Overlays.DialogStyleOverride,
  ) => void;
  restoreFilesFromIndex: (
    index: FilesCore_FilesBoot.FilesIndex,
    files: ReadonlyMap<string, string>,
  ) => FilesCore_FilesCore.RestoredIndexedFiles;
  restoreFocusAfterRemoval: (
    element: HTMLElement,
    force?: boolean,
  ) => () => void;
  restorePassiveOverlayFocus: (
    arg0: Document,
    arg1: HTMLElement | null,
    arg2: Layers_Layers.FocusableElement,
    arg3: boolean,
  ) => void;
  restoreRenameFocus: (
    props: TokenEditors_TokenEditors.RenameFocusContext,
    committedName: string,
    originalName: string,
  ) => void;
  restoreReopenedFocus: (host: Window, focusId?: string) => void;
  restoreShrinkWrapWidth: (input: HTMLElement) => void;
  restrictedFileNameReason: (path: string) => string | undefined;
  retainedDerivedSystemDocuments: ModelStorage_Storage.RetainedDerivedSystem;
  retainedRemoteTextBlobIds: () => Set<string>;
  retainedSystemBlobIds: () => Set<string>;
  retainSwatchHead: (
    environment: object,
    head: EditorRuntime_EditorRuntime.PreviewRuntimeHead,
    onMissed?: (
      reference: EditorRuntime_EditorRuntime.SwatchUrlReference,
    ) => void,
  ) => string;
  retryAddressedFileSource: (
    state: EditorRuntime_EditorRuntime.AddressedLoadState,
    getSource?: EditorRuntime_EditorRuntime.FileSource,
  ) => boolean;
  retryAssetThumbnailAddress: (
    files: string,
    image: EditorRuntime_EditorRuntime.ThumbnailEvent | undefined,
    path: () => void,
    reason: () => void,
  ) => void;
  retryFileRead: <Result>(
    read: () => Result | Promise<Result>,
    timers?: Pick<FilesCore_FilesBoot.FilesTimers, "setTimeout">,
    onRetry?: (attempt: number, error: unknown) => void,
    delays?: readonly number[],
  ) => Promise<Result>;
  reuseStoredDocumentIdentity: (
    arg0: ReadonlyMap<string, ModelStorage_Storage.DatabaseRecord> | undefined,
    arg1: string,
    arg2: ModelStorage_Storage.DatabaseRecord,
  ) => ModelStorage_Storage.DatabaseRecord;
  REVEAL_SECTION_BY_KIND: Record<
    Application_Application.AssetRevealTarget["kind"],
    string
  >;
  RGB_GAMUT_TOLERANCE: number;
  rgbaHexColor: (color: ColorControls_ColorControls.HsvaColor) => string;
  rgbIsInGamut: (color: number[]) => boolean;
  rgbToOklch: (
    color: ColorControls_ColorControls.RgbaColor,
  ) => ColorControls_ColorControls.OklchColor;
  // CucCut: the host is globalThis.designSystemHost (packages/design-system/src/editor/design-system-host.ts), not globalThis.claude.
  roomApiOwner: EditorRuntime_EditorRuntime.ClaudeEnvironment["designSystemHost"];
  roomApiPromise:
    | Promise<EditorRuntime_EditorRuntime.RoomCapability | null>
    | undefined;
  roomPeerListenerStarted: boolean;
  roomPeers: readonly EditorRuntime_EditorRuntime.RoomPeer[];
  roomPeerStore: EditorRuntime_EditorRuntime.RoomPeerStore;
  roomPeerSubscribers: Set<() => void>;
  roomPeerUnsubscribe: (() => void) | null;
  roomWithSendCapability: (
    namespace: unknown,
  ) => EditorRuntime_EditorRuntime.SessionSender | null;
  ROOT_FONT_PROBE_ATTRIBUTE: string;
  ROOT_REM_PROBE_LENGTH_CSS: string;
  ROOT_REM_PROBE_STYLE: string;
  rootElementContext: Layers_React.Context<HTMLElement | undefined>;
  rootFontSizeProbe: () => HTMLDivElement;
  rootHtmlAttributes: string;
  rootPortalContainerContext: Layers_React.Context<Layers_Layers.PortalContainer>;
  rootRelativeHrefPattern: RegExp;
  rootRemProbeElement: HTMLDivElement | null;
  rootRemResizeObserver: ResizeObserver | null;
  rootRemSnapshot: () => number;
  rootRemSubscribers: Set<() => void>;
  roundScrubValue: (value: number, step: number) => number;
  ROW_CONTEXT_LONG_PRESS_MS: number;
  ROW_CONTEXT_MOVE_TOLERANCE_PX: number;
  RowContextMenu: TokenEditors_React.FunctionComponent<TokenEditors_TokenEditors.RowContextMenuProps>;
  rubberBandDistance: (distance: number, overshootRoom: number) => number;
  runDesignSystemFilesMigration: (
    storeHandle: Boot_Boot.NativeLegacyDatabase,
    changeKey: string,
    home?: "store" | "file",
  ) => Promise<void>;
  runShrinkWrapJobs: (input: Dom_Dom.ShrinkWrapJob[]) => void;
  runSingleFileMigrationBoot: (
    storeHandle: Boot_Boot.NativeLegacyDatabase,
    state: Boot_Boot.RawEnvelope,
  ) => Promise<void>;
  runWithTransition: <Value>(
    input: string,
    options: () => Promise<Value>,
  ) => Promise<Value>;
  SAFE_AREA_TOP_CSS: string;
  SAFE_DOCUMENT_ID_CHARACTER_PATTERN: RegExp;
  safeArtifactLabel: (value: unknown) => string;
  safeBoundedRemoteFileText: (
    input: unknown,
    length: number,
  ) => string | undefined;
  safeHandoffFileLabel: (fileName: string) => string;
  safeLinkUrlFromElement: (anchor: Element) => string;
  safeReopenSessionStorage: () => globalThis.Storage | undefined;
  safeReportSyncHealth: (
    arg0: ModelStorage_Storage.SyncHealthReporter,
    arg1: ModelStorage_Storage.HealthEvent,
  ) => void;
  safeSessionStorage: () => Storage | null;
  safeShadowPreviewStyle: (shadow: string) => TokenEditors_React.CSSProperties;
  sameFlagValueType: (value: unknown, fallback: unknown) => boolean;
  sameOriginFileFetcher: () => ModelStorage_Storage.RemoteTextFetch | undefined;
  sanitizeChangeMetadataText: (value: unknown) => string;
  sanitizeClaudeRequest: (text: string, limit: number) => string;
  sanitizeComponentGroupLabel: (text: string) => string;
  sanitizeCssBackground: (arg0: string) => string;
  sanitizedFileName: (value: string) => string;
  sanitizeHref: (arg0: string | undefined) => string | undefined;
  sanitizeMarkdownLine: (text: string) => string;
  sanitizeStoredReadmeCell: (input: string) => string;
  sanitizeUploadFileName: (filename: string) => string;
  SAVE_ERROR_HEALTH: Record<string, string>;
  SAVE_NOW_COMMAND: string;
  SAVE_STATES_WITH_CURRENT_ADDRESSES: Record<
    EditorRuntime_Application.ApplicationSaveState["status"],
    boolean
  >;
  SaveConflictBanners: (props: {
    doc: Partial<EditorRuntime_EditorRuntime.ConflictDocument>;
  }) => EditorRuntime_React.ReactElement | null;
  saveDownloadFile: (
    name: string,
    contents: string | Uint8Array,
    mimeType: string,
  ) => Promise<EditorRuntime_Application.ArtifactDownloadOutcome>;
  saveHealthOutcome: (
    arg0: string,
    arg1?: string,
  ) => ModelStorage_Storage.HealthEvent | null;
  SaveProblemStatus: (
    props: Composition_Composition.SaveStatusProps,
  ) => Composition_React.ReactNode;
  SaveStatusControl: (
    props: Composition_Composition.SaveStatusControlProps,
  ) => Composition_React.ReactNode;
  SaveStatusDot: (
    props: Composition_Composition.SaveStatusProps,
  ) => Composition_React.ReactNode;
  saveThroughShell: (
    name: EditorRuntime_EditorRuntime.ShellSaveData,
    bytes: string,
    options?: {
      request?: unknown;
    },
  ) => Promise<EditorRuntime_Application.ShellSaveResult>;
  scalarTokensForFamily: (
    tokens: ModelCore_Model.NormalizedTokens,
    family: ModelCore_ModelCore.ScalarKind,
  ) => ModelCore_Model.ScalarToken[];
  ScaledComponentPreview: Preview_React.FunctionComponent<Preview_Preview.ScaledComponentPreviewProps>;
  scheduleElementAnimationFrame: (
    input: HTMLElement,
    options: FrameRequestCallback,
  ) => (() => void) | null;
  schedulePreviewIdleTask: (callback: () => void) => () => void;
  scheduleShimmerSynchronization: (element: Element | null) => void;
  SCRIPT_TAG_ATTRIBUTE_PATTERN: RegExp;
  scrollDialogInputIntoView: (element: HTMLElement, input: HTMLElement) => void;
  scrollEditorCardIntoView: (
    element: HTMLElement,
    immediate?: boolean | "title",
  ) => void;
  scrollEditorElementIntoView: (element: HTMLElement | null) => void;
  scrubPrecision: (step: number) => number;
  searchEntryWords: (...words: (string | number | undefined)[]) => string[];
  searchSectionsAndFiles: (
    index: Application_Application.SearchEntry[],
    files: Application_Application.SearchEntry[] | undefined,
    query: string,
  ) => Application_Application.SearchResult;
  secondaryButtonFillClasses: string;
  secondaryIconCodepoints: Readonly<Record<string, number>> | undefined;
  secondaryIconGlyphs: Readonly<Record<string, number>>;
  SECTION_CARD_CLASS_NAME: string;
  SECTION_HEAD_INTERACTIVE_SELECTOR: string;
  SECTION_ICON_NAMES: Record<string, string>;
  SECTION_SCROLL_ANCHOR_HOLD_MS: number;
  SECTION_SCROLL_CANCEL_TIMEOUT_MS: number;
  SECTION_SCROLL_MARGIN_PX: number;
  SECTION_SCROLL_MIN_LEAD_PX: number;
  SECTION_SCROLL_TARGET_TIMEOUT_MS: number;
  SECTION_SCROLL_VIEWPORT_LEAD_RATIO: number;
  SECTION_TITLE_KEY_PATTERN: RegExp;
  SectionAddButton: TokenEditors_React.FunctionComponent<TokenEditors_TokenEditors.SectionAddButtonProps>;
  sectionAtScrollPosition: (
    sections: Application_Application.SectionPosition[],
    leadY: number,
    edge: Application_Application.ScrollEdge,
    wanted: string | null,
    viewport: Application_Application.ScrollViewport,
  ) => string | null;
  SectionCard: TokenEditors_React.FunctionComponent<TokenEditors_TokenEditors.SectionCardProps>;
  SectionCollapseButton: TokenEditors_React.FunctionComponent<TokenEditors_TokenEditors.SectionCollapseButtonProps>;
  sectionForFilePath: (path: string) => string;
  SectionHeader: TokenEditors_React.FunctionComponent<TokenEditors_TokenEditors.SectionHeaderProps>;
  sectionIconName: (id: string) => string;
  SectionNavigationRows: (
    props: Application_Application.NavigationRowsProps,
  ) => Application_React.ReactElement;
  SectionSearchField: (
    props: Application_Application.SectionSearchFieldProps,
  ) => Application_React.ReactElement;
  SectionSearchStatus: (
    props: Pick<
      Application_Application.NavigationSearchState,
      "query" | "result"
    >,
  ) => Application_React.ReactElement;
  sectionsForFilePaths: (paths: Iterable<string>) => Set<string>;
  SectionSheet: TokenEditors_React.FunctionComponent<TokenEditors_TokenEditors.SectionSheetProps>;
  sectionsThroughTarget: (sections: string[], target: string) => string[];
  sectionTitlesFromManifest: (
    manifestInput: string | ModelCore_ModelCore.ManifestObject,
  ) => Readonly<Record<string, string>>;
  SectionUsageNote: (props: {
    note: TokenEditors_React.ReactNode;
    edgeRef?: TokenEditors_React.Ref<HTMLDivElement>;
  }) => TokenEditors_React.ReactElement;
  SEGMENT_INDICATOR_SETTLE_FRAMES: number;
  SEGMENT_INDICATOR_SETTLE_MS: number;
  SEGMENT_TOOLTIP_DELAY_MS: number;
  SegmentedControl: (
    props: ControlsExtra_Controls.SegmentedControlProps,
  ) => ControlsExtra_React.ReactElement;
  segmentedControlFlexibleItemClasses: string;
  segmentedControlFullWidthItemClasses: string;
  segmentedControlIconAspectClasses: string;
  segmentedControlResizeObservers: WeakMap<
    Window,
    ControlsExtra_Controls.SegmentObserverEntry
  >;
  segmentedControlSegmentClasses: string;
  segmentedControlTextClasses: string;
  segmentedControlTextPaddingClasses: string;
  segmentedControlThumbClasses: string;
  segmentedControlVisualLayerClasses: string;
  Select: <Value extends string | number>(
    props: Controls_C.SelectProps<Value>,
  ) => Controls_React.ReactElement;
  SELECT_ELEMENT_SELECTOR: string;
  selectAssetByClick: (
    selection: EditorRuntime_Model.AssetSelection,
    order: string[],
    id: string,
    event: EditorRuntime_EditorRuntime.SelectionKeys,
  ) => EditorRuntime_Model.AssetSelection;
  selectAssetRange: (
    selection: EditorRuntime_Model.AssetSelection,
    order: string[],
    id: string,
  ) => EditorRuntime_Model.AssetSelection;
  selectedMarkdownBlockKinds: (
    root: HTMLElement,
  ) => FileBrowser_FileBrowser.MarkdownBlockKind[];
  selectedMarkdownStyles: (
    root: HTMLElement | null,
  ) => Documentation_Documentation.SelectionStyleState;
  SELECTION_TRUNCATION_NOTE_PATTERN: RegExp;
  SELECTION_TRUNCATION_NOTE_RESERVE: number;
  selectionTruncationNote: (length: number) => string;
  SelectJsx: typeof import("react/jsx-runtime");
  SelectOptionRow: (
    props: Controls_C.SelectOptionRowProps,
  ) => Controls_React.ReactElement;
  SelectReact: typeof Controls_React;
  selectRowSizes: Record<"lg" | "md", string>;
  selectTriggerClasses: string;
  SELF_PUBLISH_ERROR_CODE_SET: Set<string>;
  SELF_PUBLISH_PERMISSION_ERROR_CODES: string[];
  selfPublishAvailable: () => boolean;
  selfPublishInstalled: () => boolean;
  SEND_TO_CLAUDE_METHOD: "sendToClaudeSession";
  sendOrSuggestToClaude: (
    request: EditorRuntime_EditorRuntime.SessionRequest,
    available: object | null,
    environment?: unknown,
    copy?: (text: string) => Promise<boolean>,
  ) => Promise<"staged" | "unanswered" | "sent" | "copied" | "failed">;
  serializeAssetGroupMetadata: (
    metadata: ModelCore_Model.AssetGroupMetadata,
  ) => {
    order?: string[] | undefined;
    tile?: ModelCore_Model.AssetTileSize | undefined;
    name: string;
  }[];
  serializeDesignSystemManifest: (manifest: unknown) => string;
  serializedValuesEqual: (
    first: FilesCore_FilesCore.JsonMergeValue,
    second: FilesCore_FilesCore.JsonMergeValue,
  ) => boolean;
  serializeIndexDocument: (index: unknown) => string;
  serializeLastChange: (
    change: ModelCore_Model.LastChange | null,
  ) => Record<string, string> | undefined;
  serializeMarkdownEditor: (
    root: HTMLElement,
    blockModels?: (
      node: Element,
    ) => FileBrowser_FileBrowser.MarkdownSource | undefined,
  ) => string;
  serializeMarkdownInlineNode: (node: Node, previousTicks?: number) => string;
  serializeMarkdownInlineNodes: (nodes: readonly Node[]) => string;
  serializeMigrationIndex: (index: unknown) => string;
  serializeResolvedLibraries: (
    declared: ModelCore_Model.DeclaredLibrary[],
    resolved: ModelCore_Model.ResolvedLibraries,
    catalog?: ModelCore_ModelCore.PackagedLibrary[],
  ) => {
    file?: string | undefined;
    global?: string | undefined;
    name: string;
    version: string;
  }[];
  serializeSectionTitles: (
    titles: Readonly<Record<string, string>>,
  ) => Record<string, string> | undefined;
  serializeSingleBoxShadow: (
    shadow: TokenEditors_TokenEditors.SingleBoxShadow,
  ) => string;
  serializeStorageCatalog: (
    arg0: ModelStorage_StorageModel.StorageCatalog,
  ) => ModelStorage_Storage.SerializedStorageCatalog | undefined;
  serializeTokens: (tokens: ModelCore_Model.NormalizedTokens) => string;
  serverRootRemSnapshot: () => number;
  setAdditionalDocument: (
    content: ModelCore_Model.DesignSystemContent,
    path: string,
    markdown: string,
  ) => ModelCore_Model.DesignSystemContent;
  setAddressedVersionResolver: (resolver: () => string | undefined) => void;
  setAllowAllBinaryFilePointers: (enabled: boolean) => void;
  setAssetsTierState: (
    arg0: ModelStorage_Storage.AssetsTierState["state"],
    arg1?: string | null,
  ) => boolean;
  setAutosaveInstaller: (
    arg0?: (
      document: ModelStorage_Storage.SystemDocument,
      hold: () => boolean,
    ) => void,
  ) => void;
  setAutoSavingArtifactRuntime: (
    input: PlatformHost_Host.ActiveArtifactRuntime | undefined,
  ) => void;
  setColorTokenUsage: (
    content: ModelCore_Model.DesignSystemContent,
    name: string,
    usage: string,
  ) => ModelCore_Model.DesignSystemContent;
  setColorTokenValue: (
    content: ModelCore_Model.DesignSystemContent,
    name: string,
    themeId: string,
    value: unknown,
  ) => ModelCore_Model.DesignSystemContent;
  setComponentGuidelines: (
    content: ModelCore_Model.DesignSystemContent,
    componentName: string,
    markdown: string,
  ) => ModelCore_Model.DesignSystemContent;
  setDesignSystemFile: (
    content: ModelCore_Model.DesignSystemContent,
    path: string,
    value: string,
  ) => ModelCore_Model.DesignSystemContent;
  setDesignSystemReadme: (
    content: ModelCore_Model.DesignSystemContent,
    markdown: string,
  ) => ModelCore_Model.DesignSystemContent;
  setDocumentBootOptions: (
    arg0: Partial<
      ModelStorage_Host.DocumentOptions<ModelStorage_StorageModel.DesignSystemContent>
    >,
    arg1?: {
      instance?: boolean;
    },
  ) => void;
  setFileStorageRecord: (
    content: ModelCore_Model.DesignSystemContent,
    path: string,
    record: ModelCore_Model.StorageRecord,
  ) => ModelCore_Model.DesignSystemContent;
  setFileSystemDocumentFactory: (
    arg0: (
      parser: ModelStorage_Host.ArtifactParser<ModelStorage_StorageModel.DesignSystemContent>,
    ) => ModelStorage_Storage.SystemDocument,
  ) => void;
  setFileVersionResolver: (
    resolver: (path: string) => string | undefined,
  ) => void;
  setHeldFileBaseUrl: (baseUrl: string | undefined) => void;
  setLastChange: (
    content: ModelCore_Model.DesignSystemContent,
    change: ModelCore_ModelCore.LastChangeDraft,
  ) => ModelCore_Model.DesignSystemContent;
  setMergePropertySafely: (
    record: FilesCore_FilesCore.JsonRecord,
    key: string,
    value: FilesCore_FilesCore.JsonMergeValue,
  ) => void;
  setProtectedFilePathPredicate: (
    predicate: ((path: string) => boolean) | undefined,
  ) => void;
  setReactRef: <Value>(
    ref: Interactions_Dom.CallbackRef<Value>,
    value: Value | null,
  ) => void | Interactions_Dom.RefCleanup;
  setRemoteTextHydrator: (
    arg0: ModelStorage_Storage.RemoteTextHydrator | undefined,
  ) => void;
  setRemoteTextUploadedCallback: (arg0: (() => void) | undefined) => void;
  setRemoteTextUploadProblem: (arg0: string, arg1: string) => void;
  setRetainedBlobIdsProvider: (arg0: () => Iterable<string>) => void;
  setScalarTokenValue: (
    content: ModelCore_Model.DesignSystemContent,
    family: ModelCore_ModelCore.ScalarKind,
    name: string,
    value: unknown,
  ) => ModelCore_Model.DesignSystemContent;
  setSectionTitle: (
    content: ModelCore_Model.DesignSystemContent,
    key: string,
    title: string,
  ) => ModelCore_Model.DesignSystemContent;
  setShadowTokenValue: (
    content: ModelCore_Model.DesignSystemContent,
    name: string,
    themeId: string,
    value: unknown,
  ) => ModelCore_Model.DesignSystemContent;
  setSkeletonMotion: (
    input: HTMLElement,
    options: Controls_C.SkeletonMotion,
  ) => void;
  settleShrinkWrapJob: (
    input: Dom_Dom.ShrinkWrapJob,
    options: number | null,
  ) => void;
  setTokenFamilyNote: (
    content: ModelCore_Model.DesignSystemContent,
    family: ModelCore_ModelCore.ScalarKind,
    note: string,
    extraFamily?: string,
  ) => ModelCore_Model.DesignSystemContent;
  setTokenUsage: (
    content: ModelCore_Model.DesignSystemContent,
    family: ModelCore_ModelCore.ValueTokenKind,
    name: string,
    usage: string,
  ) => ModelCore_Model.DesignSystemContent;
  setTransformWillChange: (input: HTMLElement, options: boolean) => void;
  setTypographyFontFamily: (
    content: ModelCore_Model.DesignSystemContent,
    styleName: string,
    fontName: string,
  ) => ModelCore_Model.DesignSystemContent;
  setTypographyProperty: <K extends ModelCore_ModelCore.TypographyProperty>(
    content: ModelCore_Model.DesignSystemContent,
    styleName: string,
    property: K,
    value: unknown,
  ) => ModelCore_Model.DesignSystemContent;
  setTypographyStyleUsage: (
    content: ModelCore_Model.DesignSystemContent,
    name: string,
    usage: string,
  ) => ModelCore_Model.DesignSystemContent;
  setUnboundedFileParsing: (enabled: boolean) => void;
  sha256: (input: string | Uint8Array<ArrayBufferLike>) => Promise<string>;
  SHA256_ROUND_CONSTANTS: Uint32Array;
  sha256Hex: (arg0: Uint8Array<ArrayBuffer> | ArrayBuffer) => Promise<string>;
  sha256Integrity: (hexDigest: string) => string;
  sha256Sync: (input: string | Uint8Array<ArrayBufferLike>) => string;
  sha256TextEncoder: TextEncoder;
  ShadowPropertyEditor: (
    props: Composition_Composition.ShadowPropertyEditorProps,
  ) => Composition_React.ReactNode;
  shadowScaleForEditor: (
    tokens: EditorRuntime_Model.NormalizedTokens,
  ) => EditorRuntime_Application.ApplicationView["shadows"];
  ShadowsSection: TokenEditors_React.FunctionComponent<TokenEditors_TokenEditors.ShadowsSectionProps>;
  ShadowTokenRow: TokenEditors_React.FunctionComponent<TokenEditors_TokenEditors.ShadowTokenRowProps>;
  ShadowValueCell: TokenEditors_React.FunctionComponent<TokenEditors_TokenEditors.ShadowValueCellProps>;
  ShadowValueEditor: TokenEditors_React.FunctionComponent<TokenEditors_TokenEditors.ShadowValueEditorProps>;
  shadowValueForTheme: (
    token: ModelCore_Model.ShadowToken,
    themeId: string,
    tokens: ModelCore_Model.NormalizedTokens,
  ) => string;
  sharedPreviewFramePool: EditorRuntime_EditorRuntime.PreviewFramePool | null;
  SHEET_CONTROL_HELD_ATTRIBUTE: string;
  SHEET_COVERED_ATTRIBUTE: string;
  SHEET_DENSITY: Dom_Overlays.Density;
  SHEET_DISMISS_TRANSLATE_CSS: string;
  SHEET_DRILLED_ATTRIBUTE: string;
  SHEET_DURATION_CLASS: string;
  SHEET_IMPLEMENTATION_WAIT_MS: number;
  SHEET_PEELING_ATTRIBUTE: string;
  SHEET_PENDING_ATTRIBUTE: string;
  SHEET_PRESSED_ATTRIBUTE: string;
  SHEET_SCROLL_ATTRIBUTE: string;
  SHEET_TREE_CLOSING_ATTRIBUTE: string;
  SHEET_UNCOVER_CLOSE_GRACE_MS: number;
  sheetBackdropClasses: string;
  SheetBody: (
    props: Interactions_Interactions.SheetBodyProps,
  ) => Interactions_React.ReactElement;
  SheetChrome: Interactions_Interactions.SheetChrome;
  sheetClipClasses: string;
  sheetContentCanGrow: (element: Element) => boolean;
  SheetContextProvider: (props0: {
    value: Dom_Overlays.SheetPopupResult<Dom_Overlays.OverlayEventDetails>;
    children?: Dom_React.ReactNode;
  }) => Dom_React.ReactElement;
  sheetCoverContext: Dom_React.Context<((token: object) => () => void) | null>;
  SheetDismissButton: Interactions_Controls.ForwardComponent<
    HTMLElement,
    Interactions_Interactions.SheetDismissButtonProps
  >;
  sheetDragSettings: Dom_Dom.SheetDragSettings;
  sheetDrillBodyClasses: string;
  sheetFrameContext: Dom_React.Context<Dom_Overlays.SheetFrameContext | null>;
  SheetHandle: (
    props: Interactions_Interactions.SheetHandleProps,
  ) => Interactions_React.ReactElement;
  sheetImplementationFailed: boolean;
  sheetImplementationGeneration: number;
  sheetImplementationPromise: Promise<Layers_Overlays.MobileSheetParts | null> | null;
  sheetImplementationRequests: number;
  sheetImplementationSubscribers: Set<() => void>;
  sheetImplementationUnavailable: boolean;
  sheetImplementationWaiters: Set<() => void>;
  sheetOverflowBackgroundClasses: string;
  sheetParentContext: Dom_React.Context<Dom_Dom.SheetParentState | null>;
  sheetPopupClasses: string;
  SheetPopupHost: (props: {
    children(
      state: Interactions_Interactions.SheetPopupHostState,
    ): Interactions_React.ReactNode;
  }) => Interactions_React.ReactNode;
  sheetPositioningOverrides: {
    disableAnchorTracking: boolean;
    collisionAvoidance: {
      side: "none";
      align: "none";
    };
  };
  sheetRadiusClasses: string;
  sheetSeparatorClasses: string;
  sheetStateContext: Dom_React.Context<Dom_Dom.SheetState>;
  SheetTitleBar: (
    props: Interactions_Interactions.SheetTitleBarProps,
  ) => Interactions_React.ReactElement | null;
  sheetTransitionClasses: string;
  SHELL_BINARY_DOWNLOAD_EXTENSIONS: Set<string>;
  SHELL_DIRECT_DOWNLOAD_EXTENSIONS: Set<string>;
  shellSaveErrorCode: (error: unknown) => string;
  shimmerStartTimes: WeakMap<Document, number>;
  Shortcut: (props0: Dom_Dom.ShortcutProps) => Dom_React.ReactElement;
  SHORTCUT_KEY_NAMES: Record<string, string | [string, string]>;
  SHORTCUT_MODIFIER_LABELS: string[];
  SHORTCUT_MODIFIER_NAMES: Record<string, [string, string]>;
  SHORTCUT_MODIFIER_SEPARATOR: string;
  SHORTCUT_SEQUENCE_SEPARATOR: string;
  SHORTCUT_SPOKEN_REPLACEMENTS: [RegExp, string, string][];
  shortcutKeycapClasses: string;
  shortcutModifierNames: Dom_Dom.ShortcutModifier[];
  shortcutModifierOrder: Dom_Dom.ShortcutModifier[];
  shortcutTextKeyClasses: string;
  shortcutToAriaKeyShortcuts: (
    input: string,
    options: boolean,
  ) => string | undefined;
  shortcutVariantClasses: Record<"keycap" | "text", string>;
  shortDebugValue: (value: string | null | undefined) => string;
  shortHotErrorMessage: (error: unknown) => string;
  shouldAllowPopupPointerFocus: (
    arg0: Layers_React.MouseEvent<HTMLElement>,
    arg1?: {
      draggable?: boolean;
    },
  ) => boolean;
  shouldAnnounceMigrationTooLarge: () => boolean;
  shouldHandleLinkWithRouter: (arg0: Layers_Layers.LinkCandidate) => boolean;
  shouldOfferMigrationCleanup: (
    state: EditorRuntime_EditorRuntime.MigrationStatus,
    enabled: boolean,
  ) => boolean;
  shouldRecomputeShrinkWrap: (input: Dom_Dom.ShrinkWrapRecompute) => boolean;
  shouldSuppressCompositionEnter: (
    input: Controls_C.CompositionEnterEvent,
  ) => boolean;
  shouldSuppressModalCatcherFocus: (
    input: HTMLElement,
    options: EventTarget | null,
  ) => boolean;
  shouldUseDesktopShowcaseWidth: (
    metadata: ModelCore_Model.ComponentCardMetadata,
    name: string,
  ) => boolean;
  shouldUseSheetPresentation: (
    mode: Dom_Dom.OverlayPresentation,
    anchored: boolean,
    mobileCoarsePointer: boolean,
  ) => boolean;
  showActionToast: (
    text: string,
    action: Composition_React.ReactNode,
    onClose?: () => void,
  ) => number;
  showEditorNotification: (message: string, options?: number) => void;
  showEditorPromiseNotification: (
    promise: string,
    options: TokenEditors_React.ReactNode,
  ) => number;
  showPreviewStaticNotice: () => void;
  showToast: (text: string, durationMs?: number) => number;
  SHRINK_WRAP_ATTRIBUTE: string;
  SHRINK_WRAP_MAX_ITERATIONS: number;
  SHRINK_WRAP_MAX_LINE_RECTS: number;
  SHRINK_WRAP_STYLE_PROPERTY: "maxWidth";
  ShrinkWrap: Dom_React.ForwardRefExoticComponent<
    Dom_React.ComponentPropsWithoutRef<"div"> &
      Dom_Dom.ShrinkWrapOptions &
      Dom_React.RefAttributes<HTMLDivElement>
  >;
  shrinkWrapAtomicTags: Set<string>;
  shrinkWrapBaselineWidths: WeakMap<HTMLElement, string>;
  shrinkWrapLayoutImproved: (
    input: Dom_Dom.ShrinkWrapLayout,
    options: Dom_Dom.ShrinkWrapLayout,
  ) => boolean;
  shrinkWrapLayoutWorsened: (
    input: Dom_Dom.ShrinkWrapLayout,
    options: Dom_Dom.ShrinkWrapLayout,
  ) => boolean;
  shrinkWrapQueues: WeakMap<Window, Dom_Dom.ShrinkWrapQueue>;
  shrinkWrapResizeObservers: WeakMap<
    Dom_Dom.BrowserWindow,
    Dom_Dom.ShrinkWrapResizeStore
  >;
  shrinkWrapSynchronously: (input: HTMLElement) => number | null;
  shrinkWrapWindowResizeStores: WeakMap<
    EventTarget,
    Dom_Dom.ShrinkWrapLoadingStore
  >;
  shrinkWrapWrittenWidths: WeakMap<HTMLElement, string>;
  SIDEBAR_MEDIA_QUERY: string;
  SidebarSectionNavigation: (
    props: Application_Application.NavigationProps,
  ) => Application_React.ReactElement;
  SidePanelContext: ColorControls_React.Context<ColorControls_ColorControls.SidePanelState | null>;
  SidePanelHost: () => ColorControls_React.ReactElement | null;
  SidePanelHostContext: ColorControls_React.Context<ColorControls_ColorControls.SidePanelHostState | null>;
  SidePanelProvider: (
    props: ColorControls_React.PropsWithChildren,
  ) => ColorControls_React.ReactElement;
  SINGLE_FILE_ACTION_REASON: string;
  SINGLE_FILE_MIGRATION_BACKUP_PATH: string;
  SINGLE_FILE_MIGRATION_PUBLISH_SPACING_MS: number;
  SINGLE_FILE_MOVE_NOTE_PREFIX: string;
  SINGLE_FILE_REOPEN_WATCHDOG_MS: number;
  SINGLE_FILE_REPLACEMENT_CHARACTER: string;
  SINGLE_FILE_SYNTHETIC_META_FIELD: string;
  singleCharacterKeycapClasses: string;
  singleFileMigrationBootExit: Boot_Boot.MigrationBootExit;
  singleFileMigrationBootHeld: boolean;
  singleFileMigrationExit: (
    outcome: Boot_Boot.MigrationOutcome,
    indexState: string,
  ) => Boot_Boot.MigrationExit;
  singleFileMigrationHolder: () => string;
  singleFileMigrationRunning: boolean;
  singleLineTooltipClasses: string;
  Skeleton: (props: Controls_C.SkeletonProps) => Controls_React.ReactElement;
  SKELETON_ANIMATION_DURATION_MS: number;
  SKELETON_BREATHE_ANIMATION: string;
  SKELETON_DURATION_LIMIT_MS: number;
  SKELETON_MINIMUM_HOLD_MS: number;
  SKELETON_SWEEP_ANIMATION: string;
  SKELETON_SYNC_TOLERANCE_MS: number;
  skeletonActiveContext: Interactions_React.Context<boolean>;
  skeletonAnimationStartTimes: WeakMap<Document, number>;
  SkeletonBlock: (
    props: Controls_C.SkeletonBlockProps,
  ) => Controls_React.ReactElement;
  SkeletonChip: (
    props: Controls_C.SkeletonChipProps,
  ) => Controls_React.ReactElement;
  skeletonElementContext: Interactions_React.Context<Interactions_Controls.SkeletonTag>;
  skeletonElementTags: Record<Controls_C.SkeletonTag, Controls_C.SkeletonTag>;
  SkeletonGroup: (
    props: Controls_C.SkeletonGroupProps,
  ) => Controls_React.ReactElement;
  skeletonGroupContext: Interactions_React.Context<number | null>;
  skeletonIconRowWidths: number[];
  SkeletonLines: (
    props: Controls_C.SkeletonLinesProps,
  ) => Controls_React.ReactElement;
  skeletonLineWidths: string[];
  skeletonNotShownSnapshot: Controls_C.SkeletonSnapshot;
  SkeletonPrimitive: Controls_C.SkeletonComponent;
  SkeletonRows: (
    props: Controls_C.SkeletonRowsProps,
  ) => Controls_React.ReactElement;
  skeletonShownSnapshot: Controls_C.SkeletonSnapshot;
  skeletonShownStoreContext: Interactions_React.Context<Interactions_Controls.SkeletonShownStore | null>;
  skeletonTextRowWidths: number[];
  skipBalancedTypeExpression: (text: string, start: number) => number;
  skipHtmlPreamble: (html: string) => number;
  skipMigrationForTab: () => void;
  SLIDES_FONT_GUIDANCE: string;
  snapScrubValue: (
    value: number,
    step: number,
    origin?: number | null,
  ) => number;
  snapshotDesignSystemView: (
    flagged: Iterable<string>,
    host?: Pick<Window, "location" | "history" | "dispatchEvent">,
  ) => FilesCore_FilesCore.CarriedView;
  sniffDataUriKind: (arg0: string, arg1: string) => null | string;
  SOLID_FILL_ICON: ColorControls_ColorControls.PropertyIconDefinition;
  SOLID_STROKE_ICON: ColorControls_ColorControls.PropertyIconDefinition;
  solidBadgeColorClasses: Record<Controls_C.AccentColor, string>;
  solidBadgeVariantClasses: Record<Controls_C.BadgeVariant, string>;
  sortedSampleQuantile: (
    sortedSamples: readonly number[],
    quantile: number,
  ) => number;
  sortIndexDocumentKeys: (value: unknown, root: boolean) => unknown;
  sortJsonObjectKeys: (arg0: string, arg1: unknown) => unknown;
  SOURCE_DOCUMENT_ID: string;
  SPACING_ICON: ColorControls_ColorControls.PropertyIconDefinition;
  Spinner: (
    props: Overlays_Overlays.SpinnerProps,
  ) => Overlays_React.ReactElement | null;
  splitBoxShadowLayers: (shadow: string) => string[];
  splitFilePublishBatches: (
    entries: FilesCore_FilesBoot.FilePublishEntries,
    isIndex?: (path: string) => boolean,
    maxBytes?: number,
    maxEntries?: number,
  ) => FilesCore_FilesBoot.FilePublishEntries[];
  splitMigrationPublishBatches: (
    entries: Migration_Model.FilePublishEntries,
  ) => Migration_Model.FilePublishEntries[];
  splitTokenName: (name: string) => string[];
  splitTypeExpression: (text: string, separator: string) => string[];
  spokenShortcut: (shortcut: string, isMac: boolean) => string;
  srgbToLinearChannel: (channel: number) => number;
  stackVirtualFileRows: (
    heights: readonly number[],
  ) => FileBrowser_FileBrowser.VirtualFileStack;
  stampLocalSystemLastChange: (
    arg0: ModelStorage_Storage.DatabaseRecord,
  ) => void;
  STANDALONE_CONSUMPTION_GUIDANCE: string;
  STANDALONE_MIGRATION_HEADING: string;
  STANDALONE_MIGRATION_PREFIXES: [string, string];
  startEmptyFilesDesignSystem: (
    storeHandle: Boot_Boot.NativeLegacyDatabase,
  ) => Promise<"created" | "unsure" | "exists" | "store" | "no">;
  STARTER_SECTION_IDS: string[];
  starterSectionState: (
    emptySections: ReadonlySet<string>,
    editable: boolean,
    assetsEmpty: boolean,
    hasStarter?: boolean,
  ) => {
    hint: boolean;
    starter: Set<string>;
  };
  startRoomPeerListener: () => void;
  stateEnvelopeTitle: (envelope: Boot_Boot.RawEnvelope) => string | undefined;
  STATIC_PREVIEW_NOTE: string;
  STATIC_PREVIEW_NOTICE: string;
  staticPreviewDocumentHtml: (
    html: string,
    head: EditorRuntime_EditorRuntime.PreviewRuntimeHead,
  ) => string;
  StaticPreviewFrame: EditorRuntime_React.FunctionComponent<EditorRuntime_EditorRuntime.StaticPreviewFrameProps>;
  StickyComponentNote: (props: {
    children: EditorRuntime_React.ReactNode;
    reserve: EditorRuntime_React.CSSProperties;
  }) => EditorRuntime_React.ReactElement;
  stopAssetInputKeyPropagation: (
    event: EditorRuntime_React.SyntheticEvent<HTMLElement>,
  ) => void;
  stopFileDropEvent: (event: TokenEditors_React.DragEvent<HTMLElement>) => void;
  STORAGE_BLOB_URL_PATTERN: RegExp;
  STORAGE_MIME_TYPE_PATTERN: RegExp;
  STORAGE_SHA256_PATTERN: RegExp;
  storageCatalogFromManifest: (
    arg0: unknown,
    arg1?: ModelStorage_StorageModel.ParseReport,
  ) => ModelStorage_StorageModel.StorageCatalog;
  storageKindForFile: (
    path: string,
    content: string,
  ) => "blob" | "file" | "inline";
  storagePointerForFile: (
    path: string,
    content: string,
  ) => ModelCore_Model.StoragePointer | null;
  storageRecordForFile: (
    arg0: ModelStorage_StorageModel.FileTable,
    arg1: ModelStorage_StorageModel.StorageCatalog,
    arg2: string,
  ) => ModelStorage_StorageModel.StorageRecord | null;
  storageRecordFromRemoteFile: (
    arg0: ModelStorage_Storage.RemoteFileRecord,
  ) => ModelStorage_StorageModel.StorageRecord;
  STORE_FOLD_DEBOUNCE_MS: number;
  STORE_FOLD_MAX_RETRIES: number;
  STORE_FOLD_PUBLISH_SPACING_MS: number;
  STORE_FOLD_RETRY_DELAY_MS: number;
  STORE_META_LOADING_NOTICE_MS: number;
  STORE_META_READ_TIMEOUT_MS: number;
  STORE_META_RETRY_MS: number;
  STORE_MODE_DECISION_TIMEOUT_MS: number;
  STORED_CODE_MIME_TYPES: Record<string, string>;
  STORED_EXTERNAL_LINK_PATTERN: RegExp;
  STORED_FILES_GUIDANCE_HEADING: string;
  STORED_README_CODE_DELIMITER: string;
  STORED_TEXT_MIME_TYPES: Record<string, string>;
  storedBlobPattern: RegExp;
  storedContentByteLength: (arg0: string, arg1: string) => number;
  storedContentType: (arg0: string, arg1?: string) => string | null;
  storedFileByteLimit: (arg0: string | null) => number;
  storedFileEncoder: TextEncoder;
  storedFileKind: (arg0: string) => ModelStorage_Storage.StoredFileKind;
  storedMimeTypeForPath: (arg0: string, arg1?: string) => string | null;
  storeDocumentDataMap: (
    snapshot: Migration_Migration.StoreSnapshot,
  ) => Map<string, Record<string, unknown>>;
  storeDocumentDigestView: (
    document: Migration_Model.FilesMigrationStoreDocument,
    adapter?: Pick<Migration_Migration.MigrationAdapter, "digestView">,
  ) => Record<string, unknown>;
  storedPathBasename: (path: string) => string;
  storedReadmeCodeSpan: (input: string) => string;
  storedSystemDocumentFactory:
    | ((
        parser: ModelStorage_Host.ArtifactParser<ModelStorage_StorageModel.DesignSystemContent>,
      ) => ModelStorage_Storage.SyncedSystemDocument)
    | undefined;
  storedSystemMigrationFlags: ModelStorage_Storage.StoredSystemFlags;
  storedSystemStatus: ModelStorage_Storage.StoredSystemStatus;
  storedSystemStatusSubscribers: Set<() => void>;
  storeFoldFileComparison: (
    context: Migration_Migration.FoldContext,
    projectPath: string,
    relative: string,
    recordedSha?: string,
  ) => Promise<string>;
  storeFoldKeptFilesMessage: (
    kept: readonly Boot_Boot.FoldKeptFile[],
  ) => string;
  storeMetaFaultCode: (input: unknown) => string;
  storePathHasPrefix: (parts: string[], prefix: string[]) => boolean;
  storePathParts: (path: string) => string[];
  storeReadAccessLevel: (
    path: string,
    rules: Migration_Migration.DatabaseRule[],
  ) => string;
  stringFileOrNull: (
    files: Documentation_Core.FileTable,
    path: string,
  ) => string | null;
  stringifyInlineJson: (value: unknown) => string;
  stringifyManifestWithinBudget: (manifest: unknown) => string;
  stringifyMarkdownValue: (value?: unknown) => string;
  stringOrUndefined: (input: unknown) => string | undefined;
  stripAddDialogNamespace: (name: string, namespace: string) => string;
  stripArtifactScopeFragment: (artifact: string) => string;
  stripConditionalCssRules: (css: string) => string;
  stripCssComments: (css: string) => string;
  stripEditingOffFromStashedIndex: (
    stash: FilesCore_FilesBoot.FilesCrashStash,
    indexPath: string,
  ) => FilesCore_FilesBoot.FilesCrashStash;
  stripFrameRuntimeBlock: (html: string) => string;
  stripGeneratedReadmeTail: (readme: string) => string;
  stripMatchingComponentHeading: (markdown: string, name: string) => string;
  stripThemeSuffixFromColorLabel: (
    label: string,
    theme: TokenEditors_Model.ColorTheme,
    themes: TokenEditors_Model.ColorTheme[],
  ) => string;
  stripTokenNamespace: (name: string, namespace: string) => string;
  stripTypeComments: (text: string) => string;
  STUCK_SAVE_REASON_MESSAGES: Record<string, string>;
  StuckSaveBanner: (props: {
    doc: EditorRuntime_EditorRuntime.ConflictDocument;
    stuck: EditorRuntime_EditorRuntime.StuckSave;
  }) => EditorRuntime_React.ReactElement;
  submenuStateContext: Interactions_React.Context<Interactions_Overlays.MenuItemState>;
  subscribeAddressedFileEntries: (listener: () => void) => () => void;
  subscribeAddressedFiles: (listener: () => void) => () => void;
  subscribeAppleKeyboardNoop: (listener: () => void) => () => void;
  subscribeAssetsState: (arg0: () => void) => () => void;
  subscribeAssetThumbnailSources: (listener: () => void) => () => void;
  subscribeBlobResources: (listener: () => void) => () => void;
  subscribeCoarsePointer: (
    listener: () => void,
    windowOverride?: Dom_Dom.MediaQueryWindow,
  ) => () => void;
  subscribeFileAvailability: (input: () => void) => () => boolean;
  subscribeFontNoop: Dom_Dom.ExternalStore<
    Dom_Dom.DocumentFont | undefined
  >["subscribe"];
  subscribeHostSaveChrome: (listener: () => void) => () => void;
  subscribeHydration: (listener: () => void) => () => void;
  subscribeInsetNoop: (listener: () => void) => () => void;
  subscribeLiveAnnouncements: (
    input: ControlsExtra_Controls.AnnouncementListener,
  ) => () => void;
  subscribeNoop: Dom_Dom.ExternalStore<boolean>["subscribe"];
  subscribePassiveOpenNoop: (listener: () => void) => () => void;
  subscribePlatformNoop: (listener: () => void) => () => void;
  subscribePreviewPoolNoop: () => () => void;
  subscribePreviewStaticNotice: (listener: () => void) => () => void;
  subscribePublishedPreviewCache: (listener: () => void) => () => void;
  subscribePublishedPreviewToSaveState: (
    document2: Pick<
      EditorRuntime_Application.ApplicationDocument,
      "saveState" | "subscribeSave"
    >,
    cache?: EditorRuntime_EditorRuntime.PublishedPreviewCache,
  ) => () => void;
  subscribeRemoteTextProblems: (arg0: () => void) => () => void;
  subscribeRootCoarsePointer: (listener: () => void) => () => void;
  subscribeRootRemSize: (listener: () => void) => () => void;
  subscribeSheetImplementation: (arg0: () => void) => () => void;
  subscribeShrinkWrapWindowResize: (
    input: EventTarget | undefined,
    options: () => void,
  ) => () => void;
  subscribeStoredSystemStatus: (arg0: () => void) => () => void;
  subscribeToasts: (
    listener: (toasts: Composition_Composition.QueuedToast[]) => void,
  ) => () => void;
  suggestPromptOrCopy: (
    prompt: string,
    environment?: unknown,
    copy?: (text: string) => Promise<boolean>,
  ) => Promise<"sent" | "copied" | "failed">;
  summarizeChangedFileNames: (names: string[]) => string;
  summarizeConflictNames: (paths: readonly string[]) => string;
  summarizeFileNames: (paths: readonly string[]) => string;
  summarizeMarkdownParagraph: (lines: string[]) => string;
  summarizeUploadItems: <T>(items: T[], label: (item: T) => string) => string;
  supportedFonts: Record<Dom_Dom.DocumentFont, boolean>;
  supportsBooleanInert: boolean;
  supportsDroppedPaths: (document: { dropPaths?: unknown }) => boolean;
  supportsElementAnimations: (input: Element) => boolean;
  supportsFilesPublish: (
    value: unknown,
  ) => value is FilesCore_FilesCore.FilesPublishCapability;
  supportsLivePreviewUrls: () => boolean;
  supportsNativeFieldSizing: boolean;
  supportsSelfPublish: (
    value: unknown,
  ) => value is PlatformHost_Host.SelfCapability;
  supportsShellSave: (
    capability: unknown,
  ) => capability is EditorRuntime_EditorRuntime.DownloadCapability;
  suppressedCompositionEvents: WeakSet<Event>;
  suppressEnterClicksUntilRelease: () => void;
  suppressFollowupCompositionLineBreak: (
    input: Event,
    options: EventTarget,
    context: () => void,
  ) => void;
  suppressRepeatedEnterClicks: (down: boolean) => () => void;
  Surface: Controls_C.ForwardComponent<HTMLDivElement, Controls_C.SurfaceProps>;
  SURFACE_COLOR_TOKEN_PATTERNS: RegExp[];
  surfaceBackgroundClasses: Record<
    Interactions_Controls.SurfaceBackground,
    string
  >;
  surfaceBackgroundContext: Layers_React.Context<string | undefined>;
  surfaceTokenNames: Set<string>;
  suspendPreviewRunner: (environment?: object) => void;
  SVG_ATTRIBUTE_PATTERN: RegExp;
  SVG_DOCTYPE_PATTERN: RegExp;
  SVG_MIME_TYPE: string;
  SVG_NAMESPACE_GE0: string;
  SVG_XML_DECLARATION_PATTERN: RegExp;
  SWATCH_ATTRIBUTE: string;
  SWATCH_ERROR_MESSAGE: string;
  SWATCH_FAILED_ATTRIBUTE: string;
  SWATCH_HEAD_REGISTRY_GLOBAL: string;
  SWATCH_HEAD_SEQUENCE_GLOBAL: string;
  SWATCH_LOCAL_URL_PATTERN: RegExp;
  SWATCH_NAVIGATING_MESSAGE: string;
  SWATCH_PIECE_ATTRIBUTE: string;
  SWATCH_PLACED_ATTRIBUTE: string;
  SWATCH_REACT_ERROR_MESSAGE: string;
  SWATCH_READY_MESSAGE: string;
  SWATCH_RUNTIME_TAG_URL_PATTERN: RegExp;
  SWATCH_SHA256_INTEGRITY_PATTERN: RegExp;
  SWATCH_SHA384_INTEGRITY_PATTERN: RegExp;
  SWATCH_THEME_ID_PATTERN: RegExp;
  SwatchButton: ColorControls_React.FunctionComponent<ColorControls_ColorControls.SwatchButtonProps>;
  swatchColorKey: (color: string) => string;
  swatchContentHash: (text: string) => string;
  swatchDocumentHtml: (
    html: string,
    head: EditorRuntime_EditorRuntime.PreviewRuntimeHead,
    headId: string,
    holdFonts?: boolean,
  ) => string;
  SwatchDot: ColorControls_React.FunctionComponent<ColorControls_ColorControls.SwatchDotProps>;
  swatchHeadKey: (
    head: EditorRuntime_EditorRuntime.PreviewRuntimeHead,
  ) => string;
  swatchHeadKeyCache: WeakMap<
    EditorRuntime_EditorRuntime.PreviewRuntimeHead,
    string
  >;
  swatchHeadPieceReference: (
    head: EditorRuntime_EditorRuntime.PreviewRuntimeHead,
    piece: string | number,
  ) => EditorRuntime_EditorRuntime.SwatchUrlReference | undefined;
  swatchHeadPiecesScript: (
    id: string,
    pieces: readonly EditorRuntime_EditorRuntime.HeadScriptPiece[],
    withUrlFallback: boolean,
  ) => string;
  swatchHeadPlacement: (
    urls: EditorRuntime_EditorRuntime.PreviewRuntimeUrls | undefined,
    headId: string,
    holdFonts: boolean,
  ) => {
    head: string;
    body: string;
  };
  swatchHeadRegistry: (
    environment: object,
  ) => Map<string, EditorRuntime_EditorRuntime.SwatchHeadEntry>;
  swatchHeadScript: (
    id: string,
    pieces?: "all" | readonly EditorRuntime_EditorRuntime.HeadScriptPiece[],
    withUrlFallback?: boolean,
  ) => string;
  swatchHeadsEqual: (
    left: EditorRuntime_EditorRuntime.PreviewRuntimeHead,
    right: EditorRuntime_EditorRuntime.PreviewRuntimeHead,
  ) => void;
  swatchHeadWithHeldFonts: (
    head: EditorRuntime_EditorRuntime.PreviewRuntimeHead,
    changes: string,
    heldFonts?: (url: string) => boolean,
  ) => EditorRuntime_EditorRuntime.SwatchHeadUrls;
  swatchHtmlAttributes: (
    head: EditorRuntime_EditorRuntime.PreviewRuntimeHead,
  ) => string;
  swatchLabel: (swatch: ColorControls_ColorControls.ColorSwatch) => string;
  swatchLabelIsColor: (
    swatch: ColorControls_ColorControls.ColorSwatch,
  ) => boolean;
  SwatchPalette: ColorControls_React.FunctionComponent<ColorControls_ColorControls.SwatchPaletteProps>;
  swatchPreviewStyle: (
    input: string | undefined,
  ) => ColorControls_React.CSSProperties | undefined;
  swatchPublishedPieceTag: (
    piece: string | number,
    reference: EditorRuntime_EditorRuntime.SwatchUrlReference,
  ) => string | undefined;
  swatchRequiresPageAddress: (
    environment: object,
    options: EditorRuntime_EditorRuntime.LiveSwatchOptions,
  ) => boolean;
  swatchRuntimeKey: (
    head: EditorRuntime_EditorRuntime.PreviewRuntimeHead,
  ) => string;
  swatchRuntimeKeyCache: WeakMap<
    EditorRuntime_EditorRuntime.PreviewRuntimeHead,
    string
  >;
  swatchRuntimeTagHtml: (tag: EditorRuntime_Model.SwatchRuntimeTag) => string;
  Switch: Controls_C.ForwardComponent<HTMLElement, Controls_C.SwitchProps>;
  SWITCH_KNOB_CLASS: string;
  SWITCH_KNOB_SIZE_CLASS: string;
  SWITCH_TRACK_CLASS: string;
  SWITCH_TRACK_SIZE_CLASS: string;
  symbolicColorPattern: RegExp;
  SYNC_FILE_ERROR_CLASSIFICATIONS: Record<string, string>;
  SYNC_FILE_INPUT_ERROR_CLASSIFICATIONS: Record<string, string>;
  SYNC_HOST_ERROR_CLASSIFICATIONS: Record<string, string>;
  SYNC_PENDING_SAVE_STATES: Set<string>;
  SYNC_READY_SAVE_STATES: Set<string>;
  synchronizeDocumentShimmers: (input: Controls_C.AnimationDocument) => void;
  synchronizeRemoteTextEntries: (
    arg0: ReadonlyMap<string, ModelStorage_Storage.RemoteFileRecord>,
    arg1?: ModelStorage_Storage.RemoteTextFetch | undefined,
  ) => void;
  synchronizeSkeletonAnimation: (
    element: Controls_C.AnimationElement,
    options?: string,
    context?: number,
  ) => void;
  syncLoadHealthOutcome: (
    arg0: string,
    arg1: string | undefined,
  ) => ModelStorage_Storage.HealthEvent;
  syncSwatchTheme: (
    iframe: HTMLIFrameElement,
    head: readonly EditorRuntime_EditorRuntime.SwatchUrlReference[],
  ) => EditorRuntime_EditorRuntime.HeadPlacementState;
  SYSTEM_COLLECTION: string;
  SYSTEM_LOAD_FAILURE_REASON: string;
  SYSTEM_META_DOCUMENT_PATH: string;
  SYSTEM_SOURCE_DOCUMENT_PATH: string;
  SYSTEM_TOKENS_DOCUMENT_PATH: string;
  SYSTEM_UPGRADED_DOCUMENT_PATH: string;
  systemMovedToFiles: boolean;
  TABLE_COLUMNS_ICON: ColorControls_ColorControls.PropertyIconDefinition;
  TABLE_ROWS_ICON: ColorControls_ColorControls.PropertyIconDefinition;
  tabsOverflowContext: Overlays_React.Context<Overlays_Overlays.TabsOverflowState | null>;
  takeStoreFoldSummary: () => Migration_Migration.FoldSummary;
  takeUnpublishableMigrationPaths: () => string[];
  temporarilyUnsavableMigrationFilesMessage: (
    paths: readonly string[],
  ) => string;
  TERMINAL_MIGRATION_ERROR_CODES: Set<string>;
  TEXT_EDITABLE_SELECTOR: string;
  TEXT_ENTRY_SELECTOR: string;
  TEXT_FIELD_BUTTON_CLASS: string;
  TEXT_FILE_EXTENSIONS: Set<string>;
  TEXT_FILE_MIME_TYPES: Set<string>;
  TEXT_MIME_TYPES: Set<string>;
  TEXT_NODE_TYPE: number;
  TextArea: Controls_C.ForwardComponent<
    HTMLTextAreaElement,
    Controls_C.TextAreaProps
  >;
  textAreaBaseClasses: string;
  textAreaContainerClasses: string;
  textContainsInvalidUnicode: (text: string) => boolean;
  textFieldStateContext: Controls_React.Context<Controls_C.FieldState | null>;
  TextInput: Controls_C.ForwardComponent<
    HTMLInputElement,
    Controls_C.TextInputProps
  >;
  textInputContainerBaseClasses: string;
  textInputElementBaseClasses: string;
  textInputNestedControlClasses: string;
  textInputTrailingControlPaddingClasses: string;
  textInputTrailingPaddingClasses: string;
  TextLink: ControlsExtra_Controls.ForwardComponent<
    HTMLElement,
    ControlsExtra_Controls.TextLinkProps
  >;
  textLinkDecorationAlias: string;
  textLinkDecorationTransitionClasses: string;
  TextLinkIcon: (
    input: ControlsExtra_React.ReactNode,
  ) => ControlsExtra_React.ReactElement;
  textLinkResetClasses: string;
  textLinkUnderlineClass: string;
  textLinkWithIconClasses: string;
  THEME_TOKEN_SCHEMA_DESCRIPTION: string;
  themeStoreContext: Interactions_React.Context<
    Interactions_Interactions.ThemeStore | undefined
  >;
  themeTokenKeys: Record<Dom_Dom.ThemeClassGroup, string[]>;
  themeTokenManifest: Dom_Dom.ThemeTokenManifest;
  THUMBNAIL_READY_ATTRIBUTE: string;
  thumbnailDeferAttribute: string;
  tintedBadgeColorClasses: Record<Controls_C.AccentColor, string>;
  TOAST_LAYER_BASE: number;
  ToastProvider: (
    props: Overlays_Overlays.ToastProviderProps,
  ) => Overlays_React.ReactElement;
  toastQueue: Composition_Composition.QueuedToast[];
  toastSubscribers: Set<
    (toasts: Composition_Composition.QueuedToast[]) => void
  >;
  toggleAttributeIfChanged: (
    element: Element,
    attribute: string,
    enabled: boolean,
  ) => void;
  TOKEN_LENGTH_VALIDATION_MESSAGES: Record<
    Application_Application.ScalarTokenKind,
    string
  >;
  TOKEN_NAME_PATTERN: RegExp;
  TOKEN_NAME_SEPARATOR: string;
  TOKEN_ROW_SELECTOR: string;
  TOKEN_SCALE_CSS_LENGTH_PATTERN: RegExp;
  TOKEN_SCALE_LABELS: Record<TokenEditors_TokenEditors.ScaleKind, string>;
  TOKEN_SCALE_SECTION_IDS: Record<TokenEditors_TokenEditors.ScaleKind, string>;
  TOKEN_SCALE_VALIDATION_MESSAGES: Record<
    TokenEditors_TokenEditors.ScaleKind,
    string
  >;
  tokenFamilySlug: (name: string) => string;
  tokenGroupName: (name: string, prefix?: string) => string;
  tokenGroupRenamePairs: (
    names: string[],
    namespace: string,
    previousGroup: string,
    nextGroup: string,
  ) => [string, string][];
  tokenHasGroupSuffix: (name: string, prefix?: string) => boolean;
  tokenizeCodeSpans: (
    markdown: string,
  ) => Documentation_Core.InlineMarkdownToken[];
  tokenizeInlineMarkdown: (
    markdown: string,
    options?: Documentation_Core.InlineMarkdownOptions,
  ) => Documentation_Core.InlineMarkdownToken[];
  tokenNamesForFamily: (
    tokens: ModelCore_Model.NormalizedTokens,
    family: ModelCore_ModelCore.TokenKind,
  ) => string[];
  TOKENS_DOCUMENT_ID: string;
  tokenScaleForEditor: (
    scale: EditorRuntime_Model.TokenFamily,
  ) => EditorRuntime_Application.EditorScale;
  tokenScaleGroupId: (group: TokenEditors_TokenEditors.ScaleGroup) => string;
  tokenScaleGroupLabel: (group: TokenEditors_TokenEditors.ScaleGroup) => string;
  tokenScaleGroups: (
    kind: TokenEditors_TokenEditors.ScaleKind,
    scale: TokenEditors_TokenEditors.EditorScale,
  ) => TokenEditors_TokenEditors.ScaleGroup[];
  TokenScaleRow: TokenEditors_React.FunctionComponent<TokenEditors_TokenEditors.TokenScaleRowProps>;
  TokenScaleSections: TokenEditors_React.FunctionComponent<TokenEditors_TokenEditors.TokenScaleSectionsProps>;
  tokenSearchEntries: (
    section: string,
    scale: Application_Application.EditorScale,
  ) => Application_Application.SearchEntry[];
  tokensJsonWithManifestName: (
    files: ModelCore_Model.FileTable,
  ) => string | null;
  TokenTableSection: TokenEditors_React.FunctionComponent<TokenEditors_TokenEditors.TokenTableSectionProps>;
  TOOLBAR_COMPACT_BREAKPOINT: number;
  TOOLBAR_CONTENT_SELECTOR: string;
  TOOLBAR_EARLY_HOLD_MS: number;
  TOOLBAR_FOCUSABLE_SELECTOR: string;
  TOOLBAR_FULL_BREAKPOINT: number;
  TOOLBAR_LAYOUT_ROLES: Set<string>;
  TOOLBAR_PADDLE_CLASS: string;
  TOOLBAR_POINTER_COORDINATE_TOLERANCE: number;
  TOOLBAR_POINTER_TIME_TOLERANCE: number;
  TOOLBAR_POSITION_TOLERANCE: number;
  TOOLBAR_QUIET_SELECTOR: string;
  TOOLBAR_SCROLL_FOCUS_MARGIN: number;
  TOOLBAR_STRAY_HOLD_MS: number;
  TOOLBAR_TOUCH_HOLD_MS: number;
  TOOLBAR_TOUCH_RECENCY_MS: number;
  TOOLBAR_WIDE_BREAKPOINT: number;
  ToolbarButton: ColorControls_React.ForwardRefExoticComponent<
    ColorControls_ColorControls.ToolbarButtonProps &
      ColorControls_React.RefAttributes<HTMLButtonElement>
  >;
  ToolbarCaret: (props?: {
    inherit?: boolean;
  }) => ColorControls_React.ReactElement;
  toolbarClickThroughTimer: ReturnType<typeof setTimeout> | null;
  toolbarContentCount: (
    element: Element,
    options?: Composition_Composition.ToolbarContentOptions,
  ) => number;
  ToolbarDivider: () => ColorControls_React.ReactElement;
  toolbarElementClickThroughDeadline: (element: Element) => number;
  ToolbarFloatingContext: ColorControls_React.Context<boolean>;
  ToolbarGroupWrapContext: ColorControls_React.Context<boolean>;
  toolbarPointerSession: ColorControls_ColorControls.ToolbarPointerSession | null;
  ToolbarQuietContext: ColorControls_React.Context<boolean>;
  toolbarRecentTouchDeadline: (element: HTMLElement, now: number) => number;
  ToolbarSaveControls: (
    props: Composition_Composition.ToolbarSaveControlsProps,
  ) => Composition_React.ReactNode;
  ToolbarScrollArea: (
    props: Composition_Composition.ToolbarScrollAreaProps,
  ) => Composition_React.ReactNode;
  ToolbarScrollPaddle: (
    props: Composition_Composition.ToolbarScrollPaddleProps,
  ) => Composition_React.ReactNode;
  toolbarScrollPageTarget: (
    direction: number,
    scrollLeft: number,
    viewportWidth: number,
    scrollWidth: number,
    margin: number,
  ) => number;
  ToolbarSelect: (
    props: FileBrowser_FileBrowser.ToolbarSelectProps,
  ) => FileBrowser_React.ReactNode;
  ToolbarStrip: ColorControls_React.FunctionComponent<ColorControls_ColorControls.ToolbarStripProps>;
  ToolbarStripButton: ColorControls_React.ForwardRefExoticComponent<
    ColorControls_ColorControls.ToolbarStripButtonProps &
      ColorControls_React.RefAttributes<HTMLButtonElement>
  >;
  toolbarStripClickThroughDeadline: (
    element: HTMLElement,
    now: number,
  ) => number;
  toolbarStrips: Set<HTMLElement>;
  ToolbarSurface: (
    props: Composition_Composition.ToolbarSurfaceProps,
  ) => Composition_React.ReactNode;
  ToolbarTabs: (
    props: Composition_Composition.ToolbarTabsProps,
  ) => Composition_React.ReactNode;
  toolbarTooltipContent: (props: ColorControls_ColorControls.ToolbarTip) => {
    content: string;
    shortcut?: string;
  };
  ToolbarTooltipSideContext: Composition_React.Context<
    Composition_Composition.ToolbarTooltipSide | undefined
  >;
  toolbarTouchDeadlines: WeakMap<
    Element,
    ColorControls_ColorControls.ToolbarTouchDeadline
  >;
  Tooltip: (props0: Dom_Overlays.TooltipProps) => Dom_React.ReactElement;
  TOOLTIP_NO_SHOW: Dom_Overlays.EmptyTooltipContent;
  tooltipBaseClasses: string;
  tooltipContentAlignmentClass: string;
  tooltipContentRowClasses: string;
  tooltipDetailClasses: string;
  tooltipExports: Dom_Overlays.TooltipImplementation & {
    useTooltipTrigger(): boolean;
    useTooltipGroup(): boolean;
    OverflowTooltip: Dom_React.ComponentType<Dom_Overlays.OverflowTooltipProps>;
  };
  tooltipImplementationContext: Dom_React.Context<Dom_Overlays.TooltipImplementation | null>;
  TooltipImplementationProvider: (
    props0: Dom_React.PropsWithChildren,
  ) => Dom_React.ReactElement;
  tooltipMultilineBodyClasses: string;
  TooltipProvider: (
    props0: Dom_React.PropsWithChildren<{
      delay?: number;
      closeDelay?: number;
    }>,
  ) => Dom_React.ReactElement;
  tooltipProviderContext: Dom_React.Context<boolean>;
  tooltipsDisabledContext: Dom_React.Context<boolean>;
  tooltipSecondaryDetailClasses: string;
  TooltipShortcut: (props0: {
    keys: string;
    className?: string;
  }) => Dom_React.ReactElement;
  tooltipSingleLineClasses: string;
  tooltipTextBalanceClass: string;
  TooltipWrapper: ColorControls_React.FunctionComponent<ColorControls_ColorControls.TooltipWrapperProps>;
  TooltipWrapperJsx: typeof import("react/jsx-runtime");
  TOUCH_DEVICE_QUERY: string;
  trackInputForElement: (element?: Element | null) => void;
  trackMigrationDownloadFailures: (files: Migration_Model.BrowserFilesPort) => {
    files: Migration_Model.BrowserFilesPort;
    downloadsRefused: () => string[];
  };
  trailingBacktickCount: (text: string) => number;
  trailingGlyphOutsetClass: string;
  trailingIconOutsetClasses: Record<"text" | "glyph", string>;
  transitionRunner: Dom_Dom.TransitionRunner | undefined;
  translateWithFallback: (
    translate: Interactions_Interactions.TranslationResolver | undefined,
    key: string,
    fallback: string,
    values?: Interactions_Interactions.TranslationValues,
  ) => string;
  translationContext: Interactions_React.Context<
    Interactions_Interactions.TranslationResolver | undefined
  >;
  transparentSheetBackdropClasses: string;
  TREE_INDEX_FIELD: string;
  trimScriptAttributeWhitespace: (text: string) => string;
  truncateHandoffFileName: (fileName: string) => string;
  truncateLinkDebugValue: (arg0: string) => string;
  truncateTokenText: (value: unknown, maxLength: number) => string;
  truncateUnicodeText: (text: string, limit: number) => string;
  truncateUtf16Safely: (text: string, maxLength: number) => string;
  trustedAndroidIntentPackages: Set<string>;
  trustedAnthropicDomains: string[];
  trySendToClaudeSession: (
    request: EditorRuntime_EditorRuntime.SessionRequest,
    available: object | null,
    send: (code: unknown) => boolean,
  ) => Promise<"started" | "staged" | "unanswered" | null>;
  TYPE_CARD_KEY_PREFIX: string;
  TYPE_IDENTIFIER_PATTERN: RegExp;
  TYPE_INFERENCE_OVER_BUDGET: symbol;
  TYPE_LABEL: string;
  TYPE_READONLY_REASON: string;
  TYPE_RESERVED_FILE_BUDGET: {
    files: number;
    bytes: number;
  };
  typeDeclarationEnd: (text: string, start: number) => number;
  TypeDeclarationResolver: Documentation_Documentation.TypeDeclarationResolverConstructor;
  typeGroupsForEditor: (
    groups: EditorRuntime_Model.TypographyGroup[],
  ) => EditorRuntime_Application.EditorTypeGroup[];
  typeInferenceIncomplete: boolean;
  typeLiteralSets: WeakMap<string[], Set<string>>;
  TypeStyleFields: TokenEditors_React.FunctionComponent<TokenEditors_TokenEditors.TypeStyleFieldsProps>;
  TypeStyleMetricEditors: TokenEditors_React.FunctionComponent<TokenEditors_TokenEditors.TypeStyleMetricEditorsProps>;
  typeStylePreviewStyle: (
    style: TokenEditors_TokenEditors.TypographyPreviewStyle,
    fontFamily: string,
  ) => TokenEditors_React.CSSProperties;
  TypeStyleRow: TokenEditors_React.FunctionComponent<TokenEditors_TokenEditors.TypeStyleRowProps>;
  TypeStyleSpecimen: TokenEditors_React.FunctionComponent<TokenEditors_TokenEditors.TypeStyleSpecimenProps>;
  TYPOGRAPHY_SECTION_LABEL: string;
  typographyClassNames: string[];
  typographyScaleNames: string[];
  TypographySection: TokenEditors_React.FunctionComponent<TokenEditors_TokenEditors.TypographySectionProps>;
  TypographySectionHeader: TokenEditors_React.FunctionComponent<
    TokenEditors_TokenEditors.EditorSectionHeaderProps<TokenEditors_TokenEditors.TypographyEdit>
  >;
  typographyShorthandVariables: (
    tokens: ModelCore_Model.NormalizedTokens,
  ) => Map<string, string>;
  typographyStyleByName: (
    tokens: ModelCore_Model.NormalizedTokens,
    name: string,
  ) => ModelCore_Model.TypographyStyle | undefined;
  typographyStyleFamily: (
    style: ModelCore_Model.TypographyStyle,
    group: ModelCore_Model.TypographyGroup,
  ) => string;
  typographyWeightClassNames: string[];
  typographyWeightNames: string[];
  unavailableStorageSlot: PlatformHost_Host.StorageSlot;
  unboundedFileParsing: boolean;
  unchangedPopupProps: Layers_Layers.PassivePopupTransform;
  UNCOMMENTABLE_PROPS: {
    "data-uncommentable": string;
  };
  uncoverParentMenuSheet: (arg0: Element, arg1: object) => void;
  UNDO_COMPLETE_LABEL: string;
  UNDO_STEPS_ATTRIBUTE: "data-mc-undo-steps";
  UNDO_STEPS_HELD_ATTRIBUTE: "data-mc-undo-steps-held";
  UNDO_UNAVAILABLE_LABEL: string;
  undoRedoKeyCommand: (
    event: Composition_Composition.UndoKeyEvent,
  ) => Composition_Composition.UndoCommand | undefined;
  UNGROUPED_ASSETS_NAME: string;
  UNICODE_REPLACEMENT_CHARACTER: string;
  unicodeCharacterCount: (text: string) => number;
  uniqueMergeList: (items: readonly string[]) => string[];
  uniqueStoredBlobBytes: (
    arg0: ModelStorage_StorageModel.StorageCatalog,
  ) => number;
  uniqueStoredBlobCount: (
    arg0: ModelStorage_StorageModel.StorageCatalog,
  ) => number;
  uniqueValues: <Value>(values: readonly Value[]) => Value[];
  UNKNOWN_EDITABILITY_REASON: string;
  UNPREFIXED_HEX_COLOR_PATTERN: RegExp;
  unpublishableFileReason: (
    path: string,
    contents: string | undefined,
  ) => string | null;
  unpublishableMigrationFilesMessage: (paths: readonly string[]) => string;
  UNREAD_LEGACY_STORE_CHANGES_MESSAGE: string;
  unreadDesignSystemFileHomes: () => Boot_Boot.FileHomes;
  unregisterShrinkWrapResizeHandler: (
    input: Dom_Dom.BrowserWindow,
    options: Element,
    context: (entry: ResizeObserverEntry) => void,
  ) => void;
  unrootedHrefPattern: RegExp;
  UNSAFE_ARTIFACT_LABEL_PATTERN: RegExp;
  UNSAFE_CLAUDE_REQUEST_CHARACTERS: RegExp;
  UNSAFE_PATH_CHARACTER_PATTERN: RegExp;
  unsafeColorPattern: RegExp;
  unsafeLinkRelTokenPattern: RegExp;
  UNSUPPORTED_UPLOAD_KIND_MESSAGE: string;
  unsupportedDownloadMessage: (path: string, shellError: string) => string;
  untrustedHandoffFileNames: (
    files: EditorRuntime_EditorRuntime.HandoffFile[],
  ) => string;
  unusedFileName: (
    files: ModelCore_Model.FileTable,
    directory: string,
    filename: string,
  ) => string;
  unusedTokenName: (
    tokens: ModelCore_Model.NormalizedTokens,
    family: ModelCore_ModelCore.TokenKind,
    preferredName: string,
  ) => string;
  unwrapTypeExpression: (text: string) => string;
  updateAssetGroupMetadata: (
    content: ModelCore_Model.DesignSystemContent,
    mutate: (metadata: ModelCore_Model.AssetGroupMetadata) => boolean,
  ) => ModelCore_Model.DesignSystemContent;
  updateLazyReadListing: (
    lazy: FilesCore_FilesCore.LazyReadState,
    listing: FilesCore_FilesBoot.FileListingRow[],
  ) => void;
  updateStorageCatalog: (
    content: ModelCore_Model.DesignSystemContent,
    mutate: (
      catalog: ModelCore_Model.StorageCatalog,
    ) => ModelCore_Model.StorageCatalog | null,
  ) => ModelCore_Model.DesignSystemContent;
  updateStoredSystemMigrationFlags: (arg0: {
    source?: unknown;
    upgraded?: unknown;
    editing?: unknown;
  }) => void;
  updateStoredSystemStatus: (
    arg0: ModelStorage_Storage.StoredSystemMetadata | null,
  ) => void;
  updateTokens: (
    content: ModelCore_Model.DesignSystemContent,
    mutate: (tokens: ModelCore_Model.NormalizedTokens) => boolean,
  ) => ModelCore_Model.DesignSystemContent;
  updateToolbarClickThroughAttributes: () => void;
  updateToolbarEmptyState: (toolbar: Element) => void;
  updateToolbarOverflowAttributes: (
    strip: HTMLElement,
    row: HTMLElement,
  ) => void;
  updateToolbarTouchDeadline: (element: HTMLElement, active: boolean) => void;
  updateToolbarWordLock: (toolbar: Element) => void;
  UPGRADED_DOCUMENT_ID: string;
  UPLOAD_REASON_MESSAGES: Record<string, string>;
  uploadAssetFile: (
    uploaded: EditorRuntime_Model.UploadedAssetFile,
    fontUpload: boolean,
    options?: EditorRuntime_EditorRuntime.AssetFileUploadOptions,
    progress?: EditorRuntime_EditorRuntime.UploadProgress,
  ) => Promise<EditorRuntime_EditorRuntime.FileUploadResult>;
  uploadAssetFiles: (
    files: File[],
    group: EditorRuntime_EditorRuntime.AssetBatchUploadOptions,
    options?: string,
  ) => Promise<EditorRuntime_Application.AssetUploadSummary>;
  uploadAssetWithRetry: (
    arg0: Pick<ModelStorage_Storage.AssetsCapability, "upload">,
    arg1: Blob,
    arg2: string,
    arg3?: ModelStorage_Storage.AssetRetryOptions,
  ) => Promise<ModelStorage_Storage.StoredAssetUploadResult>;
  uploadDestinationSummary: (
    result: EditorRuntime_Application.AssetUploadSummary,
  ) => string[];
  uploadedAssetFile: (file: File) => EditorRuntime_Model.UploadedAssetFile;
  uploadedFileIdentityId: (file: File) => number;
  uploadedFileIdentityIds: WeakMap<File, number>;
  uploadedFileRelativePath: (file: File) => string;
  uploadedFilesBuildSummary: (
    result: EditorRuntime_Application.AssetUploadSummary,
  ) => string;
  uploadEditedRemoteText: (
    arg0: string,
    arg1: string,
    arg2: string,
    arg3: ModelStorage_Storage.RemoteTextUpload | null,
    arg4: Uint8Array<ArrayBuffer> | undefined,
    arg5?: number,
  ) => void;
  uploadedRemoteTextEntries: Map<
    string,
    ModelStorage_Storage.UploadedRemoteText
  >;
  uploadFailureKind: (
    arg0: string,
  ) => ModelStorage_Storage.AssetUploadFailureKind;
  uploadFileBaseName: (fileName: string) => string;
  uploadingRemoteTextKeys: Set<string>;
  uploadResultSummary: (
    result: EditorRuntime_Application.AssetUploadSummary,
    leftOut: boolean,
    build?: boolean,
  ) => {
    text: string;
    handOff?: EditorRuntime_Application.RefusedUpload[];
  } | null;
  UsageNoteEditor: (
    props: FileBrowser_FileBrowser.UsageNoteEditorProps,
  ) => FileBrowser_React.ReactNode;
  useAdaptiveSheet: <Details extends Dom_Overlays.OverlayEventDetails>(
    props: Dom_Overlays.SheetPopupOptions<Details>,
  ) => Dom_Overlays.SheetPopupResult<Details>;
  useAddressedFontFaces: (fonts: EditorRuntime_Model.ParsedFont[]) => void;
  useAndroidCloseWatcher: (
    enabled: boolean | undefined,
    onClose: (() => void) | undefined,
  ) => void;
  useAppleKeyboard: () => boolean;
  useAssetDrag: (
    options: EditorRuntime_EditorRuntime.AssetDragOptions,
  ) => EditorRuntime_EditorRuntime.AssetDragController;
  useAssetGhostSlotHeights: (
    root: EditorRuntime_React.RefObject<HTMLElement | null>,
    slots: boolean,
  ) => void;
  useAssetGridInteractions: (
    options: EditorRuntime_EditorRuntime.AssetGridOptions,
  ) => EditorRuntime_EditorRuntime.AssetGridInteractions;
  useAssetGroupEditor: (
    options: EditorRuntime_EditorRuntime.AssetGroupEditorOptions,
  ) => EditorRuntime_EditorRuntime.AssetGroupEditorResult;
  useAssetSelection: (
    order: string[],
  ) => EditorRuntime_EditorRuntime.AssetSelectionController;
  useAssetThumbnailSource: (
    files: EditorRuntime_Model.FileTable,
    path: string,
  ) => EditorRuntime_EditorRuntime.ThumbnailSource;
  useAssetThumbnailSources: () => void;
  useBlobDataUrls: (
    resources: EditorRuntime_EditorRuntime.BlobResource[],
  ) => number;
  useBootWarnings: (context: unknown) => void;
  useButtonAccessibility: (
    props: ColorControls_ColorControls.ToolbarAccessibleDescription,
  ) => ColorControls_ColorControls.ToolbarAccessibility;
  useButtonGroup: () => Controls_C.ButtonGroupState | null;
  useButtonIconSize: (
    input?: Controls_C.ControlSize,
  ) => Controls_C.ResolvedIconSize;
  useCancelableTimeout: () => Dom_Dom.CancelableTimeout;
  useCaptureOverlayOpener: (
    arg0: boolean | undefined,
    arg1: Layers_React.RefObject<HTMLElement | null>,
    arg2: Layers_React.RefObject<HTMLElement | null>,
    arg3?: () => void,
    arg4?: Layers_React.RefObject<Layers_Layers.FocusableElement[]>,
  ) => void;
  useCdsLayerAwareZIndex: (layerOffset: number) => number;
  useCdsLink: (
    arg0: Layers_Overlays.LinkInput,
  ) => Layers_Overlays.LinkAttributes;
  useCdsLocale: () => string | undefined;
  useCdsRouter: () => Layers_Overlays.LinkRouter | undefined;
  useCdsThemeId: () => string | undefined;
  useClickToFocus: (
    arg0: (() => void) | undefined,
    arg1?: Layers_Dom.ClickToFocusOptions,
  ) => {
    clickToFocusProps: {
      onMouseDown: Layers_React.MouseEventHandler<HTMLElement>;
    };
  };
  useClientHydrated: () => boolean;
  useCloseOnActivityHideRef: (
    input: boolean,
  ) => Interactions_React.RefObject<HTMLElement | null>;
  useCoarsePointer: () => boolean;
  useCoarsePresentation: () => boolean;
  useCollisionPadding: (
    input?: Interactions_Overlays.CollisionPadding,
    options?: Interactions_Interactions.ContainerInput,
  ) => Interactions_Overlays.CollisionPadding | undefined;
  useColorContrastReport: (
    groups: TokenEditors_TokenEditors.TokenNameGroup<TokenEditors_TokenEditors.EditorColorToken>[],
    themes: TokenEditors_Model.ColorTheme[],
    firstThemeId?: string,
  ) => TokenEditors_TokenEditors.ColorContrastFor;
  useColorMode: () => Layers_Layers.ColorMode | undefined;
  useComboboxAccessibleName: (
    ref: Overlays_React.Ref<HTMLElement> | undefined,
    label?: string,
    labelledBy?: string,
  ) => {
    ref: Overlays_React.RefCallback<HTMLElement>;
    nameProps: Overlays_Overlays.AccessibleNameProps;
  };
  useComboboxListRef: (
    ref: Overlays_React.Ref<HTMLElement> | undefined,
  ) => Overlays_React.RefCallback<HTMLElement>;
  useComboboxOutsideInputRegistration: () => void;
  useComboboxPopupInputRef: (
    ref: Overlays_React.Ref<HTMLElement> | undefined,
  ) => Overlays_React.RefCallback<HTMLElement>;
  useComboboxTriggerElement: () => () => HTMLElement | null;
  useComboboxTriggerRef: (
    ref: Overlays_React.Ref<HTMLElement> | undefined,
  ) => Overlays_React.RefCallback<HTMLElement>;
  useCompactableControl: () => Overlays_Overlays.CompactableControlState;
  useCompactableControlDebug: (
    ref: Controls_React.RefObject<Element | null>,
    name: string,
  ) => void;
  useConflictedSections: (
    document2: Partial<EditorRuntime_EditorRuntime.ConflictDocument>,
  ) => ReadonlySet<string>;
  useContrastResult: (
    contrast: import("./contracts/color-controls").ContrastOptions | undefined,
    value: string | undefined,
  ) => import("./contracts/color-controls").ContrastResult[] | undefined;
  useControllableOpen: <Details extends Dom_Overlays.OverlayEventDetails>(
    props: Dom_Overlays.OverlayOpenProps<Details>,
  ) => {
    open: boolean;
    onOpenChange(open: boolean, details: Details): void;
  };
  useDebouncedPreviewValue: <Value>(
    value: Value,
    key: unknown,
    delay: number,
  ) => Value;
  useDefaultOverlayLayer: (
    input: Interactions_Dom.OverlayKind,
  ) => Interactions_Dom.LayerValue;
  useDeferredTooltipFocus: (
    enabled: ColorControls_React.RefObject<HTMLElement | null>,
    onChange: boolean,
  ) => void;
  useDeferredTooltipImplementation: (
    input: boolean,
  ) => Overlays_Overlays.DeferredTooltipState;
  useDensity: () => Layers_Layers.Density;
  useDensityIconSize: () => Interactions_Controls.ResolvedIconSize;
  useDesignSystemFilesBrowser: (
    props: FileBrowser_FileBrowser.DesignFilesBrowserProps,
  ) => {
    row:
      | {
          id: string;
          label: string;
          count: number;
          countLabel: string;
        }
      | undefined;
    open: boolean;
    show(path?: string): void;
    close(focus?: boolean): void;
    leave(callback: () => void): void;
    layer: FileBrowser_React.ReactNode;
    covered: {
      inert?: boolean;
      "data-covered"?: string;
    };
    searchEntries: import("./contracts/application").SearchEntry[];
  };
  useDesktopTitlebarInset: (
    input?: Interactions_Interactions.ContainerInput,
  ) => number;
  useDialogVisualKeyboard: (
    enabled: boolean | undefined,
  ) => Overlays_React.Dispatch<
    Overlays_React.SetStateAction<HTMLElement | null>
  >;
  useDisabledButtonDescription: (
    options: ColorControls_ColorControls.ToolbarDisabledDescription,
  ) => ColorControls_ColorControls.ToolbarDisabledAccessibility;
  useDismissSheetOnForeignFocus: (
    element: HTMLElement | null,
    options: Interactions_Overlays.SheetFrameContext | null,
    context: boolean,
  ) => void;
  useDocumentFont: (enabled?: boolean) => Dom_Dom.DocumentFont | undefined;
  useDownloadsWithheld: () => boolean | undefined;
  useEditorCardFlash: (
    root: Documentation_React.RefObject<HTMLElement | null>,
  ) => Documentation_Documentation.EditorCardFlashState;
  useEditorSectionNavigation: (
    props: Documentation_Documentation.SectionNavigationProps,
  ) => {
    reveal: (input: Documentation_Application.EditorSectionReveal) => void;
    release: () => void;
  };
  useEventCallback: <Args extends unknown[], Result>(
    callback: (...args: Args) => Result,
  ) => (...args: Args) => Result;
  useExperimentalThemeStore: (
    configuration:
      | Interactions_Interactions.ThemeConfiguration
      | null
      | undefined,
    targetRef: Interactions_React.RefObject<HTMLElement | null>,
  ) => Interactions_Interactions.ThemeStore;
  useFeatureFlagAttribute: () => string | undefined;
  useFieldDisabled: () => boolean;
  useFieldInvalid: () => boolean;
  useFieldLabelId: () => string | undefined;
  useFileAvailability: (
    files: Preview_Preview.FileAvailabilityEntry[],
  ) => number;
  useFileBrowserDownload: (
    file: FileBrowser_FileBrowser.BrowserFile,
    download: FileBrowser_FileBrowser.FileDownloadSpec,
    source: FileBrowser_FileBrowser.FileBrowserSource,
    reads: FileBrowser_FileBrowser.FileBrowserReads,
    withheld: boolean,
  ) => FileBrowser_FileBrowser.BrowserDownloadState;
  useFileConflictFlags: (
    document2: Partial<EditorRuntime_EditorRuntime.ConflictDocument>,
  ) => EditorRuntime_EditorRuntime.ConflictFlag[];
  useFileDrop: (options: Composition_Composition.FileDropOptions) => {
    over: boolean;
    targetProps: ReturnType<
      RuntimeTypes.RuntimeBindings["createFileDropHandlers"]
    >;
  };
  useFilePreviewWidth: () => [
    FileBrowser_React.Dispatch<
      FileBrowser_React.SetStateAction<HTMLDivElement | null>
    >,
    number,
  ];
  useFocusRegions: (
    regions: Application_Application.FocusRegion[],
  ) => Pick<Application_Application.FocusRegionController, "hint">;
  useFont: () => Layers_Layers.CdsFont | undefined;
  useForwardedOverlayActions: (
    internalActionsRef: Dom_React.RefObject<Dom_Dom.OverlayActions | null>,
    forwardedActionsRef:
      | Dom_React.Ref<Dom_Dom.PublicOverlayActions>
      | undefined,
  ) => void;
  useGoogleFontStylesheets: (
    families: Record<string, string>,
    fonts: {
      family: string;
    }[],
    tokens: Application_Model.NormalizedTokens["type"],
  ) => void;
  useHasFieldContext: () => boolean;
  useHasSheetFrame: () => boolean;
  useHasTooltipProvider: () => boolean;
  useHostSaveState: (
    status: PlatformHost_Host.SaveState["status"] | null,
    message?: () => void,
  ) => void;
  useHostThemeMode: () => Preview_Preview.PreviewMode;
  useIconSize: (
    input?: Interactions_Controls.IconSize,
  ) => Interactions_Controls.ResolvedIconSize;
  useInlineFontFaces: (
    fonts: EditorRuntime_Model.ParsedFont[],
    generation?: number,
  ) => void;
  useIsomorphicLayoutEffect: typeof Dom_React.useLayoutEffect;
  useIsSheet: () => boolean;
  useKeyboardContextMenuInitialFocus: (
    input: Interactions_React.RefObject<HTMLElement | null>,
  ) => void;
  useLoadedSheetImplementation: () => Layers_Overlays.MobileSheetParts | null;
  useMediaQuery: (input: string) => boolean;
  useMediaQuery__U: (
    windowObject: Dom_Dom.MediaQueryWindow | null | undefined,
    query: string,
  ) => boolean;
  useMenuOpenerRef: () =>
    | Layers_React.RefObject<HTMLElement | null>
    | undefined;
  useMenuOverlayRegistration: () => {
    elementRef: Layers_React.RefObject<HTMLElement | null>;
    overlayAttrs: {
      "data-cds-overlay": string;
    };
  };
  useMenuOwnerRef: (
    arg0: Layers_React.RefObject<HTMLElement | null> | undefined,
    arg1: Layers_Layers.PopupFocus | null | undefined,
  ) => Layers_React.RefCallback<HTMLElement>;
  useMenuPassiveFocusProps: () => Pick<
    Layers_Layers.PassivePopupProps,
    "tabIndex"
  >;
  useMergedRefs: <Value>(
    firstRef?: Interactions_Dom.CallbackRef<Value>,
    secondRef?: Interactions_Dom.CallbackRef<Value>,
    thirdRef?: Interactions_Dom.CallbackRef<Value>,
  ) => Interactions_React.RefCallback<Value>;
  useMigrationCleanupEnabled: () => boolean;
  useMobileSheetMediaQuery: () => boolean;
  useModalPortalInert: (
    arg0: Layers_Layers.ModalPortalInertOptions,
  ) => () => void;
  useMonospaceFont: () => string | null | undefined;
  useNavigationPillActivity: (
    port: HTMLElement | null | undefined,
    held: boolean,
  ) => boolean;
  useNumberScrubGesture: (
    options: ColorControls_ColorControls.NumberScrubOptions,
  ) => ColorControls_React.MouseEventHandler<HTMLElement>;
  useOptionalEventCallback: Dom_Dom.OptionalEventCallback;
  useOverlayFinalFocus: (
    arg0: boolean | undefined,
    arg1?: boolean,
    arg2?: Layers_React.RefObject<HTMLElement | null> | null,
  ) => Layers_Dom.OverlayFocusReturn;
  useOverlayFocusReturn: (
    arg0?: Layers_Dom.OverlayFocusOptions,
  ) => Layers_Dom.OverlayFocusReturn;
  useOverlayLayer: (
    parentBase: Interactions_Dom.OverlayKind,
    layerOffset?: number,
  ) => Interactions_Dom.LayerValue;
  useOverlayShowing: (open: boolean) => {
    showing: boolean;
    onOpenChangeComplete(open: boolean): void;
  };
  usePageBackground: () => string | undefined;
  usePanelHeaderTab: (
    props: ColorControls_ColorControls.PanelHeaderProps,
  ) => [string, (tab: string) => void];
  usePanelWidth: (
    initialWidth?: number,
    onResize?: (width: number, previous: number) => void,
  ) => ColorControls_ColorControls.PanelWidthState;
  usePassiveOpenContext: (arg0: boolean) => {
    cell: Layers_Layers.PassiveOpenCell | null;
    root: Layers_Layers.PassiveOpenCell | null;
  };
  usePassiveOpenState: (
    arg0: Layers_Layers.MenuChange | undefined,
    arg1: boolean | undefined,
    arg2?: boolean,
  ) => Layers_Layers.PassiveOpenGateState;
  usePlatform: () => Layers_Layers.CdsPlatform | undefined;
  usePopupOpenFocus: (open: boolean) => void;
  usePortalContainer: () => Layers_Layers.PortalContainer;
  usePreloadSheetsForCoarsePointer: (
    arg0: boolean,
    arg1: Window | undefined,
  ) => void;
  usePresentationMode: () => Dom_Dom.OverlayPresentation;
  usePresentationWhileShowing: (
    presentation: boolean,
    open: boolean,
    showing: boolean,
  ) => boolean;
  usePreviewStaticNotice: () => boolean;
  usePublishedPreviewGeneration: (
    document2: Pick<
      EditorRuntime_Application.ApplicationDocument,
      "saveState" | "subscribeSave"
    >,
  ) => number;
  USER_SCROLL_INTERRUPTION_EVENTS: string[];
  useRefocusAfterPendingSheet: (
    input: boolean,
  ) => (input2: HTMLElement | null) => void;
  useRegisterInnerOverlay: (arg0: Layers_Dom.InnerOverlay) => void;
  useResolvedColorMode: () => Layers_Layers.ColorMode;
  useRootElement: () => HTMLElement | undefined;
  useRootRemSize: () => number;
  useRootWindow: () => Window | undefined;
  useRowContextMenu: (
    enabled?: boolean,
  ) => TokenEditors_TokenEditors.RowContextState;
  usesAlphaBackground: (input: CSSStyleDeclaration) => boolean;
  useSectionNavigationSearch: (
    search: Application_Application.NavigationSearch | undefined,
    focus: (input: HTMLInputElement | null) => boolean,
  ) => Application_Application.NavigationSearchState;
  useSectionScroller: (
    ids: string[],
    header: () => number | undefined,
    sections: Application_Application.SectionRefs,
    initial: string,
  ) => Application_Application.SectionScroller;
  useSelectionToolbar: (
    container: Composition_React.RefObject<HTMLElement | null>,
    options?: Composition_Composition.SelectionToolbarOptions,
  ) => {
    open: boolean;
    style: Composition_React.CSSProperties;
    placed: "above" | "below";
    stripRef: Composition_React.RefObject<HTMLElement | null>;
    range(): Range | null;
    refresh(): void;
  };
  useSheetCapablePresentation: () => boolean;
  useSheetDrag: () => Pick<
    Dom_React.DOMAttributes<HTMLElement>,
    | "onPointerDown"
    | "onPointerMove"
    | "onPointerUp"
    | "onPointerCancel"
    | "onLostPointerCapture"
  >;
  useSheetFrame: (
    open: boolean,
    forwardedActionsRef:
      | Dom_React.Ref<Dom_Dom.PublicOverlayActions>
      | undefined,
    onOpenChangeComplete: ((open: boolean) => void) | undefined,
    close: (() => void) | undefined,
  ) => Dom_Dom.SheetFrameResult;
  useSheetHeightUntilVisible: (
    element: HTMLElement | null,
    onMeasure: (element: HTMLElement, height: number) => void,
  ) => void;
  useSheetImplementation: () => Dom_Overlays.MobileSheetParts | null;
  useSheetImplementationFailed: () => boolean;
  useSheetImplementationLoaded: () => boolean;
  useSheetPopupHost: () => Interactions_Interactions.SheetPopupHostState;
  useSheetPressedState: (element: HTMLElement | null) => void;
  useSheetState: () => Interactions_Dom.SheetState;
  useSheetTextEntryFocus: (
    element: HTMLElement | null,
    options: Interactions_Overlays.SheetFrameContext | null,
  ) => void;
  useShrinkWrapRef: (
    props0?: Dom_Dom.ShrinkWrapOptions,
  ) => Dom_React.RefCallback<HTMLElement>;
  usesImmediateModalRelease: (arg0?: Window) => boolean;
  useStableMergedRef: <Value>(
    firstRef: Interactions_React.RefCallback<Value>,
    secondRef?: Interactions_Dom.CallbackRef<Value>,
  ) => Interactions_React.RefCallback<Value>;
  useStableObjectRef: <
    Value = HTMLElement,
  >() => Interactions_React.RefObject<Value | null>;
  useStablePopupPlacement: (
    arg0: Layers_Layers.PopupAnimationInput,
  ) => Layers_Layers.StablePopupPlacement;
  useStuckSave: (
    document2: Partial<EditorRuntime_EditorRuntime.ConflictDocument>,
  ) => EditorRuntime_EditorRuntime.StuckSave | undefined;
  useSurfaceBackground: () => string | undefined;
  useSurfaceStyle: (
    input: Controls_C.SurfaceBackground,
  ) => Controls_C.DesignStyle;
  useTabsOverflow: () => Overlays_Overlays.TabsOverflowState | null;
  useTextAreaAutosize: (
    props: Controls_C.AutosizeOptions,
  ) => Controls_React.RefObject<HTMLTextAreaElement | null>;
  useTextCommit: (options: Composition_Composition.UseTextCommitOptions) => {
    props: {
      ref(element: Composition_Composition.TextEditorElement | null): void;
      value: string;
      onFocus(): void;
      onChange(
        event: Composition_React.ChangeEvent<Composition_Composition.TextEditorElement>,
      ): void;
      onBlur(): void;
      onKeyDown(
        event: Composition_React.KeyboardEvent<Composition_Composition.TextEditorElement>,
      ): void;
    };
    error: string | null;
  };
  useToastBridge: () => null;
  useToastNotifications: () => Overlays_Overlays.ToastNotifications;
  useTooltipsDisabled: () => boolean;
  useTrackedMenuTrigger: (
    arg0: Layers_Layers.MenuChange | undefined,
    arg1?: boolean,
  ) => {
    triggerRef: Layers_React.RefObject<HTMLElement | null>;
    onOpenChange: Layers_Layers.MenuChange;
  };
  useTranslation: (
    key: string,
    fallback: string,
    values?: Interactions_Interactions.TranslationValues,
  ) => string;
  useUndoKeys: (
    history: Composition_Composition.UndoActions | null | undefined,
    enabled?: boolean,
  ) => void;
  useValueCapturedOnOpen: <Value>(
    open: boolean,
    readValue: () => Value,
    defaultValue: Value,
  ) => Value;
  useVisualKeyboard: (
    enabled: boolean | undefined,
    onKeyboardChange: (keyboard: Dom_Dom.KeyboardInset | null) => void,
    props2?: {
      unpan?: boolean;
    },
  ) => void;
  validateAssetGroupName: (
    name: string,
    currentName: string,
    taken: string[],
  ) => string | null;
  validatedFilePathForDocument: (
    arg0: string,
    arg1: ModelStorage_Storage.DatabaseRecord,
  ) => string | null;
  validatedPreviewDimension: (
    value: number | undefined,
    fallback: number,
  ) => number;
  validateFilePath: (path: string) => string | undefined;
  validateFilePublishBatch: (
    entries: FilesCore_FilesBoot.FilePublishEntries,
  ) => FilesCore_FilesBoot.FilePublishFailure | undefined;
  validateIconAccessibility: (
    input: string | undefined,
    options: Interactions_React.AriaAttributes,
  ) => void;
  validateMigrationAllowlist: (
    adapter: Pick<
      Migration_Migration.MigrationAdapter<object>,
      "allowlist" | "dbRules"
    >,
  ) => void;
  validateMigrationTreePaths: (
    paths: Iterable<string>,
    type: Migration_Files.FileArtifactType,
  ) => void;
  validateNewColorValue: (
    value: string,
    allowEmpty: boolean,
    name: string,
    taken: ReadonlySet<string>,
  ) => string | null;
  validateNewFontFamily: (
    fontName: string,
    families: Record<string, string>,
  ) => string | null;
  validateNewTokenValue: (
    kind: Application_Application.ScalarTokenKind,
    value: string,
  ) => string | undefined;
  validateNewTypeField: (
    field: "fontSize" | "lineHeight" | "letterSpacing",
    value: string,
  ) => string | null;
  validateProjectFilePrefix: (prefix: string) => string;
  validateRelativeHref: (arg0: string) => string;
  validateTokenRename: (
    name: string,
    currentName: string,
    taken: ReadonlySet<string>,
  ) => string | null;
  validDerivedProjectFiles: (
    files: FilesCore_FilesBoot.FileTable,
  ) => Map<string, string>;
  validExportTimeout: (input: unknown) => number | undefined;
  VIDEO_FILE_EXTENSIONS: string[];
  viewerBuildFromFilesPrompt: (
    count: number,
    address: string,
    action: string,
  ) => string;
  viewerColorContrastFixPrompt: (
    request: EditorRuntime_EditorRuntime.ColorContrastFixRequest,
    address: string,
  ) => string;
  viewerEmptySystemPrompt: (address: string, action: string) => string;
  viewerGitHubSyncPrompt: (address: string) => string;
  viewerHandoffFilesPrompt: (
    files: EditorRuntime_EditorRuntime.HandoffFile[],
    address: string,
  ) => string;
  viewerMigrationCleanupPrompt: (address: string) => string;
  VIEWPORT_HEIGHT_EXCLUDING_SAFE_AREA_CSS: string;
  VIEWPORT_SCALE_TOLERANCE: number;
  virtualFileRowAtOffset: (tops: readonly number[], offset: number) => number;
  virtualFileRowScrollTop: (
    stack: FileBrowser_FileBrowser.VirtualFileStack,
    heights: readonly number[],
    row: number,
    scrollTop: number,
    viewportHeight: number,
    stickyHeight: number,
  ) => number;
  visibleFileName: (value: string) => string;
  visibleVirtualFileRows: (
    stack: FileBrowser_FileBrowser.VirtualFileStack,
    scrollTop: number,
    viewportHeight: number,
    overscan: number,
  ) => [number, number];
  waitAssetRetry: (delay: number) => Promise<void>;
  waitForBootLiveAnnouncer: (message?: string) => void;
  waitForDesignSystemRootContent: (document2: Document) => Promise<void>;
  waitForHotUpdateIdle: (
    value: unknown,
    options?: FilesCore_FilesCore.HotIdleOptions,
  ) => Promise<void>;
  waitForThumbnailAssets: (nextFrame?: Document) => Promise<void>;
  waitForThumbnailResources: (
    ready?: () => PromiseLike<unknown>,
    document2?: Document,
  ) => void;
  warnInvalidLayerOffset: (source: string, layerOffset: number) => void;
  warnNestedMenuInitialFocus: () => void;
  warnNestedMenuLayerOffset: () => void;
  wasPreviewRunnerRecentlyTaken: (
    environment: object,
    withinMs: number,
  ) => boolean;
  wasTypeInferenceIncomplete: () => boolean;
  watchLegacyStoreChanges: (
    storeHandle: Boot_Boot.NativeLegacyDatabase,
    files: Boot_Model.BrowserFilesPort,
    document2: Boot_Docs.DesignSystemFilesDocument,
    bootIndex: Boot_Model.FilesIndex | undefined,
    indexPath?: string,
  ) => void;
  WEB_SAFE_FONT_CATALOG: EditorRuntime_EditorRuntime.FontCatalogEntry[];
  WEB_SAFE_FONT_FAMILY_PATTERN: RegExp;
  WELCOME_ICON_PATHS: Record<"github", Preview_React.ReactElement>;
  WELCOME_OPTIONS: {
    github: [string, string];
    connect: [string, string, string];
    upload: [string, string, string];
  };
  WELCOME_TYPE_REQUIRED_MESSAGE: string;
  WelcomeIcon: Preview_React.FunctionComponent<Preview_Preview.WelcomeIconProps>;
  WelcomeSheet: Preview_React.FunctionComponent<Preview_Preview.WelcomeSheetProps>;
  WINDOW_NAMESPACE_PATTERN: RegExp;
  windowOrigin: (environment: {
    origin?: unknown;
    location?: {
      origin?: unknown;
    };
  }) => string;
  WINDOWS_SHORT_NAME_PATTERN: RegExp;
  withAutomaticSave: <Content>(
    artifactDocument: PlatformHost_Host.ArtifactDocument<Content>,
    options?: PlatformHost_Host.AutosaveOptions,
  ) => PlatformHost_Host.ArtifactDocument<Content>;
  withClaudeRequestTimeout: <T>(
    promise: Promise<T>,
    timeout: number,
  ) => Promise<T>;
  withRepeatedClickSelectionPrevention: <
    Event extends Overlays_Overlays.SelectionMouseEvent,
  >(
    onMouseDown?: (event: Event) => void,
  ) => (event: Event) => void;
  withUploadedFileRelativePath: (file: File, relativePath: string) => File;
  worstContrastResult: (
    results: ColorControls_ColorControls.ContrastResult[],
  ) => ColorControls_ColorControls.ContrastResult;
  wrapPanelResizeGestures: (
    gesture: ColorControls_ColorControls.PanelResizeGesture,
  ) => ColorControls_ColorControls.PanelResizeGesture;
  wrapUntrustedArtifactText: (label: string, text: string) => string;
  writeArtifactEditCount: (count: number) => void;
  writePanelPreference: (key: string, value: unknown) => void;
  writeShrinkWrapWidth: (input: HTMLElement, options: string) => void;
  zipCrc32: (bytes: Uint8Array) => number;
  zipCrc32Table: Uint32Array;
}
