import { isJSONRPCRequest, UnsupportedProtocolVersionError } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { protocolVersion } from "./server.ts";

/** The SDK pins an era after the opening request; retain the modern-only version policy thereafter. */
export class ModernStdioTransport extends StdioServerTransport {
  constructor(private readonly closed: () => void) {
    super();
  }
  override async start() {
    const receive = this.onmessage;
    this.onmessage = (message) => {
      if (isJSONRPCRequest(message)) {
        const requested = message.params?._meta?.["io.modelcontextprotocol/protocolVersion"];
        if (typeof requested === "string" && requested !== protocolVersion) {
          const error = new UnsupportedProtocolVersionError({
            supported: [protocolVersion],
            requested,
          });
          this.send({
            jsonrpc: "2.0",
            id: message.id,
            error: { code: error.code, message: error.message, data: error.data },
          })
            .catch((cause: unknown) =>
              this.onerror?.(cause instanceof Error ? cause : new Error(String(cause)))
            );
          return;
        }
      }
      receive?.(message);
    };
    await super.start();
  }
  override async close() {
    try {
      await super.close();
    } finally {
      this.closed();
    }
  }
}
