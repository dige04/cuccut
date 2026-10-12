import type * as React from "react";
import type * as Dom from "./dom";
import type * as Overlays from "./overlays";
export * from "./overlays";
export type ColorMode = "light" | "dark";
export type ConfiguredColorMode = ColorMode | "auto" | "system";
export type CdsPlatform = "web" | "desktop";
export type CdsFont = "anthropic" | "system";
export interface ColorModeStore {
  setElement(element: HTMLElement | null): void;
  subscribe(listener: () => void): () => void;
  getSnapshot(): ColorMode | undefined;
  getServerSnapshot(): ColorMode | undefined;
  getAttrSnapshot(): ConfiguredColorMode | undefined;
  getServerAttrSnapshot(): ConfiguredColorMode | undefined;
  getSettingSnapshot(): ConfiguredColorMode | undefined;
  getServerSettingSnapshot(): ConfiguredColorMode | undefined;
}
export type RootRenderProps = React.HTMLAttributes<HTMLElement>;
export interface CdsRootProps {
  density?: Overlays.Density;
  mode?: ConfiguredColorMode;
  platform?: CdsPlatform;
  font?: CdsFont;
  fontMono?: string | null;
  pageBackground?: string;
  locale?: string;
  router?: Overlays.LinkRouter;
  labels?: Overlays.LabelResolver;
  experimental?: {
    densityOverride?: Overlays.Density;
    naturalImageTiles?: boolean;
    fizzyLake?: { parts?: readonly string[] };
    theme?: import("./interactions").ThemeConfiguration | null;
  };
  render?:
    | React.ReactElement<RootRenderProps>
    | ((props: RootRenderProps) => React.ReactElement);
  className?: string;
  children?: React.ReactNode;
}
export interface PopupHeldPlacement {
  positionerStyle: Overlays.DesignStyle;
  positionerClassName: string;
  popupClassName: string;
}
export interface StablePopupPlacement extends Overlays.PopupPlacement {
  positionerRef?: React.RefCallback<HTMLElement>;
  popupRef: React.RefCallback<HTMLElement>;
  held: PopupHeldPlacement | null;
}
export interface CoveredMenuSheetOwner {
  count: number;
  inert: boolean;
}
export type LinkClickEvent = Pick<
  React.MouseEvent<HTMLElement>,
  "defaultPrevented" | "button" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey"
>;
export type LinkIntentEventName =
  | "onPointerEnter"
  | "onPointerLeave"
  | "onPointerDown"
  | "onFocus"
  | "onBlur";
export type LinkEventName = LinkIntentEventName | "onClick";
export interface RouterLinkCandidate {
  router: boolean;
  href?: string;
  target?: string;
  download?: string | boolean | null;
}
export type PortalContainer = Element | ShadowRoot | undefined;
export type ModalReleaseTiming = "immediate" | "after-paint" | "after-close";
export interface ModalPortalInertOptions {
  node: HTMLElement | null;
  open: boolean;
  liftOnClose?: () => "now" | "after-paint";
}
export interface PassiveOpenInput {
  type: Overlays.PopupInputKind;
  byHover: boolean;
}
export interface ContextMenuPopupFrameProps
  extends Overlays.MenuPopupElementProps {
  active?: boolean;
}
export type InertRefCounts = WeakMap<Element, number>;
export type CoveredMenuSheetOwners = WeakMap<Element, Set<object>>;
export type NativePopupMouseEvent = React.MouseEvent<HTMLDivElement>;
export interface LinkCandidate {
  router: boolean;
  href?: string;
  target?: string;
  download?: string | boolean | null;
}
export type LinkEvents = Partial<
  Record<LinkEventName, React.EventHandler<React.SyntheticEvent<HTMLElement>>>
>;
export type CssLayerRule = CSSRule & {
  name?: string;
  nameList?: string[];
  layerName?: string;
  styleSheet?: CSSStyleSheet | null;
};

export interface PopoverSheetBodyProps extends React.PropsWithChildren {
  sheetPopup: Overlays.SheetRenderState & { chrome: Overlays.SheetChrome };
  className?: string;
  bodyRef?: React.Ref<HTMLDivElement>;
  bodyClassName?: string;
  closeLabel?: string;
}
