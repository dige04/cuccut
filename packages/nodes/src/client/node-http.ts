import crypto from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import http from 'node:http';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  NODE_ERROR,
  NODE_PROTOCOL_HEADER,
  NODE_PROTOCOL_VERSION,
  type NodeHealth,
  type NodeJob,
  type NodeJobEvent,
  type NodeJobRequest,
  type NodePairResponse,
  type RemoteNodeRejectReason,
} from '@cuccut/protocol';
import { NodesClient as NC } from '@cuccut/protocol/messages/nodes';

/**
 * HTTP client for the node service (node protocol spec §2–§7), used by the initiator. Only `node:http` is used: uploads need a streamed body with `Content-Length`
 * (nodes reject `Transfer-Encoding`), and the event stream must be disconnectable on an idle deadline. Each request gets a new connection (`agent: false`), with no stale long-lived connections.
 *
 * The token is placed only in the `Authorization` header. Error messages contain only the text given by the node, the host and port, and system error codes; they never include request headers.
 */

/** Non-2xx response from the node (§8). `message` is the node's message. */
export class NodeResponseError extends Error {
  readonly status: number;
  /** The node's error code; `HTTP_<status>` when the response body is non-conforming. */
  readonly code: string;
  readonly details: Record<string, unknown> | undefined;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'NodeResponseError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Cannot connect, connection interrupted, timeout, or response is not valid JSON. */
export class NodeConnectionError extends Error {
  /** System error code (`ECONNREFUSED`…), or `TIMEOUT` or `BAD_RESPONSE`. */
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'NodeConnectionError';
    this.code = code;
  }
}

/** Aborted (the caller's `AbortSignal`). */
export class NodeRequestAborted extends Error {
  constructor() {
    super('Request aborted');
    this.name = 'NodeRequestAborted';
  }
}

/** The node's rejection → `details.reason` of `REMOTE_NODE_REJECTED` (§9, §10); null when it is not a rejection. */
export function rejectReason(error: NodeResponseError): RemoteNodeRejectReason | null {
  switch (error.code) {
    case NODE_ERROR.UNAUTHORIZED:
      return 'unpaired';
    case NODE_ERROR.PROTOCOL_VERSION_UNSUPPORTED:
      return 'version';
    case NODE_ERROR.CAPABILITY_DISABLED:
      return 'capability-disabled';
    case NODE_ERROR.MODEL_NOT_READY:
      return 'model-not-ready';
    case NODE_ERROR.QUEUE_FULL:
      return 'queue-full';
    case NODE_ERROR.DISK_LOW:
      return 'disk-low';
    case NODE_ERROR.SOURCE_NOT_ALLOWED:
      return 'source-not-allowed';
    case NODE_ERROR.INPUT_TOO_LARGE:
      return 'input-too-large';
    case NODE_ERROR.PAIRING_CODE_INVALID:
      return 'pairing-code-invalid';
    case NODE_ERROR.PAIRING_LOCKED:
      return 'pairing-locked';
  }
  // When the response body is non-conforming, classify by status code.
  if (error.status === 401) return 'unpaired';
  if (error.status === 426) return 'version';
  return null;
}

/** Whether this initiator's protocol version is compatible with the node's (§2: each side's minimum version). */
export function versionCompatible(health: Pick<NodeHealth, 'nodeProtocolVersion' | 'minNodeProtocolVersion'>): boolean {
  return (
    Number.isInteger(health.nodeProtocolVersion) &&
    Number.isInteger(health.minNodeProtocolVersion) &&
    NODE_PROTOCOL_VERSION >= health.minNodeProtocolVersion &&
    health.nodeProtocolVersion >= NODE_PROTOCOL_VERSION_MIN_ACCEPTED
  );
}

/** Minimum node protocol version the initiator can talk to. */
const NODE_PROTOCOL_VERSION_MIN_ACCEPTED = 1;
/** Limit for JSON responses (health, task records, errors). */
const JSON_RESPONSE_LIMIT = 1024 * 1024;

interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  token?: string | null;
  json?: unknown;
  headers?: Record<string, string | number>;
  /** Deadline for the whole request, including reading the JSON response; with `streaming`, it only covers up to the response headers. */
  timeoutMs?: number;
  /** The response body is a long stream (event stream): the deadline only covers up to the response headers. */
  streaming?: boolean;
  /** Deadline for no data to flow on the connection (uploads, downloads). */
  idleMs?: number;
  signal?: AbortSignal;
}

export class NodeClient {
  readonly host: string;
  readonly port: number;

  constructor(host: string, port: number) {
    // Strip the brackets from forms like `[::1]`: `http.request` wants the bare address.
    this.host = host.replace(/^\[(.*)\]$/, '$1');
    this.port = port;
  }

  get label(): string {
    return this.host.includes(':') ? `[${this.host}]:${this.port}` : `${this.host}:${this.port}`;
  }

  health(options: { timeoutMs: number; signal?: AbortSignal }): Promise<NodeHealth> {
    return this.#json<NodeHealth>({ method: 'GET', path: '/v1/health', ...options });
  }

  pair(body: { code: string; clientId: string; clientName: string }, options: { timeoutMs: number }): Promise<NodePairResponse> {
    return this.#json<NodePairResponse>({ method: 'POST', path: '/v1/pair', json: body, ...options });
  }

  createJob(token: string, request: NodeJobRequest, options: { timeoutMs: number; signal?: AbortSignal }): Promise<NodeJob> {
    return this.#json<NodeJob>({ method: 'POST', path: '/v1/jobs', token, json: request, ...options });
  }

  getJob(token: string, jobId: string, options: { timeoutMs: number; signal?: AbortSignal }): Promise<NodeJob> {
    return this.#json<NodeJob>({ method: 'GET', path: `/v1/jobs/${encodeURIComponent(jobId)}`, token, ...options });
  }

  cancelJob(token: string, jobId: string, options: { timeoutMs: number }): Promise<NodeJob> {
    return this.#json<NodeJob>({ method: 'POST', path: `/v1/jobs/${encodeURIComponent(jobId)}/cancel`, token, ...options });
  }

  async deleteJob(token: string, jobId: string, options: { timeoutMs: number }): Promise<void> {
    await this.#json<void>({ method: 'DELETE', path: `/v1/jobs/${encodeURIComponent(jobId)}`, token, ...options });
  }

