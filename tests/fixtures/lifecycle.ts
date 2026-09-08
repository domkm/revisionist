import { BunRuntime } from "@effect/platform-bun";
import { Cause, Data, Effect, Layer, Logger } from "effect";
import { application } from "../../src/app/application.ts";
import { StatusService } from "../../src/app/status.ts";
import { startHttp } from "../../src/server/http.ts";

const config = { port: 0, webOnly: false };
class InjectedFailure extends Data.TaggedError("InjectedFailure")<{ message: string; }> {}
const service = Layer.succeed(StatusService, {
  get: Effect.gen(function*() {
    yield* Effect.acquireRelease(
      Effect.logInfo("REQUEST_STARTED"),
      () => Effect.logInfo("REQUEST_RELEASED"),
    );
    return yield* Effect.never;
  }).pipe(Effect.scoped),
});
const program = process.argv[2] === "startup-failure"
  ? Effect.gen(function*() {
    const { browserUrl } = yield* startHttp(config);
    yield* Effect.logInfo(`Browser URL: ${browserUrl}`);
    return yield* Effect.fail(new InjectedFailure({ message: "Injected startup failure" }));
  })
  : application(config);
BunRuntime.runMain(
  program.pipe(
    Effect.scoped,
    Effect.provide(service),
    Effect.tapCause((cause) =>
      Cause.hasInterruptsOnly(cause) ? Effect.void : Effect.logError(cause)
    ),
    Effect.provideService(Logger.LogToStderr, true),
  ),
  { disableErrorReporting: true },
);
