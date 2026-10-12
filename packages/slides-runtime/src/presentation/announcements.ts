/** Restored application module; prepare first, initialize in original order. */
import type { ReactElement } from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";

/** Props of the visually hidden live region that announces slide changes to screen readers. */
export interface SlideNavigationAnnouncementProps {
  /** Identity of the current slide; the live region re-arms when it changes, `undefined` keeps it silent. */
  slideKey: string | undefined;
  /** Text to announce for the current slide, or `null` to stay silent. */
  message: () => string | null;
  /** Announce on the first render too (default `false`). */
  announceMount?: boolean;
  /** Delay in milliseconds before the new text is written, so rapid navigation coalesces (default 500). */
  settleMs?: number;
}

declare module "../bindings" {
  interface RuntimeBindings {
    ReactSlideAnnouncement: ReactNamespace;
    SlideAnnouncementJsx: JsxNamespace;
    SlideNavigationAnnouncement: (
      props: SlideNavigationAnnouncementProps,
    ) => ReactElement;
    formatPresentationSlideAnnouncement: (
      index: number,
      count: number,
      title: string,
    ) => string;
  }
}

export function installPresentationAnnouncements(
  runtime: RuntimeBindings,
): () => void {
  var ReactSlideAnnouncement: ReactNamespace;
  var SlideAnnouncementJsx: JsxNamespace;
  function SlideNavigationAnnouncement({
    slideKey: slideKey,
    message: message,
    announceMount = false,
    settleMs = 500,
  }: SlideNavigationAnnouncementProps): ReactElement {
    let [value, value2] = ReactSlideAnnouncement.useState(""),
      ref = ReactSlideAnnouncement.useRef(message);
    ref.current = message;
    let ref2 = ReactSlideAnnouncement.useRef(false);
    ReactSlideAnnouncement.useEffect(() => {
      if (slideKey === undefined) {
        return;
      }
      let value3 = !ref2.current;
      ref2.current = true;
      if (value3 && !announceMount) {
        return;
      }
      value2("");
      if (ref.current() === null) {
        return;
      }
      let value4 = setTimeout(() => {
        let value5 = ref.current();
        if (value5 !== null) {
          value2(value5);
        }
      }, settleMs);
      return () => clearTimeout(value4);
    }, [slideKey, settleMs]);
    return SlideAnnouncementJsx.jsx("span", {
      className: "sr-only",
      role: "status",
      "aria-atomic": "true",
      children: value,
    });
  }
  function formatPresentationSlideAnnouncement(
    index: number,
    count: number,
    title: string,
  ): string {
    return (
      "Slide " +
      String(index + 1) +
      " of " +
      String(count) +
      (title !== "" ? ": " + title : "")
    );
  }
  bindRuntimeValue(
    runtime,
    "ReactSlideAnnouncement",
    () => ReactSlideAnnouncement,
    (value) => {
      ReactSlideAnnouncement = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SlideAnnouncementJsx",
    () => SlideAnnouncementJsx,
    (value) => {
      SlideAnnouncementJsx = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SlideNavigationAnnouncement",
    () => SlideNavigationAnnouncement,
  );
  bindRuntimeValue(
    runtime,
    "formatPresentationSlideAnnouncement",
    () => formatPresentationSlideAnnouncement,
  );
  return () => {
    ReactSlideAnnouncement = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    SlideAnnouncementJsx = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
  };
}
