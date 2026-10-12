import type * as React from "react";
import type * as Controls from "./controls";
import type * as Dom from "./dom";
import type * as Overlays from "./overlays";
export type TranslationValues = Readonly<Record<string, string | number>>;
export type TranslationResolver = (
  key: string,
  fallback: string,
  values?: TranslationValues,
) => string | undefined;
export interface SheetHandleProps {
  drawPill?: boolean;
}
export interface SheetTitleBarProps {
  leading?: React.ReactNode;
  title?: React.ReactNode;
}
export interface SheetBodyProps {
  className?: string;
  children?: React.ReactNode;
}
export interface SheetDismissButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  as?: React.ElementType;
  onDismiss?: () => void;
  label?: string;
}
export interface SheetChrome {
  nested?: boolean;
  concealed?: boolean;
  close?(): void;
  dismiss?(): void;
  back?(): void;
  treeId?: string;
  closeLabel?: string;
  backLabel?: string;
  Handle: React.FunctionComponent<SheetHandleProps>;
  TitleBar: React.FunctionComponent<SheetTitleBarProps>;
  Body: React.FunctionComponent<SheetBodyProps>;
  DismissButton: Controls.ForwardComponent<
    HTMLElement,
    SheetDismissButtonProps
  >;
}
export interface SheetUncoverGate {
  ready(): boolean;
  dispose(): void;
}
export interface PinnedSheetMeasurement {
  contentHeight: number;
  written: number;
  chromeAtPin: number;
  chromeSettled: number;
  grows: boolean;
}
export interface DetachedSheetElement {
  node: HTMLElement;
  half: boolean;
}
export interface SheetPopupHostState {
  sheet: boolean;
  concealed: boolean;
  chrome: SheetChrome;
  ref: React.RefCallback<HTMLElement>;
  style?: Controls.DesignStyle;
  positionerStyle?: Controls.DesignStyle;
  attrs: Omit<React.HTMLAttributes<HTMLElement>, "inert"> & {
    inert?: boolean | "";
    [attribute: `data-${string}`]: string | number | undefined;
  };
  frame: Overlays.SheetFrameContext | null;
  state: Dom.SheetState;
  stack: Dom.SheetParentState | null;
}
/** Theme resolvers may return application-defined values; the shared store preserves them as unknown. */
export interface ThemeDescriptor {
  id: string;
}
export interface ThemeConfiguration<
  Theme extends ThemeDescriptor = ThemeDescriptor,
  Resolved = unknown,
> {
  theme: Theme;
  resolve?(theme: Theme): Resolved;
  apply?(theme: Theme, options: { target: HTMLElement }): (() => void) | void;
}
export interface ThemeSnapshot<
  Theme extends ThemeDescriptor = ThemeDescriptor,
  Resolved = unknown,
> {
  theme: Theme;
  resolved: Resolved | undefined;
}
export interface ThemeStore {
  subscribe(listener: () => void): () => boolean;
  getSnapshot(): ThemeSnapshot | undefined;
  getServerSnapshot(): ThemeSnapshot | undefined;
  getId(): string | undefined;
  set(configuration: ThemeConfiguration | null | undefined): void;
}
export interface ActivityHideProviderProps {
  actionsRef: React.RefObject<{ close?(): void } | null>;
  children?: React.ReactNode;
}
export interface ModalCatcherDragSession {
  event: DragEvent;
  restoreAll(): void;
}
export interface PortalRootProps extends SheetBodyProps {
  style?: Controls.DesignStyle;
  surface?: string;
  density?: Controls.Density;
  companionModalCatcher?: boolean;
  closeOnActivityHide?: boolean;
}
export type IconMasterSize = 16 | 20;
export interface IconWeightBounds {
  lo: number;
  hi: number;
}
export interface IconFontManifest {
  icons: Readonly<Record<string, number>>;
  secondary?: Readonly<Record<string, number>>;
  next: number;
  wght: Record<`${IconMasterSize}`, IconWeightBounds>;
  anim?: string[];
  animLoop?: string[];
  animDur?: Readonly<Record<string, number>>;
  animDurOut?: Readonly<Record<string, number>>;
  animEase?: Readonly<Record<string, string>>;
}
export type IconStroke =
  | { regular: number }
  | { regular: number; strong: number };
export interface IconSizeMetric {
  px: number;
  master: "small" | "base";
  stroke: IconStroke;
}
export interface IconFontStyle {
  fontSize: string;
  fontWeight: number;
}
export interface IconSizeStyles {
  readonly regular: IconFontStyle;
  readonly strong?: IconFontStyle;
}
export interface CustomIconStrokePath {
  d: string;
  strokeWidth: number;
}
export interface CustomIconDefinition {
  viewBox: number;
  paths: readonly (string | CustomIconStrokePath)[];
}
export interface NamedIconDefinition {
  name: string;
}
export interface CommonIconProps extends React.HTMLAttributes<Element> {
  alt?: string;
  size?: Controls.IconSize;
  customSize?: number;
  bold?: boolean;
  animated?: boolean;
  style?: Controls.DesignStyle;
}
export type IconProps = CommonIconProps &
  (
    | { name: string; icon?: NamedIconDefinition; customIcon?: undefined }
    | { name?: undefined; icon: NamedIconDefinition; customIcon?: undefined }
    | {
        customIcon: CustomIconDefinition;
        name?: string;
        icon?: NamedIconDefinition;
      }
  );
export type ContainerElement = Element | DocumentFragment;
export type ContainerInput =
  | ContainerElement
  | React.RefObject<ContainerElement | null>
  | null
  | undefined;
export interface CollisionPaddingContext {
  collisionPadding?: Overlays.CollisionPadding;
}
export interface CollisionPaddingProviderProps {
  override?: Overlays.CollisionPadding;
  container?: ContainerInput;
  provideInherit?: boolean;
  children(padding: Overlays.CollisionPadding | undefined): React.ReactNode;
}
export interface ContextMenuInputEvent {
  type: string;
  button?: number;
  pointerType?: string;
}
export interface ContextMenuChange {
  isCanceled?: boolean;
  event?: ContextMenuInputEvent;
}
