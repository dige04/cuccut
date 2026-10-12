/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPlatformRateLimiter(
  runtime: RuntimeBindings,
): () => void {
  var PlatformRateLimiterResolvedValue: Dynamic;
  var TokenBucket: Dynamic;
  var externalLinkLimiter: Dynamic;
  function errorMessage(error?: Dynamic): Dynamic {
    return error instanceof Error ? error.message : String(error);
  }
  bindRuntimeValue(
    runtime,
    "PlatformRateLimiterResolvedValue",
    () => PlatformRateLimiterResolvedValue,
    (value) => {
      PlatformRateLimiterResolvedValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TokenBucket",
    () => TokenBucket,
    (value) => {
      TokenBucket = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "externalLinkLimiter",
    () => externalLinkLimiter,
    (value) => {
      externalLinkLimiter = value;
    },
  );
  bindRuntimeValue(runtime, "errorMessage", () => errorMessage);
  return () => {
    PlatformRateLimiterResolvedValue = 2 * 1024 * 1024;
    TokenBucket = class {
      constructor(input: Dynamic, options: Dynamic) {
        this.cap = input;
        this.refillPerSec = options;
        this.tokens = input;
      }
      cap: Dynamic;
      refillPerSec: Dynamic;
      tokens: Dynamic;
      last: Dynamic = performance.now();
      take(): Dynamic {
        let value: Dynamic = performance.now();
        this.tokens = Math.min(
          this.cap,
          this.tokens + ((value - this.last) / 1e3) * this.refillPerSec,
        );
        this.last = value;
        return this.tokens < 1 ? false : ((this.tokens -= 1), true);
      }
    };
    externalLinkLimiter = new TokenBucket(1, 1);
  };
}
