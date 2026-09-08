import { existsSync } from "node:fs";
import { join } from "node:path";
import { root } from "./fixture.ts";

/** No host /proc, home, checkout, node_modules, executable search path, or JS runtime. */
export function isolated(binary = join(root, "dist/revisionist"), probe = false) {
  if (!existsSync(binary)) {
    throw new Error("Missing dist/revisionist. Run bun run build before bun run test:smoke.");
  }
  const args = [
    "bwrap",
    "--die-with-parent",
    "--unshare-pid",
    "--as-pid-1",
    "--new-session",
    "--clearenv",
    "--setenv",
    "PATH",
    "/nonexistent",
    "--tmpfs",
    "/tmp",
    "--proc",
    "/proc",
    "--dev",
    "/dev",
    "--dir",
    "/app",
    "--ro-bind",
    binary,
    "/app/revisionist",
  ];
  // Mount individual ELF dependencies, not directories that may also contain
  // globally installed JavaScript modules or another runtime.
  const dependencies = Bun.spawnSync(["ldd", binary], { env: { ...process.env, LC_ALL: "C" } });
  if (dependencies.exitCode !== 0 || dependencies.stdout.toString().includes("not found")) {
    throw new Error(
      `Cannot resolve executable OS libraries: ${dependencies.stdout.toString()}${dependencies.stderr.toString()}`,
    );
  }
  const libraries = new Set(
    dependencies.stdout.toString().split("\n").flatMap((line) => {
      const path = line.match(/=> (\/\S+)/)?.[1] ?? line.match(/^\s*(\/\S+)/)?.[1];
      return path ? [path] : [];
    }),
  );
  if (libraries.size === 0) {
    throw new Error("No executable OS libraries found; refusing an unverified isolation layout.");
  }
  for (const path of libraries) {
    args.push("--ro-bind", path, path);
  }
  if (probe) args.push("--ro-bind", "/usr/bin/test", "/app/probe");
  args.push("--chdir", "/tmp", "--");
  return [
    ...args,
    ...(probe ? ["/app/probe", "!", "-r", join(root, "package.json")] : ["/app/revisionist"]),
  ];
}
