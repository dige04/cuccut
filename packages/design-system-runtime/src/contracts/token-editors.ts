import type * as React from "react";
import type * as Model from "../contracts";
import type { ContrastOptions, ContrastResult } from "./color-controls";
export type RenameResult = boolean | string | void;
export interface EditableLength {
  n: number;
  unit: string;
}
export interface RenameFocusContext {
  doc: Document;
  scope: Element | null;
  inRow: boolean;
}
export interface EditableNameProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  name: string;
  taken: ReadonlySet<string>;
  commit?: (name: string) => RenameResult;
  kind?: "token" | "title";
  defaultTitle?: string;
  placeholder?: string;
  onEditing?: (editing: boolean) => void;
  autoEdit?: boolean;
  inputTestId?: string;
  "data-testid"?: string;
}
export interface RowPoint {
  x: number;
  y: number;
}
export interface RowTouchSession extends RowPoint {
  fired: boolean;
  timer: number;
}
export interface RowContextState {
  at: RowPoint | null;
  anchor: "point" | "tap";
  close(): void;
  rowProps: React.HTMLAttributes<HTMLElement>;
}
export interface RowActions {
  rename?: () => void;
  copy?: string;
  remove?: () => void;
  removeLabel?: string;
  goto?: () => void;
  gotoLabel?: string;
  inherit?: { label: string; run: () => void }[];
}
export interface RowContextMenuProps {
  title: string;
  at: RowPoint | null;
  anchor?: "point" | "tap";
  onClose(): void;
  actions: RowActions;
  testid?: string;
}
export interface RemoveRowButtonProps {
  label: string;
  onRemove(): void;
  tabIndex?: number;
  "data-testid"?: string;
}
export interface SectionHead {
  title: string;
  defaultTitle?: string;
  placeholder?: string;
  onRename?: (name: string) => RenameResult;
  onRemove?: () => void;
  removeWhy?: string;
  "data-testid"?: string;
  autoEdit?: { placeholder?: string; onEnd(): void };
}
export interface SectionHeaderProps {
  title: string;
  actions?: React.ReactNode;
  note?: React.ReactNode;
  pageId?: string;
  "data-testid"?: string;
}
export interface SectionSheetProps {
  children?: React.ReactNode;
  "data-testid"?: string;
}
export interface SectionAddButtonProps {
  label: string;
  what?: string;
  icon?: React.ReactNode;
  onClick(trigger: HTMLButtonElement): void;
  disabled?: boolean;
  "data-testid"?: string;
}
export interface TokenTableSectionProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "name"> {
  name: React.ReactNode;
  actions?: React.ReactNode;
  headTestId?: string;
  "data-testid"?: string;
}
export interface SectionCollapseButtonProps {
  open: boolean;
  onToggle(): void;
  label: string;
  "data-testid"?: string;
}
export interface RemoveSectionButtonProps {
  label: string;
  onRemove?: () => void;
  why?: string;
  icon?: React.ReactNode;
  verb?: string;
  "data-testid"?: string;
}
export interface SectionCardProps {
  head: SectionHead;
  actions?: React.ReactNode;
  className?: string;
  cardKey?: string;
  anchorId?: string;
  dropGroup?: string;
  overlay?: React.ReactNode;
  dropHandlers?: React.HTMLAttributes<HTMLElement>;
  "data-testid"?: string;
  flat?: boolean;
  children?: React.ReactNode;
}
export interface ConfirmRemoveDialogProps {
  title: string;
  children?: React.ReactNode;
  confirmLabel?: string;
  onCancel(): void;
  onConfirm(): void;
}
export type EmptySectionKind =
  | "colors"
  | "type"
  | "spacing"
  | "corners"
  | "shadows"
  | "components"
  | "assets"
  | "family";
