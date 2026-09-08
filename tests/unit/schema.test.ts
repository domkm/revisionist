import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport, McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { expect, test } from "bun:test";
import { Schema } from "effect";
import { mcpSchema } from "../../src/mcp/schema.ts";
import { version } from "../helpers/process.ts";

test("SDK discovers both schemas, blocks invalid inputs before handlers, and rejects invalid outputs", async () => {
  const [clientWire, serverWire] = InMemoryTransport.createLinkedPair();
  let calls = 0;
  const input = Schema.Struct({ label: Schema.String });
  const output = Schema.Struct({ count: Schema.Finite });
  const handle = serveStdio(() => {
    const server = new McpServer({ name: "schema-test", version: "1" }, {
      supportedProtocolVersions: [version],
    });
    server.registerTool("schema_test", {
      inputSchema: mcpSchema(input),
      outputSchema: mcpSchema(output),
    }, ({ label }) => {
      calls++;
      return {
        content: [],
        structuredContent: { count: label === "invalid-output" ? "wrong" : 1 },
      };
    });
    return server;
  }, { transport: serverWire, legacy: "reject" });
  const client = new Client({ name: "test", version: "1" }, {
    versionNegotiation: { mode: { pin: version } },
  });
  try {
    await client.connect(clientWire);
    const tools = (await client.listTools()).tools;
    expect(tools[0]?.inputSchema).toMatchObject({
      properties: { label: { type: "string" } },
      required: ["label"],
    });
    expect(tools[0]?.outputSchema).toMatchObject({
      properties: { count: { type: "number" } },
      required: ["count"],
    });
    expect((await client.callTool({ name: "schema_test", arguments: { label: 12 } })).isError).toBe(
      true,
    );
    expect(calls).toBe(0);
    expect(
      (await client.callTool({ name: "schema_test", arguments: { label: "valid" } }))
        .structuredContent,
    ).toEqual({ count: 1 });
    expect(
      (await client.callTool({ name: "schema_test", arguments: { label: "invalid-output" } }))
        .isError,
    ).toBe(true);
    expect(calls).toBe(2);
  } finally {
    await client.close();
    await handle.close();
  }
});
