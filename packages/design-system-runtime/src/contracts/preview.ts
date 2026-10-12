import type * as React from "react";
import type {
  ParsedDesignSystem,
  ColorTheme,
  ParsedComponent,
  ResolvedLibraries,
  FileTable,
} from "../contracts";
export type PreviewMode = "light" | "dark";
export type PreviewTheme = Pick<ColorTheme, "id" | "name">;
export interface PreviewThemeResolution {
  hostThemeId?: string;
  hostThemeMode: PreviewMode;
  previewThemeId?: string;
  stageMode: PreviewMode;
  needsGround: boolean;
}
export interface PreviewThemeMenuProps {
  themes: PreviewTheme[];
  value?: string | null;
  onChange: (id: string) => void;
  disabledWhy?: string;
}
export interface PreviewLibraryResult {
  addReact: boolean;
  libraries: ResolvedLibraries;
}
export interface PreviewStaticStatus {
  staticReason: string;
  staticMissing: readonly string[];
}
export interface PreviewScriptTag {
  src: string;
  integrity: string;
}
export interface PreviewHeldUrl {
  url: string;
  integrity: string;
  file: string;
}
export interface PreviewFontUrl {
  url: string;
  file: string;
  face: Readonly<{ family: string; weight: string; style: string }>;
}
export interface PreviewHead {
  tokensCss: string;
  fontsCss: string;
  fontsKey: string;
  bundleCss: string;
  runtimeScripts: readonly string[];
  runtimeTags: readonly PreviewScriptTag[];
  bundleJs: string;
  fontsCssHeld?: string;
  urls?: Readonly<{
    bundleCss?: PreviewHeldUrl;
    runtimeScripts: readonly (PreviewHeldUrl | undefined)[];
    bundleJs?: PreviewHeldUrl;
    fonts: readonly PreviewFontUrl[];
  }>;
  themeId?: string;
  mode: PreviewMode;
  colorScheme: PreviewMode;
}
export interface PreviewHeadResult extends PreviewStaticStatus {
  head: PreviewHead;
}
export type PreviewHeadCache = WeakMap<
  FileTable,
  Map<string, PreviewHeadResult>
>;
export interface FileAvailabilityEntry {
  path: string;
  bytes: number;
  typePrefix: string;
}
export interface FileHeadResponse {
  ok: boolean;
  headers?: Pick<Headers, "get">;
}
export type FileHeadFetch = (path: string) => Promise<FileHeadResponse>;
export interface ComponentPreviewStage {
  namespace: string;
  globals: string[];
  values: Record<string, import("./documentation").JsonValue>;
}
export type PreviewComponent = Pick<ParsedComponent, "name"> & {
  previewHtml?: string;
  previewWidth?: number;
};
export interface ComponentPreviewSource {
  html: string | undefined;
  file: string;
  fromProps: boolean;
  staticReason?: string;
}
export interface FluidComponentPreviewProps {
  c: PreviewComponent;
  height: number;
  ph: PreviewHeadResult;
  stage?: ComponentPreviewStage;
}
export interface ScaledComponentPreviewProps
  extends FluidComponentPreviewProps {
  width: number;
}
export interface WelcomeIconProps {
  name: "github";
  size?: number;
  className?: string;
}
export interface HandoffNoticeProps {
  kind: "failed" | "suggested" | "copied";
  held?: boolean;
  onCopy?: React.MouseEventHandler<HTMLElement>;
  prompt?: string;
}
export interface WelcomeSheetProps {
  onGithub?: (trigger: HTMLButtonElement) => void;
  onConnect?: (trigger: HTMLButtonElement) => void;
  onUpload: () => void;
  busy?: boolean;
  note?: React.ReactNode;
  panel?: React.ReactNode;
}
export interface IntakeProgressStatusProps {
  text: string;
  quiet?: boolean;
}
export type IntakeSaveState = "clean" | "hold" | "saving" | "error";
export interface BrandUploadIntake {
  busy: boolean;
  kept: number;
  refused: string[];
  save: IntakeSaveState;
}
export interface BrandUploadText {
  title: string;
  line: string;
  hint: string;
  create: string;
  back: string;
  noFiles: string;
  adding: string;
  noneKept: string;
  waiting: string;
  removeLater: string;
  save: Record<IntakeSaveState, string>;
}
export interface BrandUploadGridProps {
  files: File[];
  thumb: (file: File) => React.ReactNode;
  onRemove: (index: number) => void;
  removeDisabledReason?: string;
  testid: string;
}
export interface BrandUploadPanelProps
  extends Omit<BrandUploadGridProps, "testid" | "removeDisabledReason"> {
  onFiles: (files: File[]) => void;
  onLeftOut?: (count: number) => void;
  intake: BrandUploadIntake;
  handing?: boolean;
  onCreate: React.MouseEventHandler<HTMLButtonElement>;
  onBack?: React.MouseEventHandler<HTMLElement>;
  "data-testid"?: string;
}
export type PreviewSystem = ParsedDesignSystem;
