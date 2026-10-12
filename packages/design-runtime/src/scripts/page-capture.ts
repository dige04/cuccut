/** Page capture program extracted from app.js D$t (offsets 1267848..1295292).
 * The function is serialized by buildCaptureTemplate and executes in the preview document.
 * Browser globals and the explicit options/helpers parameters are its only dependencies.
 */
import type { Dynamic } from "../runtime-types";
export interface PageCaptureOptions {
  layout: { zoom: number; dpr: number };
  viewport: boolean | number;
  selection: boolean | number;
  frame: { w: number; h: number; full?: boolean } | null;
  pages: { h: number; max: number; m?: number; from?: number; n?: number; tops?: number[] } | null;
  selectionRoot: string;
  crop: boolean | number;
  matte: string;
  scale: number;
  maxDimension: number;
  selectionBackground: string;
  selectionVisibleOnly: boolean | number;
  settleFrozen: boolean | number;
  freeze: boolean | number;
  textLayer: boolean | number;
  overlay: string;
  format: string;
  quality: number;
  byteCap: number;
}
export interface PageCaptureHelpers {
  resolveSelectionRoot: (...argumentsList: Dynamic[]) => Dynamic;
  maxCaptureSide: number;
  maxCapturePixels: number;
  collectFontFaceRules: (...argumentsList: Dynamic[]) => Dynamic;
  warnUnembeddedFonts: (...argumentsList: Dynamic[]) => Dynamic;
  collectBackgroundUrls: (...argumentsList: Dynamic[]) => Dynamic;
  replaceBackgroundUrls: (...argumentsList: Dynamic[]) => Dynamic;
  makeCloneStyled: (...argumentsList: Dynamic[]) => Dynamic;
  prepareWebGlCapture: (...argumentsList: Dynamic[]) => Dynamic;
  settleFrozenAnimations: (...argumentsList: Dynamic[]) => Dynamic;
  freezeAnimations: (...argumentsList: Dynamic[]) => Dynamic;
  measureTextOriginOffset: (...argumentsList: Dynamic[]) => Dynamic;
  collectLinks: (...argumentsList: Dynamic[]) => Dynamic;
  collectTextLayer: (...argumentsList: Dynamic[]) => Dynamic;
  countHiddenContent: (...argumentsList: Dynamic[]) => Dynamic;
  sanitizeXmlCharacters: (...argumentsList: Dynamic[]) => Dynamic;
  computePaginationCuts: (...argumentsList: Dynamic[]) => Dynamic;
}
export interface PageCaptureHelperSources {
  resolveSelectionRoot: string | ((...argumentsList: Dynamic[]) => Dynamic);
  maxCaptureSide: number;
  maxCapturePixels: number;
  collectFontFaceRules: string | ((...argumentsList: Dynamic[]) => Dynamic);
  warnUnembeddedFonts: string | ((...argumentsList: Dynamic[]) => Dynamic);
  collectBackgroundUrls: string | ((...argumentsList: Dynamic[]) => Dynamic);
  replaceBackgroundUrls: string | ((...argumentsList: Dynamic[]) => Dynamic);
  makeCloneStyled: string | ((...argumentsList: Dynamic[]) => Dynamic);
  prepareWebGlCapture: string | ((...argumentsList: Dynamic[]) => Dynamic);
  settleFrozenAnimations: string | ((...argumentsList: Dynamic[]) => Dynamic);
  freezeAnimations: string | ((...argumentsList: Dynamic[]) => Dynamic);
  measureTextOriginOffset: string | ((...argumentsList: Dynamic[]) => Dynamic);
  collectLinks: string | ((...argumentsList: Dynamic[]) => Dynamic);
  collectTextLayer: string | ((...argumentsList: Dynamic[]) => Dynamic);
  countHiddenContent: string | ((...argumentsList: Dynamic[]) => Dynamic);
  sanitizeXmlCharacters: string | ((...argumentsList: Dynamic[]) => Dynamic);
  computePaginationCuts: string | ((...argumentsList: Dynamic[]) => Dynamic);
}
export interface PageCaptureResult {
  e?: string;
  l?: Dynamic;
  u?: string;
  pg?: string[];
  pt?: number[];
  pc?: number[];
  po?: number;
  pm?: number;
  hc?: Dynamic;
  w?: string[];
  cw?: number;
  ch?: number;
  lw?: number;
  lh?: number;
  t?: Dynamic;
  tt?: boolean;
  tb?: Dynamic;
  lg?: string | null;
}
export async function capturePage(
  options: PageCaptureOptions,
  helpers: PageCaptureHelpers,
): Promise<PageCaptureResult> {
  try {
    await document.fonts.ready;
  } catch (error) {}
  // rAF-gated FOUC guards (deck-stage) can outlive fonts.ready in a hidden
  // iframe where rAF is throttled; the opacity:0 would bake into the clone.
  document.querySelectorAll("[data-fonts-pending]").forEach(function (element?: Dynamic): Dynamic {
    element.removeAttribute("data-fonts-pending");
  });
  var warnings: Dynamic = [];
  // The copy is laid out at the live page's zoom and drawn back down, so its text measures, rounds and breaks as the live text did.
  // The editor measured the zoom in its own document: it is this page's too only while both report the same device pixel ratio.
  var layout: Dynamic = options.layout,
    layoutZoom: Dynamic =
      Math.abs(Number(window.devicePixelRatio) - layout.dpr) < 1e-6 ? layout.zoom : 0,
    cloneZoom: Dynamic = layoutZoom || 1;
  var viewportOnly: Dynamic = options.viewport;
  var selectionMode: Dynamic = options.selection;
  var root: Dynamic = document.documentElement;
  // Selection capture root + layout-box measurement — embedded from
  // resolveSelectionRoot (a real exported function, so tests exercise it
  // directly; see its doc comment for the promotion and sizing rules).
  var selectionBounds: Dynamic = null;
  // Whole-artboard capture: the declared frame — padded with the page
  // background colour when the content is shorter, its full length past it.
  var frame: Dynamic = options.frame;
  // Paginated frame capture ({h,max}): page-height windows over ONE clone,
  // a raster each at a scale set by the page — the reply carries pg/pt.
  var pages: Dynamic = frame ? options.pages : null;
  if (selectionMode) {
    selectionBounds = helpers.resolveSelectionRoot(
      document,
      options.selectionRoot,
      frame,
      !!pages || !!(frame && frame.full),
    );
    if (selectionBounds.e)
      return {
        e: selectionBounds.e,
      };
    root = selectionBounds.root;
  }
  var fullWidth: Dynamic = root.scrollWidth,
    fullHeight: Dynamic = root.scrollHeight;
  var width: Dynamic = viewportOnly ? root.clientWidth : fullWidth,
    height: Dynamic = viewportOnly ? root.clientHeight : fullHeight;
  var crop: Dynamic = options.crop;
  // Spliced matte (see buildCaptureScript): optional opaque color ('' =
  // off) for thumbnail captures of canvas-mode documents. The injected
  // canvas backdrop stays at its light default in the main viewer now
  // (artifact serves are theme-free), so this normalization is usually a
  // no-op there — kept because documents can still tint their own
  // backdrop (authored scripts, legacy baked runtimes mid-session) and a
  // dark matte must never bake into thumbnails that mostly render on
  // light gallery tiles. Normalized in the captured raster only — the live
  // document is never touched (re-theming it for a capture visibly flashes
  // the preview): the root/body backdrop is neutralized in the clone and
  // the matte painted flat behind the painted bounds. NOTE: never write
  // the spliced token's literal name in comments — splicing must hit the
  // declaration, not prose.
  var matte: Dynamic = options.matte;
  if (matte && !root.hasAttribute("data-dc-canvas")) matte = "";
  // Zero-area viewport (iframe not laid out / backgrounded tab): the crop
  // scan's getImageData would throw IndexSizeError and toDataURL returns
  // "data:,". Throw a named error so thumbnail callers can downgrade it to
  // a telemetry action instead of a browser error. Scoped to crop so
  // non-thumbnail captures are unaffected.
  if (crop && (!width || !height)) throw new Error("capture: zero-area viewport");
  var scrollX: Dynamic = viewportOnly ? window.scrollX || 0 : 0,
    scrollY: Dynamic = viewportOnly ? window.scrollY || 0 : 0;
  var scale: Dynamic =
    options.scale || Math.min(1, options.maxDimension / Math.max(width, height, 1));
  var isTransparent: Dynamic = function (color?: Dynamic): Dynamic {
    return !color || color === "transparent" || color === "rgba(0, 0, 0, 0)";
  };
  var selectionBackground: Dynamic = "";
  if (selectionMode) {
    width = selectionBounds.w;
    height = selectionBounds.h;
    fullWidth = width;
    fullHeight = height;
    scrollX = 0;
    scrollY = 0;
    var pageHeight: Dynamic = pages ? pages.h : height;
    // Requested scale, or fit-to-budget (the preview path's maxDim), or the
    // 2x default; the side cap bounds resolution and the area term bounds
    // total canvas pixels (Firefox hard-fails past ~125MP — 120e6 keeps
    // margin under it). Budgeted per PAGE when paginating.
    scale = Math.min(
      options.scale ||
        (options.maxDimension
          ? Math.min(1, options.maxDimension / Math.max(width, pageHeight))
          : 2),
      helpers.maxCaptureSide / Math.max(width, pageHeight),
      Math.sqrt(helpers.maxCapturePixels / (width * pageHeight)),
    );
    // JPEG backdrop: first non-transparent ancestor background. PNG keeps
    // alpha (the fill below is skipped). A frame capture pads with the
    // page background colour instead (read below, with the editor's
    // backdrop off) and fills for PNG too.
    if (!frame) {
      for (
        var backgroundAncestor: Dynamic = root.parentElement;
        backgroundAncestor;
        backgroundAncestor = backgroundAncestor.parentElement
      ) {
        var backgroundColor: Dynamic = getComputedStyle(backgroundAncestor).backgroundColor;
        if (!isTransparent(backgroundColor)) {
          selectionBackground = backgroundColor;
          break;
        }
      }
    }
    if (!selectionBackground) selectionBackground = "#fff";
    // Caller-forced backdrop (buildCaptureScript's selectionBg): selection captures
    // for the model need an opaque image — PNG alpha is for export callers —
    // and the ancestor walk above can land on a backdrop the user never sees
    // behind the element (a deck slide's ancestor is deck-stage's black
    // :host, but the user sees the shadow .canvas's white). Non-empty also
    // forces the fill below even for PNG.
    if (options.selectionBackground) selectionBackground = options.selectionBackground;
  }

  // Cache across captures — the serve path sends no-store so the browser's
  // HTTP cache can't help, but the same assets recur every capture. Only
  // persists when a caller has primed window.__omCaptureCache (runGenPptx's
  // per-export map; the annotate path's version-keyed holder — see
  // buildCaptureCachePrimeScript); other capture callers get a
  // per-invocation map so edits aren't served stale.
  var dataUrlCache: Dynamic = (window as Dynamic).__omCaptureCache || {};
  // Inline an image URL as a data URL. A non-inlined image is NOT a soft
  // degradation: the clone rasterizes via SVG-as-image, which is forbidden
  // from loading external resources, so any URL left un-inlined renders
  // BLANK in every crop — silently. So: retry once on failure, and when
  // both attempts fail, surface a warning naming the asset (callers show
  // warnings) while falling back to the URL.
  function fetchDataURL(url?: Dynamic): Dynamic {
    return fetch(url)
      .then(function (response?: Dynamic): Dynamic {
        if (!response.ok) throw new Error("http " + response.status);
        return response.blob();
      })
      .then(function (blob?: Dynamic): Dynamic {
        return new Promise(function (resolve?: Dynamic, reject?: Dynamic): Dynamic {
          var reader: Dynamic = new FileReader();
          reader.onload = function (): Dynamic {
            resolve(reader.result);
          };
          reader.onerror = function (): Dynamic {
            reject(new Error("read"));
          };
          reader.readAsDataURL(blob);
        });
      });
  }
  var warnedUrls: Dynamic = {};
  // In-flight fetches coalesce in a capture-LOCAL pending map: image-slot
  // renders the same src in two stacked <img>s (the photo and its mask
  // ghost), and a settled-only lookup let both concurrent inline jobs
  // miss, fetching + FileReader-ing every unique asset twice per capture.
  // The pending map is deliberately NOT the shared cache: _dc can outlive
  // this capture (the annotate holder, an export's per-run map), and a
  // stored promise that never settles — a hung fetch — would poison every
  // later capture in that scope. _dc therefore only ever holds SETTLED
  // strings (the value contract primers and harvesters rely on:
  // png-export pre-seeds strings, the annotate holder persists them);
  // failures stay un-cached so later captures retry.
  var pendingFetches: Dynamic = {};
  function toDataURL(url?: Dynamic, kind?: Dynamic): Dynamic {
    if (dataUrlCache[url]) return Promise.resolve(dataUrlCache[url]);
    if (pendingFetches[url]) return pendingFetches[url];
    var request: Dynamic = fetchDataURL(url)
      .catch(function (): Dynamic {
        return fetchDataURL(url);
      })
      .then(
        function (dataUrl?: Dynamic): Dynamic {
          dataUrlCache[url] = dataUrl;
          delete pendingFetches[url];
          return dataUrl;
        },
        function (): Dynamic {
          delete pendingFetches[url];
          // One warning per URL (a photo used in N seats is ONE missing photo),
          // and fonts get their own message: a failed font falls back to another
          // face — it does not blank anything, so it must not trip the blank-
          // image toast.
          if (!warnedUrls[url]) {
            warnedUrls[url] = 1;
            warnings.push(
              kind === "font"
                ? "font could not be embedded (a fallback face is used): " + url.slice(0, 120)
                : "image could not be embedded (renders blank in the export): " + url.slice(0, 120),
            );
          }
          return url;
        },
      );
    pendingFetches[url] = request;
    return request;
  }
  async function inlineFonts(): Promise<Dynamic> {
    // Rule collection + used-but-uninlined warning are real exported
    // functions (embedded like makeCloneStyled) so tests exercise them.
    var rules: Dynamic = await helpers.collectFontFaceRules(document, window, warnings);
    helpers.warnUnembeddedFonts(document, rules, warnings);
    if (!rules.length) return "";
    var rulesWithResources: Dynamic = await Promise.all(
      rules.map(async function (rule?: Dynamic): Promise<Dynamic> {
        var urlPattern: Dynamic = /url\((['"]?)([^'")]+)\1\)/g,
          match: Dynamic,
          output: Dynamic = rule.css,
          seenUrls: Dynamic = {};
        while ((match = urlPattern.exec(rule.css))) {
          var url: Dynamic = match[2];
          if (url.indexOf("data:") === 0 || seenUrls[url]) continue;
          seenUrls[url] = 1;
          var absoluteUrl: Dynamic;
          try {
            absoluteUrl = new URL(url, rule.base).href;
          } catch (error) {
            continue;
          }
          var dataUrl: Dynamic = await toDataURL(absoluteUrl, "font");
          output = output.split(match[0]).join('url("' + dataUrl + '")');
        }
        return output;
      }),
    );
    // A ']]>' inside a rule (quoted family / local() name) would end the CDATA early.
    var css: Dynamic = rulesWithResources.join("\n");
    while (css.indexOf("]]>") >= 0) css = css.split("]]>").join("");
    return "<style><![CDATA[" + css + "]]></style>";
  }
  async function inlineImages(node?: Dynamic): Promise<Dynamic> {
    var jobs: Dynamic = [];
    var images: Dynamic = node.querySelectorAll("img");
    for (var imageIndex: Dynamic = 0; imageIndex < images.length; imageIndex++)
      (function (element?: Dynamic): Dynamic {
        var sourceUrl: Dynamic = element.getAttribute("src");
        if (sourceUrl && sourceUrl.indexOf("data:") !== 0)
          jobs.push(function (): Dynamic {
            return toDataURL(element.src).then(function (dataUrl?: Dynamic): Dynamic {
              element.setAttribute("src", dataUrl);
            });
          });
      })(images[imageIndex]);
    // Per-token replacement via real exported helpers (embedded like
    // makeCloneStyled): background-image is multi-layer CSS, so matching
    // one url() and overwriting the whole property would drop every other
    // layer — gradient scrims included.
    var collectBackgroundUrls: Dynamic = helpers.collectBackgroundUrls;
    var replaceBackgroundUrls: Dynamic = helpers.replaceBackgroundUrls;
    var elements: Dynamic = node.querySelectorAll("*");
    for (var elementIndex: Dynamic = 0; elementIndex < elements.length; elementIndex++)
      (function (element?: Dynamic): Dynamic {
        var background: Dynamic = element.style && element.style.backgroundImage;
        var references: Dynamic = collectBackgroundUrls(background);
        if (references.length)
          jobs.push(function (): Dynamic {
            return Promise.all(
              references.map(function (reference?: Dynamic): Dynamic {
                return toDataURL(reference.url).then(function (dataUrl?: Dynamic): Dynamic {
                  return {
                    full: reference.full,
                    d: dataUrl,
                  };
                });
              }),
            ).then(function (pairs?: Dynamic): Dynamic {
              element.style.backgroundImage = replaceBackgroundUrls(background, pairs);
            });
          });
      })(elements[elementIndex]);
    var jobIndex: Dynamic = 0,
      concurrency: Dynamic = Math.min(6, jobs.length) || 1;
    await Promise.all(
      Array.from(
        {
          length: concurrency,
        },
        async function (): Promise<Dynamic> {
          while (jobIndex < jobs.length) await jobs[jobIndex++]();
        },
      ),
    );
  }

  // Clone walk — embedded from makeCloneStyled (a real exported function,
  // so tests exercise it directly with no dynamic evaluation). Bound here,
  // after the matte gate above has finalized, with this run's warn collector.
  // CSS zoom above the capture root is not in the copy, so the copy cannot give its text the zoom it was measured at: assume
  // nothing. The root's own zoom is in the copy, and multiplies.
  function above(node?: Dynamic): Dynamic {
    return (
      node.assignedSlot ||
      node.parentElement ||
      (node.getRootNode && node.getRootNode().host) ||
      null
    );
  }
  for (
    var zoomAncestor: Dynamic = above(root);
    zoomAncestor && layoutZoom;
    zoomAncestor = above(zoomAncestor)
  )
    if ((parseFloat(getComputedStyle(zoomAncestor).zoom) || 1) !== 1) {
      layoutZoom = 0;
      cloneZoom = 1;
    }
  var ownZoom: Dynamic = parseFloat(getComputedStyle(root).zoom) || 1;
  var placeholderCss: Dynamic = [];
  var cloneStyled: Dynamic = helpers.makeCloneStyled(
    document,
    getComputedStyle,
    matte,
    warnings,
    placeholderCss,
    options.selectionVisibleOnly && selectionMode && selectionBounds ? selectionBounds.root : null,
    layoutZoom,
  );
  // Font-CSS cache: like __omCaptureCache but for the assembled <style> string,
  // so repeat captures (video-export frame loop) skip the stylesheet scan +
  // string assembly entirely. Only persists when a caller has primed the slot
  // (set to null); otherwise recomputed so edits aren't served stale.
  var fontCss: Dynamic = (window as Dynamic).__omCaptureFontCss;
  if (fontCss == null) {
    fontCss = await inlineFonts();
    if ((window as Dynamic).__omCaptureFontCss === null)
      (window as Dynamic).__omCaptureFontCss = fontCss;
  }
  var restoreWebGl: Dynamic = await helpers.prepareWebGlCapture(document, window);
  // Frozen-animation settle (opt-in, agent screenshots only — see
  // buildCaptureScript's settleFrozen). Embedded from settleFrozenAnimations
  // (a real exported function, like makeCloneStyled above) so unit tests
  // exercise exactly the code the script runs. Seeks frozen animations to
  // their end state for the duration of the clone walk; the returned restore
  // puts the computed state back.
  var restoreSettled: Dynamic = helpers.settleFrozenAnimations(
    options.settleFrozen ? document : null,
  );
  var restoreFrozen: Dynamic = helpers.freezeAnimations(options.freeze ? document : null);
  if ((options.settleFrozen || options.freeze) && !selectionMode) {
    // Settling/freezing can change layout (height/width/flex growth) —
    // re-measure so the foreignObject and canvas are sized to the seeked
    // layout, not the bounds read at the top of the script; otherwise
    // changed-state content is clipped out. Gated so every other capture
    // keeps its original geometry semantics. Still synchronous: nothing
    // yields between the seeks, this re-measure, the clone walk, and the
    // restores.
    fullWidth = root.scrollWidth;
    fullHeight = root.scrollHeight;
    width = viewportOnly ? root.clientWidth : fullWidth;
    height = viewportOnly ? root.clientHeight : fullHeight;
    scale = options.scale || Math.min(1, options.maxDimension / Math.max(width, height, 1));
  }
  // finally: the clone walk traverses arbitrary user DOM and can throw
  // (e.g. a stack RangeError on pathologically deep content); the live
  // document's animation state must be restored regardless, or paused/
  // seeked animations would persist until reload.
  // Selection chrome (the blue outline) is a stylesheet rule keyed on
  // body:not([data-dc-editor-overlay-hidden]) and would bake into the
  // inlined computed styles — hide it for the synchronous clone walk and
  // restore the previous state after.
  var hadHiddenOverlay: Dynamic =
    selectionMode && document.body.hasAttribute("data-dc-editor-overlay-hidden");
  if (selectionMode) document.body.setAttribute("data-dc-editor-overlay-hidden", "");
  // A frame capture is the design, not the editor: drop the editor's backdrop
  // for the clone walk and read the page colour from what remains (html, body, white).
  var clone: Dynamic,
    textLayer: Dynamic = null,
    links: Dynamic = null,
    avoidCutBands: Dynamic = pages ? [] : null,
    needsPaginationPlan: Dynamic = !(pages && pages.tops && pages.tops.length);
  try {
    if (frame) {
      document.body.setAttribute("data-dc-capturing", "");
      if (!options.selectionBackground) {
        var htmlBackground: Dynamic = getComputedStyle(document.documentElement).backgroundColor,
          bodyBackground: Dynamic = getComputedStyle(document.body).backgroundColor;
        selectionBackground = !isTransparent(htmlBackground)
          ? htmlBackground
          : !isTransparent(bodyBackground)
            ? bodyBackground
            : "#fff";
      }
    }
    // Links, then the PDF text layer, measured in the same synchronous block as the clone, so their geometry
    // IS the clone's layout; an holds the link-anchor numbers both share.
    try {
      clone = cloneStyled(root);
      if (options.textLayer && selectionMode && needsPaginationPlan) {
        var textOriginOffset: Dynamic = 0,
          anchorIds: Dynamic = new Map();
        try {
          textOriginOffset = helpers.measureTextOriginOffset(document, getComputedStyle, root);
        } catch (error) {}
        try {
          links = helpers.collectLinks(getComputedStyle, root, width, height, {
            dy: textOriginOffset,
            skipAttrs: ["data-omelette-chrome", "data-noncommentable", "data-dc-editor-overlay"],
            anchorId: function (anchor?: Dynamic): Dynamic {
              var anchorId: Dynamic = anchorIds.get(anchor);
              if (anchorId === undefined) {
                anchorId = anchorIds.size;
                anchorIds.set(anchor, anchorId);
              }
              return anchorId;
            },
          });
          if (links.truncated) warnings.push("some links were left out");
          links = links.links;
        } catch (error) {
          links = null;
          anchorIds.clear();
          warnings.push("links could not be measured");
        }
        try {
          textLayer = helpers.collectTextLayer(
            document,
            getComputedStyle,
            root,
            pages && pages.max > 1 ? 150000 : 50000,
            width,
            height,
            avoidCutBands,
            textOriginOffset,
            anchorIds,
          );
        } catch (error) {
          warnings.push("text layer could not be measured");
        }
      }
    } finally {
      restoreSettled();
      restoreFrozen();
      restoreWebGl();
    }
    // Media boxes are no-cut bands for the paginator too, and the content's
    // painted end (deepest band, childless box or background-image box) bounds
    // the pages so trailing padding never earns a blank one.
    var contentEnd: Dynamic = 0;
    if (pages && needsPaginationPlan) {
      var rootRect: Dynamic = root.getBoundingClientRect(),
        rootScale: Dynamic =
          root.offsetWidth > 0 && rootRect.width > 0 ? rootRect.width / root.offsetWidth : 1,
        descendants: Dynamic = root.querySelectorAll("*");
      for (var mediaIndex: Dynamic = 0; mediaIndex < descendants.length; mediaIndex++) {
        var mediaElement: Dynamic = descendants[mediaIndex];
        if (
          mediaElement.closest(
            "[data-dc-editor-overlay],[data-omelette-chrome],[data-noncommentable]",
          ) ||
          (mediaElement.checkVisibility &&
            !mediaElement.checkVisibility({
              visibilityProperty: true,
              opacityProperty: true,
            }))
        )
          continue;
        var mediaRect: Dynamic = mediaElement.getBoundingClientRect();
        if (!(mediaRect.width > 0 && mediaRect.height > 0)) continue;
        var mediaBottom: Dynamic = (mediaRect.bottom - rootRect.top) / rootScale;
        if (/^(IMG|SVG|CANVAS|VIDEO|IFRAME)$/i.test(mediaElement.tagName)) {
          avoidCutBands.push([(mediaRect.top - rootRect.top) / rootScale, mediaBottom]);
          if (mediaBottom > contentEnd) contentEnd = mediaBottom;
        } else if (
          mediaBottom > contentEnd &&
          (!mediaElement.firstElementChild ||
            getComputedStyle(mediaElement).backgroundImage !== "none")
        )
          contentEnd = mediaBottom;
      }
      for (var avoidBandIndex: Dynamic = 0; avoidBandIndex < avoidCutBands.length; avoidBandIndex++)
        if (avoidCutBands[avoidBandIndex][1] > contentEnd)
          contentEnd = avoidCutBands[avoidBandIndex][1];
    }
    // A whole-artboard capture (its first chunk, which lays out the whole artboard) also counts what the design keeps out of any
    // capture of it, for the export's telemetry; nothing here is drawn.
    var hiddenContent: Dynamic = null;
    if (frame && needsPaginationPlan) {
      try {
        hiddenContent = helpers.countHiddenContent(
          document,
          getComputedStyle,
          root,
          pages && pages.max === 1 ? +frame.h || height : Infinity,
        );
      } catch (error) {}
    }
  } finally {
    if (selectionMode && !hadHiddenOverlay)
      document.body.removeAttribute("data-dc-editor-overlay-hidden");
    if (frame) document.body.removeAttribute("data-dc-capturing");
  }
  // cloneStyled returns an empty Text node for script/style/chrome-marked
  // roots — nothing capturable was selected.
  if (selectionMode && clone.nodeType !== 1)
    return {
      e: "no-selection",
    };
  // Selection mode only: an svg clone root keeps its own namespace
  // (XMLSerializer declares it); forcing the xhtml xmlns onto it would
  // break its rendering. The whole-page path keeps its unconditional set.
  if (!selectionMode || clone.namespaceURI !== "http://www.w3.org/2000/svg")
    clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  // Selection root normalization: an absolutely-positioned element would
  // otherwise render at its page offset inside the border-box-sized
  // foreignObject (blank image). The root transform is dropped by policy
  // (layout-size export); descendants are untouched. Appended declarations
  // override the inlined computed values.
  if (selectionMode)
    clone.setAttribute(
      "style",
      (clone.getAttribute("style") || "") +
        "margin:0;position:static;inset:auto;top:auto;right:auto;bottom:auto;left:auto;transform:none;translate:none;rotate:none;scale:none;" +
        ((pages && pages.max > 1) || (frame && frame.full) ? "overflow:visible;" : ""),
    );
  // Selection-mode overlay (annotate path): composited into the CLONE, not
  // the live document — a live-DOM inject inside <deck-stage> dirties its
  // thumbnail-rail MutationObserver, so every capture would rebuild the
  // slide's rail thumb (refetching its assets) and could briefly clone the
  // annotation marks into the visible rail. The wrapper is sized to the
  // selection's layout box with overflow:hidden, so marks outside the
  // captured element clip exactly as the live-inject path clips them. An
  // absolutely-positioned wrapper under the position:static clone root
  // anchors to the foreignObject's initial containing block at (0,0) —
  // which is where the root itself renders — so wrapper and root origins
  // coincide. HTML capture roots only (a div child of an svg root would
  // not render); the annotate path's deck slides are HTML sections.
  if (
    selectionMode &&
    options.overlay &&
    clone.nodeType === 1 &&
    clone.namespaceURI !== "http://www.w3.org/2000/svg"
  ) {
    var overlayElement: Dynamic = document.createElement("div");
    overlayElement.style.cssText =
      "position:absolute;left:0;top:0;width:" +
      width +
      "px;height:" +
      height +
      "px;overflow:hidden;pointer-events:none";
    overlayElement.innerHTML = options.overlay;
    clone.appendChild(overlayElement);
  }
  if (cloneZoom !== 1 && clone.nodeType === 1)
    clone.setAttribute(
      "style",
      (clone.getAttribute("style") || "") + "zoom:" + cloneZoom * ownZoom + ";",
    );
  await inlineImages(clone);
  var xml: Dynamic = new XMLSerializer().serializeToString(clone);
  var placeholderStyle: Dynamic = placeholderCss.length
    ? "<style><![CDATA[" + placeholderCss.join("\n") + "]]></style>"
    : "";
  // One serialization (URL-encoded once), any window: top offsets the
  // layout, sh crops it.
  var svgBody: Dynamic = helpers.sanitizeXmlCharacters(fontCss + placeholderStyle + xml),
    encodedSvgBody: Dynamic = null;
  function svgHead(top?: Dynamic, sliceHeight?: Dynamic): Dynamic {
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" width="' +
      width * cloneZoom +
      '" height="' +
      sliceHeight * cloneZoom +
      '"><foreignObject x="' +
      -scrollX * cloneZoom +
      '" y="' +
      (-scrollY - top) * cloneZoom +
      '" width="' +
      fullWidth * cloneZoom +
      '" height="' +
      fullHeight * cloneZoom +
      '">'
    );
  }
  var svgTail: Dynamic = "</foreignObject></svg>";
  function svgAt(top?: Dynamic, sliceHeight?: Dynamic): Dynamic {
    return svgHead(top, sliceHeight) + svgBody + svgTail;
  }
  function svgUrlAt(top?: Dynamic, sliceHeight?: Dynamic): Dynamic {
    if (encodedSvgBody === null) encodedSvgBody = encodeURIComponent(svgBody);
    return (
      "data:image/svg+xml;charset=utf-8," +
      encodeURIComponent(svgHead(top, sliceHeight)) +
      encodedSvgBody +
      encodeURIComponent(svgTail)
    );
  }

  // On onerror, re-parse via DOMParser to surface the actual XML error
  // (line/col + reason). The bare 'svg load failed' gave the agent nothing
  // to act on; the parse diagnostic points at the DOM construct that broke
  // serialization so it can route around it.
  function xmlErr(svg?: Dynamic): Dynamic {
    try {
      var parseError: Dynamic = new DOMParser()
        .parseFromString(svg, "image/svg+xml")
        .querySelector("parsererror");
      return parseError
        ? ": " +
            parseError.textContent
              .replace(/\s+/g, " ")
              .replace(
                /^ ?This page contains the following errors:|Below is a rendering of the page.*$/g,
                "",
              )
              .trim()
              .slice(0, 200)
        : "";
    } catch (error) {
      return "";
    }
  }
  function loadSvg(svg?: Dynamic, url?: Dynamic): Dynamic {
    var image: Dynamic = new Image();
    return new Promise(function (resolve?: Dynamic, reject?: Dynamic): Dynamic {
      image.onload = function (): Dynamic {
        resolve(image);
      };
      image.onerror = function (): Dynamic {
        reject(new Error("svg load failed" + xmlErr(typeof svg === "function" ? svg() : svg)));
      };
      image.src = url || "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    });
  }
  if (pages) {
    // Content windows [top, next top) on full-page canvases pre-filled with
    // the page background: a continuation page opens below the margin, a cut
    // page keeps it clear at the foot, the last page pads. One chunk
    // [from, from+n) per call; later chunks reuse the first call's tops.
    var pageMargin: Dynamic = pageHeight - 2 * (pages.m || 0) > 40 ? pages.m || 0 : 0,
      computePageTops: Dynamic = helpers.computePaginationCuts;
    // Flow runs past the frame when its painted end does (without a measured
    // text layer, when the extent does); pages then span the painted end.
    var overflows: Dynamic = false,
      contentHeight: Dynamic = Math.min(height, Math.max(pageHeight, contentEnd));
    if (pages.max > 1) overflows = (textLayer || contentEnd ? contentEnd : height) > pageHeight + 4;
    else if (
      !/hidden|clip/.test(
        getComputedStyle(root).overflowY + getComputedStyle(document.documentElement).overflowY,
      )
    ) {
      // One page: say so only when a text line or media box is cut (not
      // decorative bleed, and not what the author's own root clip hides).
      if (textLayer) {
        for (
          var overflowBandIndex: Dynamic = 0;
          overflowBandIndex < avoidCutBands.length;
          overflowBandIndex++
        )
          if (avoidCutBands[overflowBandIndex][1] > pageHeight + 4) {
            overflows = true;
            break;
          }
      } else overflows = height > pageHeight + 4;
    }
    var pageTops: Dynamic = !needsPaginationPlan
      ? pages.tops
      : overflows
        ? computePageTops(avoidCutBands, contentHeight, pageHeight, pages.max, pageMargin)
        : [0];
    if (pageTops.length < 2) pageMargin = 0;
    var pageImages: Dynamic = [],
      pageCanvasWidth: Dynamic = Math.round(width * scale),
      pageCanvasHeight: Dynamic = Math.round(pageHeight * scale);
    var pageStart: Dynamic = pages.from || 0,
      pageEnd: Dynamic = Math.min(pageTops.length, pageStart + (pages.n || pageTops.length));
    for (var pageIndex: Dynamic = pageStart; pageIndex < pageEnd; pageIndex++) {
      // Whole device rows only: a fractional window bottom would blend in a
      // sliver of the next page's first row.
      var pageTop: Dynamic = pageTops[pageIndex],
        pageOffset: Dynamic = pageIndex > 0 ? pageMargin : 0,
        pageContentHeight: Dynamic =
          Math.floor(
            Math.min(
              pageHeight - pageOffset,
              (pageIndex + 1 < pageTops.length ? pageTops[pageIndex + 1] : height) - pageTop,
            ) * scale,
          ) / scale;
      var pageImage: Dynamic = await loadSvg(
        function (): Dynamic {
          return svgAt(pageTop, pageContentHeight);
        },
        svgUrlAt(pageTop, pageContentHeight),
      );
      var pageCanvas: Dynamic = document.createElement("canvas");
      pageCanvas.width = pageCanvasWidth;
      pageCanvas.height = pageCanvasHeight;
      var pageContext: Dynamic = pageCanvas.getContext("2d");
      pageContext.fillStyle = "#fff";
      pageContext.fillRect(0, 0, pageCanvasWidth, pageCanvasHeight);
      pageContext.fillStyle = selectionBackground;
      pageContext.fillRect(0, 0, pageCanvasWidth, pageCanvasHeight);
      pageContext.scale(scale / cloneZoom, scale / cloneZoom);
      pageContext.drawImage(pageImage, 0, pageOffset * cloneZoom);
      pageImages.push(pageCanvas.toDataURL(options.format, options.quality));
      pageCanvas.width = 0;
      pageCanvas.height = 0;
    }
    // pm 1: content left off past the last exported page (a Fixed page the
    // content runs past, or the Flow cap); pm 2: Flow overflow seen but out
    // of reach (inside an inner scrolling/clipping box).
    var lastPageTop: Dynamic = pageTops[pageTops.length - 1],
      hasUncapturedContent: Dynamic =
        contentHeight - lastPageTop > pageHeight - (pageTops.length > 1 ? pageMargin : 0) + 4,
      overflowKind: Dynamic = 0;
    if (overflows && pageTops.length >= pages.max && hasUncapturedContent) overflowKind = 1;
    else if (overflows && pages.max > 1 && pageTops.length < 2) overflowKind = 2;
    // Runs leave in capture px over the WHOLE flow (bottom-pinned ones clamped
    // onto the last page); the host partitions them.
    var bottomEdge: Dynamic = lastPageTop * scale + pageCanvasHeight;
    if (textLayer) {
      textLayer.runs.forEach(function (run?: Dynamic): Dynamic {
        run.x = Math.min(run.x * scale, pageCanvasWidth);
        run.y *= scale;
        if (run.y > bottomEdge && run.y < bottomEdge + 1) run.y = bottomEdge;
        run.s *= scale;
        run.w *= scale;
      });
      textLayer.blocks.forEach(function (block?: Dynamic): Dynamic {
        if (typeof block === "object") {
          block.x *= scale;
          block.y *= scale;
          block.w *= scale;
          block.h *= scale;
        }
      });
    }
    if (links)
      links.forEach(function (link?: Dynamic): Dynamic {
        link.x *= scale;
        link.y *= scale;
        link.w *= scale;
        link.h *= scale;
      });
    return {
      l: links,
      pg: pageImages,
      pt: pageTops.map(function (pageTop?: Dynamic): Dynamic {
        return pageTop * scale;
      }),
      pc: pageTops,
      po: pageMargin * scale,
      pm: overflowKind,
      hc: hiddenContent,
      w: warnings.filter(function (warning?: Dynamic, index?: Dynamic): Dynamic {
        return warnings.indexOf(warning) === index;
      }),
      cw: pageCanvasWidth,
      ch: pageCanvasHeight,
      lw: width,
      lh: height,
      t: textLayer ? textLayer.runs : null,
      tt: !!(textLayer && textLayer.truncated),
      tb: textLayer ? textLayer.blocks : null,
      lg: textLayer ? (document.documentElement && document.documentElement.lang) || "" : null,
    };
  }
  var svg: Dynamic = svgAt(0, height);
  var image: Dynamic = await loadSvg(svg);
  var canvas: Dynamic = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  var context: Dynamic = canvas.getContext("2d");
  // Viewport-canvas background: html's bg, or body's when html is the
  // initial transparent (the browser's root-bg propagation rule), falling
  // back to white. The foreignObject only paints where the cloned <html>
  // box reaches, so a page smaller than the capture viewport would
  // otherwise leave empty space in the output.
  var background: Dynamic = getComputedStyle(root).backgroundColor;
  if (isTransparent(background))
    background = document.body ? getComputedStyle(document.body).backgroundColor : "";
  background = isTransparent(background) ? "#fff" : background;
  if (matte) background = matte;
  if (selectionMode) background = selectionBackground;
  // Non-crop callers (model screenshot, pptx export) pad the empty space
  // with the page background. Crop callers (thumbnails) leave it
  // transparent so the alpha scan below can find the painted bounds.
  // Selection PNG skips the fill so the element keeps its alpha; selection
  // JPEG fills #fff under the backdrop first — the matched ancestor
  // background can be semi-transparent, and JPEG would composite the
  // residual alpha onto black (same guard as the crop path below).
  if (
    !crop &&
    !(selectionMode && options.format === "image/png" && !options.selectionBackground && !frame)
  ) {
    if (selectionMode) {
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  context.scale(scale / cloneZoom, scale / cloneZoom);
  context.drawImage(image, 0, 0);
  if (crop) {
    var scanWidth: Dynamic = canvas.width,
      scanHeight: Dynamic = canvas.height,
      pixels: Dynamic = context.getImageData(0, 0, scanWidth, scanHeight).data;
    var left: Dynamic = scanWidth,
      top: Dynamic = scanHeight,
      right: Dynamic = -1,
      bottom: Dynamic = -1;
    for (var row: Dynamic = 0; row < scanHeight; row++)
      for (var column: Dynamic = 0; column < scanWidth; column++)
        if (pixels[(row * scanWidth + column) * 4 + 3]) {
          if (column < left) left = column;
          if (column > right) right = column;
          if (row < top) top = row;
          if (row > bottom) bottom = row;
        }
    if (right >= 0) {
      var cropWidth: Dynamic = right - left + 1,
        cropHeight: Dynamic = bottom - top + 1,
        croppedCanvas: Dynamic = document.createElement("canvas");
      croppedCanvas.width = cropWidth;
      croppedCanvas.height = cropHeight;
      var croppedContext: Dynamic = croppedCanvas.getContext("2d");
      // #fff under bg: bg can be semi-transparent (xp() only catches fully-
      // transparent), and the JPEG fallback below would otherwise composite
      // those pixels onto black.
      croppedContext.fillStyle = "#fff";
      croppedContext.fillRect(0, 0, cropWidth, cropHeight);
      croppedContext.fillStyle = background;
      croppedContext.fillRect(0, 0, cropWidth, cropHeight);
      croppedContext.drawImage(
        canvas,
        left,
        top,
        cropWidth,
        cropHeight,
        0,
        0,
        cropWidth,
        cropHeight,
      );
      canvas = croppedCanvas;
    } else {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = background;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
  }
  var format: Dynamic = options.format,
    quality: Dynamic = options.quality,
    byteCap: Dynamic = options.byteCap,
    dataUrl: Dynamic = canvas.toDataURL(format, quality);
  // WebKit's canvas can't encode WebP — toDataURL silently returns PNG and
  // ignores quality. Re-encode as JPEG so the quality knob and the maxL
  // loop below actually bite; the bg fillRect above has already composited
  // any alpha onto an opaque background, so JPEG's alpha-drop is a no-op.
  if (format === "image/webp" && dataUrl.indexOf("data:image/webp") !== 0) {
    format = "image/jpeg";
    quality = 0.85;
    dataUrl = canvas.toDataURL(format, quality);
  }
  // Step quality, then halve dimensions once, until the data-URL fits the
  // caller's byte cap (SetProjectThumbnail's protovalidate max_bytes).
  while (byteCap && dataUrl.length > byteCap && quality > 0.3) {
    quality -= 0.1;
    dataUrl = canvas.toDataURL(format, quality);
  }
  if (byteCap && dataUrl.length > byteCap) {
    var smallerCanvas: Dynamic = document.createElement("canvas");
    smallerCanvas.width = canvas.width >> 1 || 1;
    smallerCanvas.height = canvas.height >> 1 || 1;
    smallerCanvas
      .getContext("2d")
      .drawImage(canvas, 0, 0, smallerCanvas.width, smallerCanvas.height);
    canvas = smallerCanvas;
    dataUrl = canvas.toDataURL(format, quality);
  }
  // Text runs leave in CAPTURE px (× scale), the unit cw/ch are in; an
  // edge-pinned run is clamped onto the ROUNDED canvas so it survives.
  if (textLayer) {
    textLayer.runs.forEach(function (run?: Dynamic): Dynamic {
      run.x = Math.min(run.x * scale, canvas.width);
      run.y = Math.min(run.y * scale, canvas.height);
      run.s *= scale;
      run.w *= scale;
    });
    textLayer.blocks.forEach(function (block?: Dynamic): Dynamic {
      if (typeof block === "object") {
        block.x *= scale;
        block.y *= scale;
        block.w *= scale;
        block.h *= scale;
      }
    });
  }
  if (links)
    links.forEach(function (link?: Dynamic): Dynamic {
      link.x *= scale;
      link.y *= scale;
      link.w *= scale;
      link.h *= scale;
    });
  return {
    l: links,
    u: dataUrl,
    hc: hiddenContent,
    w: warnings.filter(function (warning?: Dynamic, index?: Dynamic): Dynamic {
      return warnings.indexOf(warning) === index;
    }),
    cw: canvas.width,
    ch: canvas.height,
    lw: width,
    lh: height,
    t: textLayer ? textLayer.runs : null,
    tt: !!(textLayer && textLayer.truncated),
    tb: textLayer ? textLayer.blocks : null,
    lg: textLayer ? (document.documentElement && document.documentElement.lang) || "" : null,
  };
}
/** Retain the original WJ token-splicing protocol while exposing a real TS program. */
export function buildCaptureTemplate(sources: PageCaptureHelperSources): string {
  const optionTokens = {
    __LAYOUT__: "layout",
    __VP__: "viewport",
    __SEL__: "selection",
    __FRAME__: "frame",
    __PAGES__: "pages",
    __SELROOT__: "selectionRoot",
    __CROP__: "crop",
    __MATTE__: "matte",
    __SCALE__: "scale",
    __MAX__: "maxDimension",
    __SELBG__: "selectionBackground",
    __SELVIS__: "selectionVisibleOnly",
    __SETTLE__: "settleFrozen",
    __FREEZE__: "freeze",
    __TEXT__: "textLayer",
    __OVERLAY__: "overlay",
    __FMT__: "format",
    __Q__: "quality",
    __CAP__: "byteCap",
  };
  const optionsSource =
    "{" +
    Object.entries(optionTokens)
      .map(([token, field]) => JSON.stringify(field) + ":" + token)
      .join(",") +
    "}";
  const helpersSource =
    "{" +
    Object.entries(sources)
      .map(
        ([name, value]) =>
          JSON.stringify(name) +
          ":" +
          (typeof value === "number" ? String(value) : "(" + String(value) + ")"),
      )
      .join(",") +
    "}";
  return "(" + capturePage.toString() + ")(" + optionsSource + "," + helpersSource + ")";
}
