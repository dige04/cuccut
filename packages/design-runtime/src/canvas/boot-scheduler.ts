/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installCanvasBootScheduler(
  runtime: RuntimeBindings,
): () => void {
  var defaultArtboardBootEnvironment: Dynamic;
  var ArtboardBootScheduler: Dynamic;
  var artboardBootScheduler: Dynamic;
  function artboardBootClock(): Dynamic {
    return typeof performance !== "undefined" ? performance.now() : Date.now();
  }
  bindRuntimeValue(
    runtime,
    "defaultArtboardBootEnvironment",
    () => defaultArtboardBootEnvironment,
    (value) => {
      defaultArtboardBootEnvironment = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ArtboardBootScheduler",
    () => ArtboardBootScheduler,
    (value) => {
      ArtboardBootScheduler = value;
    },
  );
  bindRuntimeValue(runtime, "artboardBootClock", () => artboardBootClock);
  bindRuntimeValue(
    runtime,
    "artboardBootScheduler",
    () => artboardBootScheduler,
    (value) => {
      artboardBootScheduler = value;
    },
  );
  return () => {
    defaultArtboardBootEnvironment = {
      busySince: (): Dynamic => null,
      rank: (): Dynamic => 0,
    };
    ArtboardBootScheduler = class {
      env: Dynamic = defaultArtboardBootEnvironment;
      waiting: Dynamic = [];
      booting: Dynamic = new Map();
      timer: Dynamic = null;
      booted: Dynamic = 0;
      configure(input: Dynamic): Dynamic {
        this.env = input ?? defaultArtboardBootEnvironment;
        input === null && (this.booted = 0);
      }
      request(input: Dynamic, options: Dynamic): Dynamic {
        this.drop(input);
        this.waiting = this.waiting.filter(
          (input2?: Dynamic): Dynamic => input2.file !== input,
        );
        let state: Dynamic = {
          file: input,
          grant: options,
        };
        this.env.rank(input) < 0
          ? this.start(state)
          : (this.waiting.push(state), this.pump());
        return (): Dynamic => {
          let value: Dynamic = this.waiting.indexOf(state);
          value >= 0 && this.waiting.splice(value, 1);
        };
      }
      done(input: Dynamic): Dynamic {
        let length: Dynamic = this.waiting.length;
        this.waiting = this.waiting.filter(
          (input2?: Dynamic): Dynamic => input2.file !== input,
        );
        (this.drop(input) || this.waiting.length !== length) && this.pump();
      }
      expedite(input: Dynamic): Dynamic {
        let value: Dynamic = this.waiting.findIndex(
          (input2?: Dynamic): Dynamic => input2.file === input,
        );
        value >= 0 && this.start(this.waiting.splice(value, 1)[0]);
      }
      get inFlight(): Dynamic {
        return this.booting.size;
      }
      drop(input: Dynamic): Dynamic {
        let entry: Dynamic = this.booting.get(input);
        return entry === undefined
          ? false
          : (clearTimeout(entry),
            this.booting.delete(input),
            (this.booted += 1),
            true);
      }
      start(input: Dynamic): Dynamic {
        this.booting.set(
          input.file,
          setTimeout((): Dynamic => this.done(input.file), 2500),
        );
        input.grant();
      }
      pump(): Dynamic {
        this.timer != null && (clearTimeout(this.timer), (this.timer = null));
        let value: Dynamic = this.env.busySince(),
          value2: Dynamic =
            this.booted > 0 &&
            value != null &&
            artboardBootClock() - value < 2e3;
        for (; !value2 && this.waiting.length > 0 && this.booting.size < 1; )
          this.start(this.next());
        value2 &&
          this.waiting.length > 0 &&
          (this.timer = setTimeout((): Dynamic => this.pump(), 120));
      }
      next(): Dynamic {
        let index: Dynamic = 0,
          value: Dynamic = this.env.rank(this.waiting[0].file);
        for (let count: Dynamic = 1; count < this.waiting.length; count++) {
          let value2: Dynamic = this.env.rank(this.waiting[count].file);
          value2 < value && ((index = count), (value = value2));
        }
        return this.waiting.splice(index, 1)[0];
      }
    };
    artboardBootScheduler = new ArtboardBootScheduler();
  };
}
