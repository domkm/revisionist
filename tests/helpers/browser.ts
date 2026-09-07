import { expect } from "bun:test";
import { chromium } from "playwright";

export async function checkBrowser(url: string, consoleProbe = false) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(5000);
    const errors: string[] = [];
    const external: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (new URL(request.url()).origin !== url) external.push(request.url());
    });
    const [health] = await Promise.all([
      page.waitForResponse(`${url}/api/health`),
      page.goto(url),
    ]);
    expect(health.status()).toBe(200);
    await page.getByText(/Connected · v/).waitFor();
    if (consoleProbe) await page.evaluate(() => console.log("browser-console-probe"));
    await page.route("**/api/health", (route) => route.abort());
    await page.reload();
    await page.getByText("Unavailable").waitFor();
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  } finally {
    await browser.close();
  }
}
