import { expect, test } from "bun:test";
import { join } from "node:path";
import { checkBrowser } from "../helpers/browser.ts";
import { command, root } from "../helpers/fixture.ts";
import { isolated } from "../helpers/isolation.ts";
import { launch, version } from "../helpers/process.ts";

test(
  "isolated executable embeds runtime/assets, serves MCP and browser, and shuts down",
  async () => {
    expect((await command(isolated(undefined, true))).code).toBe(0);
    const app = launch(isolated(), "/tmp");
    try {
      const url = await app.url();
      const result = await app.request("tools/call", { name: "revisionist_status", arguments: {} });
      expect(result.result?.structuredContent).toMatchObject({ browserUrl: url, status: "ok" });
      expect((await app.request("server/discover")).result?.supportedVersions).toEqual([version]);
      expect((await app.request("tools/list")).result?.tools).toMatchObject([{
        name: "revisionist_status",
      }]);
      await checkBrowser(url, true);
      expect(app.stdout).not.toContain("browser-console-probe");
      await app.child.stdin.end();
      expect(await app.exit()).toBe(0);
      expect(await fetch(url).then(() => false, () => true)).toBe(true);
    } finally {
      await app.stop();
    }
  },
  30000,
);

test("isolation probe detects an accidentally exposed checkout file", async () => {
  const probe = isolated(undefined, true);
  const file = join(root, "package.json");
  probe.splice(probe.indexOf("--"), 0, "--ro-bind", file, file);
  expect((await command(probe)).code).toBe(1);
});

test("isolated executable releases its port on SIGTERM", async () => {
  const app = launch(isolated(), "/tmp");
  try {
    const url = await app.url();
    // The driver can inspect host /proc; the sandbox cannot. With --as-pid-1,
    // bubblewrap's single child is the application, not a namespace reaper.
    const children =
      (await Bun.file(`/proc/${app.child.pid}/task/${app.child.pid}/children`).text()).trim().split(
        /\s+/,
      );
    expect(children).toHaveLength(1);
    const pid = Number(children[0]);
    expect(Number.isInteger(pid) && pid > 1).toBe(true);
    process.kill(pid, "SIGTERM");
    await app.exit();
    expect(await fetch(url).then(() => false, () => true)).toBe(true);
  } finally {
    await app.stop();
  }
});
