import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { mp3Fixture, pngFixture, wavFixture } from './media-fixtures.ts';

export * from './media-fixtures.ts';

/**
 * Fake provider for tests. It listens only on a temporary port on the loopback address, records every request it receives (including headers, to check that the key appears only where it should), and replies from a script (normal results, 401, 5xx, hanging, redirects, ...). Tests never connect to a real cloud service.
 */

export interface RecordedRequest {
  method: string;
  /** Path, including the query string. */
  path: string;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
  /** Text fields of a multipart request (repeated names hold multiple values). */
  fields: Record<string, string[]>;
  /** Files in a multipart request. */
  file: { name: string; type: string; size: number } | null;
  /** JSON request body. */
  json: unknown;
}

export type FakeReply =
  | { status: number; json?: unknown; text?: string; bytes?: Buffer; headers?: Record<string, string> }
  /** Does not reply until the client disconnects. */
  | 'hang';

export type FakeHandler = (request: RecordedRequest, server: FakeProviderServer) => FakeReply | Promise<FakeReply>;

export interface FakeProviderServer {
  /** `http://127.0.0.1:<port>`。 */
  origin: string;
  requests: RecordedRequest[];
  /** Number of requests that had not been fully answered when the client disconnected (on cancel, the connection should be closed). */
  closedEarly: number;
  handler: FakeHandler;
  /** Waits until the nth request is received. */
  waitForRequests(count: number, timeoutMs?: number): Promise<void>;
  /** Waits until n requests have been disconnected early by the client. */
  waitForClosedEarly(count: number, timeoutMs?: number): Promise<void>;
  close(): Promise<void>;
}

export async function startFakeProviderServer(handler: FakeHandler): Promise<FakeProviderServer> {
  const waiters = new Set<() => void>();
  const notify = () => {
    for (const waiter of waiters) waiter();
  };
  const sockets = new Set<import('node:net').Socket>();
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    let replied = false;
    res.on('close', () => {
      if (!replied || !res.writableFinished) {
        state.closedEarly++;
        notify();
      }
    });
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      void (async () => {
        const recorded = await record(req, Buffer.concat(chunks));
        state.requests.push(recorded);
        notify();
        const reply = await state.handler(recorded, state);
        if (reply === 'hang') return;
        replied = true;
        const body = reply.json !== undefined ? JSON.stringify(reply.json) : (reply.bytes ?? reply.text ?? '');
        res.writeHead(reply.status, {
          ...(reply.json !== undefined ? { 'content-type': 'application/json' } : {}),
          ...reply.headers,
        });
        res.end(body);
      })().catch((error: unknown) => {
        replied = true;
        res.writeHead(500);
        res.end(String(error));
      });
    });
  });
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  const until = (check: () => boolean, timeoutMs: number, what: string) =>
    new Promise<void>((resolve, reject) => {
      if (check()) return resolve();
      const timer = setTimeout(() => {
        waiters.delete(waiter);
        reject(new Error(`等待超时：${what}`));
      }, timeoutMs);
      const waiter = () => {
        if (!check()) return;
        clearTimeout(timer);
        waiters.delete(waiter);
        resolve();
      };
      waiters.add(waiter);
    });
  const state: FakeProviderServer = {
    origin: `http://127.0.0.1:${port}`,
    requests: [],
    closedEarly: 0,
    handler,
    waitForRequests: (count, timeoutMs = 10_000) => until(() => state.requests.length >= count, timeoutMs, `${count} 个请求`),
    waitForClosedEarly: (count, timeoutMs = 10_000) => until(() => state.closedEarly >= count, timeoutMs, `${count} 个断开的请求`),
    close: () =>
      new Promise<void>((resolve) => {
        for (const socket of sockets) socket.destroy();
        server.close(() => resolve());
      }),
  };
  return state;
}

async function record(req: http.IncomingMessage, body: Buffer): Promise<RecordedRequest> {
  const contentType = String(req.headers['content-type'] ?? '');
  const recorded: RecordedRequest = {
    method: req.method ?? 'GET',
    path: req.url ?? '/',
    headers: req.headers,
    body,
    fields: {},
    file: null,
    json: undefined,
  };
  if (contentType.startsWith('multipart/form-data')) {
    const form = await new Response(new Uint8Array(body), { headers: { 'content-type': contentType } }).formData();
    for (const [name, value] of form.entries()) {
      if (typeof value === 'string') (recorded.fields[name] ??= []).push(value);
      else recorded.file = { name: value.name, type: value.type, size: value.size };
    }
  } else if (contentType.startsWith('application/json')) {
    try {
      recorded.json = JSON.parse(body.toString('utf8'));
    } catch {
      recorded.json = undefined;
    }
  }
  return recorded;
}

