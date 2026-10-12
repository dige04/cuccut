/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorSelectionHost(
  runtime: RuntimeBindings,
): () => void {
  var reactSelectionHost: Dynamic;
  var selectedElementLocations: Dynamic;
  var SelectionHostAlias: Dynamic;
  var SelectionHostThenValue: Dynamic;
  var awaitEditorReady: Dynamic;
  var runSelectionAction: Dynamic;
  var SelectionHostAlias_2: Dynamic;
  var SelectionHostAlias_3: Dynamic;
  var SelectionHostSubscribers: Dynamic;
  var SelectionHostAdd: Dynamic;
  var HostedEditorErrorBoundary: Dynamic;
  function setSelectionActionHandler(input?: Dynamic): Dynamic {
    SelectionHostAlias = input;
  }
  function setEditorReadyPromise(input?: Dynamic): Dynamic {
    SelectionHostThenValue = input.then(
      (input2?: Dynamic): Dynamic => input2 === true,
      (): Dynamic => false,
    );
  }
  function setSelectionHostFactory(input?: Dynamic): Dynamic {
    SelectionHostAlias_2 = input;
  }
  function setHostedEditorComponent(input?: Dynamic): Dynamic {
    if (SelectionHostAlias_3 !== input) {
      SelectionHostAlias_3 = input;
      for (let value of [...SelectionHostSubscribers] as Dynamic) value();
    }
  }
  function HostedEditor({ host: host }: Dynamic): Dynamic {
    let value: Dynamic = (0, reactSelectionHost.useSyncExternalStore)(
      SelectionHostAdd,
      (): Dynamic => SelectionHostAlias_3,
      (): Dynamic => null,
    );
    return value === null ? null : (
      <HostedEditorErrorBoundary>
        {(() => {
          const _Component = value;
          return <_Component host={host()} />;
        })()}
      </HostedEditorErrorBoundary>
    );
  }
  bindRuntimeValue(
    runtime,
    "reactSelectionHost",
    () => reactSelectionHost,
    (value) => {
      reactSelectionHost = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "selectedElementLocations",
    () => selectedElementLocations,
    (value) => {
      selectedElementLocations = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SelectionHostAlias",
    () => SelectionHostAlias,
    (value) => {
      SelectionHostAlias = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "setSelectionActionHandler",
    () => setSelectionActionHandler,
  );
  bindRuntimeValue(
    runtime,
    "SelectionHostThenValue",
    () => SelectionHostThenValue,
    (value) => {
      SelectionHostThenValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "setEditorReadyPromise",
    () => setEditorReadyPromise,
  );
  bindRuntimeValue(
    runtime,
    "awaitEditorReady",
    () => awaitEditorReady,
    (value) => {
      awaitEditorReady = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "runSelectionAction",
    () => runSelectionAction,
    (value) => {
      runSelectionAction = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SelectionHostAlias_2",
    () => SelectionHostAlias_2,
    (value) => {
      SelectionHostAlias_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "setSelectionHostFactory",
    () => setSelectionHostFactory,
  );
  bindRuntimeValue(
    runtime,
    "SelectionHostAlias_3",
    () => SelectionHostAlias_3,
    (value) => {
      SelectionHostAlias_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SelectionHostSubscribers",
    () => SelectionHostSubscribers,
    (value) => {
      SelectionHostSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "setHostedEditorComponent",
    () => setHostedEditorComponent,
  );
  bindRuntimeValue(
    runtime,
    "SelectionHostAdd",
    () => SelectionHostAdd,
    (value) => {
      SelectionHostAdd = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HostedEditorErrorBoundary",
    () => HostedEditorErrorBoundary,
    (value) => {
      HostedEditorErrorBoundary = value;
    },
  );
  bindRuntimeValue(runtime, "HostedEditor", () => HostedEditor);
  return () => {
    reactSelectionHost = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    selectedElementLocations = (
      input?: Dynamic,
      options?: Dynamic,
      context?: Dynamic,
    ): Dynamic =>
      input.flatMap((input2?: Dynamic): Dynamic => {
        let entry: Dynamic = options.get(input2);
        return entry !== undefined &&
          entry.name !== null &&
          entry.name === context(input2) &&
          entry.tids.length > 0
          ? [
              {
                file: input2,
                tids: [...entry.tids],
              },
            ]
          : [];
      });
    SelectionHostAlias = null;
    SelectionHostThenValue = null;
    awaitEditorReady = (): Dynamic =>
      SelectionHostThenValue ?? Promise.resolve(false);
    runSelectionAction = (input?: Dynamic, options?: Dynamic): Dynamic =>
      SelectionHostAlias === null
        ? Promise.resolve(null)
        : SelectionHostAlias(input, options);
    SelectionHostAlias_2 = null;
    SelectionHostAlias_3 = null;
    SelectionHostSubscribers = new Set();
    SelectionHostAdd = (input?: Dynamic): Dynamic => (
      SelectionHostSubscribers.add(input),
      (): Dynamic => {
        SelectionHostSubscribers.delete(input);
      }
    );
    HostedEditorErrorBoundary = class extends reactSelectionHost.Component {
      declare props: Dynamic;
      state: Dynamic = {
        failed: false,
      };
      static getDerivedStateFromError(): Dynamic {
        return {
          failed: true,
        };
      }
      render(): Dynamic {
        return this.state.failed ? null : this.props.children;
      }
    };
  };
}
