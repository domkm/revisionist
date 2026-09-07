import { expect, test } from "bun:test";
import { launch, until, version } from "../helpers/process.ts";

test("startup failure after acquiring HTTP releases its listener and logs only to stderr", async () => {
  const app = launch([process.execPath, "tests/fixtures/lifecycle.ts", "startup-failure"]);
  try {
    const url = await app.url();
    expect(await app.exit()).not.toBe(0);
    expect(app.stdout).toBe("");
    expect(app.stderr).toContain("Injected startup failure");
    expect(await fetch(url).then(() => false, () => true)).toBe(true);
  } finally {
    await app.stop();
  }
});

for (const ending of ["stdin", "SIGTERM"] as const) {
  test(`pending MCP and HTTP work is cancelled on ${ending}`, async () => {
    const app = launch([process.execPath, "tests/fixtures/lifecycle.ts"]);
    let request: Promise<Response | undefined> | undefined;
    const controller = new AbortController();
    try {
      const url = await app.url();
      request = fetch(`${url}/api/health`, { signal: controller.signal }).catch(() => undefined);
      await app.child.stdin.write(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: {
            name: "revisionist_status",
            arguments: {},
            _meta: {
              "io.modelcontextprotocol/protocolVersion": version,
              "io.modelcontextprotocol/clientCapabilities": {},
            },
          },
        }) + "\n",
      );
      await app.child.stdin.flush();
      await until(
        () => (app.stderr.match(/REQUEST_STARTED/g)?.length === 2 ? true : undefined),
        "two pending requests",
      );
      if (ending === "stdin") await app.child.stdin.end();
      else app.child.kill(ending);
      await app.exit();
      expect(app.stderr.match(/REQUEST_RELEASED/g)?.length).toBe(2);
      expect(await fetch(url).then(() => false, () => true)).toBe(true);
    } finally {
      controller.abort();
      await app.stop();
      await request;
    }
  }, 30000);
}

test("HTTP client abort interrupts the Effect request", async () => {
  const app = launch([process.execPath, "tests/fixtures/lifecycle.ts"]);
  const controller = new AbortController();
  let request: Promise<Response | undefined> | undefined;
  try {
    request = fetch(`${await app.url()}/api/health`, { signal: controller.signal }).catch(() =>
      undefined
    );
    await until(() => app.stderr.includes("REQUEST_STARTED") ? true : undefined, "request start");
    controller.abort();
    await until(
      () => app.stderr.includes("REQUEST_RELEASED") ? true : undefined,
      "request cancellation",
    );
  } finally {
    controller.abort();
    await request;
    await app.stop();
  }
});
