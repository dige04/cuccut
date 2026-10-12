/** Restored application module; prepare first, initialize in original order. */
import type { ReactElement } from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";
import type { PeerWhoPresence, RoomPeer } from "../host/room-presence";

/** One collaborator shown on a slide thumbnail. */
export interface SlidePresencePeer {
  /** Stable key: the account (`u:`) or, for anonymous peers, the peer id (`p:`). */
  key: string;
  /** Account id, or null for anonymous peers. */
  by: string | null;
  name: string;
  /** CSS color for the avatar. */
  color: string;
}
/** Who is on a slide: the listed peers (capped) and the real head count. */
export interface SlidePresenceEntry {
  peers: SlidePresencePeer[];
  total: number;
}
export interface SlidePresenceBadgeProps {
  on: SlidePresenceEntry | undefined;
  /** DOM id of the screen-reader text. */
  id?: string;
  /** Extra sentence prepended to the screen-reader text. */
  also?: string;
}
type PeerEntries = Map<string, [peerId: string, peer: SlidePresencePeer]>;
type SlidePresenceById = Map<string, SlidePresenceEntry>;

declare module "../bindings" {
  interface RuntimeBindings {
    ReactSlidePresence: ReactNamespace;
    SlidePresenceJsx: JsxNamespace;
    MAX_PRESENCE_SLIDE_ID_CHARS: number;
    MAX_PRESENCE_NAME_CHARS: number;
    MAX_VISIBLE_SLIDE_PEERS: number;
    ANONYMOUS_PEER_NAME: string;
    MAX_LISTED_SLIDE_PEERS: number;
    subscribeNoSlidePresence: (listener: () => void) => () => void;
    truncatePresenceName: (name: string) => string;
    collectSlidePresence: (
      peers: readonly RoomPeer[],
      deckId: string | null,
      hasSlide: (slideId: string) => boolean,
    ) => SlidePresenceById;
    useSlidePresence: (
      deckId: string | null | undefined,
      slides: readonly { id: string }[],
    ) => SlidePresenceById;
    formatSlidePresenceLabel: (
      presence: SlidePresenceEntry | undefined,
    ) => string;
    SlidePresenceBadge: (props: SlidePresenceBadgeProps) => ReactElement | null;
  }
}

