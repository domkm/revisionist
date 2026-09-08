import { expect, test } from "bun:test";
import { checkBrowser } from "../helpers/browser.ts";

test("browser teardown handles a failed navigation without an unhandled response wait", async () => {
  const listener = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: () => new Response("unused"),
  });
  const url = listener.url.origin;
  await listener.stop(true);
  const error = await checkBrowser(url).then(() => "Navigation unexpectedly succeeded", String);
  expect(error).toContain("ERR_CONNECTION_REFUSED");
});
