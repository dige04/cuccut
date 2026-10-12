/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installApplicationDocumentRoot(
  runtime: RuntimeBindings,
): () => void {
  function initializeDesignKeyboardBindings(): Dynamic {
    (0, runtime.blurTextOutsideFind)(
      document,
      undefined,
      (document as Dynamic).querySelector("[data-note-typing-strip]") !== null
        ? runtime.NotesLinkEditingLabel
        : undefined,
    );
  }
  function DesignDocumentRoot(props?: Dynamic): Dynamic {
    let loadState: Dynamic = (0, runtime.useCanvasLoadState)(props.doc),
      [restoreCount, setRestoreCount]: Dynamic = (0,
      runtime.reactChromeTheme.useState)(
        (): Dynamic => props.doc.restoreCount(),
      );
    (0, runtime.reactChromeTheme.useEffect)((): Dynamic => {
      let callback: Dynamic = (): Dynamic => {
        setRestoreCount(props.doc.restoreCount());
        let value: Dynamic = props.doc.title();
        value !== "" &&
          value !== (document as Dynamic).title &&
          ((document as Dynamic).title = value);
      };
      callback();
      return props.doc.subscribe(callback);
    }, [props.doc]);
    return (
      <runtime.EditorChromeRoot>
        <runtime.EditorToastProvider>
          {loadState === "live" ? (
            <runtime.DesignCanvas key={restoreCount} {...props} />
          ) : (
            <runtime.CanvasLoadFailure
              doc={props.doc}
              filePath={props.filePath}
            />
          )}
          <runtime.useExportDeliveries />
          <runtime.PendingEditorToasts />
          <runtime.ScreenReaderAnnouncer />
          <runtime.CanvasDialogHost />
          <runtime.CodePasteTrustDialog />
        </runtime.EditorToastProvider>
      </runtime.EditorChromeRoot>
    );
  }
  bindRuntimeValue(
    runtime,
    "initializeDesignKeyboardBindings",
    () => initializeDesignKeyboardBindings,
  );
  bindRuntimeValue(runtime, "DesignDocumentRoot", () => DesignDocumentRoot);
  return () => {};
}