// ---- Default replies for each provider ----

/** Reply to OpenAI `POST /audio/transcriptions`: includes segments and words for `verbose_json`, text only for `json`. */
export function openAiTranscriptionReply(request: RecordedRequest, text = 'hello world'): FakeReply {
  const words = text.split(' ');
  if (request.fields.response_format?.[0] === 'verbose_json') {
    return {
      status: 200,
      json: {
        task: 'transcribe',
        language: 'english',
        duration: 1,
        text,
        segments: [{ id: 0, start: 0.1, end: 0.9, text: ` ${text}` }],
        words: words.map((word, i) => ({ word, start: 0.1 + i * 0.4, end: 0.1 + i * 0.4 + 0.3 })),
        usage: { type: 'duration', seconds: 1 },
      },
    };
  }
  return { status: 200, json: { text, usage: { type: 'tokens', input_tokens: 10, output_tokens: 3, total_tokens: 13 } } };
}

/** Replies with a decodable audio clip in the requested format. There is no ready-made flac sample, so it returns WAV bytes; used only in tests that do not decode. */
export function audioReply(format: string): FakeReply {
  if (format.startsWith('mp3')) return { status: 200, bytes: mp3Fixture(), headers: { 'content-type': 'audio/mpeg' } };
  if (format.startsWith('flac')) return { status: 200, bytes: wavFixture(), headers: { 'content-type': 'audio/flac' } };
  return { status: 200, bytes: wavFixture(), headers: { 'content-type': 'audio/wav' } };
}

/** Reply to OpenAI `POST /images/generations`: `b64_json` for `n` PNGs, each with different content (the i-th is `pngFixture(16, 9, i)`). */
export function openAiImagesReply(request: RecordedRequest): FakeReply {
  const body = (request.json ?? {}) as { n?: number };
  const n = body.n ?? 1;
  return {
    status: 200,
    json: {
      created: 1_700_000_000,
      data: Array.from({ length: n }, (_, i) => ({ b64_json: pngFixture(16, 9, i).toString('base64') })),
      usage: { total_tokens: 100, input_tokens: 10, output_tokens: 90 },
    },
  };
}

export interface TextReplyOptions {
  /** OpenAI's `finish_reason` (default `stop`) or Gemini's `finishReason` (default `STOP`). */
  finishReason?: string | null;
  /** Model version in the response (default `<requested model>-2026-09-01`). */
  modelVersion?: string;
  inputTokens?: number;
  outputTokens?: number;
}

/** Reply to OpenAI (and compatible endpoints) `POST /chat/completions`. */
export function chatCompletionReply(request: RecordedRequest, content: string, options: TextReplyOptions = {}): FakeReply {
  const model = String((request.json as { model?: unknown } | undefined)?.model ?? 'model');
  return {
    status: 200,
    json: {
      id: 'chatcmpl-1',
      object: 'chat.completion',
      model: options.modelVersion ?? `${model}-2026-09-01`,
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content, refusal: null },
          finish_reason: options.finishReason === undefined ? 'stop' : options.finishReason,
        },
      ],
      usage: { prompt_tokens: options.inputTokens ?? 12, completion_tokens: options.outputTokens ?? 5, total_tokens: 17 },
    },
  };
}

/** Reply to Gemini `POST /models/<model>:generateContent`: a thought summary (which should be skipped) followed by the body. */
export function geminiTextReply(request: RecordedRequest, text: string, options: TextReplyOptions = {}): FakeReply {
  const model = /\/models\/([^/:]+):generateContent/.exec(request.path)?.[1] ?? 'model';
  return {
    status: 200,
    json: {
      candidates: [
        {
          content: { role: 'model', parts: [{ text: 'thinking about it', thought: true }, { text }] },
          finishReason: options.finishReason === undefined ? 'STOP' : options.finishReason,
          index: 0,
        },
      ],
      usageMetadata: {
        promptTokenCount: options.inputTokens ?? 12,
        candidatesTokenCount: options.outputTokens ?? 5,
        thoughtsTokenCount: 3,
      },
      modelVersion: options.modelVersion ?? `${decodeURIComponent(model)}-001`,
    },
  };
}

