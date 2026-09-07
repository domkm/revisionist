import { chromium } from "playwright";

export async function prerequisites() {
  if (process.platform !== "linux" || process.arch !== "x64") {
    throw new Error(
      "Full checks currently require Linux x64 with bubblewrap and user namespaces. See README.md: Test prerequisites.",
    );
  }
  if (!Bun.which("bwrap")) {
    throw new Error(
      "Missing bubblewrap. Install: sudo apt-get install bubblewrap. See README.md: Test prerequisites.",
    );
  }
  const namespace = Bun.spawnSync([
    "bwrap",
    "--ro-bind",
    "/",
    "/",
    "--unshare-pid",
    "--proc",
    "/proc",
    "--dev",
    "/dev",
    "--die-with-parent",
    "/usr/bin/true",
  ], { stdout: "pipe", stderr: "pipe" });
  if (namespace.exitCode !== 0) {
    throw new Error(
      `Bubblewrap namespaces are unavailable. See README.md: Test prerequisites.\n${namespace.stderr.toString()}`,
    );
  }
  try {
    const browser = await chromium.launch();
    await browser.close();
  } catch (cause) {
    throw new Error(
      "Chromium or its OS libraries are unavailable. Run bun run setup:browser (with --with-deps on a provisioned Linux host). See README.md: Test prerequisites.",
      { cause },
    );
  }
}
if (import.meta.main) await prerequisites();
