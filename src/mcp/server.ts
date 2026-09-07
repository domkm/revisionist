import { McpServer } from "@modelcontextprotocol/server";
import { Context, Effect, Schema } from "effect";
import { version } from "../../package.json";
import { readStatus, StatusService } from "../app/status.ts";
import { McpStatus } from "../shared/status.ts";
import { mcpSchema } from "./schema.ts";

export const protocolVersion = "2026-07-28";

export function createMcpServer(context: Context.Context<StatusService>, browserUrl: string) {
  const server = new McpServer({ name: "revisionist", version }, {
    supportedProtocolVersions: [protocolVersion],
    capabilities: { tools: {} },
  });
  const run = Effect.runPromiseWith(context);
  server.registerTool("revisionist_status", {
    description: "Read-only bootstrap connectivity example; not a review API.",
    inputSchema: mcpSchema(Schema.Record(Schema.String, Schema.Never)),
    outputSchema: mcpSchema(McpStatus),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, async (_input, request) => {
    const status = await run(readStatus, { signal: request.mcpReq.signal });
    const result = { ...status, browserUrl };
    return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
  });
  return server;
}
