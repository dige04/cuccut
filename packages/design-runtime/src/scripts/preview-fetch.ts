/** Restored injected script; compiled as an isolated IIFE before insertion into a preview. */
import type { Dynamic } from "../runtime-types";
(function (this: Dynamic, ..._extraArguments: Dynamic[]): Dynamic {
  var value_real: Dynamic = (window as Dynamic).fetch.bind(window);
  var value_ROOT: Dynamic =
    typeof (window as Dynamic).__dcProjectRoot === "string"
      ? (window as Dynamic).__dcProjectRoot
      : null;
  var state: Dynamic = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    avif: "image/avif",
    bmp: "image/bmp",
    svg: "image/svg+xml",
  };
  var state2: Dynamic = {
    html: "text/html",
    css: "text/css",
    js: "text/javascript",
    mjs: "text/javascript",
    json: "application/json",
  };
  /* The requested URL as a project key: relative to the root file's folder ('../x' too, and the
   * runtime's encoded '..%2FName.dc.html'), or absolute under <base> (/appifact/...) - resolveRef in preview.ts. */
  var value_norm: Dynamic = function (
    this: Dynamic,
    input?: Dynamic,
    ..._extraArguments2: Dynamic[]
  ): Dynamic {
    if (input && typeof input === "object" && typeof input.url === "string")
      input = input.url;
    input = String(input).split("#")[0]!.split("?")[0];
    // dc-runtime boot() re-fetches location.href to re-adopt its own raw
    // bytes (camelCase attr repair). In a srcdoc document that URL is
    // about:srcdoc, which fetch() can't load - serve the root source from
    // the map instead, keeping the fidelity pass working.
    if (input === "about:srcdoc" || input === String(location.href)) {
      return (window as Dynamic).__dcRootPath || input;
    }
    var value_dir: Dynamic = String(
      (window as Dynamic).__dcRootPath || "",
    ).replace(/[^/]*$/, "");
    /* an absolute URL counts only on this document's own base origin, under /appifact/ or under the stamped project folder */
    if (/^[a-z][a-z0-9+.-]*:/i.test(input) || input.slice(0, 2) === "//") {
      try {
        var value_abs: Dynamic = new URL(input, (document as Dynamic).baseURI),
          value_base: Dynamic = new URL((document as Dynamic).baseURI);
        if (
          value_abs.origin !== value_base.origin ||
          (value_abs.pathname.indexOf("/appifact/") !== 0 &&
            (value_ROOT === null ||
              value_abs.pathname.indexOf(value_ROOT) !== 0))
        )
          return null;
        input = value_abs.pathname;
      } catch (value_e: Dynamic) {
        return null;
      }
    }
    /* with the published base, a path under the project folder is read as the same path under /appifact/ */
    if (value_ROOT !== null && input.indexOf(value_ROOT) === 0)
      input = "/appifact/" + input.slice(value_ROOT.length);
    if (input.indexOf("/appifact/") === 0) {
      input = input.slice(10);
      value_dir = "";
    } else if (input.charAt(0) === "/") value_dir = "";
    try {
      input = decodeURIComponent(input);
    } catch (value_e: Dynamic) {}
    var items: Dynamic = [];
    var value_segs: Dynamic = (value_dir + input).split("/");
    for (var index: Dynamic = 0; index < value_segs.length; index += 1) {
      if (value_segs[index] === "" || value_segs[index] === ".") continue;
      if (value_segs[index] === "..") items.pop();
      else items.push(value_segs[index]);
    }
    return items.join("/");
  };
  /* the stored file a URL names, read live from the map: {key, mime, text, bytes (images)} or null */
  var __dcLookup: Dynamic = function (
    this: Dynamic,
    input?: Dynamic,
    ..._extraArguments3: Dynamic[]
  ): Dynamic {
    var key2: Dynamic = value_norm(input);
    var value_files: Dynamic = (window as Dynamic).__dcFiles || {};
    if (
      key2 === null ||
      !(Object as Dynamic).prototype.hasOwnProperty.call(value_files, key2)
    )
      return null;
    var value_ext: Dynamic = key2
      .slice(key2.lastIndexOf(".") + 1)
      .toLowerCase();
    var value_img: Dynamic = state[value_ext];
    var text2: Dynamic = String(value_files[key2]);
    var bytes2: Dynamic = null;
    if (value_img) {
      try {
        var value_bin: Dynamic = atob(text2);
        bytes2 = new Uint8Array(value_bin.length);
        for (var index: Dynamic = 0; index < value_bin.length; index += 1)
          bytes2[index] = value_bin.charCodeAt(index);
      } catch (value_e: Dynamic) {
        value_img = "";
        bytes2 = null;
      }
    }
    return {
      key: key2,
      mime: value_img || state2[value_ext] || "text/plain",
      text: text2,
      bytes: bytes2,
    };
  };
  (window as Dynamic).__dcLookup = __dcLookup;
  (window as Dynamic).fetch = function (
    this: Dynamic,
    input?: Dynamic,
    options?: Dynamic,
    ..._extraArguments4: Dynamic[]
  ): Dynamic {
    var value_f: Dynamic = __dcLookup(input);
    if (value_f)
      return Promise.resolve(
        new Response(value_f.bytes || value_f.text, {
          status: 200,
          headers: {
            "Content-Type": value_f.mime,
          },
        }),
      );
    if (value_ROOT === null) return value_real(input, options);
    /* a document with the published base reports to the editor a file under the project folder that was answered 403, 404 or 410 (ADDRESS_REFUSED) */
    return value_real(input, options).then(function (
      this: Dynamic,
      input2?: Dynamic,
      ..._extraArguments5: Dynamic[]
    ): Dynamic {
      if (
        input2 &&
        (input2.status === 403 ||
          input2.status === 404 ||
          input2.status === 410) &&
        String(input2.url).indexOf((window as Dynamic).origin + value_ROOT) ===
          0
      ) {
        try {
          (window as Dynamic).parent.postMessage(
            {
              __dc_address_refused: 1,
              u: input2.url,
            },
            "*",
          );
        } catch (value_e: Dynamic) {}
      }
      return input2;
    });
  };
})();
