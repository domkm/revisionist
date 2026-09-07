import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";

if (process.platform !== "linux" || process.arch !== "x64") {
  throw new Error(
    `Builds require Linux x64; received ${process.platform} ${process.arch}. See README.md: Setup.`,
  );
}

await mkdir("dist", { recursive: true });
// Pin the embedded runtime too: a repackaged local Bun can reference Homebrew's
// loader and ICU paths. The bootstrap's validated target is Linux x64.
const compiler = createRequire(import.meta.url).resolve("@oven/bun-linux-x64/bin/bun");
const result = Bun.spawnSync([
  compiler,
  "build",
  "--compile",
  "--no-compile-autoload-dotenv",
  "--no-compile-autoload-bunfig",
  "--minify",
  "src/main.ts",
  "--outfile",
  "dist/revisionist",
], { stdout: "inherit", stderr: "inherit" });
process.exit(result.exitCode);
