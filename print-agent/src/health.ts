import net from 'node:net';

export async function checkPrinterReachable(
  host: string,
  port: number,
  timeoutMs: number,
): Promise<{ reachable: boolean; error: string | null }> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    let settled = false;

    const finish = (reachable: boolean, error: string | null) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({ reachable, error });
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true, null));
    socket.once('timeout', () => finish(false, 'ETIMEDOUT'));
    socket.once('error', (error: NodeJS.ErrnoException) =>
      finish(false, error.code ?? 'PRINTER_UNREACHABLE'),
    );
  });
}
