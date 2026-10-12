import { installLibraries } from "./third-party/libraries";
import { installVirtualizer } from "./third-party/virtualizer";
import type { RuntimeBindings } from "./bindings";
import type { SlidesRuntime } from "./deck-contracts";
import { installModuleInterop } from "./module-interop";
import { installUiFoundation } from "./ui/foundation";
import { installUiInteractions } from "./ui/interactions";
import { installUiOverlays } from "./ui/overlays";
import { installUiEditorTokens } from "./ui/editor-tokens";
import { installUiEditorSelection } from "./ui/editor-selection";
import { installUiAvatars } from "./ui/avatars";
import { installUiAvatarStack } from "./ui/avatar-stack";
import { installUiDisclosure } from "./ui/disclosure";
import { installUiMenu } from "./ui/menu";
import { installUiInputs } from "./ui/inputs";
import { installUiDialog } from "./ui/dialog";
import { installUiTabs } from "./ui/tabs";
import { installUiDialog2 } from "./ui/dialog-2";
import { installUiTable } from "./ui/table";
import { installUiTabs2 } from "./ui/tabs-2";
import { installUiToast } from "./ui/toast";
import { installUiInputs2 } from "./ui/inputs-2";
import { installUiPropertyFocus } from "./ui/property-focus";
import { installUiPropertyIcons } from "./ui/property-icons";
import { installUiAnnouncements } from "./ui/announcements";
import { installUiContrast } from "./ui/contrast";
import { installUiPropertyLabels } from "./ui/property-labels";
import { installUiContrastControls } from "./ui/contrast-controls";
import { installUiColorPicker } from "./ui/color-picker";
import { installUiInspectorIcons } from "./ui/inspector-icons";
import { installUiNumberControls } from "./ui/number-controls";
import { installUiPropertyRow } from "./ui/property-row";
import { installUiPropertyPopover } from "./ui/property-popover";
import { installUiPropertySearch } from "./ui/property-search";
import { installUiPointerMedia } from "./ui/pointer-media";
import { installUiSelect } from "./ui/select";
import { installUiGradientEditor } from "./ui/gradient-editor";
import { installUiTooltipWrapper } from "./ui/tooltip-wrapper";
import { installUiIconButton } from "./ui/icon-button";
import { installUiColorSelect } from "./ui/color-select";
import { installEnvironmentColorMode } from "./environment/color-mode";
import { installEnvironmentPlatformShortcuts } from "./environment/platform-shortcuts";
import { installMediaImageCrop } from "./media/image-crop";
import { installMediaImageDownsampling } from "./media/image-downsampling";
import { installEnvironmentLinks } from "./environment/links";
import { installEnvironmentHostCapabilities } from "./environment/host-capabilities";
import { installEnvironmentCompiledPage } from "./environment/compiled-page";
import { installEnvironmentEmulator } from "./environment/emulator";
import { installMediaAssets } from "./media/assets";
import { installMediaVideoAssets } from "./media/video-assets";
import { installMediaVideoLinks } from "./media/video-links";
import { installModelSections } from "./model/sections";
import { installModelTypeScales } from "./model/type-scales";
import { installModelStyleSchema } from "./model/style-schema";
import { installModelDeck } from "./model/deck";
import { installDesignSystemTokens } from "./design-system/tokens";
import { installDesignSystemStore } from "./design-system/store";
import { installCompilerCssValues } from "./compiler/css-values";
import { installCompilerHtml } from "./compiler/html";
import { installModelTypography } from "./model/typography";
import { installModelGeometry } from "./model/geometry";
import { installModelRichTextDom } from "./model/rich-text-dom";
import { installSerializationHtml } from "./serialization/html";
import { installModelEditing } from "./model/editing";
import { installModelSelection } from "./model/selection";
import { installFontsCatalog } from "./fonts/catalog";
import { installFontsVariants } from "./fonts/variants";
import { installRenderingTheme } from "./rendering/theme";
import { installModelNavigation } from "./model/navigation";
import { installMediaVideoController } from "./media/video-controller";
import { installMediaClipRegistry } from "./media/clip-registry";
import { installMediaClipBadge } from "./media/clip-badge";
import { installMediaVideoLinkPlayer } from "./media/video-link-player";
import { installModelRichTextCommands } from "./model/rich-text-commands";
import { installEmbedsSanitizer } from "./embeds/sanitizer";
import { installEmbedsRuntimeBridge } from "./embeds/runtime-bridge";
import { installEmbedsDocument } from "./embeds/document";
import { installEmbedsFrameHost } from "./embeds/frame-host";
import { installEmbedsReactFrame } from "./embeds/react-frame";
import { installRenderingIconFont } from "./rendering/icon-font";
import { installRenderingSlides } from "./rendering/slides";
import { installFontsFetch } from "./fonts/fetch";
import { installPresentationBuildEffects } from "./presentation/build-effects";
import { installFontsReadiness } from "./fonts/readiness";
import { installExportFilenames } from "./export/filenames";
import { installExportEmbedCapture } from "./export/embed-capture";
import { installExportReactCapture } from "./export/react-capture";
import { installExportPptx } from "./export/pptx";
import { installExportPdfWriter } from "./export/pdf-writer";
import { installExportRenderedSemantics } from "./export/rendered-semantics";
import { installFontsFaceParser } from "./fonts/face-parser";
import { installFontsInlining } from "./fonts/inlining";
import { installExportPdfCapture } from "./export/pdf-capture";
import { installExportPng } from "./export/png";
import { installExportBackground } from "./export/background";
import { installExportBackgroundPicturesTail } from "./export/background-pictures-tail";
import { installExportDeckMeasurement } from "./export/deck-measurement";
import { installExportFontSubstitution } from "./export/font-substitution";
import { installExportGoogleFontCatalog } from "./export/google-font-catalog";
import { installExportGoogleSlidesFonts } from "./export/google-slides-fonts";
import { installExportCurrentFonts } from "./export/current-fonts";
import { installExportNotesPages } from "./export/notes-pages";
import { installExportPicturePptx } from "./export/picture-pptx";
import { installExportPageRuntime } from "./export/page-runtime";
import { installExportImageShrinking } from "./export/image-shrinking";
import { installExportDeckHtml } from "./export/deck-html";
import { installHostHotReload } from "./host/hot-reload";
import { installHostFeatureFlags } from "./host/feature-flags";
import { installHostAgentActivity } from "./host/agent-activity";
import { installUiEditorBootstrapImports } from "./ui/editor-bootstrap-imports";
import { installHostFrameBridge } from "./host/frame-bridge";
import { installUiUndoKeys } from "./ui/undo-keys";
import { installUiCollaboratorTints } from "./ui/collaborator-tints";
import { installUiViewportGestures } from "./ui/viewport-gestures";
import { installUiDesignProvider } from "./ui/design-provider";
import { installUiCommitTextInput } from "./ui/commit-text-input";
import { installUiSidePanels } from "./ui/side-panels";
import { installUiContextMenuPopup } from "./ui/context-menu-popup";
import { installUiCanvasFocus } from "./ui/canvas-focus";
import { installUiPropertyRows } from "./ui/property-rows";
import { installUiSegmentedProperty } from "./ui/segmented-property";
import { installUiSidesProperty } from "./ui/sides-property";
import { installEditorHitTesting } from "./editor/hit-testing";
import { installEditorMediaCropOverlay } from "./editor/media-crop-overlay";
import { installEditorMeasurementOverlay } from "./editor/measurement-overlay";
import { installEditorDragGeometry } from "./editor/drag-geometry";
import { installUiToolbarControls } from "./ui/toolbar-controls";
import { installUiToolbarTabs } from "./ui/toolbar-tabs";
import { installUiArtifactLoadBoundary } from "./ui/artifact-load-boundary";
import { installUiAgentCursor } from "./ui/agent-cursor";
import { installUiFileDrop } from "./ui/file-drop";
import { installUiToasts } from "./ui/toasts";
import { installUiToolbarPopover } from "./ui/toolbar-popover";
import { installUiPropertyPopover2 } from "./ui/property-popover-2";
import { installUiArtifactToolbar } from "./ui/artifact-toolbar";
import { installUiArtifactShell } from "./ui/artifact-shell";
import { installHostArtifactText } from "./host/artifact-text";
import { installHostClipboardText } from "./host/clipboard-text";
import { installHostRoomPresence } from "./host/room-presence";
import { installHostAgentSession } from "./host/agent-session";
import { installHostHandoffPreference } from "./host/handoff-preference";
import { installHostArtifactClipboard } from "./host/artifact-clipboard";
import { installModelComments } from "./model/comments";
import { installHostArtifactEditCount } from "./host/artifact-edit-count";
import { installHostArtifactPresence } from "./host/artifact-presence";
import { installHostUserApi } from "./host/user-api";
import { installUiPeerCursors } from "./ui/peer-cursors";
import { installUiRemoteChangeAnnouncer } from "./ui/remote-change-announcer";
import { installMediaVideoEncodingPlans } from "./media/video-encoding-plans";
import { installMediaVideoWorker } from "./media/video-worker";
import { installMediaVideoShrinkQueue } from "./media/video-shrink-queue";
import { installMediaEmbeddedPlayerSupport } from "./media/embedded-player-support";
import { installEditorCommandHistory } from "./editor/command-history";
import { installModelDeckMetadata } from "./model/deck-metadata";
import { installEditorDeckCommandHistory } from "./editor/deck-command-history";
import { installEditorSlideGestureHistory } from "./editor/slide-gesture-history";
import { installUiVideoShrinkProgress } from "./ui/video-shrink-progress";
import { installUiZoomControl } from "./ui/zoom-control";
import { installUiFindBar } from "./ui/find-bar";
import { installUiArtifactFind } from "./ui/artifact-find";
import { installEditorDomTextSearch } from "./editor/dom-text-search";
import { installUiFindHighlights } from "./ui/find-highlights";
import { installUiFindResultIcons } from "./ui/find-result-icons";
import { installModelArtifactStoreRecords } from "./model/artifact-store-records";
import { installEditorFontFaceChoices } from "./editor/font-face-choices";
import { installEditorGestureCursor } from "./editor/gesture-cursor";
import { installEditorSlideGeneration } from "./editor/slide-generation";
import { installUiSessionProperties } from "./ui/session-properties";
import { installUiStyleInspector } from "./ui/style-inspector";
import { installUiBoxQuickPanels } from "./ui/box-quick-panels";
import { installUiBoxStyleToolbar } from "./ui/box-style-toolbar";
import { installUiSelectionActions } from "./ui/selection-actions";
import { installUiEditContextMenu } from "./ui/edit-context-menu";
import { installUiRovingFocus } from "./ui/roving-focus";
import { installUiScrollbarOverlay } from "./ui/scrollbar-overlay";
import { installEditorChildSizeModes } from "./editor/child-size-modes";
import { installUiVideoPlaybackActions } from "./ui/video-playback-actions";
import { installEditorContrastBackgrounds } from "./editor/contrast-backgrounds";
import { installUiSelectionInspector } from "./ui/selection-inspector";
import { installEditorMediaCropSession } from "./editor/media-crop-session";
import { installEditorGrouping } from "./editor/grouping";
import { installLayoutSelectionGroups } from "./layout/selection-groups";
import { installLayoutSnapping } from "./layout/snapping";
import { installCreationTiming } from "./creation/timing";
import { installCollaborationSlidePresence } from "./collaboration/slide-presence";
import { installEditorSlideRailLayout } from "./editor/slide-rail-layout";
import { installEditorSlideRail } from "./editor/slide-rail";
import { installEditorSlideGrid } from "./editor/slide-grid";
import { installBridgeFrameViewport } from "./bridge/frame-viewport";
import { installCommentsCapability } from "./comments/capability";
import { installCommentsAnchors } from "./comments/anchors";
import { installCommentsComposer } from "./comments/composer";
import { installCommentsLabels } from "./comments/labels";
import { installEditorTouchLongPress } from "./editor/touch-long-press";
import { installEditorCanvas } from "./editor/canvas";
import { installEditorSpeakerNotes } from "./editor/speaker-notes";
import { installEditorShapeIcons } from "./editor/shape-icons";
import { installEditorDamagedSlide } from "./editor/damaged-slide";
import { installEditorPalette } from "./editor/palette";
import { installEditorContextMenu } from "./editor/context-menu";
import { installEditorClipboard } from "./editor/clipboard";
import { installPresentationFullscreen } from "./presentation/fullscreen";
import { installPresentationSlideIndex } from "./presentation/slide-index";
import { installPresentationAnnouncements } from "./presentation/announcements";
import { installPresentationSpeakerProtocol } from "./presentation/speaker-protocol";
import { installPresentationPopouts } from "./presentation/popouts";
import { installDocumentsJsonRecords } from "./documents/json-records";
import { installDocumentsCommentRecords } from "./documents/comment-records";
import { installDocumentsMigrationMarkers } from "./documents/migration-markers";
import { installDocumentsSlideCodec } from "./documents/slide-codec";
import { installPresentationSpeakerPanel } from "./presentation/speaker-panel";
import { installPresentationSpeakerSession } from "./presentation/speaker-session";
import { installPresentationAnimationEngine } from "./presentation/animation-engine";
import { installPresentationPlayer } from "./presentation/player";
import { installCreationOverlay } from "./creation/overlay";
import { installCreationController } from "./creation/controller";
import { installEditorEarlySlide } from "./editor/early-slide";
import { installEditorFocusRegions } from "./editor/focus-regions";
import { installEditorFind } from "./editor/find";
import { installEditorChangeAnnouncements } from "./editor/change-announcements";
import { installCommentsAreaSelection } from "./comments/area-selection";
import { installCommentsAreaGeometry } from "./comments/area-geometry";
import { installCommentsPinGeometry } from "./comments/pin-geometry";
import { installCommentsHitTesting } from "./comments/hit-testing";
import { installCommentsPin } from "./comments/pin";
import { installCommentsHighlights } from "./comments/highlights";
import { installCommentsKeyboard } from "./comments/keyboard";
import { installCommentsSlideLayer } from "./comments/slide-layer";
import { installCommentsGridLayer } from "./comments/grid-layer";
import { installEditorGridNotesClick } from "./editor/grid-notes-click";
import { installCollaborationGridCursors } from "./collaboration/grid-cursors";
import { installCollaborationSelectionRings } from "./collaboration/selection-rings";
import { installCollaborationSlideSelection } from "./collaboration/slide-selection";
import { installDeliveryShellDownloads } from "./delivery/shell-downloads";
import { installDeliveryProvider } from "./delivery/provider";
import { installDeliveryBrowserDownload } from "./delivery/browser-download";
import { installDeliveryPdfOptions } from "./delivery/pdf-options";
import { installDeliveryNotesDialog } from "./delivery/notes-dialog";
import { installDeliveryFontSubstitution } from "./delivery/font-substitution";
import { installBridgePageOcclusion } from "./bridge/page-occlusion";
import { installEditorDialogs } from "./editor/dialogs";
import { installDocumentsEditProtection } from "./documents/edit-protection";
import { installEditorViewState } from "./editor/view-state";
import { installDocumentsSelfPublish } from "./documents/self-publish";
import { installDocumentsArtifactDocument } from "./documents/artifact-document";
import { installDocumentsRemovedSlides } from "./documents/removed-slides";
import { installDocumentsDeckStore } from "./documents/deck-store";
import { installDocumentsAssetUndo } from "./documents/asset-undo";
import { installEditorCurrentSlide } from "./editor/current-slide";
import { installBridgePlaceLinks } from "./bridge/place-links";
import { installEditorTemplates } from "./editor/templates";
import { installEditorTemplateRestyling } from "./editor/template-restyling";
import { installDeliveryDialog } from "./delivery/delivery-dialog";
import { installEditorApp } from "./editor/app";
import { installDocumentsWriteAccess } from "./documents/write-access";
import { installBootThumbnailCapture } from "./boot/thumbnail-capture";
import { installBootStateFile } from "./boot/state-file";
import { installBootLegacyHtml } from "./boot/legacy-html";
import { installEditorThumbnailApp } from "./editor/thumbnail-app";
import { installDocumentsStashRecoveryMessage } from "./documents/stash-recovery-message";
import { installFilesSlideCodec } from "./files/slide-codec";
import { installFilesCrashStash } from "./files/crash-stash";
import { installFilesUnsavedSlides } from "./files/unsaved-slides";
import { installFilesUnloadFlush } from "./files/unload-flush";
import { installFilesSyncErrorNotifier } from "./files/sync-error-notifier";
import { installFilesDesignSystems } from "./files/design-systems";
import { installFilesProjectPaths } from "./files/project-paths";
import { installFilesSha256 } from "./files/sha256";
import { installFilesPublishInputs } from "./files/publish-inputs";
import { installFilesReadRetries } from "./files/read-retries";
import { installFilesHotUpdates } from "./files/hot-updates";
import { installFilesBootReader } from "./files/boot-reader";
import { installFilesSequenceMerge } from "./files/sequence-merge";
import { installFilesBrowserPort } from "./files/browser-port";
import { installFilesDocumentMerge } from "./files/document-merge";
import { installFilesIndexStore } from "./files/index-store";
import { installFilesBootRecovery } from "./files/boot-recovery";
import { installFilesSaveQueue } from "./files/save-queue";
import { installFilesDebugPanel } from "./files/debug-panel";
import { installFilesSlideOrderMerge } from "./files/slide-order-merge";
import { installFilesSlidesDocument } from "./files/slides-document";
import { installFilesLegacyDatabase } from "./files/legacy-database";
import { installFilesLegacyRestoration } from "./files/legacy-restoration";
import { installFilesEarlySlides } from "./files/early-slides";
import { installBootstrap } from "./boot/bootstrap";

