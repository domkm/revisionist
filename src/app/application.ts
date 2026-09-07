import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { Deferred, Effect } from "effect";
import { createMcpServer } from "../mcp/server.ts";
import { ModernStdioTransport } from "../mcp/transport.ts";
import { startHttp } from "../server/http.ts";
import type { Configuration } from "./config.ts";
import { StatusService } from "./status.ts";

export const application = (configuration: Configuration) =>
  Effect.gen(function*() {
    const { browserUrl } = yield* startHttp(configuration);
    const context = yield* Effect.context<StatusService>();
    const disconnected = yield* Deferred.make<void>();
    if (!configuration.webOnly) {
      yield* Effect.acquireRelease(
        Effect.sync(() =>
          serveStdio(() => createMcpServer(context, browserUrl), {
            legacy: "reject",
            transport: new ModernStdioTransport(() =>
              Effect.runSync(Deferred.succeed(disconnected, undefined))
            ),
            onerror: (error) => console.error(error.message),
          })
        ),
        (handle) => Effect.promise(() => handle.close()),
      );
    }
    yield* Effect.logInfo(`Browser URL: ${browserUrl}`);
    if (configuration.webOnly) return yield* Effect.never;
    yield* Effect.raceFirst(
      Deferred.await(disconnected),
      Effect.callback<void>((resume) => {
        const onEnd = () => resume(Effect.void);
        process.stdin.once("end", onEnd);
        if (process.stdin.readableEnded) onEnd();
        return Effect.sync(() => {
          process.stdin.off("end", onEnd);
        });
      }),
    );
  });
