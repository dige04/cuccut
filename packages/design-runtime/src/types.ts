/** Public application contracts; implementations use the same domain definitions. */
import type { ApplicationContracts } from "./runtime-contracts";
export type {
  JsonValue,
  DataRecord,
  VersionedIndex,
  MergePolicy,
  MergeContext,
  IndexFileState,
  IndexStateOptions,
  IndexReadResult,
  IndexTextPort,
} from "./contracts/storage";
export type {
  Point,
  Size,
  Rectangle,
  CanvasView,
  AffineTransform,
  ResizeHandle,
  PreviewHandle,
} from "./contracts/geometry";
export type {
  Artboard,
  CanvasPage,
  CanvasLaunch,
  CanvasAnnotation,
  NoteAnnotation,
  BoxAnnotation,
  LineAnnotation,
  ImageAnnotation,
  PenAnnotation,
  CanvasDocument,
  CanvasIndex,
  GuideAlignment,
  LayoutGuide,
  TrackGuide,
  GridGuide,
} from "./contracts/canvas";
export type {
  StoredZipEntry,
  PaperSizeName,
  ExportHeight,
  ImageCaptureScale,
} from "./contracts/export";
export interface DesignFile {
  content: string;
  revision?: string;
}
export interface Disposable {
  dispose(): void;
}
export type Unsubscribe = () => void;
/** Untyped UI/host bindings remain unknown; reviewed operations have concrete signatures. */
export interface DesignRuntime extends Readonly<ApplicationContracts> {
  [name: string]: unknown;
}
export * from "./contracts/ui";
