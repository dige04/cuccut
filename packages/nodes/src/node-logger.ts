/**
 * The logging interface used by this package. Harness's `Logger` satisfies it structurally. Tokens, pairing codes and transcription text never go into the logs.
 */
export interface NodeLogger {
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
}

export const silentNodeLog: NodeLogger = {
  info() {},
  warn() {},
  error() {},
};
