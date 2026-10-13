import net from 'node:net';

/**
 * Test utility: a loopback TCP proxy between the initiator and the node, used to simulate network failures without touching the node itself.
 *
 * - `dropOnce(match, afterMs)`: for the next connection whose request line matches, cut it `afterMs` after the node starts replying (the event stream breaks once);
 * - `down()`: cut all connections, and any new connection is dropped as soon as it connects (the node "died" or the network went down); `up()` restores it;
 * - `retarget(port)`: switch to a different upstream port (after the node restarts on another port).
 *
 * Listens only on 127.0.0.1, with the port assigned by the system.
 */
export interface TcpProxy {
  readonly port: number;
  /** The first line (the HTTP request line) of each connection that passes through the proxy. */
  readonly requests: string[];
  dropOnce(match: (requestLine: string) => boolean, afterMs?: number): void;
  down(): void;
  up(): void;
  retarget(port: number): void;
  close(): Promise<void>;
}

export async function startTcpProxy(targetPort: number): Promise<TcpProxy> {
  let target = targetPort;
  let isDown = false;
  const sockets = new Set<net.Socket>();
  const requests: string[] = [];
  const rules: Array<{ match: (line: string) => boolean; afterMs: number }> = [];

  const server = net.createServer((client) => {
    sockets.add(client);
    client.on('close', () => sockets.delete(client));
    client.on('error', () => {});
    if (isDown) {
      client.destroy();
      return;
    }
    const upstream = net.connect(target, '127.0.0.1');
    sockets.add(upstream);
    upstream.on('close', () => {
      sockets.delete(upstream);
      client.destroy();
    });
    upstream.on('error', () => client.destroy());
    client.on('close', () => upstream.destroy());

    let doomed: { afterMs: number } | null = null;
    let scheduled = false;
    client.once('data', (first: Buffer) => {
      const line = first.toString('latin1').split('\r\n')[0] ?? '';
      requests.push(line);
      const index = rules.findIndex((rule) => rule.match(line));
      if (index >= 0) doomed = rules.splice(index, 1)[0]!;
      upstream.write(first);
      client.pipe(upstream);
    });
    upstream.on('data', () => {
      if (!doomed || scheduled) return;
      scheduled = true;
      setTimeout(() => {
        client.destroy();
        upstream.destroy();
      }, doomed.afterMs);
    });
    upstream.pipe(client);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as net.AddressInfo).port;

  return {
    port,
    requests,
    dropOnce(match, afterMs = 0) {
      rules.push({ match, afterMs });
    },
    down() {
      isDown = true;
      for (const socket of sockets) socket.destroy();
    },
    up() {
      isDown = false;
    },
    retarget(next) {
      target = next;
    },
    async close() {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
