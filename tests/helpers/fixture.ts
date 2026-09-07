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
) {
  const processHandle = Bun.spawn(args, {
    cwd,
    env: { ...process.env, ...env },
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
  });
  const timeout = setTimeout(() => processHandle.kill("SIGKILL"), 15000);
  try {
    const [code, stdout, stderr] = await Promise.all([
      processHandle.exited,
      new Response(processHandle.stdout).text(),
      new Response(processHandle.stderr).text(),
    ]);
    return { code, stdout, stderr, output: stdout + stderr };
  } finally {
    clearTimeout(timeout);
  }
}

export const tool = (
  name: string,
  ...args: string[]
) => [process.execPath, "run", "--bun", name, ...args];
