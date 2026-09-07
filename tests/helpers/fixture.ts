import { copyFile, mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const root = fileURLToPath(new URL("../../", import.meta.url));

export async function fixture() {
  // Exercise command arguments and file URLs with paths that require escaping.
  const directory = await mkdtemp(join(tmpdir(), "revisionist test %-"));
  for (const folder of ["src/web", "src/shared", "src/server", "scripts", "tests"]) {
    await mkdir(join(directory, folder), { recursive: true });
  }
  for (
    const file of [
      "tsconfig.json",
      "tsconfig.base.json",
      "src/web/tsconfig.json",
      ".oxlintrc.json",
      "dprint.json",
      "package.json",
      ".bun-version",
      "scripts/prepare.ts",
      "scripts/typecheck.ts",
    ]
  ) {
    await copyFile(join(root, file), join(directory, file));
  }
  await symlink(join(root, "node_modules"), join(directory, "node_modules"), "dir");
  return { directory, cleanup: () => rm(directory, { recursive: true, force: true }) };
}

export async function command(
  args: string[],
  cwd = root,
  env: Record<string, string | undefined> = {},
  timeout = 15000,
) {
  // One-shot tooling commands do not need live streams. Avoid Bun 1.3.14's
  // async process-watcher EBADF failures observed on the Linux CI runner.
  const result = Bun.spawnSync(args, {
    cwd,
    env: { ...process.env, ...env },
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
    timeout,
    killSignal: "SIGKILL",
  });
  if (result.signalCode) {
    throw new Error(`Command terminated by ${result.signalCode}: ${args.join(" ")}`);
  }
  const stdout = result.stdout.toString();
  const stderr = result.stderr.toString();
  return { code: result.exitCode, stdout, stderr, output: stdout + stderr };
}

export const tool = (
  name: string,
  ...args: string[]
) => [process.execPath, "run", "--bun", name, ...args];
