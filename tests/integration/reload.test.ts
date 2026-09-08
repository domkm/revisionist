import { expect, test } from "bun:test";
import { cp } from "node:fs/promises";
import { join } from "node:path";
import { type Browser, chromium } from "playwright";
import { fixture, root } from "../helpers/fixture.ts";
import { launch } from "../helpers/process.ts";

test("Bun development reload updates React without restarting the server", async () => {
  const temp = await fixture();
  let browser: Browser | undefined;
  let app: ReturnType<typeof launch> | undefined;
  try {
    browser = await chromium.launch();
    await cp(join(root, "src"), join(temp.directory, "src"), { recursive: true });
    app = launch([process.execPath, "src/main.ts", "--web-only"], temp.directory);
    const url = await app.url();
    const page = await browser.newPage();
    page.setDefaultTimeout(5000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(url);
    await page.getByText(/Connected · v/).waitFor();
    const file = Bun.file(join(temp.directory, "src/web/main.tsx"));
    const source = await file.text();
    await Bun.write(
      file,
      source.replace("Markdown review comes next.", "Reload fixture succeeded."),
    );
    await page.getByText(/Reload fixture succeeded/).waitFor();
    expect(app.child.exitCode).toBeNull();
    expect((await fetch(`${url}/api/health`)).status).toBe(200);
    expect(errors).toEqual([]);
  } finally {
    try {
      await Promise.all([app?.stop(), browser?.close()]);
    } finally {
      await temp.cleanup();
    }
  }
}, 30000);
