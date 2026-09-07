import { existsSync } from "node:fs";

const expected = (await Bun.file(new URL("../.bun-version", import.meta.url)).text()).trim();
if (Bun.version !== expected) {
  throw new Error(`Use Bun ${expected}; running ${Bun.version}. See .bun-version.`);
}

function run(tool: string, ...args: string[]) {
  const result = Bun.spawnSync([process.execPath, "run", "--bun", tool, ...args], {
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  if (result.exitCode !== 0) process.exit(result.exitCode);
}

run("effect-tsgo", "get-exe-path");
// dprint's dependency lifecycle script stays disabled. Resolve its optional native
// binary through its Bun-run wrapper instead of its Node-based postinstall.
// Bun 1.3.14 treats an empty trustedDependencies list as its default allowlist;
// package.json uses @effect/tsgo (no install script) to keep that list nonempty.
run("dprint", "--version");
if (process.env.HUSKY !== "0" && existsSync(".git")) run("husky");
