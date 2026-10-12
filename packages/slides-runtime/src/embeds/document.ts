/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
} from "../bindings";

/** What `buildEmbedSrcdoc` needs to know about the embed it wraps. */
export interface EmbedSrcdocOptions {
  allowScripts?: boolean;
  interactive?: boolean;
  /** State saved by an earlier session; serialized into the bootstrap script. */
  saved?: unknown;
  /** Whether the embed persists saves through the host. */
  keepsSaves?: boolean;
  /** Legacy switch: when set, it decides whether scripts run in place of `allowScripts`. */
  runtime?: boolean;
}

declare module "../bindings" {
  interface RuntimeBindings {
    embedContentSecurityPolicy: (allowScripts?: boolean) => string;
    buildEmbedSrcdoc: (html: string, options: EmbedSrcdocOptions) => string;
    embedSandboxPermissions: string;
    webEmbedDiagnosticsScript: string;
    initializeEmbedDocument: () => void;
  }
}

export function installEmbedsDocument(runtime: RuntimeBindings): () => void {
  var embedSandboxPermissions: RuntimeBindings["embedSandboxPermissions"];
  var webEmbedDiagnosticsScript: RuntimeBindings["webEmbedDiagnosticsScript"];
  var initializeEmbedDocument: RuntimeBindings["initializeEmbedDocument"];
  function embedContentSecurityPolicy(allowScripts?: boolean): string {
    return (
      "default-src 'none'; script-src " +
      (allowScripts ? "'unsafe-inline'" : "'none'") +
      "; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; worker-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'"
    );
  }
  function buildEmbedSrcdoc(html: string, options: EmbedSrcdocOptions): string {
    let allowScripts: boolean | undefined =
        (options.runtime ?? options.allowScripts) && options.allowScripts,
      interactive: boolean | undefined =
        options.interactive === true && allowScripts,
      runtime2: string =
        options.saved !== undefined || options.keepsSaves === true
          ? (0, runtime.embedRuntimeBootstrapScript)(
              interactive,
              options.saved,
              options.keepsSaves === true,
            )
          : interactive
            ? runtime.interactiveEmbedRuntimeScript
            : runtime.defaultEmbedRuntimeScript;
    return (
      '<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="' +
      embedContentSecurityPolicy(options.allowScripts) +
      '"><meta name="referrer" content="no-referrer"><style>html,body{margin:0;padding:0;overflow:hidden}' +
      (interactive ? "html{touch-action:pan-x pan-y}" : "") +
      "</style></head><body>" +
      (interactive
        ? "<script>" +
          runtime.embedSharedRootBootstrapScript +
          webEmbedDiagnosticsScript +
          "<\/script><script>" +
          runtime2 +
          "<\/script>"
        : allowScripts
          ? "<script>" + runtime2 + "<\/script>"
          : "") +
      html +
      "</body></html>"
    );
  }
  bindRuntimeValue(
    runtime,
    "embedContentSecurityPolicy",
    () => embedContentSecurityPolicy,
  );
  bindRuntimeValue(runtime, "buildEmbedSrcdoc", () => buildEmbedSrcdoc);
  bindRuntimeValue(
    runtime,
    "embedSandboxPermissions",
    () => embedSandboxPermissions,
    (value) => {
      embedSandboxPermissions = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "webEmbedDiagnosticsScript",
    () => webEmbedDiagnosticsScript,
    (value) => {
      webEmbedDiagnosticsScript = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeEmbedDocument",
    () => initializeEmbedDocument,
    (value) => {
      initializeEmbedDocument = value;
    },
  );
  return () => {
    embedSandboxPermissions = "allow-scripts";
    initializeEmbedDocument = (0, runtime.initializeOnce)((): void => {
      (0, runtime.initializeEmbedSanitizer)();
      (0, runtime.initializeEmbedRuntimeScript)();
      webEmbedDiagnosticsScript = runtime.embedSandboxDiagnosticsScript
        .replace(/\[design sandbox\]/g, "[web embed]")
        .replace(/design previews/g, "web embeds")
        .replace(/the design preview sandbox/g, "a web embed");
    });
  };
}