  /** Upload media: the file is streamed out, `Content-Length` is `byteLength`, and the file is not read into memory. */
  async upload(
    token: string,
    jobId: string,
    file: string,
    byteLength: number,
    options: { idleMs: number; signal?: AbortSignal },
  ): Promise<void> {
    const response = await this.#send(
      {
        method: 'PUT',
        path: `/v1/jobs/${encodeURIComponent(jobId)}/input`,
        token,
        headers: { 'content-type': 'application/octet-stream', 'content-length': byteLength },
        ...options,
      },
      (request) => {
        const source = createReadStream(file);
        source.on('error', (error) => request.destroy(error));
        request.on('close', () => source.destroy());
        source.pipe(request);
      },
    );
    await this.#finish(response);
  }

  /** Open the event stream (events after `since`). The returned response is read line by line by the caller, who is responsible for destroying it. */
  async events(
    token: string,
    jobId: string,
    since: number,
    options: { timeoutMs: number; signal?: AbortSignal },
  ): Promise<http.IncomingMessage> {
    const response = await this.#send({
      method: 'GET',
      path: `/v1/jobs/${encodeURIComponent(jobId)}/events${since > 0 ? `?since=${since}` : ''}`,
      token,
      streaming: true,
      ...options,
    });
    if (response.statusCode !== 200) {
      await this.#finish(response);
      throw new NodeConnectionError('BAD_RESPONSE', NC.badEventStream({ label: this.label }).text);
    }
    return response;
  }

  /** Download the result to `dest`, computing sha256 at the same time. Returns the lowercase hex digest and the length. */
  async download(
    token: string,
    jobId: string,
    dest: string,
    options: { idleMs: number; signal?: AbortSignal },
  ): Promise<{ sha256: string; byteLength: number }> {
    const response = await this.#send({ method: 'GET', path: `/v1/jobs/${encodeURIComponent(jobId)}/result`, token, ...options });
    if (response.statusCode !== 200) {
      await this.#finish(response);
      throw new NodeConnectionError('BAD_RESPONSE', NC.badResultResponse({ label: this.label }).text);
    }
    const hash = crypto.createHash('sha256');
    let byteLength = 0;
    const meter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        byteLength += chunk.length;
        hash.update(chunk);
        callback(null, chunk);
      },
    });
    try {
      await pipeline(response, meter, createWriteStream(dest));
    } catch (error) {
      throw this.#connectionError(error);
    }
    return { sha256: hash.digest('hex'), byteLength };
  }

  // ---- Internal ----

  async #json<T>(options: RequestOptions): Promise<T> {
    const response = await this.#send(options);
    const body = await this.#finish(response);
    if (response.statusCode === 204 || body.length === 0) return undefined as T;
    try {
      return JSON.parse(body.toString('utf8')) as T;
    } catch {
      throw new NodeConnectionError('BAD_RESPONSE', NC.badJson({ label: this.label }).text);
    }
  }

  /** Read the full response body; throws `NodeResponseError` for non-2xx. */
  async #finish(response: http.IncomingMessage): Promise<Buffer> {
    const chunks: Buffer[] = [];
    let size = 0;
    try {
      for await (const chunk of response) {
        size += (chunk as Buffer).length;
        if (size > JSON_RESPONSE_LIMIT) {
          response.destroy();
          throw new NodeConnectionError('BAD_RESPONSE', NC.responseTooLarge({ label: this.label }).text);
        }
        chunks.push(chunk as Buffer);
      }
    } catch (error) {
      throw this.#connectionError(error);
    }
    const body = Buffer.concat(chunks);
    const status = response.statusCode ?? 0;
    if (status >= 200 && status < 300) return body;
    type ErrorBody = { error?: { code?: unknown; message?: unknown; details?: unknown } } | null;
    let parsed: ErrorBody;
    try {
      parsed = JSON.parse(body.toString('utf8')) as ErrorBody;
    } catch {
      parsed = null;
    }
    const error = parsed?.error;
    const code = typeof error?.code === 'string' ? error.code : `HTTP_${status}`;
    const message = typeof error?.message === 'string' ? error.message : NC.nodeReturnedStatus({ status }).text;
    const details =
      error?.details && typeof error.details === 'object' && !Array.isArray(error.details)
        ? (error.details as Record<string, unknown>)
        : undefined;
    throw new NodeResponseError(status, code, message, details);
  }

  /**
   * Send the request and wait for the response headers. If `write` is given, it writes the request body (and ends it); otherwise it writes `json` or an empty body.
   * `timeoutMs` covers until the response body has been read (the timer stays alive until the caller finishes reading); `idleMs` covers idleness on the connection.
   */
  #send(options: RequestOptions, write?: (request: http.ClientRequest) => void): Promise<http.IncomingMessage> {
    const headers: Record<string, string | number> = { [NODE_PROTOCOL_HEADER]: String(NODE_PROTOCOL_VERSION), ...options.headers };
    if (options.token) headers.authorization = `Bearer ${options.token}`;
    let payload: Buffer | null = null;
    if (options.json !== undefined) {
      payload = Buffer.from(JSON.stringify(options.json));
      headers['content-type'] = 'application/json';
      headers['content-length'] = payload.length;
    }
    return new Promise((resolve, reject) => {
      if (options.signal?.aborted) {
        reject(new NodeRequestAborted());
        return;
      }
      let settled = false;
      const request = http.request({ host: this.host, port: this.port, method: options.method, path: options.path, headers, agent: false });
      let timer: ReturnType<typeof setTimeout> | null = null;
      const cleanup = () => {
        if (timer) clearTimeout(timer);
        timer = null;
        options.signal?.removeEventListener('abort', onAbort);
      };
      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      };
      const onAbort = () => {
        request.destroy(new NodeRequestAborted());
      };
      options.signal?.addEventListener('abort', onAbort, { once: true });
      if (options.timeoutMs) {
        timer = setTimeout(
          () => request.destroy(new NodeConnectionError('TIMEOUT', NC.timedOut({ label: this.label }).text)),
          options.timeoutMs,
        );
      }
      if (options.idleMs) {
        request.setTimeout(options.idleMs, () =>
          request.destroy(new NodeConnectionError('TIMEOUT', NC.idleTimeout({ label: this.label }).text)),
        );
      }
      request.on('error', (error) => fail(this.#connectionError(error)));
      request.on('response', (response) => {
        if (settled) {
          response.destroy();
          return;
        }
        settled = true;
        if (options.streaming && timer) {
          clearTimeout(timer);
          timer = null;
        }
        // The timer and abort listener are cleared only when the response body is fully read or the connection closes: reading the body is bound by them too.
        const done = () => cleanup();
        response.on('end', done);
        response.on('close', done);
        response.on('error', () => {});
        // If the timer or abort fires while the body is being read: `request.destroy` also destroys the response.
        resolve(response);
      });
      if (write) write(request);
      else request.end(payload ?? undefined);
    });
  }

  #connectionError(error: unknown): Error {
    if (error instanceof NodeRequestAborted || error instanceof NodeConnectionError || error instanceof NodeResponseError) return error;
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    return new NodeConnectionError(code ?? 'NETWORK', (code ? NC.connectionFailedCode({ label: this.label, code }) : NC.connectionFailed({ label: this.label })).text);
  }
}

