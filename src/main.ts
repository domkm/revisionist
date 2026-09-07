import { BunRuntime } from "@effect/platform-bun";
import { Cause, Effect, Logger } from "effect";
import { application } from "./app/application.ts";
import { readConfiguration } from "./app/config.ts";
import { StatusLive } from "./app/status.ts";

const main = Effect.gen(function*() {
  const configuration = yield* readConfiguration(process.argv.slice(2));
  yield* application(configuration);
}).pipe(
  Effect.scoped,
  Effect.provide(StatusLive),
  Effect.tapCause((cause) => Cause.hasInterruptsOnly(cause) ? Effect.void : Effect.logError(cause)),
  Effect.provideService(Logger.LogToStderr, true),
);

BunRuntime.runMain(main, { disableErrorReporting: true });
