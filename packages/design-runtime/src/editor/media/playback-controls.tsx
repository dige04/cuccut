/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorMediaPlaybackControls(
  runtime: RuntimeBindings,
): () => void {
  var ThisVideoIsnTPlayingHereRightMessage: Dynamic;
  var MediaPlaybackControlsLabel: Dynamic;
  var ThisVideoCouldnTBeLoadedMessage: Dynamic;
  var ThisVideoCouldnTBeLoadedSoMessage: Dynamic;
  var MediaPlaybackControlsQuerySelector: Dynamic;
  var ThisVideoDoesnTSayHowLongMessage: Dynamic;
  var MediaPlaybackControlsFound: Dynamic;
  var MediaPlaybackControlsFound_2: Dynamic;
  var reactMediaPlaybackControls: Dynamic;
  var reactMediaPlaybackControls_2: Dynamic;
  var jsxMediaPlaybackControls: Dynamic;
  var PropertiesInheritedFieldValueAlias: Dynamic;
  var PropertiesInheritedFieldMixedAlias: Dynamic;
  function findPreviewMediaElement(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    if (!input) return null;
    let value2: Dynamic = [
      ...input.querySelectorAll(
        (0, runtime.SessionArtboardStateHandler)(options, context),
      ),
    ].filter(
      (input2?: Dynamic): Dynamic =>
        (input2.closest("[data-sc-name]")?.getAttribute("data-sc-name") ??
          value) === value,
    );
    return (
      value2.find(
        (input2?: Dynamic): Dynamic =>
          typeof input2.checkVisibility == "function"
            ? input2.checkVisibility()
            : true,
      ) ??
      value2[0] ??
      null
    );
  }
  function useVideoPlayback(input?: Dynamic, options: Dynamic = 0): Dynamic {
    let [value, value2]: Dynamic = (0,
      runtime.reactSessionArtboardState.useState)(
        runtime.SessionArtboardStatePausedCurrentTimeDurationConfig,
      ),
      [value3, value4]: Dynamic = (0,
      runtime.reactSessionArtboardState.useState)(false),
      [, value5]: Dynamic = (0, runtime.reactSessionArtboardState.useState)(0),
      value6: Dynamic = (0, runtime.reactSessionArtboardState.useRef)(null),
      value7: Dynamic = (0, runtime.reactSessionArtboardState.useRef)(null),
      value8: Dynamic = (0, runtime.reactSessionArtboardState.useRef)(input);
    value8.current = input;
    (0, runtime.reactSessionArtboardState.useEffect)((): Dynamic => {
      let callback: Dynamic = (): Dynamic => {},
        value9: Dynamic,
        callback2: Dynamic = (): Dynamic => {
          let value10: Dynamic = value8.current();
          if (
            value10 !== null &&
            value10 === value7.current &&
            value10.isConnected
          ) {
            value9 = setTimeout(callback2, 1e3);
            return;
          }
          callback();
          value6.current?.detach();
          value6.current = null;
          value7.current = value10;
          value4(value10 !== null);
          if (value10) {
            let value11: Dynamic = (0, runtime.createVideoPlaybackStore)(
              value10,
            );
            value6.current = value11;
            callback = value11.subscribe(value2);
          } else {
            value2(runtime.SessionArtboardStatePausedCurrentTimeDurationConfig);
            value5((input2?: Dynamic): Dynamic => input2 + 1);
          }
          value9 = setTimeout(callback2, value10 ? 1e3 : 300);
        };
      callback2();
      return (): Dynamic => {
        clearTimeout(value9);
        callback();
        value6.current?.detach();
        value6.current = null;
        value7.current = null;
      };
    }, [options]);
    return {
      at: value,
      found: value3,
      toggle: (): Dynamic => value6.current?.toggle(),
      seek: (input2?: Dynamic): Dynamic => {
        value6.current?.seek(input2);
        value2(
          (input3?: Dynamic): Dynamic => ({
            ...input3,
            currentTime: Math.max(0, Math.min(input2, input3.duration)),
          }),
        );
      },
    };
  }
  function VideoPlayControl({
    find: find,
    gen = 0,
    whyAbsent: whyAbsent,
  }: Dynamic): Dynamic {
    let {
        at: value,
        found: value2,
        toggle: value3,
      }: Dynamic = useVideoPlayback(find, gen),
      value4: Dynamic = MediaPlaybackControlsFound_2(
        {
          found: value2,
          ready: value.ready,
          failed: value.failed,
        },
        value2 ? undefined : whyAbsent?.(),
      ),
      value5: Dynamic = value.paused
        ? runtime.MediaVideoPlaybackPlayPauseSeekConfig.play
        : runtime.MediaVideoPlaybackPlayPauseSeekConfig.pause;
    return (
      <runtime.SessionStripButton
        data-testid={"mega-video-playpause"}
        icon={
          <runtime.Icon
            name={
              value.paused
                ? runtime.MediaVideoPlaybackPlayPauseConfig.play
                : runtime.MediaVideoPlaybackPlayPauseConfig.pause
            }
            size={"sm"}
          />
        }
        aria-label={value5}
        title={value4 ?? value5 + " video"}
        disabled={value4 !== undefined}
        onClick={value3}
      />
    );
  }
  function VideoSeekControl({
    find: find,
    gen = 0,
    whyAbsent: whyAbsent,
  }: Dynamic): Dynamic {
    let {
        at: value,
        found: value2,
        toggle: value3,
        seek: value4,
      }: Dynamic = useVideoPlayback(find, gen),
      value5: Dynamic = MediaPlaybackControlsFound(
        {
          found: value2,
          ready: value.ready,
          seekable: value.seekable,
          failed: value.failed,
        },
        value2 ? undefined : whyAbsent?.(),
      ),
      value6: Dynamic = value2 && value.ready;
    return (
      <runtime.PropertyRangeRow
        label={"Time"}
        value={Math.round(value.currentTime * 10) / 10}
        min={0}
        max={Math.max(0.1, Math.round(value.duration * 10) / 10)}
        step={0.1}
        unit={"s"}
        disabled={value5 !== undefined}
        title={
          value5 ??
          runtime.MediaVideoPlaybackPlayPauseSeekConfig.seek +
            ": " +
            (0, runtime.formatVideoTime)(value.currentTime) +
            " / " +
            (0, runtime.formatVideoTime)(value.duration)
        }
        onLive={value4}
        onValue={value4}
        adornment={
          <runtime.Button
            variant={"ghost"}
            size={"xxs"}
            data-testid={"dc-video-playpause"}
            aria-label={
              value.paused
                ? runtime.MediaVideoPlaybackPlayPauseSeekConfig.play
                : runtime.MediaVideoPlaybackPlayPauseSeekConfig.pause
            }
            title={value6 ? undefined : value5}
            disabled={!value6}
            onClick={value3}
          >
            <runtime.Icon
              name={
                value.paused
                  ? runtime.MediaVideoPlaybackPlayPauseConfig.play
                  : runtime.MediaVideoPlaybackPlayPauseConfig.pause
              }
              size={"xs"}
            />
          </runtime.Button>
        }
      />
    );
  }
  bindRuntimeValue(
    runtime,
    "findPreviewMediaElement",
    () => findPreviewMediaElement,
  );
  bindRuntimeValue(
    runtime,
    "ThisVideoIsnTPlayingHereRightMessage",
    () => ThisVideoIsnTPlayingHereRightMessage,
    (value) => {
      ThisVideoIsnTPlayingHereRightMessage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MediaPlaybackControlsLabel",
    () => MediaPlaybackControlsLabel,
    (value) => {
      MediaPlaybackControlsLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ThisVideoCouldnTBeLoadedMessage",
    () => ThisVideoCouldnTBeLoadedMessage,
    (value) => {
      ThisVideoCouldnTBeLoadedMessage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ThisVideoCouldnTBeLoadedSoMessage",
    () => ThisVideoCouldnTBeLoadedSoMessage,
    (value) => {
      ThisVideoCouldnTBeLoadedSoMessage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MediaPlaybackControlsQuerySelector",
    () => MediaPlaybackControlsQuerySelector,
    (value) => {
      MediaPlaybackControlsQuerySelector = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ThisVideoDoesnTSayHowLongMessage",
    () => ThisVideoDoesnTSayHowLongMessage,
    (value) => {
      ThisVideoDoesnTSayHowLongMessage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MediaPlaybackControlsFound",
    () => MediaPlaybackControlsFound,
    (value) => {
      MediaPlaybackControlsFound = value;
    },
  );
  bindRuntimeValue(runtime, "useVideoPlayback", () => useVideoPlayback);
  bindRuntimeValue(
    runtime,
    "MediaPlaybackControlsFound_2",
    () => MediaPlaybackControlsFound_2,
    (value) => {
      MediaPlaybackControlsFound_2 = value;
    },
  );
  bindRuntimeValue(runtime, "VideoPlayControl", () => VideoPlayControl);
  bindRuntimeValue(runtime, "VideoSeekControl", () => VideoSeekControl);
  bindRuntimeValue(
    runtime,
    "reactMediaPlaybackControls",
    () => reactMediaPlaybackControls,
    (value) => {
      reactMediaPlaybackControls = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactMediaPlaybackControls_2",
    () => reactMediaPlaybackControls_2,
    (value) => {
      reactMediaPlaybackControls_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxMediaPlaybackControls",
    () => jsxMediaPlaybackControls,
    (value) => {
      jsxMediaPlaybackControls = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesInheritedFieldValueAlias",
    () => PropertiesInheritedFieldValueAlias,
    (value) => {
      PropertiesInheritedFieldValueAlias = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PropertiesInheritedFieldMixedAlias",
    () => PropertiesInheritedFieldMixedAlias,
    (value) => {
      PropertiesInheritedFieldMixedAlias = value;
    },
  );
  return () => {
    ThisVideoIsnTPlayingHereRightMessage =
      "This video isn't playing here right now. Scroll it into view to play it.";
    MediaPlaybackControlsLabel = "The video hasn't loaded yet.";
    ThisVideoCouldnTBeLoadedMessage = "This video couldn't be loaded.";
    ThisVideoCouldnTBeLoadedSoMessage =
      "This video couldn't be loaded, so only its still is shown.";
    MediaPlaybackControlsQuerySelector = (input?: Dynamic): Dynamic =>
      (0, runtime.isImageDecodeQueued)(input)
        ? "Only " +
          String(4) +
          " videos play at once on a page. This one starts when another is deleted or leaves view."
        : (document as Dynamic).querySelector(
              '[data-mega-annotation="' +
                CSS.escape(input) +
                '"][data-clip-failed]',
            ) != null
          ? ThisVideoCouldnTBeLoadedSoMessage
          : undefined;
    ThisVideoDoesnTSayHowLongMessage =
      "This video doesn't say how long it is (a screen recording often doesn't), so it can be played and paused but not scrubbed.";
    MediaPlaybackControlsFound = (
      input?: Dynamic,
      options?: Dynamic,
    ): Dynamic =>
      input.found
        ? input.failed
          ? ThisVideoCouldnTBeLoadedMessage
          : input.ready
            ? input.seekable
              ? undefined
              : ThisVideoDoesnTSayHowLongMessage
            : MediaPlaybackControlsLabel
        : (options ?? ThisVideoIsnTPlayingHereRightMessage);
    MediaPlaybackControlsFound_2 = (
      input?: Dynamic,
      options?: Dynamic,
    ): Dynamic =>
      input.found
        ? input.failed
          ? ThisVideoCouldnTBeLoadedMessage
          : input.ready
            ? undefined
            : MediaPlaybackControlsLabel
        : (options ?? ThisVideoIsnTPlayingHereRightMessage);
    (0, runtime.initializeCdsIndex)();
    reactMediaPlaybackControls = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    reactMediaPlaybackControls_2 = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    (0, runtime.initializeCdsIndex)();
    jsxMediaPlaybackControls = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    PropertiesInheritedFieldValueAlias = runtime.PropertiesInheritedFieldValue;
    PropertiesInheritedFieldMixedAlias = runtime.PropertiesInheritedFieldMixed;
  };
}