export interface EditorActionButtonProps {
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  label: string;
  icon?: React.ReactNode;
  "data-testid"?: string;
  disabled?: boolean;
  why?: string;
}
export type ScaleKind = "spacing" | "radius" | "extra";
export interface ScalarEdit {
  value(name: string, value: string): void;
  rename(name: string, next: string): RenameResult;
  usage(name: string, usage: string): void;
  remove(name: string): void;
  done(): void;
}
export interface EditorScalarToken extends Omit<Model.ScalarToken, "usage"> {
  usage?: string;
}
export interface EditorScale<T = EditorScalarToken> {
  note?: string;
  tokens: T[];
}
export interface ScaleGroup {
  kind: ScaleKind;
  name: string;
  tokens: EditorScalarToken[];
  family?: { key: string; title: string };
}
export interface ExtraScaleFamily {
  key: string;
  title: string;
  scale: EditorScale;
}
export interface PlainTokenValueEditorProps {
  t: EditorScalarToken;
  edit: ScalarEdit;
  testid: string;
}
export interface LengthTokenValueEditorProps
  extends PlainTokenValueEditorProps {
  kind: ScaleKind;
}
export interface TokenScaleRowProps {
  t: EditorScalarToken;
  kind: ScaleKind;
  section: string;
  taken: ReadonlySet<string>;
  edit?: ScalarEdit;
}
export interface TokenScaleSectionsProps {
  groups: ScaleGroup[];
  editFor?: (group: ScaleGroup) => ScalarEdit | undefined;
  headFor?: (group: ScaleGroup) => SectionHead | undefined;
}
export interface TokenNameGroup<T> {
  name: string;
  tokens: T[];
}
export interface EditorColorToken extends Omit<Model.ColorToken, "usage"> {
  usage?: string;
  alias?: Record<string, { css?: string; to: string }>;
}
export interface ThemeColorValue {
  css?: string;
  to?: string;
  declared: string;
  inherited: boolean;
}
export interface ContrastRequest {
  label: string;
  request: string;
  prompt: string;
}
export type ColorContrastFor = (
  token: EditorColorToken,
  theme: string,
) => ContrastOptions | undefined;
export interface ColorEdit {
  value(name: string, theme: string, value: string): void;
  clear?(name: string, theme: string): void;
  rename(name: string, next: string): RenameResult;
  usage(name: string, value: string): void;
  remove(name: string): void;
  done(): void;
  addTo?(group: TokenNameGroup<EditorColorToken>): void;
  addGroup?(manual?: boolean): void;
  renameGroup?(
    group: TokenNameGroup<EditorColorToken>,
    next: string,
  ): RenameResult;
  removeGroup?(group: TokenNameGroup<EditorColorToken>): void;
}
export interface ColorSwatchProps {
  css?: string;
  inherited?: boolean;
  small?: boolean;
}
export interface ColorValueCellProps {
  token: EditorColorToken;
  theme: Model.ColorTheme;
  themes: Model.ColorTheme[];
  firstId?: string;
  edit?: ColorEdit;
  onGoto(name: string): void;
  contrastFor: ColorContrastFor;
  askClaude?: (request: ContrastRequest, trigger: HTMLElement) => void;
  busy?: boolean;
}
export interface ColorTokenRowProps extends Omit<ColorValueCellProps, "theme"> {
  names: ReadonlySet<string>;
  flash?: boolean;
  rowRef?: React.Ref<HTMLDivElement>;
  gridStyle?: React.CSSProperties;
}
export interface ColorsSectionProps {
  themes: Model.ColorTheme[];
  groups: TokenNameGroup<EditorColorToken>[];
  edit?: ColorEdit;
  names?: ReadonlySet<string>;
  askClaude?: ColorValueCellProps["askClaude"];
  busy?: boolean;
}
export interface EditorSectionHeaderProps<Edit> {
  edit?: Edit;
  note?: React.ReactNode;
}
export interface SingleBoxShadow {
  x: number;
  y: number;
  blur: number;
  spread?: number;
  color: string;
}
export interface ShadowSummary {
  text: string;
  color: string | null;
}
export interface ShadowValueEditorProps {
  label: string;
  value: string;
  onChange(value: string): void;
  onLive?: (value: string) => void;
  onLiveEnd?: () => void;
  testid: string;
  clear?: { label: string; run(): void };
  anchorKey?: string;
  editsAreUndoSteps?: boolean;
}
export interface ShadowEdit {
  add?():void;
  value(name: string, theme: string, value: string): void;
  live?: (name: string, theme: string, value: string) => void;
  done?: () => void;
  rename(name: string, next: string): RenameResult;
  usage(name: string, value: string): void;
  remove(name: string): void;
}
export interface EditorShadowToken extends Omit<Model.ShadowToken, "usage"> {
  usage?: string;
}
export interface ShadowValueCellProps {
  t: EditorShadowToken;
  theme: Model.ColorTheme;
  edit?: ShadowEdit;
  testid: string;
}
export interface ShadowTokenRowProps {
  t: EditorShadowToken;
  themes: Model.ColorTheme[];
  grounds: Record<string, { well: string; card: string }>;
  preview: Model.ColorTheme;
  taken: ReadonlySet<string>;
  edit?: ShadowEdit;
}
export interface ShadowsSectionProps {
  shadows: EditorScale<EditorShadowToken>;
  themes: Model.ColorTheme[];
  grounds: Record<string, { well: string; card: string }>;
  previewThemeId?: string;
  edit?: ShadowEdit;
  head?: SectionHead;
}
export interface EditorTypeStyle
  extends Omit<
    Model.TypographyStyle,
    "family" | "opticalSize" | "sample" | "usage"
  > {
  familyKey?: string;
  opticalSize?: number;
  sample?: string;
  usage?: string;
}
export interface EditorTypeGroup
  extends Omit<Model.TypographyGroup, "styles" | "note"> {
  styles: EditorTypeStyle[];
  note?: string;
}
export interface EditorFont
  extends Pick<
    Model.ParsedFont,
    "path" | "family" | "weight" | "style" | "format" | "missing"
  > {
  asset?: boolean;
  stray?: boolean;
}
export interface TypographyPreviewStyle {
  fontSize: string;
  fontWeight: string | number;
  lineHeight: string;
  letterSpacing: string;
  fontStyle?: string;
  opticalSize?: number | null;
}
export interface FontFamilyPickerProps {
  value: string;
  familyKey?: string;
  families: Record<string, string>;
  familyNames?: Record<string, string>;
  fontNames?: string[];
  onFamily(key: string): void;
  onFont(name: string): void;
  testid: string;
  disabled?: boolean;
}
export type TypographyField =
  | "family"
  | "fontSize"
  | "fontWeight"
  | "lineHeight"
  | "letterSpacing";
