/** Restored injected script; compiled as an isolated IIFE before insertion into a preview. */
import type { Dynamic } from "../runtime-types";
(window as Dynamic).__dcRun = (function (
  this: Dynamic,
  ..._extraArguments: Dynamic[]
): Dynamic {
  var hasOwnProperty: Dynamic = (Object as Dynamic).prototype.hasOwnProperty;
  var value_fail: Dynamic = function (
    this: Dynamic,
    input?: Dynamic,
    ..._extraArguments2: Dynamic[]
  ): Dynamic {
    try {
      (window as Dynamic).parent.postMessage(
        {
          __dc_boot_failed: 1,
          e: "a script of this design did not load: " + input,
        },
        "*",
      );
    } catch (value_e: Dynamic) {}
  };
  /* a blob: URL that did not load: a file whose text the frame has still runs (inline, at that point); only a URL-only part fails the boot */
  var value_recover: Dynamic = function (
    this: Dynamic,
    input?: Dynamic,
    options?: Dynamic,
    ..._extraArguments3: Dynamic[]
  ): Dynamic {
    var value_files: Dynamic = (window as Dynamic).__dcFiles || {};
    if (!hasOwnProperty.call(value_files, input)) return value_fail(input);
    var value_s: Dynamic = (document as Dynamic).createElement("script");
    for (var value_a in options) {
      if (
        hasOwnProperty.call(options, value_a) &&
        !/^(async|defer|integrity|crossorigin)$/i.test(value_a)
      ) {
        try {
          value_s.setAttribute(value_a, String(options[value_a]));
        } catch (value_e: Dynamic) {}
      }
    }
    value_s.text =
      String(value_files[input]) +
      "\n//# sourceURL=/appifact/" +
      encodeURI(input);
    (
      (document as Dynamic).head || (document as Dynamic).documentElement
    ).appendChild(value_s);
  };
  /* the parser's tip: a script the parser itself is executing right now (no node follows it anywhere up the tree) -
   * the only place a document.write lands in place rather than re-opening the document */
  var value_atTip: Dynamic = function (
    this: Dynamic,
    input?: Dynamic,
    ..._extraArguments4: Dynamic[]
  ): Dynamic {
    for (var value_n: Dynamic = input; value_n; value_n = value_n.parentNode) {
      if (value_n.nextSibling) return false;
    }
    return true;
  };
  return function (
    this: Dynamic,
    input?: Dynamic,
    options?: Dynamic,
    ..._extraArguments5: Dynamic[]
  ): Dynamic {
    var value_files: Dynamic = (window as Dynamic).__dcFiles || {},
      value_urls: Dynamic = (window as Dynamic).__dcPartUrls || {};
    var src: Dynamic = hasOwnProperty.call(value_urls, input)
      ? value_urls[input]
      : null;
    if (src === null && !hasOwnProperty.call(value_files, input)) return;
    options = options || {};
    /* defer/async: after the parse, in document order (as every deferred script here has always run) */
    var value_later: Dynamic =
      hasOwnProperty.call(options, "defer") ||
      hasOwnProperty.call(options, "async");
    var currentScript: Dynamic = (document as Dynamic).currentScript;
    if (
      (document as Dynamic).readyState === "loading" &&
      currentScript &&
      value_atTip(currentScript)
    ) {
      /* written where the tag stood, this IS the tag the page wrote: parser-blocking (or natively deferred), same
       * attributes; a part loads by the page URL every artboard shares (one compile), any other file by a URL of its own */
      if (src === null && value_later) {
        try {
          src = URL.createObjectURL(
            new Blob(
              [
                String(value_files[input]),
                "\n//# sourceURL=/appifact/" + encodeURI(input),
              ],
              {
                type: "text/javascript",
              },
            ),
          );
        } catch (value_e: Dynamic) {
          src = null;
        }
      }
      if (src !== null) {
        var value_h: Dynamic =
          "<" + 'script src="' + src + '"' + (value_later ? " defer" : "");
        for (var value_n in options) {
          if (
            hasOwnProperty.call(options, value_n) &&
            /^[\w:.-]+$/.test(value_n) &&
            !/^(async|defer|integrity|crossorigin)$/i.test(value_n)
          )
            value_h +=
              " " +
              value_n +
              '="' +
              String(options[value_n])
                .replace(/&/g, "&amp;")
                .replace(/"/g, "&quot;") +
              '"';
        }
        try {
          (document as Dynamic).write(value_h + "></" + "script>");
          var value_w: Dynamic = (document as Dynamic).scripts[
            (document as Dynamic).scripts.length - 1
          ]; /* the tag just written (the parser inserts it before write returns) */
          if (
            value_w &&
            value_w !== currentScript &&
            value_w.getAttribute("src") === src
          ) {
            value_w.addEventListener(
              "error",
              function (
                this: Dynamic,
                ..._extraArguments6: Dynamic[]
              ): Dynamic {
                value_recover(input, options);
              },
            );
            return;
          }
          /* the write did not land (a Trusted Types default policy rewrote it, say): load it the other way rather than not at all */
        } catch (value_e: Dynamic) {}
      }
    }
    var value_run: Dynamic = function (
      this: Dynamic,
      ..._extraArguments7: Dynamic[]
    ): Dynamic {
      var value_s: Dynamic = (document as Dynamic).createElement("script");
      for (var value_a in options) {
        if (
          hasOwnProperty.call(options, value_a) &&
          (src === null ||
            !/^(async|defer|integrity|crossorigin)$/i.test(value_a))
        ) {
          try {
            value_s.setAttribute(value_a, String(options[value_a]));
          } catch (value_e: Dynamic) {}
        }
      }
      if (hasOwnProperty.call(value_files, input))
        value_s.text =
          String(value_files[input]) +
          "\n//# sourceURL=/appifact/" +
          encodeURI(input);
      else {
        value_s.async = false;
        value_s.src = src;
        value_s.addEventListener(
          "error",
          function (this: Dynamic, ..._extraArguments8: Dynamic[]): Dynamic {
            value_recover(input, options);
          },
        );
      } /* no text on hand (not expected: the bootloader hands every part's text): by URL, in insertion order */
      /* where the tag stood (document.currentScript keeps its position and data- attributes), else the head */
      var currentScript2: Dynamic = (document as Dynamic).currentScript;
      if (currentScript2 && currentScript2.parentNode)
        currentScript2.parentNode.insertBefore(value_s, currentScript2);
      else
        (
          (document as Dynamic).head || (document as Dynamic).documentElement
        ).appendChild(value_s);
      /* an external script fires 'load' once it has run; the inline stand-in has run by now, so fire it for onload= handlers */
      if (hasOwnProperty.call(value_files, input)) {
        try {
          value_s.dispatchEvent(new Event("load"));
        } catch (value_e: Dynamic) {}
      }
    };
    if (value_later && (document as Dynamic).readyState === "loading")
      (document as Dynamic).addEventListener(
        "readystatechange",
        function value_g(
          this: Dynamic,
          ..._extraArguments9: Dynamic[]
        ): Dynamic {
          (document as Dynamic).removeEventListener(
            "readystatechange",
            value_g,
          );
          value_run();
        },
      );
    else value_run();
  };
})();
