/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type {
  CommentAnchorController,
  CommentAnchorHandlers,
  HostCommentsCapability,
  SlidesHost,
} from "../../../slides/src/editor/slides-host";
import type { HostCapabilityValidator } from "../environment/host-capabilities";

/** Optional host extension: opens the host's comment composer on a canvas element. */
export interface CommentComposerCapability {
  openComposer(options: {
    element?: unknown;
  }): Promise<{ opened?: boolean } | null | undefined>;
}

/** What `slidesHost.use("comments")` may resolve to: the capability, or a marker that it is unavailable. */
type LoadedCommentsCapability =
  | (HostCommentsCapability & { available?: boolean })
  | null
  | undefined;

declare module "../bindings" {
  interface RuntimeBindings {
    supportsCommentComposer: HostCapabilityValidator<CommentComposerCapability>;
    commentsAvailable: () => boolean;
    openCommentComposer: (element?: unknown) => Promise<boolean>;
    getCustomCommentAnchors: (
      handlers: CommentAnchorHandlers,
    ) => Promise<CommentAnchorController | null>;
    getCommentsCapability: () => Promise<HostCommentsCapability | null | undefined>;
  }
}

export function installCommentsCapability(
  runtime: RuntimeBindings,
): () => void {
  var supportsCommentComposer: HostCapabilityValidator<CommentComposerCapability>;
  function commentsAvailable(): boolean {
    return (
      (0, runtime.getHostCapability)("comments") !== undefined ||
      (0, runtime.hasHostCapabilityLoader)()
    );
  }
  async function openCommentComposer(element?: unknown): Promise<boolean> {
    let comments = await (0, runtime.getOrLoadHostCapability)(
      "comments",
      supportsCommentComposer,
    );
    if (comments === null) {
      return false;
    }
    try {
      return (
        (
          await comments.openComposer({
            element: element,
          })
        )?.opened === true
      );
    } catch {
      return false;
    }
  }
  async function getCustomCommentAnchors(
    handlers: CommentAnchorHandlers,
  ): Promise<CommentAnchorController | null> {
    let comments = await getCommentsCapability(),
      customAnchors = comments?.customAnchors;
    if (typeof customAnchors !== "function") {
      return null;
    }
    try {
      let value = await customAnchors.call(comments, handlers);
      if (value && typeof value.compose === "function") {
        return value;
      } else {
        return null;
      }
    } catch {
      return null;
    }
  }
  async function getCommentsCapability(): Promise<
    HostCommentsCapability | null | undefined
  > {
    let slidesHost: SlidesHost | undefined = globalThis.slidesHost;
    if (
      typeof slidesHost?.comments?.customAnchors === "function" ||
      typeof slidesHost?.use !== "function"
    ) {
      return slidesHost?.comments;
    }
    try {
      let value = (await slidesHost.use.call(
        slidesHost,
        "comments",
      )) as LoadedCommentsCapability;
      if (value?.available === false) {
        return null;
      } else {
        return value;
      }
    } catch {
      return null;
    }
  }
  bindRuntimeValue(
    runtime,
    "supportsCommentComposer",
    () => supportsCommentComposer,
    (value) => {
      supportsCommentComposer = value;
    },
  );
  bindRuntimeValue(runtime, "commentsAvailable", () => commentsAvailable);
  bindRuntimeValue(runtime, "openCommentComposer", () => openCommentComposer);
  bindRuntimeValue(
    runtime,
    "getCustomCommentAnchors",
    () => getCustomCommentAnchors,
  );
  bindRuntimeValue(
    runtime,
    "getCommentsCapability",
    () => getCommentsCapability,
  );
  return () => {
    (0, runtime.initializeVideoAssets)();
    (0, runtime.initializeSlideRenderer)();
    (0, runtime.initializeClipRegistry)();
    (0, runtime.initializeRichTextDom)();
    supportsCommentComposer = (0, runtime.capabilityHasMethod)("openComposer");
  };
}
