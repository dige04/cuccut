/** Restored injected script; compiled as an isolated IIFE before insertion into a preview. */
import type { Dynamic } from "../runtime-types";
(function (): Dynamic {
  "use strict";

  var parent: Dynamic = (window as Dynamic).parent;
  if (!parent || parent === window) return;
  /* Authored script CAN run between write steps, in this realm (when the head loads its runtime by URL the parser instead
   * buffers every later chunk behind that fetch and runs them after the writer has closed: stricter, same order). So:
   * strict mode throughout (a sloppy step would be reachable through Function#caller from script running inside its write); everything a step touches is captured HERE, before the
   * first authored byte, and used only through these locals - no step evaluates a property an authored script could have
   * redefined (MessageChannel#port2, MessagePort#postMessage/onmessage, Array.prototype indices, String, ...); a step that
   * finds the parser already ended writes nothing more (a write then would re-open the document and parse the remaining
   * chunks as a fresh one); a finished writer holds no native and answers nothing. */
  var value_doc: Dynamic = document,
    prototype: Dynamic = Document.prototype,
    open: Dynamic = prototype.open,
    write: Dynamic = prototype.write,
    close: Dynamic = prototype.close,
    apply2: Dynamic = Reflect.apply,
    value_Str: Dynamic = String;
  var get: Dynamic = (Object as Dynamic).getOwnPropertyDescriptor(
    prototype,
    "readyState",
  ).get;
  /* every chunk is written as TrustedHTML minted by the loader's own policy: a write of TrustedHTML never consults the realm's
   * 'default' policy, which an authored script could otherwise register (and switch enforcement on with a <meta> CSP) to
   * rewrite the remaining chunks on their way into the parser */
  var value_mint: Dynamic = null;
  try {
    if (
      (window as Dynamic).trustedTypes &&
      (window as Dynamic).trustedTypes.createPolicy
    ) {
      var value_policy: Dynamic = (window as Dynamic).trustedTypes.createPolicy(
        "dc-boot#" + Math.random().toString(36).slice(2),
        {
          createHTML: function (
            this: Dynamic,
            input?: Dynamic,
            ..._extraArguments: Dynamic[]
          ): Dynamic {
            return input;
          },
        },
      );
      value_mint = function (
        this: Dynamic,
        input?: Dynamic,
        ..._extraArguments2: Dynamic[]
      ): Dynamic {
        return value_policy.createHTML(input);
      };
    }
  } catch (value_e: Dynamic) {
    value_mint = null;
  }
  var value_ch: Dynamic = new MessageChannel(),
    port12: Dynamic = value_ch.port1,
    port22: Dynamic = value_ch.port2,
    postMessage: Dynamic = MessagePort.prototype.postMessage,
    close2: Dynamic = MessagePort.prototype.close;
  var value_fail: Dynamic = function (
    this: Dynamic,
    input?: Dynamic,
    ..._extraArguments3: Dynamic[]
  ): Dynamic {
    var text: Dynamic = "boot failed";
    try {
      text = value_Str(input);
    } catch (value_e: Dynamic) {}
    try {
      parent.postMessage(
        {
          __dc_boot_failed: 1,
          e: text,
        },
        "*",
      );
    } catch (value_e: Dynamic) {}
  };
  var value_writeDoc: Dynamic = function (
    this: Dynamic,
    input?: Dynamic,
    ..._extraArguments4: Dynamic[]
  ): Dynamic {
    var value_re: Dynamic = /<\/script[^>]*>/gi,
      items: Dynamic = [],
      index: Dynamic = 0;
    while (value_re.exec(input) !== null) {
      items.push(input.slice(index, value_re.lastIndex));
      index = value_re.lastIndex;
    }
    items.push(input.slice(index));
    if (value_mint) {
      for (var index2: Dynamic = 0; index2 < items.length; index2 += 1)
        items[index2] = value_mint(items[index2]);
    }
    var index3: Dynamic = 0,
      length: Dynamic = items.length,
      value_closed: Dynamic = false;
    var onmessage: Dynamic = function (
      this: Dynamic,
      ..._extraArguments5: Dynamic[]
    ): Dynamic {
      if (value_closed || index3 >= length) return;
      var value_chunk: Dynamic = items[index3];
      index3 += 1;
      try {
        /* window.stop() or a navigation start ended the parser between steps (or an authored document.close did):
         * another write would re-open the document and parse the rest as a fresh one - stop instead */
        if (index3 > 1 && apply2(get, value_doc, []) !== "loading")
          throw "the document was closed before it was fully written";
        apply2(write, value_doc, [value_chunk]);
        if (index3 < length) {
          apply2(postMessage, port22, [0]);
          return;
        }
        value_closed = true;
        apply2(close2, port12, []);
        apply2(close, value_doc, []);
      } catch (value_err: Dynamic) {
        value_closed = true;
        try {
          apply2(close2, port12, []);
        } catch (value_e: Dynamic) {}
        value_fail(value_err);
      }
      open =
        write =
        close =
        get =
        postMessage =
        close2 =
        apply2 =
        value_Str =
        value_fail =
        value_mint =
        items =
        port12 =
        port22 =
        value_doc =
          null;
    };
    port12.onmessage = onmessage;
    apply2(open, value_doc, []);
    onmessage();
  };
  var value_onDoc: Dynamic = function (
    this: Dynamic,
    input?: Dynamic,
    ..._extraArguments6: Dynamic[]
  ): Dynamic {
    if (input.source !== parent) return;
    var data: Dynamic = input.data;
    if (!data || data.__dc_doc !== 1 || typeof data.doc !== "string") return;
    (window as Dynamic).removeEventListener("message", value_onDoc);
    var value_parts: Dynamic =
      data.parts && typeof data.parts === "object" ? data.parts : {};
    /* script parts the host minted a page URL for (part-blobs.ts partScriptUrls): project path to blob: URL */
    var __dcPartUrls: Dynamic = {},
      value_given: Dynamic =
        data.urls && typeof data.urls === "object" ? data.urls : {};
    for (var value_k in value_given) {
      if (
        (Object as Dynamic).prototype.hasOwnProperty.call(
          value_given,
          value_k,
        ) &&
        typeof value_given[value_k] === "string" &&
        value_given[value_k].indexOf("blob:") === 0
      )
        __dcPartUrls[value_k] = value_given[value_k];
    }
    (window as Dynamic).__dcPartUrls = __dcPartUrls;
    var value_ids: Dynamic = (Object as Dynamic).keys(value_parts);
    Promise.all(
      value_ids.map(function (
        this: Dynamic,
        input2?: Dynamic,
        ..._extraArguments7: Dynamic[]
      ): Dynamic {
        var value_b: Dynamic = value_parts[input2];
        return value_b instanceof Blob ? value_b.text() : String(value_b);
      }),
    )
      .then(function (
        this: Dynamic,
        input2?: Dynamic,
        ..._extraArguments8: Dynamic[]
      ): Dynamic {
        var __dcParts: Dynamic = {},
          __dcPartBlobs: Dynamic = {};
        for (var index: Dynamic = 0; index < value_ids.length; index += 1) {
          __dcParts[value_ids[index]] = input2[index];
          if (
            value_ids[index].indexOf("file:") === 0 &&
            value_parts[value_ids[index]] instanceof Blob
          )
            __dcPartBlobs[value_ids[index].slice(5)] =
              value_parts[value_ids[index]];
        }
        (window as Dynamic).__dcParts = __dcParts;
        (window as Dynamic).__dcPartBlobs = __dcPartBlobs;
        value_writeDoc(data.doc);
      })
      .then(null, value_fail);
  };
  (window as Dynamic).addEventListener("message", value_onDoc);
})();