/** One line of the event stream (events other than heartbeats carry `seq`). */
export type StreamedNodeEvent = NodeJobEvent;

/**
 * Read the NDJSON event stream line by line. If no data (heartbeats count as data) arrives within `idleMs`, destroy the response and throw `NodeConnectionError('TIMEOUT')`.
 * When the stream ends normally, iteration ends; a non-conforming line throws `NodeConnectionError('BAD_RESPONSE')`.
 */
export async function* readEventStream(response: http.IncomingMessage, idleMs: number): AsyncGenerator<StreamedNodeEvent> {
  let idle: ReturnType<typeof setTimeout> | null = null;
  let timedOut = false;
  const arm = () => {
    if (idle) clearTimeout(idle);
    idle = setTimeout(() => {
      timedOut = true;
      response.destroy();
    }, idleMs);
  };
  arm();
  let buffer = '';
  response.setEncoding('utf8');
  try {
    for await (const chunk of response) {
      arm();
      buffer += chunk as string;
      let newline: number;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (line === '') continue;
        let event: StreamedNodeEvent;
        try {
          event = JSON.parse(line) as StreamedNodeEvent;
        } catch {
          throw new NodeConnectionError('BAD_RESPONSE', NC.badStreamLine().text);
        }
        yield event;
      }
    }
  } catch (error) {
    if (timedOut) throw new NodeConnectionError('TIMEOUT', NC.noHeartbeat().text);
    if (error instanceof NodeConnectionError) throw error;
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    throw new NodeConnectionError(code ?? 'NETWORK', (code ? NC.streamInterruptedCode({ code }) : NC.streamInterrupted()).text);
  } finally {
    if (idle) clearTimeout(idle);
    if (!response.destroyed) response.destroy();
  }
  if (timedOut) throw new NodeConnectionError('TIMEOUT', NC.noHeartbeat().text);
}
