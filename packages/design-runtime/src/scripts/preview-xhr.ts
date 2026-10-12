/** Restored injected script; compiled as an isolated IIFE before insertion into a preview. */
import type { Dynamic } from "../runtime-types";
(function (this: Dynamic, ..._extraArguments: Dynamic[]): Dynamic {
  var XMLHttpRequest: Dynamic = (window as Dynamic).XMLHttpRequest,
    __dcLookup: Dynamic = (window as Dynamic).__dcLookup;
  if (
    !XMLHttpRequest ||
    !XMLHttpRequest.prototype ||
    typeof __dcLookup !== "function"
  )
    return;
  var prototype: Dynamic = XMLHttpRequest.prototype,
    open: Dynamic = prototype.open,
    send: Dynamic = prototype.send,
    setRequestHeader: Dynamic = prototype.setRequestHeader,
    overrideMimeType: Dynamic = prototype.overrideMimeType,
    abort: Dynamic = prototype.abort;
  var items: Dynamic = [
    "readyState",
    "status",
    "statusText",
    "response",
    "responseText",
    "responseXML",
    "responseURL",
    "getResponseHeader",
    "getAllResponseHeaders",
  ];
  var value_set: Dynamic = function (
    this: Dynamic,
    input?: Dynamic,
    options?: Dynamic,
    value?: Dynamic,
    ..._extraArguments2: Dynamic[]
  ): Dynamic {
    try {
      (Object as Dynamic).defineProperty(input, options, {
        value: value,
        configurable: true,
        writable: true,
      });
    } catch (value_e: Dynamic) {}
  };
  /* a reused object gets its native accessors back before each open */
  var value_clear: Dynamic = function (
    this: Dynamic,
    input?: Dynamic,
    ..._extraArguments3: Dynamic[]
  ): Dynamic {
    for (var index: Dynamic = 0; index < items.length; index += 1) {
      try {
        delete input[items[index]];
      } catch (value_e: Dynamic) {}
    }
  };
  var value_fire: Dynamic = function (
    this: Dynamic,
    input?: Dynamic,
    options?: Dynamic,
    ..._extraArguments4: Dynamic[]
  ): Dynamic {
    try {
      input.dispatchEvent(new Event(options));
    } catch (value_e: Dynamic) {}
  };
  prototype.open = function (
    this: Dynamic,
    input?: Dynamic,
    options?: Dynamic,
    ..._extraArguments5: Dynamic[]
  ): Dynamic {
    value_clear(this);
    var value_f: Dynamic = /^get$/i.test(String(input))
      ? __dcLookup(options)
      : null;
    if (!value_f) {
      this.__dcHit = null;
      return open.apply(this, arguments);
    }
    /* a reused object: quiesce any native request still in flight, as a native open would */
    if (this.__dcHit === null) {
      try {
        abort.apply(this);
      } catch (value_e: Dynamic) {}
    }
    this.__dcHit = {
      f: value_f,
      async: arguments.length < 3 || !!arguments[2],
    };
    value_set(this, "readyState", 1);
    value_set(this, "status", 0);
    value_fire(this, "readystatechange");
  };
  prototype.setRequestHeader = function (
    this: Dynamic,
    ..._extraArguments6: Dynamic[]
  ): Dynamic {
    if (!this.__dcHit) return setRequestHeader.apply(this, arguments);
  };
  if (overrideMimeType)
    prototype.overrideMimeType = function (
      this: Dynamic,
      ..._extraArguments7: Dynamic[]
    ): Dynamic {
      if (!this.__dcHit) return overrideMimeType.apply(this, arguments);
    };
  prototype.abort = function (
    this: Dynamic,
    ..._extraArguments8: Dynamic[]
  ): Dynamic {
    var __dcHit: Dynamic = this.__dcHit;
    if (!__dcHit) return abort.apply(this, arguments);
    this.__dcHit = null;
    if (__dcHit.sent && !__dcHit.done) {
      value_set(this, "readyState", 4);
      value_fire(this, "readystatechange");
      value_fire(this, "abort");
      value_fire(this, "loadend");
    }
    value_clear(this);
  };
  prototype.send = function (
    this: Dynamic,
    ..._extraArguments9: Dynamic[]
  ): Dynamic {
    var __dcHit: Dynamic = this.__dcHit;
    if (!__dcHit) return send.apply(this, arguments);
    if (__dcHit.sent) return;
    __dcHit.sent = true;
    var value_x: Dynamic = this,
      f2: Dynamic = __dcHit.f,
      text: Dynamic = "";
    try {
      text = String(value_x.responseType || "");
    } catch (value_e: Dynamic) {}
    var value_done: Dynamic = function (
      this: Dynamic,
      ..._extraArguments0: Dynamic[]
    ): Dynamic {
      if (value_x.__dcHit !== __dcHit) return; /* aborted or re-opened */
      /* as text: the file's characters (an image's bytes decoded, as fetch().text() gives), never the map's base64 */
      var value_text: Dynamic = f2.bytes
        ? new TextDecoder().decode(f2.bytes)
        : f2.text;
      var value_body: Dynamic = value_text;
      // CucCut: restorer fix — the branches below test the request's responseType (`text`, `rt` in the original script);
      // the restored code tested the response text, so arraybuffer / blob / json / document responses came back as text.
      try {
        if (text === "arraybuffer")
          value_body = f2.bytes
            ? f2.bytes.buffer.slice(0)
            : new TextEncoder().encode(f2.text).buffer;
        else if (text === "blob")
          value_body = new Blob([f2.bytes || f2.text], {
            type: f2.mime,
          });
        else if (text === "json") value_body = JSON.parse(value_text);
        else if (text === "document")
          value_body = new DOMParser().parseFromString(
            value_text,
            f2.mime === "text/html"
              ? "text/html"
              : f2.mime === "image/svg+xml"
                ? "image/svg+xml"
                : "application/xml",
          );
      } catch (value_e: Dynamic) {
        value_body = null;
      }
      value_set(value_x, "status", 200);
      value_set(value_x, "statusText", "OK");
      try {
        value_set(
          value_x,
          "responseURL",
          String(
            new URL(
              "/appifact/" +
                f2.key.split("/").map(encodeURIComponent).join("/"),
              (document as Dynamic).baseURI,
            ),
          ),
        );
      } catch (value_e: Dynamic) {}
      value_set(value_x, "response", value_body);
      if (text === "" || text === "text")
        value_set(value_x, "responseText", value_text);
      if (text === "document")
        value_set(value_x, "responseXML", value_body);
      value_x.getResponseHeader = function (
        this: Dynamic,
        input?: Dynamic,
        ..._extraArguments1: Dynamic[]
      ): Dynamic {
        return /^content-type$/i.test(String(input)) ? f2.mime : null;
      };
      value_x.getAllResponseHeaders = function (
        this: Dynamic,
        ..._extraArguments10: Dynamic[]
      ): Dynamic {
        return "content-type: " + f2.mime + "\r\n";
      };
      value_set(value_x, "readyState", 4);
      __dcHit.done = true;
      value_fire(value_x, "readystatechange");
      value_fire(value_x, "load");
      value_fire(value_x, "loadend");
    };
    if (__dcHit.async) setTimeout(value_done, 0);
    else value_done();
  };
})();
