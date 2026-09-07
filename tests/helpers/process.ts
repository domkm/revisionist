import { root } from "./fixture.ts";

export const version = "2026-07-28";
export async function until<T>(
  read: () => T | undefined,
  description: string,
  timeout = 10000,
): Promise<T> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = read();
    if (value !== undefined) return value;
    await Bun.sleep(20);
  }
  throw new Error(`Timed out waiting for ${description}`);
}

export function launch(command = [process.execPath, "src/main.ts"], cwd = root) {
  const child = Bun.spawn(command, { cwd, stdin: "pipe", stdout: "pipe", stderr: "pipe" });
  let stdout = "";
  let stderr = "";
  async function collect(stream: ReadableStream<Uint8Array>, append: (text: string) => void) {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        append(decoder.decode(part.value, { stream: true }));
      }
      append(decoder.decode());
    } finally {
      reader.releaseLock();
    }
  }
  const streams = Promise.all([
    collect(child.stdout, (text) => {
      stdout += text;
    }),
    collect(child.stderr, (text) => {
      stderr += text;
    }),
  ]);
  let id = 0;
  return {
    child,
    get stdout() {
      return stdout;
    },
    get stderr() {
      return stderr;
    },
    url: () =>
      until(() => {
        const url = stderr.match(/Browser URL: (http:\/\/127\.0\.0\.1:\d+)/)?.[1];
        if (!url && child.exitCode !== null) {
          throw new Error(`Startup exited ${child.exitCode}: ${stderr}`);
        }
        return url;
      }, "startup URL"),
    async request(
      method: string,
      params: Record<string, unknown> = {},
      protocol: string | null = version,
    ) {
      const requestId = ++id;
      await child.stdin.write(
        JSON.stringify({
          jsonrpc: "2.0",
          id: requestId,
          method,
          params: {
            ...params,
            ...(protocol === null ? {} : {
              _meta: {
                "io.modelcontextprotocol/protocolVersion": protocol,
                "io.modelcontextprotocol/clientCapabilities": {},
              },
            }),
          },
        }) + "\n",
      );
      await child.stdin.flush();
      return until(
        () =>
          stdout.split("\n").slice(0, -1).filter(Boolean).map((line) =>
            JSON.parse(line) as {
              id?: number;
              result?: Record<string, unknown>;
              error?: { code: number; data?: Record<string, unknown>; };
            }
          ).find((message) => message.id === requestId),
        `${method} response; stderr: ${stderr}`,
      );
    },
    async exit() {
      const code = await until(() => child.exitCode ?? undefined, "process exit");
      await streams;
      return code;
    },
    async stop() {
      if (child.exitCode === null) child.kill("SIGTERM");
      try {
        await until(() => child.exitCode ?? undefined, "teardown", 5000);
      } catch {
        child.kill("SIGKILL");
      }
      await child.exited;
      await streams;
    },
  };
}