export interface TypeStyleFieldsValue {
  family: string;
  fontSize: string;
  fontWeight: string | number;
  lineHeight: string;
  letterSpacing?: string;
}
export interface TypeStyleFieldsProps {
  v: TypeStyleFieldsValue;
  families: Record<string, string>;
  familyNames?: Record<string, string>;
  fontNames?: string[];
  fontLabel?: string;
  onField(field: TypographyField, value: string): void;
  onLive?: (field: TypographyField, value: string) => void;
  onLiveEnd?: () => void;
  onFont(name: string): void;
  testid: string;
  inputRef?: React.Ref<HTMLInputElement>;
  row?: (label: string, children: React.ReactNode) => React.ReactNode;
  anchorKey?: string;
}
export interface TypographyEdit {
  setField(name: string, field: TypographyField, value: string): void;
  setFont?: (name: string, font: string) => void;
  done(): void;
  rename(name: string, next: string): RenameResult;
  setUsage(name: string, usage: string): void;
  remove(name: string): void;
  add?: (set: string) => void;
  addSet?: () => void;
  uploadFont?: () => void;
  dropMissingFonts?: () => void;
}
export interface TypeStyleMetricEditorsProps {
  s: EditorTypeStyle;
  famKey: string;
  families: Record<string, string>;
  familyNames?: Record<string, string>;
  fontNames?: string[];
  edit: TypographyEdit;
}
export interface TypeStyleSpecimenProps
  extends Omit<TypeStyleMetricEditorsProps, "edit"> {
  edit?: TypographyEdit;
}
export interface TypeStyleRowProps
  extends Omit<TypeStyleSpecimenProps, "famKey"> {
  g: EditorTypeGroup;
  taken: ReadonlySet<string>;
}
export interface TypographySectionProps {
  groups: EditorTypeGroup[];
  families: Record<string, string>;
  familyNames?: Record<string, string>;
  fonts: EditorFont[];
  onRemoveFont?: (font: EditorFont) => void;
  edit?: TypographyEdit;
  headFor?: (group: EditorTypeGroup) => SectionHead | undefined;
}
export interface MissingFontNoticeProps {
  missing: EditorFont[];
  edit?: TypographyEdit;
}
export interface FontFilesListProps {
  fams: [string, EditorFont[]][];
  onRemoveFont?: (font: EditorFont) => void;
}
