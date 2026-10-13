import type { Id, RuntimeInfo, Seq } from './domain.ts';
import type { Topic } from './events.ts';
import { localizeText, refOf, type Localized, type MessageRef } from './message-ref.ts';
import './messages/index.ts';

/** Business protocol version (`eventProtocolVersion`, architecture design §13.3). It evolves independently of the Runtime version. */
export const PROTOCOL_VERSION = '0.6';
export const RUNTIME_VERSION = '0.5.0';

export type ClientKind = 'desktop' | 'cli' | 'agent';

/**
 * First frame of the connection. The token appears only here and is not put in the URL (architecture design §4.2, §12.2).
 */
export interface HelloFrame {
  type: 'hello';
  protocolVersion: string;
  token: string;
  client: { kind: ClientKind; name: string; version: string };
}

export interface RequestFrame {
  type: 'request';
  id: string;
  method: string;
  params: unknown;
}

export type ClientFrame = HelloFrame | RequestFrame;

export interface WelcomeFrame {
  type: 'welcome';
  runtime: RuntimeInfo;
  connectionId: Id;
}

export interface ResponseFrame {
  type: 'response';
  id: string;
  ok: boolean;
  result?: unknown;
  error?: RpcErrorPayload;
}

export interface EventFrame {
  type: 'event';
  topic: Topic;
  seq: Seq;
  event: unknown;
}

/** Connection-level error (handshake failure, protocol incompatibility). The connection is closed right after it is sent. */
export interface FatalFrame {
  type: 'fatal';
  error: RpcErrorPayload;
}

export type ServerFrame = WelcomeFrame | ResponseFrame | EventFrame | FatalFrame;

/**
 * Error contract. An error must state the real status, not use one “failed” to cover every case
 * (documented convention: “the contract's status”).
 */
export type RpcErrorCode =
  | 'unauthenticated'
  | 'protocol-mismatch'
  | 'invalid-request'
  | 'unknown-method'
  | 'not-found'
  | 'forbidden'
  | 'conflict'
  | 'driver-unavailable'
  | 'driver-failed'
  | 'busy'
  /** The method and parameters are both valid, but this version cannot do it yet (for example, an attachment channel that is not connected yet). This is not an argument error. */
  | 'unsupported'
  /** The video engine process is unavailable (not built, failed to start, or restarting after a crash). */
  | 'engine-unavailable'
  | 'internal';

export interface RpcErrorPayload {
  code: RpcErrorCode;
  /** Text in the Runtime's current language at the time it is emitted. */
  message: string;
  /** Message reference (message-ref.ts) for `message`: the client regenerates it in its own language. Third-party verbatim text and errors from older versions have none. */
  messageRef?: MessageRef;
  details?: unknown;
}

export class RpcError extends Error {
  readonly code: RpcErrorCode;
  readonly details: unknown;
  readonly messageRef: MessageRef | undefined;

  /** When `message` is a `Localized` (text from `defineCatalog`), attach the reference so the client shows it in its own language. */
  constructor(code: RpcErrorCode, message: string | Localized, details?: unknown, messageRef?: MessageRef) {
    super(String(message));
    this.name = 'RpcError';
    this.code = code;
    this.details = details;
    this.messageRef = typeof message === 'string' ? messageRef : refOf(message);
  }

  toPayload(): RpcErrorPayload {
    return {
      code: this.code,
      message: this.message,
      ...(this.messageRef ? { messageRef: this.messageRef } : {}),
      ...(this.details === undefined ? {} : { details: this.details }),
    };
  }

  /** Received error: when a recognizable reference is present, `message` is replaced with the text in this process's current language. */
  static from(payload: RpcErrorPayload): RpcError {
    return new RpcError(payload.code, localizeText(payload.message, payload.messageRef), payload.details, payload.messageRef);
  }
}