/** Fake OpenAI: `/models`, `/audio/transcriptions`, `/audio/speech`, `/images/generations`, and `/chat/completions`. */
export function fakeOpenAiHandler(text = 'hello world'): FakeHandler {
  return (request) => {
    if (request.method === 'GET' && request.path.endsWith('/models')) return { status: 200, json: { object: 'list', data: [] } };
    if (request.method === 'POST' && request.path.endsWith('/chat/completions')) return chatCompletionReply(request, text);
    if (request.method === 'POST' && request.path.endsWith('/audio/transcriptions')) return openAiTranscriptionReply(request, text);
    if (request.method === 'POST' && request.path.endsWith('/audio/speech')) {
      return audioReply(String((request.json as { response_format?: string } | undefined)?.response_format ?? 'mp3'));
    }
    if (request.method === 'POST' && request.path.endsWith('/images/generations')) return openAiImagesReply(request);
    return { status: 404, json: { error: { message: 'not found' } } };
  };
}

/** Fake ElevenLabs: `GET /models`, `GET /voices`, and `POST /text-to-speech/<voice_id>?output_format=…`. */
export function fakeElevenLabsHandler(): FakeHandler {
  return (request) => {
    const url = new URL(request.path, 'http://fake');
    if (request.method === 'GET' && url.pathname.endsWith('/models')) return { status: 200, json: [] };
    if (request.method === 'GET' && url.pathname.endsWith('/voices')) return { status: 200, json: { voices: [] } };
    if (request.method === 'POST' && /\/text-to-speech\/[^/]+$/.test(url.pathname)) {
      return audioReply(url.searchParams.get('output_format') ?? 'mp3_44100_128');
    }
    return { status: 404, json: { detail: { status: 'not_found', message: 'not found' } } };
  };
}

/** Gemini image generation reply: a `thought` step with an intermediate image, plus a `model_output` step with the final image. */
export function googleImageReply(request: RecordedRequest, image: Buffer = pngFixture()): FakeReply {
  const format = (request.json as { response_format?: { mime_type?: string } } | undefined)?.response_format;
  const mimeType = format?.mime_type ?? 'image/png';
  return {
    status: 200,
    json: {
      id: 'interaction-image',
      status: 'completed',
      steps: [
        { type: 'thought', content: [{ type: 'image', data: Buffer.from('draft').toString('base64'), mime_type: mimeType }] },
        {
          type: 'model_output',
          content: [
            { type: 'text', text: 'Here is your image.' },
            { type: 'image', data: image.toString('base64'), mime_type: mimeType },
          ],
        },
      ],
      usage: { total_input_tokens: 12, total_output_tokens: 1120 },
    },
  };
}

/** Fake Gemini: Interactions (the transcription model replies with word-level annotations, the general model with structured segments; image generation), and text `generateContent`. */
export function fakeGoogleHandler(text = 'hello world'): FakeHandler {
  return (request) => {
    if (request.method === 'GET' && new URL(request.path, 'http://fake').pathname.endsWith('/models')) {
      return { status: 200, json: { models: [] } };
    }
    if (request.method === 'POST' && request.path.endsWith(':generateContent')) return geminiTextReply(request, text);
    if (request.method !== 'POST' || !request.path.endsWith('/interactions'))
      return { status: 404, json: { error: { message: 'not found' } } };
    const body = request.json as { model?: string; response_format?: { type?: string } } | undefined;
    if (body?.response_format?.type === 'image') return googleImageReply(request);
    const words = text.split(' ');
    if (body?.model === 'gemini-3.5-transcribe') {
      return {
        status: 200,
        json: {
          id: 'interaction-1',
          status: 'completed',
          output_text: text,
          steps: [
            {
              type: 'model_output',
              content: [
                {
                  type: 'text',
                  text,
                  annotations: words.map((word, i) => ({
                    type: 'word_info',
                    text: word,
                    start_offset: `${(0.1 + i * 0.4).toFixed(3)}s`,
                    end_offset: `${(0.4 + i * 0.4).toFixed(3)}s`,
                  })),
                },
              ],
            },
          ],
          usage: { total_input_tokens: 32, total_output_tokens: 4 },
        },
      };
    }
    return {
      status: 200,
      json: {
        id: 'interaction-2',
        status: 'completed',
        output_text: JSON.stringify({ language: 'en', segments: [{ start: 0.1, end: 0.9, text }] }),
        usage: { total_input_tokens: 40, total_output_tokens: 20 },
      },
    };
  };
}
