import { BunHttpServer } from "@effect/platform-bun";
import { Effect } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import type { Configuration } from "../app/config.ts";
import { readStatus } from "../app/status.ts";
import { Status } from "../shared/status.ts";
import page from "../web/index.html";

export const startHttp = (configuration: Configuration) =>
  Effect.gen(function*() {
    const server = yield* BunHttpServer.make({
      hostname: "127.0.0.1",
      port: configuration.port,
      reusePort: false,
      disablePreemptiveShutdown: true,
      development: configuration.webOnly ? { hmr: true, console: true } : false,
      routes: { "/": page },
    });
    if (server.address._tag !== "TcpAddress") return yield* Effect.die("Expected a TCP listener");
    const browserUrl = `http://127.0.0.1:${server.address.port}`;
    const expectedHost = new URL(browserUrl).host;
    yield* server.serve(
      Effect.gen(function*() {
        const request = yield* HttpServerRequest.HttpServerRequest;
        const origin = request.headers.origin;
        if (
          request.headers.host !== expectedHost || (origin !== undefined && origin !== browserUrl)
        ) {
          return HttpServerResponse.text("Forbidden", { status: 403 });
        }
        if (request.method !== "GET" || request.url !== "/api/health") {
          return HttpServerResponse.text("Not found", { status: 404 });
        }
        return yield* HttpServerResponse.schemaJson(Status)(yield* readStatus, {
          headers: { "cache-control": "no-store" },
        });
      }).pipe(Effect.interruptible),
    );
    return { browserUrl };
  });
