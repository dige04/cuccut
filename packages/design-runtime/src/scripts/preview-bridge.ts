/** Restored injected script; compiled as an isolated IIFE before insertion into a preview. */
import type { Dynamic } from "../runtime-types";
const text: Dynamic = "__ARROW_OWNER__";
(function (this: Dynamic, ..._extraArguments: Dynamic[]): Dynamic {
  /* WebRTC is an egress channel the CSP cannot close, and Frame's runtime
   * removes its constructors in the ARTIFACT realm only; this nested realm
   * gets the same treatment so an artboard starts from the platform's
   * baseline. (A page that goes looking can still find a constructor in a
   * fresh child realm - the residual Frame accepts for every artifact.) */
  try {
    delete (window as Dynamic).RTCPeerConnection;
  } catch (value_e: Dynamic) {}
  try {
    delete (window as Dynamic).webkitRTCPeerConnection;
  } catch (value_e: Dynamic) {}
  try {
    (window as Dynamic).RTCPeerConnection = undefined;
  } catch (value_e: Dynamic) {}
  try {
    (window as Dynamic).webkitRTCPeerConnection = undefined;
  } catch (value_e: Dynamic) {}
  var parent: Dynamic = (window as Dynamic).parent;
  if (!parent || parent === window) return;
  /* Liveness handshake (previewGuard.ts): mint a channel, keep one end
   * in this closure, hand the other to the host before any authored
   * byte runs. The port is a capability, not text - it cannot be read
   * out of the document or serialized into a data:/blob: replacement,
   * and it dies with this realm - so a pong is proof the document the
   * HOST assembled is the one alive in the frame. The host binds the
   * first hello per generation; nothing authored runs earlier, so this
   * one always wins that race. */
  try {
    /* The pong path is UNCURRIED at t=0: every native it touches is
     * captured as a value before any authored byte runs, and invoked
     * through a captured Reflect.apply - authored prototype poisoning
     * of MessagePort.prototype.postMessage or a trapping
     * MessageEvent.prototype.data getter must never see this port or
     * steal a send path. And every pong ECHOES the ping's nonce: a pong
     * is only proof of life for the ping that asked, so stale pongs
     * queued before a navigation prove nothing about the document that
     * replaced this one. */
    var apply: Dynamic = Reflect.apply;
    var get: Dynamic = (Object as Dynamic).getOwnPropertyDescriptor(
      MessageEvent.prototype,
      "data",
    ).get;
    var hasOwnProperty: Dynamic = (Object as Dynamic).prototype.hasOwnProperty;
    var value_ch: Dynamic = new MessageChannel();
    var value_portPost: Dynamic = MessagePort.prototype.postMessage.bind(
      value_ch.port1,
    );
    value_ch.port1.onmessage = function (
      this: Dynamic,
      input?: Dynamic,
      ..._extraArguments2: Dynamic[]
    ): Dynamic {
      var value_d: Dynamic = null;
      try {
        value_d = apply(get, input, []);
      } catch (value_e: Dynamic) {
        return;
      }
      if (value_d == null || typeof value_d !== "object") return;
      if (!apply(hasOwnProperty, value_d, ["__om_ping"])) return;
      try {
        value_portPost({
          __om_pong: value_d.__om_ping,
        });
      } catch (value_e: Dynamic) {}
    };
    parent.postMessage(
      {
        __om_hello: 1,
      },
      "*",
      [value_ch.port2],
    );
  } catch (value_e: Dynamic) {}
  /* Self-navigation tripwire: pagehide fires while THIS document is
   * being torn down. The message is DELIVERED after the document is
   * destroyed, so it arrives with e.source === null - the host accepts
   * exactly that shape (a live-source forgery of it only blanks the
   * forger's own preview). It is one tripwire, not the verdict: the
   * port probe above is what decides, on every load. The listener is
   * an unreachable closure - authored code has no reference to remove
   * it, and P is captured at t=0 before anything authored runs. */
  try {
    (window as Dynamic).addEventListener(
      "pagehide",
      function (this: Dynamic, ..._extraArguments3: Dynamic[]): Dynamic {
        try {
          parent.postMessage(
            {
              __om_nav_away: 1,
            },
            "*",
          );
        } catch (value_e: Dynamic) {}
      },
    );
  } catch (value_e: Dynamic) {}
  /* Escape relay (np): while an artboard plays (full-window or in place)
   * keyboard focus lives in HERE, so the host cannot hear Esc - relay
   * it. Advisory only: the host acts on it solely to LEAVE Play, so a
   * forged relay can do nothing worse than end the sender's own play.
   * Capture phase, so authored handlers that stopPropagation still let
   * it through. */
  try {
    (window as Dynamic).addEventListener(
      "keydown",
      function (
        this: Dynamic,
        input?: Dynamic,
        ..._extraArguments4: Dynamic[]
      ): Dynamic {
        if (input.key !== "Escape" || input.repeat) return;
        try {
          parent.postMessage(
            {
              __om_escape: 1,
            },
            "*",
          );
        } catch (value_e: Dynamic) {}
      },
      true,
    );
  } catch (value_e: Dynamic) {}
  /* Step relay: ArrowLeft / ArrowRight for the host's full-window Previous / Next, which cannot hear keys pressed in here. Not sent: a chord,
   * a repeat, a script's event, a key for a field, arrow-key control or sideways-scrolling page, or one the design cancelled. */
  try {
    var value_ARROW_OWNER: Dynamic = text;
    var value_afterDispatch: Dynamic = (window as Dynamic).setTimeout.bind(
      window,
    );
    var value_styleOf: Dynamic = (window as Dynamic).getComputedStyle.bind(
      window,
    );
    /* the page itself scrolls sideways (by more than a stray scrollbar's width) and is not clipped there */
    var value_pageScrollsSideways: Dynamic = function (
      this: Dynamic,
      ..._extraArguments5: Dynamic[]
    ): Dynamic {
      var scrollingElement: Dynamic = (document as Dynamic).scrollingElement;
      if (
        !scrollingElement ||
        scrollingElement.scrollWidth - scrollingElement.clientWidth <= 24
      )
        return false;
      var value_clip: Dynamic = /hidden|clip/;
      var overflowX: Dynamic = value_styleOf(
        (document as Dynamic).documentElement,
      ).overflowX;
      if (value_clip.test(overflowX)) return false;
      return (
        /auto|scroll/.test(overflowX) ||
        !(
          (document as Dynamic).body &&
          value_clip.test(value_styleOf((document as Dynamic).body).overflowX)
        )
      );
    };
    /* a clicked box that scrolls sideways takes the arrows without having focus: remember where the last press landed */
    var value_lastPress: Dynamic = null;
    (window as Dynamic).addEventListener(
      "pointerdown",
      function (
        this: Dynamic,
        event?: Dynamic,
        ..._extraArguments6: Dynamic[]
      ): Dynamic {
        value_lastPress =
          (event.composedPath && event.composedPath()[0]) || event.target;
      },
      true,
    );
    var value_ownsArrows: Dynamic = function (
      this: Dynamic,
      event?: Dynamic,
      ..._extraArguments7: Dynamic[]
    ): Dynamic {
      var value_path: Dynamic = event.composedPath
        ? event.composedPath()
        : [event.target];
      if (
        event.target === (document as Dynamic).body ||
        event.target === (document as Dynamic).documentElement
      ) {
        for (
          var value_p: Dynamic = value_lastPress;
          value_p && value_p.nodeType === 1 && value_p.isConnected;
          value_p =
            value_p.parentElement ||
            (value_p.parentNode && value_p.parentNode.host) ||
            null
        )
          value_path.push(value_p);
      }
      for (var index: Dynamic = 0; index < value_path.length; index += 1) {
        var value_n: Dynamic = value_path[index];
        if (!value_n || value_n.nodeType !== 1) continue;
        if (
          value_n.isContentEditable ||
          (value_n.matches && value_n.matches(value_ARROW_OWNER))
        )
          return true;
        /* a box in the design that scrolls sideways keeps its arrows too */
        if (
          value_n.scrollWidth - value_n.clientWidth > 24 &&
          /auto|scroll/.test(value_styleOf(value_n).overflowX)
        )
          return true;
      }
      return false;
    };
    (window as Dynamic).addEventListener(
      "keydown",
      function (
        this: Dynamic,
        input?: Dynamic,
        ..._extraArguments8: Dynamic[]
      ): Dynamic {
        if (
          (input.key !== "ArrowLeft" && input.key !== "ArrowRight") ||
          input.repeat ||
          !input.isTrusted
        )
          return;
        if (
          input.metaKey ||
          input.ctrlKey ||
          input.altKey ||
          input.shiftKey ||
          value_ownsArrows(input)
        )
          return;
        if (value_pageScrollsSideways()) return;
        var __om_step: Dynamic = input.key === "ArrowRight" ? 1 : -1;
        value_afterDispatch(function (
          this: Dynamic,
          ..._extraArguments9: Dynamic[]
        ): Dynamic {
          if (input.defaultPrevented) return;
          try {
            parent.postMessage(
              {
                __om_step: __om_step,
              },
              "*",
            );
          } catch (value_e: Dynamic) {}
        }, 0);
      },
      false,
    );
  } catch (value_e: Dynamic) {}
  /* Link relay (advisory, not hardened). Any navigation here (even "#x", resolved off <base>) trips the
   * host's guard, so every anchor click is cancelled at capture - invisibly: the design (and the edit picker)
   * still read defaultPrevented as false, and their own preventDefault() means hands off. Otherwise, once the
   * click has dispatched: "#id" scrolls the frame to its target, external http(s) is handed to the host, and a
   * project path (href="Deck.dc.html") is offered to the host, which opens it only if it names an artboard. */
  try {
    var value_compatPage: Dynamic =
      (window as Dynamic).__omEditor ===
      1; /* a migrated page at its own URL (buildCompatDoc): links name pages by their project path, as its shim does */
    /* the project root (/_f/{ver}/project/) the runner stamped ahead of this script: a link is named relative to IT, so deck/a.html's
     * "b.html" reads deck/b.html and its "../index.html" reads index.html; read once, here, before anything authored runs */
    var value_projectRoot: Dynamic =
      value_compatPage &&
      typeof (window as Dynamic).__omProjectRoot === "string"
        ? (window as Dynamic).__omProjectRoot
        : null;
    var text2: Dynamic =
      "a[*|href],area[href]"; /* *| also catches SVG xlink:href */
    try {
      (document as Dynamic).createElement("a").matches(text2);
    } catch (value_e: Dynamic) {
      text2 = "a[href],area[href]";
    }
    /* A native control between the click and the link owns the click: in current engines these act without the link navigating... */
    var text3: Dynamic =
      "input[type=checkbox],input[type=radio],input[type=file],input[type=color],summary,label,video[controls],audio[controls]";
    /* ...while these (buttons, text/number/date/range inputs, selects) would still navigate it, so the navigation is cancelled but nothing opens. */
    var value_CONTROL_SEL: Dynamic = text3 + ",button,input,select,textarea";
    /* a label counts only when it labels something, a summary only as its details' first summary: otherwise the link still navigates */
    var value_ownsClick: Dynamic = function (
      this: Dynamic,
      input?: Dynamic,
      ..._extraArguments0: Dynamic[]
    ): Dynamic {
      if (input.localName === "label") return !!input.control;
      if (input.localName !== "summary") return true;
      var parentNode: Dynamic = input.parentNode;
      return (
        !!parentNode &&
        parentNode.localName === "details" &&
        parentNode.querySelector(":scope > summary") === input
      );
    };
    var value_hit: Dynamic = function (
      this: Dynamic,
      event?: Dynamic,
      ..._extraArguments1: Dynamic[]
    ): Dynamic {
      var value_path: Dynamic = event.composedPath
        ? event.composedPath()
        : [event.target];
      var control2: Dynamic = null;
      for (var index: Dynamic = 0; index < value_path.length; index += 1) {
        var value_n: Dynamic = value_path[index];
        if (!value_n || value_n.nodeType !== 1 || !value_n.matches) continue;
        if (value_n.matches(text2))
          return {
            a: value_n,
            control: control2,
          };
        if (
          control2 == null &&
          value_n.matches(value_CONTROL_SEL) &&
          value_ownsClick(value_n)
        )
          control2 = value_n;
      }
      return null;
    };
    var value_follow: Dynamic = function (
      this: Dynamic,
      element?: Dynamic,
      options?: Dynamic,
      ..._extraArguments10: Dynamic[]
    ): Dynamic {
      var value_raw: Dynamic = String(
        element.getAttribute("href") || "",
      ).trim();
      if (value_raw === "")
        return; /* SVG xlink-only anchors, empty href: cancelled above, inert here */
      if (value_raw.charAt(0) === "#") {
        if (options || value_raw === "#")
          return; /* a middle click never scrolls; a bare "#" is the "script owns it" idiom: inert */
        var value_id: Dynamic = value_raw.slice(1);
        try {
          value_id = decodeURIComponent(value_id);
        } catch (value_e: Dynamic) {}
        var value_t: Dynamic =
          (document as Dynamic).getElementById(value_id) ||
          (document as Dynamic).getElementsByName(value_id)[0];
        /* in-frame scroll only: a fragment navigation or scrollIntoView can also scroll the host's containers */
        try {
          if (value_t)
            (window as Dynamic).scrollBy(
              0,
              value_t.getBoundingClientRect().top,
            );
          else if (value_id.toLowerCase() === "top")
            (window as Dynamic).scrollTo(0, 0);
        } catch (value_e: Dynamic) {}
        return;
      }
      var value_url: Dynamic = null;
      try {
        value_url = new URL(value_raw, (document as Dynamic).baseURI);
      } catch (value_e: Dynamic) {
        return;
      }
      if (value_url.protocol !== "http:" && value_url.protocol !== "https:")
        return;
      var value_own: Dynamic = false;
      try {
        value_own =
          value_url.origin === new URL((document as Dynamic).baseURI).origin;
      } catch (value_e: Dynamic) {}
      if (value_own) {
        if (options || element.hasAttribute("download"))
          return; /* a same-origin download names no artboard (in compat mode the page shim saves it) */
        var __om_step: Dynamic = value_compatPage
          ? value_projectRoot !== null
            ? value_projectRoot
            : new URL(".", (document as Dynamic).baseURI).pathname
          : null;
        if (__om_step !== null && value_url.pathname.indexOf(__om_step) !== 0)
          return; /* out of the project: not a page of it */
        var __om_open: Dynamic =
          __om_step !== null
            ? value_url.pathname.slice(__om_step.length)
            : value_url.pathname.indexOf("/appifact/") === 0
              ? value_url.pathname.slice(10)
              : value_url.pathname.slice(1);
        try {
          __om_open = decodeURIComponent(__om_open);
        } catch (value_e: Dynamic) {}
        try {
          parent.postMessage(
            {
              __om_open: __om_open,
            },
            "*",
          );
        } catch (value_e: Dynamic) {}
        return;
      }
      try {
        parent.postMessage(
          {
            __om_link: value_url.href,
          },
          "*",
        );
      } catch (value_e: Dynamic) {}
    };
    var value_onLink: Dynamic = function (
      this: Dynamic,
      event?: Dynamic,
      ..._extraArguments11: Dynamic[]
    ): Dynamic {
      var value_aux: Dynamic = event.type === "auxclick";
      if (value_aux && event.button !== 1) return;
      var value_h: Dynamic = value_hit(event);
      if (value_h == null) return;
      var a2: Dynamic = value_h.a;
      /* text being edited around the click (asked of the nearest HTML element: SVG nodes have no isContentEditable) */
      var target: Dynamic = event.target;
      while (target && target.isContentEditable === undefined)
        target = target.parentNode;
      var value_editing: Dynamic = !!(target && target.isContentEditable);
      /* untouched: a control that keeps its click (any control, for a middle click), and a middle click in text being edited (paste) */
      if (
        (value_h.control != null &&
          (value_aux || value_h.control.matches(text3))) ||
        (value_aux && value_editing)
      )
        return;
      var value_handled: Dynamic = false;
      var preventDefault: Dynamic = event.preventDefault;
      var value: Dynamic = function (
        this: Dynamic,
        ..._extraArguments12: Dynamic[]
      ): Dynamic {
        value_handled = true;
        preventDefault.call(event);
      };
      try {
        (Object as Dynamic).defineProperty(event, "preventDefault", {
          value: value,
          writable: true,
          configurable: true,
        });
        (Object as Dynamic).defineProperty(event, "defaultPrevented", {
          get: function (
            this: Dynamic,
            ..._extraArguments13: Dynamic[]
          ): Dynamic {
            return value_handled;
          },
          configurable: true,
        });
        (Object as Dynamic).defineProperty(event, "returnValue", {
          get: function (
            this: Dynamic,
            ..._extraArguments14: Dynamic[]
          ): Dynamic {
            return !value_handled;
          },
          set: function (
            this: Dynamic,
            input?: Dynamic,
            ..._extraArguments15: Dynamic[]
          ): Dynamic {
            if (input === false) value();
          },
          configurable: true,
        });
      } catch (value_e: Dynamic) {}
      preventDefault.call(event);
      /* cancelled, nothing opens: a control the link would navigate past, a link in text being edited,
       * and a middle button arriving as 'click' (auxclick carries the one relay for it) */
      if (
        value_h.control != null ||
        value_editing ||
        (!value_aux && event.button === 1)
      )
        return;
      setTimeout(function (
        this: Dynamic,
        ..._extraArguments16: Dynamic[]
      ): Dynamic {
        if (!value_handled) value_follow(a2, value_aux);
      }, 0);
    };
    (window as Dynamic).addEventListener("click", value_onLink, true);
    (window as Dynamic).addEventListener("auxclick", value_onLink, true);
  } catch (value_e: Dynamic) {}
  var value_serialise: Dynamic = function (
    this: Dynamic,
    input?: Dynamic,
    ..._extraArguments17: Dynamic[]
  ): Dynamic {
    try {
      return JSON.stringify(input);
    } catch (value_e: Dynamic) {
      return JSON.stringify(String(input));
    }
  };
  (window as Dynamic).addEventListener(
    "message",
    function (
      this: Dynamic,
      input?: Dynamic,
      ..._extraArguments18: Dynamic[]
    ): Dynamic {
      if (input.source !== parent) return;
      var data: Dynamic = input.data;
      if (!data || data.__om_eval !== 1) return;
      var value_reply: Dynamic = function (
        this: Dynamic,
        input2?: Dynamic,
        ..._extraArguments19: Dynamic[]
      ): Dynamic {
        input2.__om_eval_r = 1;
        input2.id = data.id;
        input.source.postMessage(input2, "*");
      };
      try {
        var value_r: Dynamic = (0, eval)(data.code);
        if (value_r && typeof value_r.then === "function") {
          value_r.then(
            function (
              this: Dynamic,
              input2?: Dynamic,
              ..._extraArguments20: Dynamic[]
            ): Dynamic {
              value_reply({
                ok: 1,
                v: value_serialise(input2),
              });
            },
            function (
              this: Dynamic,
              input2?: Dynamic,
              ..._extraArguments21: Dynamic[]
            ): Dynamic {
              value_reply({
                ok: 0,
                e: String(input2),
              });
            },
          );
        } else {
          value_reply({
            ok: 1,
            v: value_serialise(value_r),
          });
        }
      } catch (value_err: Dynamic) {
        value_reply({
          ok: 0,
          e: String(value_err),
        });
      }
    },
  );
})();
