import { installDependencies } from "./dependencies";
import type { RuntimeBindings } from "./runtime-types";
import type { DesignSystemRuntime } from "./types";
import { installModuleHelpers } from "./module-helpers";
import { installUiFoundation } from "./ui/foundation";
import { installUiInteractions } from "./ui/interactions";
import { installUiOverlays } from "./ui/overlays";
import { installUiAvatars } from "./ui/avatars";
import { installHostHotReload } from "./host/hot-reload";
import { installUiDisclosure } from "./ui/disclosure";
import { installUiButtons } from "./ui/buttons";
import { installUiSkeleton } from "./ui/skeleton";
import { installUiSurfaces } from "./ui/surfaces";
import { installUiTextInput } from "./ui/text-input";
import { installUiTextInputOverlay } from "./ui/text-input-overlay";
import { installUiControlLabels } from "./ui/control-labels";
import { installUiMenu } from "./ui/menu";
import { installUiAdaptiveSheets } from "./ui/adaptive-sheets";
import { installUiPopover } from "./ui/popover";
import { installUiTextArea } from "./ui/text-area";
import { installUiBadges } from "./ui/badges";
import { installUiIcons } from "./ui/icons";
import { installUiLinks } from "./ui/links";
import { installUiTooltips } from "./ui/tooltips";
import { installUiDialog } from "./ui/dialog";
import { installUiSwitch } from "./ui/switch";
import { installUiSegmentedControl } from "./ui/segmented-control";
import { installUiNumberInput } from "./ui/number-input";
import { installUiTabs } from "./ui/tabs";
import { installUiToast } from "./ui/toast";
import { installUiField } from "./ui/field";
import { installUiComboboxPrimitives } from "./ui/combobox-primitives";
import { installUiCombobox } from "./ui/combobox";
import { installUiCheckbox } from "./ui/checkbox";
import { installHostFrameBridge } from "./host/frame-bridge";
import { installPlatformFrameChrome } from "./platform/frame-chrome";
import { installUiPropertyFocus } from "./ui/property-focus";
import { installUiUndoKeys } from "./ui/undo-keys";
import { installUiPropertyIcons } from "./ui/property-icons";
import { installUiCollaboratorTints } from "./ui/collaborator-tints";
import { installUiAnnouncements } from "./ui/announcements";
import { installUiColorContrast } from "./ui/color/contrast";
import { installUiPropertyLabels } from "./ui/property-labels";
import { installUiColorContrastControls } from "./ui/color/contrast-controls";
import { installUiColorPicker } from "./ui/color/picker";
import { installUiInspectorIcons } from "./ui/inspector-icons";
import { installUiNumberControls } from "./ui/number-controls";
import { installUiPropertyRow } from "./ui/property-row";
import { installUiPropertyPopover } from "./ui/property-popover";
import { installUiPropertySearch } from "./ui/property-search";
import { installUiSelect } from "./ui/select";
import { installUiColorGradientStops } from "./ui/color/gradient-stops";
import { installUiColorSelect } from "./ui/color-select";
import { installUiColorMode } from "./ui/color-mode";
import { installUiCommitTextInput } from "./ui/commit-text-input";
import { installUiSidePanels } from "./ui/side-panels";
import { installUiPlatformShortcuts } from "./ui/platform-shortcuts";
import { installUiContextMenu } from "./ui/context-menu";
import { installUiTextCommit } from "./ui/text-commit";
import { installUiPropertyRows } from "./ui/property-rows";
import { installUiToolbarControls } from "./ui/toolbar-controls";
import { installUiSelectionToolbar } from "./ui/selection-toolbar";
import { installUiToolbarTabs } from "./ui/toolbar-tabs";
import { installUiArtifactLoadBoundary } from "./ui/artifact-load-boundary";
import { installUiFileDrop } from "./ui/file-drop";
import { installUiToasts } from "./ui/toasts";
import { installUiPropertyPopoverControls } from "./ui/property-popover-controls";
import { installUiArtifactToolbar } from "./ui/artifact-toolbar";
import { installUiArtifactShell } from "./ui/artifact-shell";
import { installUiAnnouncedHistory } from "./ui/announced-history";
import { installHostClaudeCapabilities } from "./host/claude-capabilities";
import { installDocumentsSelfPublish } from "./documents/self-publish";
import { installPlatformCompiledPage } from "./platform/compiled-page";
import { installHostClaudeSession } from "./host/claude-session";
import { installPlatformEmulator } from "./platform/emulator";
import { installMediaAssets } from "./media/assets";
import { installHostArtifactEditCount } from "./host/artifact-edit-count";
import { installDocumentsArtifactDocument } from "./documents/artifact-document";
import { installHostUserApi } from "./host/user-api";
import { installDocumentsStorage } from "./documents/storage";
import { installDocumentsAutosave } from "./documents/autosave";
import { installTelemetryHealth } from "./telemetry/health";
import { installDocumentsWriteAccess } from "./documents/write-access";
import { installModelFilePolicy } from "./model/file-policy";
import { installModelFileTable } from "./model/file-table";
import { installModelComponentInference } from "./model/component-inference";
import { installModelLibraries } from "./model/libraries";
import { installModelTokens } from "./model/tokens";
import { installModelDocumentation } from "./model/documentation";
import { installModelPublish } from "./model/publish";
import { installModelBoot } from "./model/boot";
import { installModelLastChange } from "./model/last-change";
import { installModelStorage } from "./model/storage";
import { installModelManifestMetadata } from "./model/manifest-metadata";
import { installModelDeriveSystem } from "./model/derive-system";
import { installModelFileCommands } from "./model/file-commands";
import { installModelTokenCommands } from "./model/token-commands";
import { installModelFontComponentCommands } from "./model/font-component-commands";
import { installModelAssetCommands } from "./model/asset-commands";
import { installModelMigrationMarkers } from "./model/migration-markers";
import { installModelRecordCodec } from "./model/record-codec";
import { installModelStoredFileCodec } from "./model/stored-file-codec";
import { installModelStoreConversion } from "./model/store-conversion";
import { installModelStoreCompose } from "./model/store-compose";
import { installModelRemoteText } from "./model/remote-text";
import { installModelSystemSync } from "./model/system-sync";
import { installModelAssetStore } from "./model/asset-store";
import { installModelSystemStore } from "./model/system-store";
import { installModelReactRuntime } from "./model/react-runtime";
import { installEditorExternalLinks } from "./editor/external-links";
import { installEditorInlineMarkdown } from "./editor/inline-markdown";
import { installEditorMarkdownBlocks } from "./editor/markdown-blocks";
import { installEditorMarkdownAutoformat } from "./editor/markdown-autoformat";
import { installEditorMarkdownToolbar } from "./editor/markdown-toolbar";
import { installEditorCommentAnchors } from "./editor/comment-anchors";
import { installEditorMarkdownFormatting } from "./editor/markdown-formatting";
import { installEditorEditableName } from "./editor/editable-name";
import { installEditorMarkdownCommit } from "./editor/markdown-commit";
import { installEditorMarkdownParser } from "./editor/markdown-parser";
import { installEditorMarkdownEditor } from "./editor/markdown-editor";
import { installEditorReadmeArticle } from "./editor/readme-article";
import { installEditorSectionCard } from "./editor/section-card";
import { installEditorDocumentSections } from "./editor/document-sections";
import { installEditorRowContextMenu } from "./editor/row-context-menu";
import { installEditorUsageNotes } from "./editor/usage-notes";
import { installEditorSectionHeaders } from "./editor/section-headers";
import { installEditorCssLengthInput } from "./editor/css-length-input";
import { installEditorFilesIndex } from "./editor/files-index";
import { installEditorAddressedFiles } from "./editor/addressed-files";
import { installEditorAssetResources } from "./editor/asset-resources";
import { installEditorFontFaces } from "./editor/font-faces";
import { installEditorViewModel } from "./editor/view-model";
import { installEditorTokenScales } from "./editor/token-scales";
import { installEditorClaudeDelivery } from "./editor/claude-delivery";
import { installEditorClaudePrompts } from "./editor/claude-prompts";
import { installEditorColorContrastPairs } from "./editor/color-contrast-pairs";
import { installEditorColors } from "./editor/colors";
import { installEditorShadows } from "./editor/shadows";
import { installEditorFontCatalog } from "./editor/font-catalog";
import { installEditorEmptyStates } from "./editor/empty-states";
import { installEditorTypography } from "./editor/typography";
import { installEditorAddTokenDialog } from "./editor/add-token-dialog";
import { installEditorSectionNavigation } from "./editor/section-navigation";
import { installEditorPipelineBanners } from "./editor/pipeline-banners";
import { installEditorMigrationBanners } from "./editor/migration-banners";
import { installEditorConflictBanners } from "./editor/conflict-banners";
import { installEditorIndexFileStore } from "./editor/index-file-store";
import { installEditorFilesMerge } from "./editor/files-merge";
import { installEditorPreviewRunner } from "./editor/preview-runner";
import { installEditorSwatchRuntime } from "./editor/swatch-runtime";
import { installEditorPreviewHeight } from "./editor/preview-height";
import { installEditorStaticPreview } from "./editor/static-preview";
import { installEditorPreviewPool } from "./editor/preview-pool";
import { installEditorPublishedPreview } from "./editor/published-preview";
import { installEditorComponentPreview } from "./editor/component-preview";
import { installEditorPreviewFit } from "./editor/preview-fit";
import { installEditorComponents } from "./editor/components";
import { installEditorCoverPreview } from "./editor/cover-preview";
import { installEditorConfirmRemove } from "./editor/confirm-remove";
import { installEditorAssetThumbnails } from "./editor/asset-thumbnails";
import { installEditorAssetGroups } from "./editor/asset-groups";
import { installEditorEditDispatch } from "./editor/edit-dispatch";
import { installEditorDownloadPermission } from "./editor/download-permission";
import { installEditorAssetUpload } from "./editor/asset-upload";
import { installEditorAssetDetails } from "./editor/asset-details";
import { installEditorUploadPipeline } from "./editor/upload-pipeline";
import { installEditorAssetContextMenu } from "./editor/asset-context-menu";
import { installEditorAssetSelection } from "./editor/asset-selection";
import { installEditorAssetDrag } from "./editor/asset-drag";
import { installEditorAssetInteractions } from "./editor/asset-interactions";
import { installEditorAssetGroupEditor } from "./editor/asset-group-editor";
import { installEditorFileDrop } from "./editor/file-drop";
import { installEditorNewAssetGroup } from "./editor/new-asset-group";
import { installFilesPaths } from "./files/paths";
import { installFilesMigrationEngine } from "./files/migration-engine";
import { installFilesHotUpdates } from "./files/hot-updates";
import { installFilesBootDecisions } from "./files/boot-decisions";
import { installFilesUiWelcome } from "./files/ui/welcome";
import { installFilesUiPreviewAvailability } from "./files/ui/preview-availability";
import { installFilesUiHandoffRuntime } from "./files/ui/handoff-runtime";
import { installFilesUiPreviewHead } from "./files/ui/preview-head";
import { installFilesUiTheme } from "./files/ui/theme";
import { installFilesUiNavigationSearch } from "./files/ui/navigation-search";
import { installFilesUiNavigation } from "./files/ui/navigation";
import { installFilesUiSectionScroll } from "./files/ui/section-scroll";
import { installFilesUiFocusRegions } from "./files/ui/focus-regions";
import { installFilesUiFileTree } from "./files/ui/file-tree";
import { installFilesUiFileBrowser } from "./files/ui/file-browser";
import { installFilesUiDesignSystemFiles } from "./files/ui/design-system-files";
import { installFilesUiDesignSystemApp } from "./files/ui/design-system-app";
import { installFilesLegacyStateReader } from "./files/legacy-state-reader";
import { installFilesThumbnailReadiness } from "./files/thumbnail-readiness";
import { installFilesBrowserPort } from "./files/browser-port";
import { installFilesBootReader } from "./files/boot-reader";
import { installFilesSaveQueue } from "./files/save-queue";
import { installFilesCrashStash } from "./files/crash-stash";
import { installFilesDebugPanel } from "./files/debug-panel";
import { installFilesInitializeStore } from "./files/initialize-store";
import { installFilesLegacyStorePort } from "./files/legacy-store-port";
import { installFilesStoreFoldController } from "./files/store-fold-controller";
import { installFilesSaveMessages } from "./files/save-messages";
import { installFilesDocument } from "./files/document";
import { installFilesLazyReads } from "./files/lazy-reads";
import { installFilesTokenMerge } from "./files/token-merge";
import { installFilesDataUri } from "./files/data-uri";
import { installFilesDesignSystemPort } from "./files/design-system-port";
import { installFilesCarry } from "./files/carry";
import { installFilesIndexConflicts } from "./files/index-conflicts";
import { installFilesDesignSystemDocument } from "./files/design-system-document";
import { installFilesMigrationCodec } from "./files/migration-codec";
import { installFilesMigrationFold } from "./files/migration-fold";
import { installFilesSingleFileMigration } from "./files/single-file-migration";
import { installFilesMigrationEditingHold } from "./files/migration-editing-hold";
import { installFilesCoverCapture } from "./files/cover-capture";
import { installFilesApplicationBoot } from "./files/application-boot";
import { installFilesSingleFileMigrationBoot } from "./files/single-file-migration-boot";
import { installFilesReopen } from "./files/reopen";
import { installFilesApplicationMigration } from "./files/application-migration";
import { installFilesPerFileBoot } from "./files/per-file-boot";
import { installBootstrap } from "./bootstrap";

