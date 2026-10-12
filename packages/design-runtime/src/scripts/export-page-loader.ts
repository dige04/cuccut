/** Restored injected script; compiled as an isolated IIFE before insertion into a preview. */
import type { Dynamic } from "../runtime-types";
(document as Dynamic).addEventListener(
  "DOMContentLoaded",
  async function (
    this: Dynamic,
    ..._extraArguments: Dynamic[]
  ): Promise<Dynamic> {
    const value_loading: Dynamic = (document as Dynamic).getElementById(
      "__bundler_loading",
    );
    function helper_setStatus(
      this: Dynamic,
      textContent?: Dynamic,
      ..._extraArguments2: Dynamic[]
    ): Dynamic {
      if (value_loading) value_loading.textContent = textContent;
    }
    const value_FONT_MIME: Dynamic =
      /^(font[/]|application[/](x-)?font-|application[/]vnd\.ms-fontobject)/i;
    const value_MIME_TOKEN: Dynamic = /^[\w.+-]+[/][\w.+-]+$/;
    function helper_toBase64(
      this: Dynamic,
      input?: Dynamic,
      ..._extraArguments3: Dynamic[]
    ): Dynamic {
      let text: Dynamic = "";
      for (let index: Dynamic = 0; index < input.length; index += 0x8000) {
        text += String.fromCharCode.apply(
          null,
          input.subarray(index, index + 0x8000),
        );
      }
      return btoa(text);
    }

    // Error sink persists across replaceWith since it's on window, not the DOM.
    (window as Dynamic).addEventListener(
      "error",
      function (
        this: Dynamic,
        event?: Dynamic,
        ..._extraArguments4: Dynamic[]
      ): Dynamic {
        // Failed resource loads (CSP-blocked links, scripts, images) fire plain
        // events at the element — warn only; real JS errors carry message/error.
        if (
          !event.message &&
          !event.error &&
          event.target &&
          event.target !== window
        ) {
          console.warn(
            "[bundle] resource failed to load:",
            event.target.tagName,
            String(event.target.src || event.target.href || ""),
          );
          return;
        }
        var value_p: Dynamic =
          (document as Dynamic).body || (document as Dynamic).documentElement;
        var value_d: Dynamic =
          (document as Dynamic).getElementById("__bundler_err") ||
          value_p.appendChild((document as Dynamic).createElement("div"));
        value_d.id = "__bundler_err";
        value_d.style.cssText =
          "position:fixed;bottom:12px;left:12px;right:12px;font:12px/1.4 ui-monospace,monospace;background:#2a1215;color:#ff8a80;padding:10px 14px;border-radius:8px;border:1px solid #5c2b2e;z-index:99999;white-space:pre-wrap;max-height:40vh;overflow:auto";
        value_d.textContent =
          (value_d.textContent
            ? value_d.textContent + String.fromCharCode(10)
            : "") +
          "[bundle] " +
          (event.message || event.type) +
          (event.filename
            ? " (" + event.filename.slice(0, 60) + ":" + event.lineno + ")"
            : "");
      },
      true,
    );
    try {
      const element: Dynamic = (document as Dynamic).querySelector(
        'script[type="__bundler/manifest"]',
      );
      const element2: Dynamic = (document as Dynamic).querySelector(
        'script[type="__bundler/template"]',
      );
      if (!element || !element2) {
        helper_setStatus("Error: missing bundle data");
        console.error(
          "[bundler] Missing script tags — manifestEl:",
          !!element,
          "templateEl:",
          !!element2,
        );
        return;
      }
      const value_manifest: Dynamic = JSON.parse(element.textContent);
      let value_template: Dynamic = JSON.parse(element2.textContent);

      // Nested page bundles (iframe targets). Each ships ONCE, in the ROOT
      // document's manifest; frame srcs carry an about:blank#<uuid> marker
      // instead of a substitutable uuid. Every document mints the blobs for
      // its OWN frames — from local text at the root, or text obtained from
      // its DIRECT parent over the relay protocol below — so each frame
      // navigation stays same-origin with its initiator and a deduped page
      // loads at any depth on any host, including a file:// download's
      // opaque origins (where a blob minted by one document cannot be
      // navigated to by another).
      const element3: Dynamic = (document as Dynamic).querySelector(
        'script[type="__bundler/page_order"]',
      );
      const value_pageOrder: Dynamic = element3
        ? JSON.parse(element3.textContent)
        : [];
      const value_pageSet: Dynamic = new Set(value_pageOrder);
      const state: Dynamic = {};

      // ── Nested-page text protocol (parent-chain relay) ──
      // Page bundles ship once, in the ROOT document's manifest. Every
      // document mints the blobs for its OWN frames, obtaining page text
      // through a strict parent-chain relay: a document only ever SENDS to
      // its direct parent (which, for every document the publisher's own
      // runtime minted, is another publisher document) and only ACCEPTS
      // text from that direct parent; requests from below are honored only
      // for the document's own child frames, and the ROOT never sends
      // upward at all. That last rule is load-bearing: the artifact host's
      // frame-ancestors allows claude.ai (and friends) to frame an
      // artifact, so window.top can be a FOREIGN document — a top-addressed
      // protocol would hand page uuids to that ancestor and accept forged
      // "page text" from it, minting attacker HTML as an artifact-origin
      // blob document. The chain never touches the ancestor: requests stop
      // at the root, replies are origin-addressed per hop (never '*' when
      // an origin exists), and both directions are origin-gated (on https
      // a foreign sender's origin can never equal this document's; in
      // opaque contexts — file:// — everything serializes as 'null', where
      // an embedded EXTERNAL frame still fails the gate by carrying its
      // own real origin, and a sandboxed child of such a frame is excluded
      // by the own-child-frames check plus uuid unguessability). Shape is
      // deny-by-default: one request form, one reply form, no error
      // replies.
      // window.origin is the SERIALIZED SECURITY origin ('null' in opaque
      // contexts such as a sandboxed preview iframe) — location.origin is
      // computed from the URL and stays 'https://…' even when the document
      // is sandboxed, which would misgate every opaque chain.
      const value_OWN_TARGET: Dynamic = /^https?:[/][/]/.test(
        (window as Dynamic).origin || "",
      )
        ? (window as Dynamic).origin
        : "*";
      function helper_trustedOrigin(
        this: Dynamic,
        input?: Dynamic,
        ..._extraArguments5: Dynamic[]
      ): Dynamic {
        if (input.origin === (window as Dynamic).origin) return true; // https chains; opaque==opaque
        // file:// trees: Chrome serializes the file document's origin as
        // 'file://' while the blob: documents it mints serialize as 'null',
        // so the two legitimate shapes can never string-match — accept the
        // pair in both directions. https origins never serialize as either,
        // and sender identity (own child frame / direct parent) is checked
        // separately.
        return (
          (input.origin === "null" &&
            ((window as Dynamic).origin === "file://" ||
              (window as Dynamic).location.protocol === "file:")) ||
          (/^file:/.test(input.origin) && (window as Dynamic).origin === "null")
        );
      }
      // Non-empty only in the root document (nested bundles ship an empty
      // island), so it doubles as the root marker: the root answers from
      // local text and treats a miss as authoritative — never relaying to
      // its (possibly foreign) parent.
      const value_isPageRoot: Dynamic = value_pageOrder.length > 0;
      const state2: Dynamic = {};
      const __resourceBlobs: Dynamic = {};
      const value_UUID_SHAPE: Dynamic =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
      const state3: Dynamic = {}; // uuid -> [{el, frag}] awaiting text for own frames
      const state4: Dynamic = {}; // uuid -> [childWindow] awaiting text to pass down
      function helper_mountPage(
        this: Dynamic,
        input?: Dynamic,
        options?: Dynamic,
        __bundler_text?: Dynamic,
        ..._extraArguments6: Dynamic[]
      ): Dynamic {
        const u2: Dynamic = new Blob([__bundler_text], {
          type: "text/html",
        });
        const value_u: Dynamic = URL.createObjectURL(u2);
        __resourceBlobs[value_u] = u2;
        input.src = value_u + options;
      }
      function helper_deliverPage(
        this: Dynamic,
        __bundler_page?: Dynamic,
        __bundler_text?: Dynamic,
        ..._extraArguments7: Dynamic[]
      ): Dynamic {
        const value_frames: Dynamic = state3[__bundler_page];
        delete state3[__bundler_page];
        if (value_frames)
          for (const value_f of value_frames as Dynamic)
            helper_mountPage(value_f.el, value_f.frag, __bundler_text);
        const value_relays: Dynamic = state4[__bundler_page];
        delete state4[__bundler_page];
        if (value_relays) {
          for (const value_cw of value_relays as Dynamic) {
            try {
              value_cw.postMessage(
                {
                  __bundler_page: __bundler_page,
                  __bundler_text: __bundler_text,
                },
                value_OWN_TARGET,
              );
            } catch (value_err: Dynamic) {
              /* gone */
            }
          }
        }
      }
      function helper_ownFrameWindows(
        this: Dynamic,
        ..._extraArguments8: Dynamic[]
      ): Dynamic {
        const items: Dynamic = [];
        for (const value_f of (Array as Dynamic).from(
          (document as Dynamic).querySelectorAll("iframe"),
        ) as Dynamic) {
          try {
            if (value_f.contentWindow) items.push(value_f.contentWindow);
          } catch (value_err: Dynamic) {
            /* detached */
          }
        }
        return items;
      }
      (window as Dynamic).addEventListener(
        "message",
        function (
          this: Dynamic,
          input?: Dynamic,
          ..._extraArguments9: Dynamic[]
        ): Dynamic {
          const data: Dynamic = input.data;
          if (!data || typeof data !== "object" || !input.source) return;
          // Origin gate first; the structural checks below (own-child-frames
          // for requests, direct-parent + solicited-uuid for replies, the
          // root's never-relay rule) are what hold in fully opaque chains
          // where origin strings can't discriminate — a sandboxed root's
          // FOREIGN wrapper still fails all three even though both serialize
          // as real-vs-'null' rather than matching.
          if (!helper_trustedOrigin(input)) return;
          if (
            typeof data.__bundler_need === "string" &&
            value_UUID_SHAPE.test(data.__bundler_need)
          ) {
            // Requests are honored only for this document's own child frames.
            if (helper_ownFrameWindows().indexOf(input.source) < 0) return;
            const __bundler_page: Dynamic = data.__bundler_need;
            const __bundler_text: Dynamic = state[__bundler_page];
            if (typeof __bundler_text === "string") {
              try {
                input.source.postMessage(
                  {
                    __bundler_page: __bundler_page,
                    __bundler_text: __bundler_text,
                  },
                  value_OWN_TARGET,
                );
              } catch (value_err: Dynamic) {
                /* gone */
              }
              return;
            }
            if (value_isPageRoot || (window as Dynamic).parent === window)
              return; // authoritative miss
            const value_waiting: Dynamic = state4[__bundler_page];
            if (value_waiting) {
              if (value_waiting.indexOf(input.source) < 0)
                value_waiting.push(input.source);
              return;
            }
            // Never-answered uuids would otherwise accumulate forever under a
            // request spray; past the cap (far above any real page count) new
            // relays are dropped rather than remembered.
            if ((Object as Dynamic).keys(state4).length >= 128) return;
            state4[__bundler_page] = [input.source];
            (window as Dynamic).parent.postMessage(
              {
                __bundler_need: __bundler_page,
              },
              value_OWN_TARGET,
            );
          } else if (
            typeof data.__bundler_page === "string" &&
            value_UUID_SHAPE.test(data.__bundler_page) &&
            typeof data.__bundler_text === "string"
          ) {
            // The shape test is load-bearing beyond tidiness: the solicited
            // check below uses the in operator, which matches prototype keys
            // ('__proto__', 'constructor') — an unshaped key would reach
            // deliverPage and throw, painting the error banner.
            // Text is accepted only from the direct parent — the document
            // that minted this one.
            if (
              input.source !== (window as Dynamic).parent ||
              (window as Dynamic).parent === window
            )
              return;
            if (
              !(data.__bundler_page in state3) &&
              !(data.__bundler_page in state4)
            )
              return;
            helper_deliverPage(data.__bundler_page, data.__bundler_text);
          }
        },
      );
      const value_uuids: Dynamic = (Object as Dynamic).keys(value_manifest);
      helper_setStatus("Unpacking " + value_uuids.length + " assets...");
      await Promise.all(
        value_uuids.map(
          async (
            __bundler_page?: Dynamic,
            ..._extraArguments0: Dynamic[]
          ): Promise<Dynamic> => {
            const value_entry: Dynamic = value_manifest[__bundler_page];
            try {
              const value_binaryStr: Dynamic = atob(value_entry.data);
              const value_bytes: Dynamic = new Uint8Array(
                value_binaryStr.length,
              );
              for (
                let index: Dynamic = 0;
                index < value_binaryStr.length;
                index++
              )
                value_bytes[index] = value_binaryStr.charCodeAt(index);
              let value_finalBytes: Dynamic = value_bytes;
              if (value_entry.compressed) {
                if (typeof DecompressionStream !== "undefined") {
                  const value_ds: Dynamic = new DecompressionStream("gzip");
                  const value_writer: Dynamic = value_ds.writable.getWriter();
                  const value_reader: Dynamic = value_ds.readable.getReader();
                  value_writer.write(value_bytes);
                  value_writer.close();
                  const items: Dynamic = [];
                  let index: Dynamic = 0;
                  while (true) {
                    const { done: value_done, value: value_value }: Dynamic =
                      await value_reader.read();
                    if (value_done) break;
                    items.push(value_value);
                    index += value_value.length;
                  }
                  value_finalBytes = new Uint8Array(index);
                  let index2: Dynamic = 0;
                  for (const value_chunk of items as Dynamic) {
                    value_finalBytes.set(value_chunk, index2);
                    index2 += value_chunk.length;
                  }
                } else {
                  console.warn(
                    "DecompressionStream not available, asset " +
                      __bundler_page +
                      " may not render",
                  );
                }
              }
              if (value_pageSet.has(__bundler_page)) {
                state[__bundler_page] = new TextDecoder().decode(
                  value_finalBytes,
                );
                return;
              }
              if (
                value_FONT_MIME.test(value_entry.mime) &&
                value_MIME_TOKEN.test(value_entry.mime)
              ) {
                // Strict artifact hosts allow font-src data: but not blob:.
                state2[__bundler_page] =
                  "data:" +
                  value_entry.mime +
                  ";base64," +
                  (value_entry.compressed
                    ? helper_toBase64(value_finalBytes)
                    : value_entry.data);
              } else {
                const value_blob: Dynamic = new Blob([value_finalBytes], {
                  type: value_entry.mime,
                });
                state2[__bundler_page] = URL.createObjectURL(value_blob);
                __resourceBlobs[state2[__bundler_page]] = value_blob;
              }
            } catch (value_err: Dynamic) {
              console.error(
                "Failed to decode asset " + __bundler_page + ":",
                value_err,
              );
              const value_blob: Dynamic = new Blob([], {
                type: value_entry.mime,
              });
              state2[__bundler_page] = URL.createObjectURL(value_blob);
              __resourceBlobs[state2[__bundler_page]] = value_blob;
            }
          },
        ),
      );
      const element4: Dynamic = (document as Dynamic).querySelector(
        'script[type="__bundler/ext_resources"]',
      );
      const value_extResources: Dynamic = element4
        ? JSON.parse(element4.textContent)
        : [];
      const state5: Dynamic = {};
      for (const value_entry of value_extResources as Dynamic) {
        if (state2[value_entry.uuid])
          state5[value_entry.id] = state2[value_entry.uuid];
      }

      // Artifact-host CSP (connect-src 'self') refuses fetch() of blob: URLs —
      // consumers read these Blobs directly. Survives the swap like the error sink.
      (window as Dynamic).__resourceBlobs = __resourceBlobs;
      helper_setStatus("Rendering...");
      // Page uuids have no blob here — they ride inside about:blank#<uuid>
      // frame markers the pass below resolves after the swap.
      for (const __bundler_page of value_uuids as Dynamic) {
        if (value_pageSet.has(__bundler_page)) continue;
        value_template = value_template
          .split(__bundler_page)
          .join(state2[__bundler_page]);
      }

      // Strip integrity + crossorigin — blob URLs from a file:// document inherit
      // a null origin, so crossorigin forces a CORS fetch that SRI then rejects.
      // The manifest bytes are ours; SRI protects against CDN compromise, not this.
      // appifacts: only on tags now pointing at OUR blob: URLs. A reference the
      // bundler left live-fetched (an absolute x-import, a runtime dependency it
      // could not embed, an authored external script) keeps the pin it was
      // written with: that fetch is exactly what SRI protects. (A crossorigin
      // on a parent whose child carries the blob — <video crossorigin><source>
      // — is left alone too; the attribute is then the author's to drop.)
      value_template = value_template.replace(
        /<[a-z][^>]*>/gi,
        (input?: Dynamic, ..._extraArguments1: Dynamic[]): Dynamic =>
          /\s(?:src|href|srcset|poster|data|xlink:href)="blob:/i.test(input)
            ? input
                .replace(/\s+integrity="[^"]*"/gi, "")
                .replace(/\s+crossorigin="[^"]*"/gi, "")
            : input,
      );
      const value_resourceScript: Dynamic =
        "<script>window.__resources = " +
        JSON.stringify(state5).replace(/<\//g, "<\\/") +
        ";</" +
        "script>";
      // Inject after <head> so the DOCTYPE stays first; prepending the script
      // would push the parser into quirks mode. DOMParser always emits a <head>
      // (synthesizing one if the source HTML omitted it) but may carry
      // attributes through, so match the full opening tag. slice() rather than
      // replace() keeps us clear of $-pattern substitution in resourceScript.
      const value_headOpen: Dynamic = value_template.match(/<head[^>]*>/i);
      if (value_headOpen) {
        const value_i: Dynamic =
          value_headOpen.index + value_headOpen[0].length;
        value_template =
          value_template.slice(0, value_i) +
          value_resourceScript +
          value_template.slice(value_i);
      }

      // Parse the template and swap the root element. Scripts inserted via
      // DOMParser/replaceWith are inert per spec — re-create each with
      // createElement so they execute, awaiting onload for src scripts to
      // preserve ordering (React before ReactDOM before Babel before text/babel).
      const value_doc: Dynamic = new DOMParser().parseFromString(
        value_template,
        "text/html",
      );
      (document as Dynamic).documentElement.replaceWith(
        value_doc.documentElement,
      );

      // Resolve page-frame markers: mint this document's own blob for each
      // framed page — from local text when this is the root, otherwise by
      // asking the direct parent over the relay protocol above. An
      // unanswered request leaves the frame on about:blank, the same
      // degraded state as a refused embed.
      {
        const value_MARKER: Dynamic =
          /^about:blank#([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(#.*)?$/;
        const items: Dynamic = [];
        for (const value_el of (Array as Dynamic).from(
          (document as Dynamic).querySelectorAll("iframe"),
        ) as Dynamic) {
          const value_m: Dynamic = value_MARKER.exec(
            value_el.getAttribute("src") || "",
          );
          if (!value_m) continue;
          const __bundler_text: Dynamic = state[value_m[1]];
          if (typeof __bundler_text === "string") {
            helper_mountPage(value_el, value_m[2] || "", __bundler_text);
          } else if (
            (window as Dynamic).parent !== window &&
            !value_isPageRoot
          ) {
            const value_had: Dynamic = state3[value_m[1]];
            (state3[value_m[1]] = value_had || []).push({
              el: value_el,
              frag: value_m[2] || "",
            });
            if (!value_had) items.push(value_m[1]);
          }
        }
        for (const __bundler_page of items as Dynamic) {
          (window as Dynamic).parent.postMessage(
            {
              __bundler_need: __bundler_page,
            },
            value_OWN_TARGET,
          );
        }
      }
      const value_dead: Dynamic = (Array as Dynamic).from(
        (document as Dynamic).scripts,
      );
      for (const value_old of value_dead as Dynamic) {
        const value_s: Dynamic = (document as Dynamic).createElement("script");
        for (const value_a of value_old.attributes as Dynamic)
          value_s.setAttribute(value_a.name, value_a.value);
        value_s.textContent = value_old.textContent;
        // text/babel scripts with a src: read and inline. transformScriptTags
        // does XHR against the src, but blob:null/ from a file:// origin is
        // silently dropped. Inlining makes it a plain inline babel script,
        // which transformScriptTags handles unconditionally.
        if (
          (value_s.type === "text/babel" || value_s.type === "text/jsx") &&
          value_s.src
        ) {
          const value_pre: Dynamic = __resourceBlobs[value_s.src.split("#")[0]];
          value_s.textContent = value_pre
            ? await value_pre.text()
            : await (await fetch(value_s.src)).text();
          value_s.removeAttribute("src");
        }
        const value_p: Dynamic = value_s.src
          ? new Promise(function (
              this: Dynamic,
              onerror?: Dynamic,
              ..._extraArguments10: Dynamic[]
            ): Dynamic {
              value_s.onload = value_s.onerror = onerror;
            })
          : null;
        value_old.replaceWith(value_s);
        if (value_p) await value_p;
      }
      // Babel standalone auto-transforms type=text/babel on DOMContentLoaded,
      // which fired before we swapped the document. Trigger manually if present.
      if (
        (window as Dynamic).Babel &&
        typeof (window as Dynamic).Babel.transformScriptTags === "function"
      ) {
        (window as Dynamic).Babel.transformScriptTags();
      }
    } catch (value_err: Dynamic) {
      helper_setStatus("Error unpacking: " + value_err.message);
      console.error("Bundle unpack error:", value_err);
    }
  },
);