export function installCollaborationSlidePresence(
  runtime: RuntimeBindings,
): () => void {
  var ReactSlidePresence: ReactNamespace;
  var SlidePresenceJsx: JsxNamespace;
  var MAX_PRESENCE_SLIDE_ID_CHARS: number;
  var MAX_PRESENCE_NAME_CHARS: number;
  var MAX_VISIBLE_SLIDE_PEERS: number;
  var ANONYMOUS_PEER_NAME: string;
  var MAX_LISTED_SLIDE_PEERS: number;
  var subscribeNoSlidePresence: (listener: () => void) => () => void;
  var truncatePresenceName: (name: string) => string;
  function collectSlidePresence(
    peers: readonly RoomPeer[],
    deckId: string | null,
    hasSlide: (slideId: string) => boolean,
  ): SlidePresenceById {
    let presenceBySlide = new Map<string, PeerEntries>();
    for (let value of peers) {
      if (value.sameTab || value.isMe) {
        continue;
      }
      let context = value.presence.context;
      if (
        typeof context !== "object" ||
        context === null ||
        Array.isArray(context)
      ) {
        continue;
      }
      let value2 = context,
        slideId = value2.slideId;
      if (
        (value2.deck ?? null) !== deckId ||
        typeof slideId !== "string" ||
        slideId === "" ||
        slideId.length > MAX_PRESENCE_SLIDE_ID_CHARS ||
        !hasSlide(slideId)
      ) {
        continue;
      }
      let who = value.presence.who,
        value3: PeerWhoPresence =
          typeof who === "object" && who !== null ? who : {},
        value4 =
          value.by !== null ? "u:" + value.by : "p:" + value.peer,
        value5: PeerEntries = presenceBySlide.get(slideId) ?? new Map(),
        entry = value5.get(value4);
      if (entry === undefined || value.peer < entry[0]) {
        value5.set(value4, [
          value.peer,
          {
            key: value4,
            by: value.by,
            name:
              typeof value3.n === "string"
                ? truncatePresenceName(value3.n)
                : "",
            color: (0, runtime.peerColorCssVariable)(
              (0, runtime.peerColorIndex)(value3.c, value.peer),
            ),
          },
        ]);
      }
      presenceBySlide.set(slideId, value5);
    }
    let callback = (
        input: readonly [string, unknown],
        options: readonly [string, unknown],
      ) => (input[0] < options[0] ? -1 : input[0] > options[0] ? 1 : 0),
      callback2 = (input: [string, [string, SlidePresencePeer]]) =>
        input[1][1].by === null ? 1 : 0;
    return new Map(
      [...presenceBySlide].sort(callback).map(
        ([input, input2]): [string, SlidePresenceEntry] => [
          input,
          {
            peers: [...input2]
              .sort(
                (input3, options) =>
                  callback2(input3) - callback2(options) ||
                  callback(input3, options),
              )
              .slice(0, MAX_LISTED_SLIDE_PEERS)
              .map(([, [, input3]]) => input3),
            total: input2.size,
          },
        ],
      ),
    );
  }
  function useSlidePresence(
    deckId: string | null | undefined,
    slides: readonly { id: string }[],
  ): SlidePresenceById {
    let slideIds = ReactSlidePresence.useMemo(
        () => new Set(slides.map((input) => input.id)),
        [slides],
      ),
      getSnapshot = ReactSlidePresence.useCallback(
        () =>
          deckId === undefined
            ? "[]"
            : JSON.stringify([
                ...collectSlidePresence(
                  runtime.roomPeerStore.getSnapshot(),
                  deckId,
                  (input) => slideIds.has(input),
                ),
              ]),
        [deckId, slideIds],
      ),
      value = ReactSlidePresence.useSyncExternalStore(
        deckId === undefined
          ? subscribeNoSlidePresence
          : runtime.roomPeerStore.subscribe,
        getSnapshot,
        getSnapshot,
      ),
      memo = ReactSlidePresence.useMemo(
        () => new Map<string, SlidePresenceEntry>(JSON.parse(value)),
        [value],
      ),
      memo2 = ReactSlidePresence.useMemo(
        () =>
          [
            ...new Set(
              [...memo.values()].flatMap(
                (input) =>
                  input.peers.flatMap(
                    (input2) => (input2.by === null ? [] : [input2.by]),
                  ),
              ),
            ),
          ].sort().join(`
`),
        [memo],
      ),
      [value2, value3] = ReactSlidePresence.useState<Map<string, string>>(
        new Map(),
      );
    ReactSlidePresence.useEffect(() => {
      if (memo2 === "") {
        return;
      }
      let flag = true;
      (0, runtime.userProfiles)(
        memo2.split(`
`),
      ).then((input: Map<string, string>) => {
        if (flag) {
          value3(input);
        }
      });
      return () => {
        flag = false;
      };
    }, [memo2]);
    return ReactSlidePresence.useMemo(
      () =>
        new Map(
          [...memo].map(
            ([input, input2]): [string, SlidePresenceEntry] => [
              input,
              {
                total: input2.total,
                peers: input2.peers.map(
                  (input3) => ({
                    ...input3,
                    name:
                      truncatePresenceName(
                        (input3.by !== null && value2.get(input3.by)) || "",
                      ) ||
                      input3.name ||
                      ANONYMOUS_PEER_NAME,
                  }),
                ),
              },
            ],
          ),
        ),
      [memo, value2],
    );
  }
  function formatSlidePresenceLabel(
    presence: SlidePresenceEntry | undefined,
  ): string {
    if (presence === undefined || presence.total === 0) {
      return "";
    }
    let names = presence.peers
        .map((input) => input.name)
        .filter(
          (input) => input !== "" && input !== ANONYMOUS_PEER_NAME,
        ),
      unnamedCount = presence.total - names.length;
    if (names.length === 0) {
      return (
        String(unnamedCount) +
        (unnamedCount === 1 ? " person is" : " people are") +
        " on this slide"
      );
    }
    let value =
      unnamedCount > 0
        ? String(unnamedCount) + (unnamedCount === 1 ? " other" : " others")
        : names.pop();
    return (
      (names.length > 0 ? names.join(", ") + " and " : "") +
      value +
      (presence.total === 1 ? " is" : " are") +
      " on this slide"
    );
  }
  function SlidePresenceBadge({
    on: presence,
    id: id,
    also: also,
  }: SlidePresenceBadgeProps): ReactElement | null {
    if (presence === undefined || presence.total === 0) {
      return null;
    }
    return SlidePresenceJsx.jsxs(SlidePresenceJsx.Fragment, {
      children: [
        SlidePresenceJsx.jsx("span", {
          id: id,
          "aria-hidden": "true",
          "data-mc-chrome": "",
          className: "pointer-events-none sr-only",
          children:
            (also === undefined ? "" : also + ". ") +
            formatSlidePresenceLabel(presence),
        }),
        SlidePresenceJsx.jsx(runtime.CdsRoot, {
          density: "compact",
          render: SlidePresenceJsx.jsx("span", {
            title: "",
            "aria-hidden": "true",
            "data-mc-chrome": "",
            "data-kit": "peer-avatars",
          }),
          className: "absolute top-2 right-2 flex",
          children: SlidePresenceJsx.jsx(runtime.AvatarStack, {
            size: "xs",
            max: MAX_VISIBLE_SLIDE_PEERS,
            total: presence.total,
            noun: "people",
            children: presence.peers.map(
              (input) =>
                SlidePresenceJsx.jsx(
                  runtime.TooltipWrapper,
                  {
                    tip: input.name,
                    children: SlidePresenceJsx.jsx(runtime.Avatar, {
                      name: input.name,
                      style: {
                        backgroundColor: input.color,
                        color: runtime.designTokens.on.accent.cssVar,
                      },
                    }),
                  },
                  input.key,
                ),
            ),
          }),
        }),
      ],
    });
  }
  bindRuntimeValue(
    runtime,
    "ReactSlidePresence",
    () => ReactSlidePresence,
    (value) => {
      ReactSlidePresence = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SlidePresenceJsx",
    () => SlidePresenceJsx,
    (value) => {
      SlidePresenceJsx = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_PRESENCE_SLIDE_ID_CHARS",
    () => MAX_PRESENCE_SLIDE_ID_CHARS,
    (value) => {
      MAX_PRESENCE_SLIDE_ID_CHARS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_PRESENCE_NAME_CHARS",
    () => MAX_PRESENCE_NAME_CHARS,
    (value) => {
      MAX_PRESENCE_NAME_CHARS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_VISIBLE_SLIDE_PEERS",
    () => MAX_VISIBLE_SLIDE_PEERS,
    (value) => {
      MAX_VISIBLE_SLIDE_PEERS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ANONYMOUS_PEER_NAME",
    () => ANONYMOUS_PEER_NAME,
    (value) => {
      ANONYMOUS_PEER_NAME = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_LISTED_SLIDE_PEERS",
    () => MAX_LISTED_SLIDE_PEERS,
    (value) => {
      MAX_LISTED_SLIDE_PEERS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "subscribeNoSlidePresence",
    () => subscribeNoSlidePresence,
    (value) => {
      subscribeNoSlidePresence = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "truncatePresenceName",
    () => truncatePresenceName,
    (value) => {
      truncatePresenceName = value;
    },
  );
  bindRuntimeValue(runtime, "collectSlidePresence", () => collectSlidePresence);
  bindRuntimeValue(runtime, "useSlidePresence", () => useSlidePresence);
  bindRuntimeValue(
    runtime,
    "formatSlidePresenceLabel",
    () => formatSlidePresenceLabel,
  );
  bindRuntimeValue(runtime, "SlidePresenceBadge", () => SlidePresenceBadge);
  return () => {
    (0, runtime.initializeModelEditing)();
    (0, runtime.initializeSlideModel)();
    (0, runtime.initializeSlideRenderer)();
    (0, runtime.initializeUiInputs210)();
    ReactSlidePresence = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    SlidePresenceJsx = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    MAX_PRESENCE_SLIDE_ID_CHARS = 128;
    MAX_PRESENCE_NAME_CHARS = 40;
    MAX_VISIBLE_SLIDE_PEERS = 3;
    ANONYMOUS_PEER_NAME = "Someone";
    MAX_LISTED_SLIDE_PEERS = MAX_VISIBLE_SLIDE_PEERS + 4;
    subscribeNoSlidePresence = () => () => {
      return;
    };
    truncatePresenceName = (input) =>
      (0, runtime.sanitizePresenceLabel)(
        input.slice(0, MAX_PRESENCE_NAME_CHARS * 4),
        MAX_PRESENCE_NAME_CHARS,
      );
  };
}
