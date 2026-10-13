/** Logger interface used only by this package; Harness's `Logger` structurally satisfies it (Jobs does not depend on Harness, architecture design §13.1). */
export interface JobsLogger {
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
}

export const silentLog: JobsLogger = {
  info() {},
  warn() {},
  error() {},
};
