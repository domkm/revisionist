import { Context, Effect, Layer } from "effect";
import { version } from "../../package.json";
import type { Status } from "../shared/status.ts";

export class StatusService extends Context.Service<StatusService, {
  readonly get: Effect.Effect<Status>;
}>()("revisionist/StatusService") {}

export const StatusLive = Layer.succeed(StatusService, {
  get: Effect.succeed({ name: "revisionist", version, status: "ok" } satisfies Status),
});

export const readStatus = Effect.flatMap(StatusService, (service) => service.get);
