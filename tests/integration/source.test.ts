import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { expect, test } from "bun:test";
import { checkBrowser } from "../helpers/browser.ts";
import { root } from "../helpers/fixture.ts";
import { launch, version } from "../helpers/process.ts";

test("raw modern MCP, local HTTP, browser, protocol logging, and stdin cleanup", async () => {
  const app = launch();
  try {
    const url = await app.url();
    const call = await app.request("tools/call", { name: "revisionist_status", arguments: {} });
    expect(call.error).toBeUndefined();
    expect(call.result?.structuredContent).toMatchObject({ status: "ok", browserUrl: url });
    const discovery = await app.request("server/discover");
    expect(discovery.error).toBeUndefined();
    expect(discovery.result?.supportedVersions).toEqual([version]);
    const listed = await app.request("tools/list");
    expect(listed.result?.tools).toMatchObject([{
      name: "revisionist_status",
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
    }]);
    const invalid = await app.request("tools/call", {
      name: "revisionist_status",
      arguments: { unexpected: true },
    });
    expect(invalid.result?.isError).toBe(true);
    const unsupported = await app.request("tools/list", {}, "2025-11-25");
    expect(unsupported.error).toMatchObject({
      code: -32022,
      data: { supported: [version], requested: "2025-11-25" },
    });
    expect((await fetch(`${url}/api/health`)).status).toBe(200);
    expect((await fetch(`${url}/api/health`, { headers: { host: "evil.test" } })).status).toBe(403);
    expect((await fetch(`${url}/api/health`, { headers: { origin: "https://evil.test" } })).status)
      .toBe(403);
    await checkBrowser(url, true);
    expect(app.stdout).not.toContain("browser-console-probe");
    expect(app.stderr).toContain("Browser URL:");
    await app.child.stdin.write("not-json\n");
    await app.child.stdin.flush();
    expect((await app.request("tools/list")).error).toBeUndefined();
    await app.child.stdin.end();
    expect(await app.exit()).toBe(0);
    for (const line of app.stdout.trim().split("\n")) {
      expect(JSON.parse(line)).toMatchObject({ jsonrpc: "2.0" });
    }
    expect(await fetch(url).then(() => false, () => true)).toBe(true);
  } finally {
    await app.stop();
  }
}, 30000);

test("official client uses pinned modern negotiation", async () => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["src/main.ts"],
    cwd: root,
    stderr: "ignore",
  });
  const client = new Client({ name: "bootstrap-test", version: "1" }, {
    versionNegotiation: { mode: { pin: version } },
  });
  try {
    await client.connect(transport);
    expect((await client.listTools()).tools[0]?.name).toBe("revisionist_status");
    expect((await client.callTool({ name: "revisionist_status", arguments: {} })).isError).not.toBe(
      true,
    );
  } finally {
    await client.close();
  }
}, 30000);

test("legacy initialize rejects and leaves modern requests usable", async () => {
  const app = launch();
  try {
    await app.url();
    const legacy = await app.request("initialize", {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "legacy", version: "1" },
    }, null);
    expect(legacy.error?.code).toBe(-32022);
    expect(legacy.error?.data?.supported).toEqual([version]);
    expect((await app.request("tools/list")).error).toBeUndefined();
  } finally {
    await app.stop();
  }
});

test("SDK rejects missing and malformed protocol metadata before and after negotiation", async () => {
  const app = launch();
  try {
    await app.url();
    for (const stage of ["opening", "established"]) {
      if (stage === "established") {
        expect((await app.request("tools/list")).error).toBeUndefined();
      }
      for (
        const metadata of [undefined, {}, {
          "io.modelcontextprotocol/protocolVersion": 42,
          "io.modelcontextprotocol/clientCapabilities": {},
        }]
      ) {
        const rejected = await app.request("tools/call", {
          name: "revisionist_status",
          arguments: {},
          ...(metadata === undefined ? {} : { _meta: metadata }),
        }, null);
        expect(rejected.error).toBeDefined();
        expect(rejected.result).toBeUndefined();
      }
    }
    expect(
      (await app.request("tools/call", { name: "revisionist_status", arguments: {} })).result
        ?.structuredContent,
    )
      .toMatchObject({ status: "ok" });
  } finally {
    await app.stop();
  }
});

test("two instances, explicit port conflict, invalid bind and termination", async () => {
  const first = launch();
  const second = launch();
  try {
    const [one, two] = await Promise.all([first.url(), second.url()]);
    expect(one).not.toBe(two);
    const conflict = launch([process.execPath, "src/main.ts", "--port", new URL(one).port]);
    try {
      expect(await conflict.exit()).not.toBe(0);
    } finally {
      await conflict.stop();
    }
    const invalid = launch([process.execPath, "src/main.ts", "--host=0.0.0.0"]);
    try {
      expect(await invalid.exit()).not.toBe(0);
      expect(invalid.stderr).toContain("local-only");
      expect(invalid.stdout).toBe("");
    } finally {
      await invalid.stop();
    }
    first.child.kill("SIGTERM");
    await first.exit();
    expect(await fetch(one).then(() => false, () => true)).toBe(true);
    second.child.kill("SIGINT");
    await second.exit();
    expect(await fetch(two).then(() => false, () => true)).toBe(true);
  } finally {
    await Promise.all([first.stop(), second.stop()]);
  }
});

test("web-only mode tolerates closed stdin and allows browser console forwarding", async () => {
  const app = launch([process.execPath, "src/main.ts", "--web-only"]);
  try {
    await app.child.stdin.end();
    await checkBrowser(await app.url(), true);
    expect(app.child.exitCode).toBeNull();
    expect(app.stdout + app.stderr).toContain("browser-console-probe");
  } finally {
    await app.stop();
  }
}, 30000);
