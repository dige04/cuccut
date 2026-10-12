/** Restored injected script; compiled as an isolated IIFE before insertion into a preview. */
import type { Dynamic } from "../runtime-types";
(function (this: Dynamic, ..._extraArguments: Dynamic[]): Dynamic {
  var text: Dynamic = "page:";
  var value_memory: Dynamic = function (
    this: Dynamic,
    ..._extraArguments2: Dynamic[]
  ): Dynamic {
    var value_m: Dynamic = (Object as Dynamic).create(null);
    return {
      getItem: function (
        this: Dynamic,
        input?: Dynamic,
        ..._extraArguments3: Dynamic[]
      ): Dynamic {
        return input in value_m ? value_m[input] : null;
      },
      setItem: function (
        this: Dynamic,
        input?: Dynamic,
        value?: Dynamic,
        ..._extraArguments4: Dynamic[]
      ): Dynamic {
        value_m[input] = String(value);
      },
      removeItem: function (
        this: Dynamic,
        input?: Dynamic,
        ..._extraArguments5: Dynamic[]
      ): Dynamic {
        delete value_m[input];
      },
      key: function (
        this: Dynamic,
        input?: Dynamic,
        ..._extraArguments6: Dynamic[]
      ): Dynamic {
        var value_ks: Dynamic = (Object as Dynamic).keys(value_m);
        input = Math.floor(Number(input)) || 0;
        return input >= 0 && input < value_ks.length ? value_ks[input] : null;
      },
      get length(): Dynamic {
        return (Object as Dynamic).keys(value_m).length;
      },
    };
  };
  var value_scope: Dynamic = function (
    this: Dynamic,
    n?: Dynamic,
    ..._extraArguments7: Dynamic[]
  ): Dynamic {
    var value_keys: Dynamic = function (
      this: Dynamic,
      ..._extraArguments8: Dynamic[]
    ): Dynamic {
      var items: Dynamic = [];
      // CucCut: restorer fix — read the scoped storage `n` (`real` in the original script); the restored code read
      // `length.length` / `length.key` off the loop bound, which is undefined, so listing an artboard's keys threw.
      for (
        var index: Dynamic = 0, length: Dynamic = n.length;
        index < length;
        index++
      ) {
        var value_k: Dynamic = n.key(index);
        if (value_k !== null && value_k.indexOf(text) === 0)
          items.push(value_k.slice(text.length));
      }
      return items;
    };
    var state3: Dynamic = {
      getItem: function (
        this: Dynamic,
        input?: Dynamic,
        ..._extraArguments9: Dynamic[]
      ): Dynamic {
        return n.getItem(text + String(input));
      },
      setItem: function (
        this: Dynamic,
        input?: Dynamic,
        value?: Dynamic,
        ..._extraArguments0: Dynamic[]
      ): Dynamic {
        n.setItem(text + String(input), String(value));
      },
      removeItem: function (
        this: Dynamic,
        input?: Dynamic,
        ..._extraArguments1: Dynamic[]
      ): Dynamic {
        n.removeItem(text + String(input));
      },
      clear: function (
        this: Dynamic,
        ..._extraArguments10: Dynamic[]
      ): Dynamic {
        value_keys().forEach(function (
          this: Dynamic,
          input?: Dynamic,
          ..._extraArguments11: Dynamic[]
        ): Dynamic {
          n.removeItem(text + input);
        });
      },
      key: function (
        this: Dynamic,
        input?: Dynamic,
        ..._extraArguments12: Dynamic[]
      ): Dynamic {
        var value_ks: Dynamic = value_keys();
        input = Math.floor(Number(input)) || 0;
        return input >= 0 && input < value_ks.length ? value_ks[input] : null;
      },
      get length(): Dynamic {
        return value_keys().length;
      },
    };
    if (typeof Proxy !== "function") return state3;
    var value_own: Dynamic = function (
      this: Dynamic,
      input?: Dynamic,
      ..._extraArguments13: Dynamic[]
    ): Dynamic {
      return (
        typeof input === "string" && !(input in state3) && input !== "length"
      );
    };
    return new Proxy(state3, {
      get: function (
        this: Dynamic,
        input?: Dynamic,
        options?: Dynamic,
        ..._extraArguments14: Dynamic[]
      ): Dynamic {
        if (options === "length") return value_keys().length;
        if (options in state3) return state3[options];
        if (!value_own(options)) return undefined;
        var value: Dynamic = n.getItem(text + options);
        return value === null ? undefined : value;
      },
      set: function (
        this: Dynamic,
        input?: Dynamic,
        options?: Dynamic,
        value?: Dynamic,
        ..._extraArguments15: Dynamic[]
      ): Dynamic {
        if (value_own(options)) n.setItem(text + options, String(value));
        return true;
      },
      deleteProperty: function (
        this: Dynamic,
        input?: Dynamic,
        options?: Dynamic,
        ..._extraArguments16: Dynamic[]
      ): Dynamic {
        if (value_own(options)) n.removeItem(text + options);
        return true;
      },
      has: function (
        this: Dynamic,
        input?: Dynamic,
        options?: Dynamic,
        ..._extraArguments17: Dynamic[]
      ): Dynamic {
        return (
          options in state3 ||
          options === "length" ||
          (value_own(options) && n.getItem(text + options) !== null)
        );
      },
      ownKeys: function (
        this: Dynamic,
        ..._extraArguments18: Dynamic[]
      ): Dynamic {
        return value_keys();
      },
      getOwnPropertyDescriptor: function (
        this: Dynamic,
        input?: Dynamic,
        options?: Dynamic,
        ..._extraArguments19: Dynamic[]
      ): Dynamic {
        if (!value_own(options)) return undefined;
        var value: Dynamic = n.getItem(text + options);
        return value === null
          ? undefined
          : {
              value: value,
              writable: true,
              enumerable: true,
              configurable: true,
            };
      },
    });
  };
  var state: Dynamic = {};
  var state2: Dynamic = {};
  ["localStorage", "sessionStorage"].forEach(function (
    this: Dynamic,
    input?: Dynamic,
    ..._extraArguments20: Dynamic[]
  ): Dynamic {
    var n: Dynamic = null;
    try {
      n = (window as Dynamic)[input];
    } catch (value_e: Dynamic) {
      n = null;
    }
    if (!n || typeof n.getItem !== "function") n = value_memory();
    state[input] = n;
    state2[input] = value_scope(n);
    try {
      (Object as Dynamic).defineProperty(window, input, {
        value: state2[input],
        configurable: true,
      });
    } catch (value_e: Dynamic) {}
  });
  /* 'storage' events, the same view: a write to the namespace (another artboard, another tab) reaches the page's listeners
   * with its own key and the scoped store as storageArea; anything else on this origin (the editor's stash and prefs, a key
   * outside the namespace) is not the page's and does not reach them. Registered first and capturing, so it runs before any
   * listener the page adds, onstorage included. */
  try {
    (window as Dynamic).addEventListener(
      "storage",
      function (
        this: Dynamic,
        input?: Dynamic,
        ..._extraArguments21: Dynamic[]
      ): Dynamic {
        if (!input.isTrusted)
          return; /* one the page dispatched itself (a same-window sync idiom): its own traffic, already in its own terms */
        var key: Dynamic = input.key;
        var value: Dynamic =
          input.storageArea === state.localStorage
            ? state2.localStorage
            : input.storageArea === state.sessionStorage
              ? state2.sessionStorage
              : null;
        if (
          key === null ||
          (typeof key === "string" && key.indexOf(text) === 0)
        ) {
          /* a namespace key, or a whole-store clear (null): the page's, in its terms */
          try {
            (Object as Dynamic).defineProperties(input, {
              key: {
                value: key === null ? null : key.slice(text.length),
                configurable: true,
              },
              storageArea: {
                value: value,
                configurable: true,
              },
            });
          } catch (value_x: Dynamic) {
            input.stopImmediatePropagation();
          }
          return;
        }
        input.stopImmediatePropagation();
      },
      true,
    );
  } catch (value_e: Dynamic) {}
})();
