import { expect, test } from "bun:test";
import { Effect, Schema } from "effect";
import { readConfiguration } from "../../src/app/config.ts";
import { readStatus, StatusLive } from "../../src/app/status.ts";
import { Status } from "../../src/shared/status.ts";

test("configuration defaults and explicit local options", async () => {
  expect(await Effect.runPromise(readConfiguration([]))).toEqual({ port: 0, webOnly: false });
  expect(
    await Effect.runPromise(
      readConfiguration(["--web-only", "--host=127.0.0.1", "--port", "1234"]),
    ),
  )
    .toEqual({ port: 1234, webOnly: true });
});
test("invalid configuration fails", async () => {
  for (
    const args of [
      ["--port"],
      ["--port=-1"],
      ["--port=65536"],
      ["--port=1.5"],
      ["--port=2=x"],
      ["--host=0.0.0.0"],
      ["--host=127.0.0.1=x"],
      ["--unknown"],
    ]
  ) {
    expect(await Effect.runPromiseExit(readConfiguration(args))).toMatchObject({ _tag: "Failure" });
  }
});
test("shared schema decodes the service response and rejects invalid status", async () => {
  const status = await Effect.runPromise(readStatus.pipe(Effect.provide(StatusLive)));
  expect(Schema.decodeUnknownSync(Status)(status)).toEqual(status);
  expect(() => Schema.decodeUnknownSync(Status)({ ...status, status: "bad" })).toThrow();
});