/** Preserve hoisting, live bindings, and initialization order from the shipped IIFE. */
export function createSlidesRuntime(
  options: { boot?: boolean } = {},
): RuntimeBindings & SlidesRuntime {
  const runtime: RuntimeBindings = Object.create(null);
  installLibraries(runtime);
  installVirtualizer(runtime);
  const initializers = [
    installModuleInterop(runtime),
    installUiFoundation(runtime),
    installUiInteractions(runtime),
    installUiOverlays(runtime),
    installUiEditorTokens(runtime),
    installUiEditorSelection(runtime),
    installUiAvatars(runtime),
    installUiAvatarStack(runtime),
    installUiDisclosure(runtime),
    installUiMenu(runtime),
    installUiInputs(runtime),
    installUiDialog(runtime),
    installUiTabs(runtime),
    installUiDialog2(runtime),
    installUiTable(runtime),
    installUiTabs2(runtime),
    installUiToast(runtime),
    installUiInputs2(runtime),
    installUiPropertyFocus(runtime),
    installUiPropertyIcons(runtime),
    installUiAnnouncements(runtime),
    installUiContrast(runtime),
    installUiPropertyLabels(runtime),
    installUiContrastControls(runtime),
    installUiColorPicker(runtime),
    installUiInspectorIcons(runtime),
    installUiNumberControls(runtime),
    installUiPropertyRow(runtime),
    installUiPropertyPopover(runtime),
    installUiPropertySearch(runtime),
    installUiPointerMedia(runtime),
    installUiSelect(runtime),
    installUiGradientEditor(runtime),
    installUiTooltipWrapper(runtime),
    installUiIconButton(runtime),
    installUiColorSelect(runtime),
    installEnvironmentColorMode(runtime),
    installEnvironmentPlatformShortcuts(runtime),
    installMediaImageCrop(runtime),
    installMediaImageDownsampling(runtime),
    installEnvironmentLinks(runtime),
    installEnvironmentHostCapabilities(runtime),
    installEnvironmentCompiledPage(runtime),
    installEnvironmentEmulator(runtime),
    installMediaAssets(runtime),
    installMediaVideoAssets(runtime),
    installMediaVideoLinks(runtime),
    installModelSections(runtime),
    installModelTypeScales(runtime),
    installModelStyleSchema(runtime),
    installModelDeck(runtime),
    installDesignSystemTokens(runtime),
    installDesignSystemStore(runtime),
    installCompilerCssValues(runtime),
    installCompilerHtml(runtime),
    installModelTypography(runtime),
    installModelGeometry(runtime),
    installModelRichTextDom(runtime),
    installSerializationHtml(runtime),
    installModelEditing(runtime),
    installModelSelection(runtime),
    installFontsCatalog(runtime),
    installFontsVariants(runtime),
    installRenderingTheme(runtime),
    installModelNavigation(runtime),
    installMediaVideoController(runtime),
    installMediaClipRegistry(runtime),
    installMediaClipBadge(runtime),
    installMediaVideoLinkPlayer(runtime),
    installModelRichTextCommands(runtime),
    installEmbedsSanitizer(runtime),
    installEmbedsRuntimeBridge(runtime),
    installEmbedsDocument(runtime),
    installEmbedsFrameHost(runtime),
    installEmbedsReactFrame(runtime),
    installRenderingIconFont(runtime),
    installRenderingSlides(runtime),
    installFontsFetch(runtime),
    installPresentationBuildEffects(runtime),
    installFontsReadiness(runtime),
    installExportFilenames(runtime),
    installExportEmbedCapture(runtime),
    installExportReactCapture(runtime),
    installExportPptx(runtime),
    installExportPdfWriter(runtime),
    installExportRenderedSemantics(runtime),
    installFontsFaceParser(runtime),
    installFontsInlining(runtime),
    installExportPdfCapture(runtime),
    installExportPng(runtime),
    installExportBackground(runtime),
    installExportBackgroundPicturesTail(runtime),
    installExportDeckMeasurement(runtime),
    installExportFontSubstitution(runtime),
    installExportGoogleFontCatalog(runtime),
    installExportGoogleSlidesFonts(runtime),
    installExportCurrentFonts(runtime),
    installExportNotesPages(runtime),
    installExportPicturePptx(runtime),
    installExportPageRuntime(runtime),
    installExportImageShrinking(runtime),
    installExportDeckHtml(runtime),
    installHostHotReload(runtime),
    installHostFeatureFlags(runtime),
    installHostAgentActivity(runtime),
    installUiEditorBootstrapImports(runtime),
    installHostFrameBridge(runtime),
    installUiUndoKeys(runtime),
    installUiCollaboratorTints(runtime),
    installUiViewportGestures(runtime),
    installUiDesignProvider(runtime),
    installUiCommitTextInput(runtime),
    installUiSidePanels(runtime),
    installUiContextMenuPopup(runtime),
    installUiCanvasFocus(runtime),
    installUiPropertyRows(runtime),
    installUiSegmentedProperty(runtime),
    installUiSidesProperty(runtime),
    installEditorHitTesting(runtime),
    installEditorMediaCropOverlay(runtime),
    installEditorMeasurementOverlay(runtime),
    installEditorDragGeometry(runtime),
    installUiToolbarControls(runtime),
    installUiToolbarTabs(runtime),
    installUiArtifactLoadBoundary(runtime),
    installUiAgentCursor(runtime),
    installUiFileDrop(runtime),
    installUiToasts(runtime),
    installUiToolbarPopover(runtime),
    installUiPropertyPopover2(runtime),
    installUiArtifactToolbar(runtime),
    installUiArtifactShell(runtime),
    installHostArtifactText(runtime),
    installHostClipboardText(runtime),
    installHostRoomPresence(runtime),
    installHostAgentSession(runtime),
    installHostHandoffPreference(runtime),
    installHostArtifactClipboard(runtime),
    installModelComments(runtime),
    installHostArtifactEditCount(runtime),
    installHostArtifactPresence(runtime),
    installHostUserApi(runtime),
    installUiPeerCursors(runtime),
    installUiRemoteChangeAnnouncer(runtime),
    installMediaVideoEncodingPlans(runtime),
    installMediaVideoWorker(runtime),
    installMediaVideoShrinkQueue(runtime),
    installMediaEmbeddedPlayerSupport(runtime),
    installEditorCommandHistory(runtime),
    installModelDeckMetadata(runtime),
    installEditorDeckCommandHistory(runtime),
    installEditorSlideGestureHistory(runtime),
    installUiVideoShrinkProgress(runtime),
    installUiZoomControl(runtime),
    installUiFindBar(runtime),
    installUiArtifactFind(runtime),
    installEditorDomTextSearch(runtime),
    installUiFindHighlights(runtime),
    installUiFindResultIcons(runtime),
    installModelArtifactStoreRecords(runtime),
    installEditorFontFaceChoices(runtime),
    installEditorGestureCursor(runtime),
    installEditorSlideGeneration(runtime),
    installUiSessionProperties(runtime),
    installUiStyleInspector(runtime),
    installUiBoxQuickPanels(runtime),
    installUiBoxStyleToolbar(runtime),
    installUiSelectionActions(runtime),
    installUiEditContextMenu(runtime),
    installUiRovingFocus(runtime),
    installUiScrollbarOverlay(runtime),
    installEditorChildSizeModes(runtime),
    installUiVideoPlaybackActions(runtime),
    installEditorContrastBackgrounds(runtime),
    installUiSelectionInspector(runtime),
    installEditorMediaCropSession(runtime),
    installEditorGrouping(runtime),
    installLayoutSelectionGroups(runtime),
    installLayoutSnapping(runtime),
    installCreationTiming(runtime),
    installCollaborationSlidePresence(runtime),
    installEditorSlideRailLayout(runtime),
    installEditorSlideRail(runtime),
    installEditorSlideGrid(runtime),
    installBridgeFrameViewport(runtime),
    installCommentsCapability(runtime),
    installCommentsAnchors(runtime),
    installCommentsComposer(runtime),
    installCommentsLabels(runtime),
    installEditorTouchLongPress(runtime),
    installEditorCanvas(runtime),
    installEditorSpeakerNotes(runtime),
    installEditorShapeIcons(runtime),
    installEditorDamagedSlide(runtime),
    installEditorPalette(runtime),
    installEditorContextMenu(runtime),
    installEditorClipboard(runtime),
    installPresentationFullscreen(runtime),
    installPresentationSlideIndex(runtime),
    installPresentationAnnouncements(runtime),
    installPresentationSpeakerProtocol(runtime),
    installPresentationPopouts(runtime),
    installDocumentsJsonRecords(runtime),
    installDocumentsCommentRecords(runtime),
    installDocumentsMigrationMarkers(runtime),
    installDocumentsSlideCodec(runtime),
    installPresentationSpeakerPanel(runtime),
    installPresentationSpeakerSession(runtime),
    installPresentationAnimationEngine(runtime),
    installPresentationPlayer(runtime),
    installCreationOverlay(runtime),
    installCreationController(runtime),
    installEditorEarlySlide(runtime),
    installEditorFocusRegions(runtime),
    installEditorFind(runtime),
    installEditorChangeAnnouncements(runtime),
    installCommentsAreaSelection(runtime),
    installCommentsAreaGeometry(runtime),
    installCommentsPinGeometry(runtime),
    installCommentsHitTesting(runtime),
    installCommentsPin(runtime),
    installCommentsHighlights(runtime),
    installCommentsKeyboard(runtime),
    installCommentsSlideLayer(runtime),
    installCommentsGridLayer(runtime),
    installEditorGridNotesClick(runtime),
    installCollaborationGridCursors(runtime),
    installCollaborationSelectionRings(runtime),
    installCollaborationSlideSelection(runtime),
    installDeliveryShellDownloads(runtime),
    installDeliveryProvider(runtime),
    installDeliveryBrowserDownload(runtime),
    installDeliveryPdfOptions(runtime),
    installDeliveryNotesDialog(runtime),
    installDeliveryFontSubstitution(runtime),
    installBridgePageOcclusion(runtime),
    installEditorDialogs(runtime),
    installDocumentsEditProtection(runtime),
    installEditorViewState(runtime),
    installDocumentsSelfPublish(runtime),
    installDocumentsArtifactDocument(runtime),
    installDocumentsRemovedSlides(runtime),
    installDocumentsDeckStore(runtime),
    installDocumentsAssetUndo(runtime),
    installEditorCurrentSlide(runtime),
    installBridgePlaceLinks(runtime),
    installEditorTemplates(runtime),
    installEditorTemplateRestyling(runtime),
    installDeliveryDialog(runtime),
    installEditorApp(runtime),
    installDocumentsWriteAccess(runtime),
    installBootThumbnailCapture(runtime),
    installBootStateFile(runtime),
    installBootLegacyHtml(runtime),
    installEditorThumbnailApp(runtime),
    installDocumentsStashRecoveryMessage(runtime),
    installFilesSlideCodec(runtime),
    installFilesCrashStash(runtime),
    installFilesUnsavedSlides(runtime),
    installFilesUnloadFlush(runtime),
    installFilesSyncErrorNotifier(runtime),
    installFilesDesignSystems(runtime),
    installFilesProjectPaths(runtime),
    installFilesSha256(runtime),
    installFilesPublishInputs(runtime),
    installFilesReadRetries(runtime),
    installFilesHotUpdates(runtime),
    installFilesBootReader(runtime),
    installFilesSequenceMerge(runtime),
    installFilesBrowserPort(runtime),
    installFilesDocumentMerge(runtime),
    installFilesIndexStore(runtime),
    installFilesBootRecovery(runtime),
    installFilesSaveQueue(runtime),
    installFilesDebugPanel(runtime),
    installFilesSlideOrderMerge(runtime),
    installFilesSlidesDocument(runtime),
    installFilesLegacyDatabase(runtime),
    installFilesLegacyRestoration(runtime),
    installFilesEarlySlides(runtime),
    installBootstrap(runtime),
  ];
  for (let index = 0; index < initializers.length; index++) {
    if (options.boot === false && index === initializers.length - 1) continue;
    initializers[index]!();
  }
  return runtime as RuntimeBindings & SlidesRuntime;
}
