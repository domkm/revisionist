import { chmod, cp, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const excluded = new Set([".git", "node_modules", "dist", "coverage", ".cache"]);
const included = (path: string) => {
  const parts = relative(root, path).split("/");
  return !parts.some((part) => excluded.has(part)) && !parts.join("/").startsWith(".husky/_");
};
const directory = await mkdtemp(join(tmpdir(), "revisionist-clean-"));
const guard = await mkdtemp(join(tmpdir(), "revisionist-no-node-"));
const env = { ...process.env, HUSKY: "0", CI: "true", PATH: `${guard}:${process.env.PATH ?? ""}` };
async function run(args: string[], expectFailure = false) {
  const child = Bun.spawn(args, {
    cwd: directory,
    env,
    stdin: "ignore",
    stdout: "inherit",
    stderr: "inherit",
  });
  const code = await child.exited;
  if (expectFailure ? code === 0 : code !== 0) {
    throw new Error(`Unexpected exit ${code}: ${args.join(" ")}`);
  }
}
async function snapshot() {
  const files: Record<string, string> = {};
  async function visit(folder: string) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      if (
        excluded.has(entry.name) || relative(directory, folder) === ".husky" && entry.name === "_"
      ) continue;
      const path = join(folder, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) {
        files[relative(directory, path)] = Bun.hash(await Bun.file(path).bytes()).toString();
      }
    }
  }
  await visit(directory);
  return JSON.stringify(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)));
}
try {
  await cp(root, directory, { recursive: true, filter: included });
  await Bun.write(
    join(guard, "node"),
    "#!/bin/sh\necho 'Unexpected Node dependency' >&2\nexit 93\n",
  );
  await chmod(join(guard, "node"), 0o755);
  await run(["git", "init", "--quiet"]);
  await run(["git", "add", "--all"]);
  const before = await snapshot();
  const index = await Bun.file(join(directory, ".git/index")).bytes();
  await run([process.execPath, "install", "--frozen-lockfile", "--ignore-scripts"]);
  async function compilerSnapshot() {
    const files = Array.from(
      new Bun.Glob("node_modules/@typescript/typescript-*/lib/tsc*").scanSync({ cwd: directory }),
    ).sort();
    if (files.length === 0) throw new Error("No installed TypeScript binary found.");
    return JSON.stringify(
      await Promise.all(
        files.map(async (
          file,
        ) => [file, Bun.hash(await Bun.file(join(directory, file)).bytes()).toString()]),
      ),
    );
  }
  const compilerBefore = await compilerSnapshot();
  await run([process.execPath, "install", "--frozen-lockfile"]);
  await run([process.execPath, "run", "check"]);
  if (await compilerSnapshot() !== compilerBefore) {
    throw new Error("Setup or checks modified TypeScript's installed binary.");
  }
  if (await snapshot() !== before) throw new Error("Clean check modified source files.");
  if (
    !Buffer.from(index).equals(Buffer.from(await Bun.file(join(directory, ".git/index")).bytes()))
  ) {
    throw new Error("Clean check modified the Git index.");
  }
  const manifest = Bun.file(join(directory, "package.json"));
  const original = await manifest.text();
  const lock = await Bun.file(join(directory, "bun.lock")).text();
  const changed = JSON.parse(original) as { dependencies: Record<string, string>; };
  changed.dependencies.react = "19.0.0";
  await Bun.write(manifest, JSON.stringify(changed));
  await run([process.execPath, "install", "--frozen-lockfile"], true);
  if (await Bun.file(join(directory, "bun.lock")).text() !== lock) {
    throw new Error("Frozen failure changed bun.lock.");
  }
  console.error(
    "Clean frozen installation and full check passed; source/index and TypeScript binary unchanged; dependency drift rejected; no Node runtime used.",
  );
} finally {
  await rm(directory, { recursive: true, force: true });
  await rm(guard, { recursive: true, force: true });
}