/** Preserve hoisting, live bindings, and initialization order from the shipped IIFE. */
export function createDesignSystemRuntime(
  options: { boot?: boolean } = {},
): RuntimeBindings & DesignSystemRuntime {
  const runtime: RuntimeBindings = Object.create(null);
  installDependencies(runtime);
  const initializers = [
    installModuleHelpers(runtime),
    installUiFoundation(runtime),
    installUiInteractions(runtime),
    installUiOverlays(runtime),
    installUiAvatars(runtime),
    installHostHotReload(runtime),
    installUiDisclosure(runtime),
    installUiButtons(runtime),
    installUiSkeleton(runtime),
    installUiSurfaces(runtime),
    installUiTextInput(runtime),
    installUiTextInputOverlay(runtime),
    installUiControlLabels(runtime),
    installUiMenu(runtime),
    installUiAdaptiveSheets(runtime),
    installUiPopover(runtime),
    installUiTextArea(runtime),
    installUiBadges(runtime),
    installUiIcons(runtime),
    installUiLinks(runtime),
    installUiTooltips(runtime),
    installUiDialog(runtime),
    installUiSwitch(runtime),
    installUiSegmentedControl(runtime),
    installUiNumberInput(runtime),
    installUiTabs(runtime),
    installUiToast(runtime),
    installUiField(runtime),
    installUiComboboxPrimitives(runtime),
    installUiCombobox(runtime),
    installUiCheckbox(runtime),
    installHostFrameBridge(runtime),
    installPlatformFrameChrome(runtime),
    installUiPropertyFocus(runtime),
    installUiUndoKeys(runtime),
    installUiPropertyIcons(runtime),
    installUiCollaboratorTints(runtime),
    installUiAnnouncements(runtime),
    installUiColorContrast(runtime),
    installUiPropertyLabels(runtime),
    installUiColorContrastControls(runtime),
    installUiColorPicker(runtime),
    installUiInspectorIcons(runtime),
    installUiNumberControls(runtime),
    installUiPropertyRow(runtime),
    installUiPropertyPopover(runtime),
    installUiPropertySearch(runtime),
    installUiSelect(runtime),
    installUiColorGradientStops(runtime),
    installUiColorSelect(runtime),
    installUiColorMode(runtime),
    installUiCommitTextInput(runtime),
    installUiSidePanels(runtime),
    installUiPlatformShortcuts(runtime),
    installUiContextMenu(runtime),
    installUiTextCommit(runtime),
    installUiPropertyRows(runtime),
    installUiToolbarControls(runtime),
    installUiSelectionToolbar(runtime),
    installUiToolbarTabs(runtime),
    installUiArtifactLoadBoundary(runtime),
    installUiFileDrop(runtime),
    installUiToasts(runtime),
    installUiPropertyPopoverControls(runtime),
    installUiArtifactToolbar(runtime),
    installUiArtifactShell(runtime),
    installUiAnnouncedHistory(runtime),
    installHostClaudeCapabilities(runtime),
    installDocumentsSelfPublish(runtime),
    installPlatformCompiledPage(runtime),
    installHostClaudeSession(runtime),
    installPlatformEmulator(runtime),
    installMediaAssets(runtime),
    installHostArtifactEditCount(runtime),
    installDocumentsArtifactDocument(runtime),
    installHostUserApi(runtime),
    installDocumentsStorage(runtime),
    installDocumentsAutosave(runtime),
    installTelemetryHealth(runtime),
    installDocumentsWriteAccess(runtime),
    installModelFilePolicy(runtime),
    installModelFileTable(runtime),
    installModelComponentInference(runtime),
    installModelLibraries(runtime),
    installModelTokens(runtime),
    installModelDocumentation(runtime),
    installModelPublish(runtime),
    installModelBoot(runtime),
    installModelLastChange(runtime),
    installModelStorage(runtime),
    installModelManifestMetadata(runtime),
    installModelDeriveSystem(runtime),
    installModelFileCommands(runtime),
    installModelTokenCommands(runtime),
    installModelFontComponentCommands(runtime),
    installModelAssetCommands(runtime),
    installModelMigrationMarkers(runtime),
    installModelRecordCodec(runtime),
    installModelStoredFileCodec(runtime),
    installModelStoreConversion(runtime),
    installModelStoreCompose(runtime),
    installModelRemoteText(runtime),
    installModelSystemSync(runtime),
    installModelAssetStore(runtime),
    installModelSystemStore(runtime),
    installModelReactRuntime(runtime),
    installEditorExternalLinks(runtime),
    installEditorInlineMarkdown(runtime),
    installEditorMarkdownBlocks(runtime),
    installEditorMarkdownAutoformat(runtime),
    installEditorMarkdownToolbar(runtime),
    installEditorCommentAnchors(runtime),
    installEditorMarkdownFormatting(runtime),
    installEditorEditableName(runtime),
    installEditorMarkdownCommit(runtime),
    installEditorMarkdownParser(runtime),
    installEditorMarkdownEditor(runtime),
    installEditorReadmeArticle(runtime),
    installEditorSectionCard(runtime),
    installEditorDocumentSections(runtime),
    installEditorRowContextMenu(runtime),
    installEditorUsageNotes(runtime),
    installEditorSectionHeaders(runtime),
    installEditorCssLengthInput(runtime),
    installEditorFilesIndex(runtime),
    installEditorAddressedFiles(runtime),
    installEditorAssetResources(runtime),
    installEditorFontFaces(runtime),
    installEditorViewModel(runtime),
    installEditorTokenScales(runtime),
    installEditorClaudeDelivery(runtime),
    installEditorClaudePrompts(runtime),
    installEditorColorContrastPairs(runtime),
    installEditorColors(runtime),
    installEditorShadows(runtime),
    installEditorFontCatalog(runtime),
    installEditorEmptyStates(runtime),
    installEditorTypography(runtime),
    installEditorAddTokenDialog(runtime),
    installEditorSectionNavigation(runtime),
    installEditorPipelineBanners(runtime),
    installEditorMigrationBanners(runtime),
    installEditorConflictBanners(runtime),
    installEditorIndexFileStore(runtime),
    installEditorFilesMerge(runtime),
    installEditorPreviewRunner(runtime),
    installEditorSwatchRuntime(runtime),
    installEditorPreviewHeight(runtime),
    installEditorStaticPreview(runtime),
    installEditorPreviewPool(runtime),
    installEditorPublishedPreview(runtime),
    installEditorComponentPreview(runtime),
    installEditorPreviewFit(runtime),
    installEditorComponents(runtime),
    installEditorCoverPreview(runtime),
    installEditorConfirmRemove(runtime),
    installEditorAssetThumbnails(runtime),
    installEditorAssetGroups(runtime),
    installEditorEditDispatch(runtime),
    installEditorDownloadPermission(runtime),
    installEditorAssetUpload(runtime),
    installEditorAssetDetails(runtime),
    installEditorUploadPipeline(runtime),
    installEditorAssetContextMenu(runtime),
    installEditorAssetSelection(runtime),
    installEditorAssetDrag(runtime),
    installEditorAssetInteractions(runtime),
    installEditorAssetGroupEditor(runtime),
    installEditorFileDrop(runtime),
    installEditorNewAssetGroup(runtime),
    installFilesPaths(runtime),
    installFilesMigrationEngine(runtime),
    installFilesHotUpdates(runtime),
    installFilesBootDecisions(runtime),
    installFilesUiWelcome(runtime),
    installFilesUiPreviewAvailability(runtime),
    installFilesUiHandoffRuntime(runtime),
    installFilesUiPreviewHead(runtime),
    installFilesUiTheme(runtime),
    installFilesUiNavigationSearch(runtime),
    installFilesUiNavigation(runtime),
    installFilesUiSectionScroll(runtime),
    installFilesUiFocusRegions(runtime),
    installFilesUiFileTree(runtime),
    installFilesUiFileBrowser(runtime),
    installFilesUiDesignSystemFiles(runtime),
    installFilesUiDesignSystemApp(runtime),
    installFilesLegacyStateReader(runtime),
    installFilesThumbnailReadiness(runtime),
    installFilesBrowserPort(runtime),
    installFilesBootReader(runtime),
    installFilesSaveQueue(runtime),
    installFilesCrashStash(runtime),
    installFilesDebugPanel(runtime),
    installFilesInitializeStore(runtime),
    installFilesLegacyStorePort(runtime),
    installFilesStoreFoldController(runtime),
    installFilesSaveMessages(runtime),
    installFilesDocument(runtime),
    installFilesLazyReads(runtime),
    installFilesTokenMerge(runtime),
    installFilesDataUri(runtime),
    installFilesDesignSystemPort(runtime),
    installFilesCarry(runtime),
    installFilesIndexConflicts(runtime),
    installFilesDesignSystemDocument(runtime),
    installFilesMigrationCodec(runtime),
    installFilesMigrationFold(runtime),
    installFilesSingleFileMigration(runtime),
    installFilesMigrationEditingHold(runtime),
    installFilesCoverCapture(runtime),
    installFilesApplicationBoot(runtime),
    installFilesSingleFileMigrationBoot(runtime),
    installFilesReopen(runtime),
    installFilesApplicationMigration(runtime),
    installFilesPerFileBoot(runtime),
    installBootstrap(runtime),
  ];
  for (let index = 0; index < initializers.length; index++) {
    if (options.boot === false && index === initializers.length - 1) continue;
    initializers[index]();
  }
  return runtime as RuntimeBindings & DesignSystemRuntime;
}
