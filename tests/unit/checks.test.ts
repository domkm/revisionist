import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { chmod, copyFile, mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { phases } from "../../scripts/check.ts";
import { command, fixture, root } from "../helpers/fixture.ts";

test("test helpers resolve repository paths containing spaces and percent signs", async () => {
  const temp = await fixture();
  try {
    await mkdir(join(temp.directory, "tests/helpers"), { recursive: true });
    await copyFile(
      join(root, "tests/helpers/fixture.ts"),
      join(temp.directory, "tests/helpers/fixture.ts"),
    );
    const result = await command([
      process.execPath,
      "--eval",
      "import { root } from \"./tests/helpers/fixture.ts\"; console.log(root);",
    ], temp.directory);
    expect(result.code).toBe(0);
    expect(result.stdout.trim()).toBe(`${temp.directory}/`);
  } finally {
    await temp.cleanup();
  }
});

test("every aggregate phase propagates failure without modifying fixture files or index", async () => {
  const temp = await fixture();
  try {
    await copyFile(join(root, "scripts/check.ts"), join(temp.directory, "scripts/check.ts"));
    expect((await command(["git", "init", "--quiet"], temp.directory)).code).toBe(0);
    await Bun.write(join(temp.directory, "sample.ts"), "export const sample = 1;\n");
    await command(["git", "add", "sample.ts"], temp.directory);
    const beforeIndex = await Bun.file(join(temp.directory, ".git/index")).bytes();
    for (const failed of [...phases, undefined]) {
      const scripts = Object.fromEntries(
        phases.map((
          phase,
        ) => [
          phase,
          `bun -e 'console.error("PHASE:${phase}");process.exit(${phase === failed ? 7 : 0})'`,
        ]),
      );
      const manifest = JSON.stringify({ scripts });
      await Bun.write(join(temp.directory, "package.json"), manifest);
      const result = await command([process.execPath, "scripts/check.ts"], temp.directory);
      expect(result.code).toBe(failed ? 7 : 0);
      if (failed) {
        expect(result.output).toContain(`Check failed: ${failed}`);
        const next = phases[phases.indexOf(failed) + 1];
        if (next) expect(result.output).not.toContain(`PHASE:${next}`);
      }
      expect(await Bun.file(join(temp.directory, "package.json")).text()).toBe(manifest);
      expect(await Bun.file(join(temp.directory, "sample.ts")).text()).toBe(
        "export const sample = 1;\n",
      );
      expect(await Bun.file(join(temp.directory, ".git/index")).bytes()).toEqual(beforeIndex);
    }
  } finally {
    await temp.cleanup();
  }
});

test("prepare rejects a mismatched runtime and propagates compiler resolution failure with HUSKY=0", async () => {
  const temp = await fixture();
  try {
    await Bun.write(join(temp.directory, ".bun-version"), "0.0.0\n");
    const mismatch = await command([process.execPath, "scripts/prepare.ts"], temp.directory, {
      HUSKY: "0",
    });
    expect(mismatch.code).not.toBe(0);
    expect(mismatch.output).toContain("Use Bun 0.0.0");
    await copyFile(join(root, ".bun-version"), join(temp.directory, ".bun-version"));
    // Replace only the disposable fixture's symlink, never the real dependency directory.
    await unlink(join(temp.directory, "node_modules"));
    await mkdir(join(temp.directory, "node_modules/.bin"), { recursive: true });
    const resolver = join(temp.directory, "node_modules/.bin/effect-tsgo");
    await Bun.write(
      resolver,
      "#!/usr/bin/env bun\nconsole.error('Injected compiler resolution failure');process.exit(7);\n",
    );
    await chmod(resolver, 0o755);
    const failure = await command([process.execPath, "scripts/prepare.ts"], temp.directory, {
      HUSKY: "0",
    });
    expect(failure.code).toBe(7);
    expect(failure.output).toContain("Injected compiler resolution failure");
  } finally {
    await temp.cleanup();
  }
});

test("missing bubblewrap and Chromium fail with setup guidance", async () => {
  const temp = await fixture();
  try {
    const noBubblewrap = await command([process.execPath, "scripts/prerequisites.ts"], root, {
      PATH: temp.directory,
    });
    expect(noBubblewrap.code).not.toBe(0);
    expect(noBubblewrap.output).toContain("Missing bubblewrap");
    const noBrowser = await command([process.execPath, "scripts/prerequisites.ts"], root, {
      PLAYWRIGHT_BROWSERS_PATH: temp.directory,
    });
    expect(noBrowser.code).not.toBe(0);
    expect(noBrowser.output).toContain("bun run setup:browser");
    await Bun.write(join(temp.directory, "bwrap"), "#!/bin/sh\nexit 1\n");
    await chmod(join(temp.directory, "bwrap"), 0o755);
    const noNamespace = await command([process.execPath, "scripts/prerequisites.ts"], root, {
      PATH: `${temp.directory}:${process.env.PATH ?? ""}`,
    });
    expect(noNamespace.code).not.toBe(0);
    expect(noNamespace.output).toContain("namespaces are unavailable");
  } finally {
    await temp.cleanup();
  }
});

test("a broken Playwright import cannot mask earlier prerequisite failures", async () => {
  const temp = await fixture();
  try {
    await copyFile(
      join(root, "scripts/prerequisites.ts"),
      join(temp.directory, "scripts/prerequisites.ts"),
    );
    // Replace only the fixture's symlink; never modify the installed dependencies.
    await unlink(join(temp.directory, "node_modules"));
    const playwright = join(temp.directory, "node_modules/playwright");
    await mkdir(playwright, { recursive: true });
    await Bun.write(
      join(playwright, "package.json"),
      JSON.stringify({ type: "module", exports: "./index.js" }),
    );
    await Bun.write(
      join(playwright, "index.js"),
      "throw new Error(\"Injected Playwright import failure\");\nexport const chromium = {};\n",
    );
    const unsupported = await command([
      process.execPath,
      "--eval",
      "Object.defineProperty(process, \"platform\", { value: \"darwin\" }); const entry = await import(\"./scripts/prerequisites.ts\"); await entry.prerequisites();",
    ], temp.directory);
    expect(unsupported.code).not.toBe(0);
    expect(unsupported.output).toContain("require Linux x64");
    expect(unsupported.output).not.toContain("Injected Playwright");
    const run = () =>
      command([process.execPath, "scripts/prerequisites.ts"], temp.directory, {
        PATH: temp.directory,
      });
    const missing = await run();
    expect(missing.code).not.toBe(0);
    expect(missing.output).toContain("Missing bubblewrap");
    expect(missing.output).not.toContain("Injected Playwright");
    const bwrap = join(temp.directory, "bwrap");
    await Bun.write(bwrap, "#!/bin/sh\nexit 1\n");
    await chmod(bwrap, 0o755);
    const namespace = await run();
    expect(namespace.code).not.toBe(0);
    expect(namespace.output).toContain("namespaces are unavailable");
    expect(namespace.output).not.toContain("Injected Playwright");
    await Bun.write(bwrap, "#!/bin/sh\nexit 0\n");
    const browser = await run();
    expect(browser.code).not.toBe(0);
    expect(browser.output).toContain("bun run setup:browser");
    expect(browser.output).toContain("Injected Playwright import failure");
  } finally {
    await temp.cleanup();
  }
});

test("build and prerequisite checks reject unsupported hosts before creating output", async () => {
  const temp = await fixture();
  try {
    for (const script of ["build", "prerequisites"]) {
      await copyFile(
        join(root, `scripts/${script}.ts`),
        join(temp.directory, `scripts/${script}.ts`),
      );
      for (const [property, value] of [["platform", "darwin"], ["arch", "arm64"]]) {
        const result = await command([
          process.execPath,
          "--eval",
          `Object.defineProperty(process, ${JSON.stringify(property)}, { value: ${
            JSON.stringify(value)
          } }); const entry = await import("./scripts/${script}.ts"); ${
            script === "prerequisites" ? "await entry.prerequisites();" : ""
          }`,
        ], temp.directory);
        expect(result.code).not.toBe(0);
        expect(result.output).toContain("require Linux x64");
        expect(existsSync(join(temp.directory, "dist"))).toBe(false);
      }
    }
  } finally {
    await temp.cleanup();
  }
});

test("Husky blocks failing operations and preserves partially staged content", async () => {
  const temp = await fixture();
  try {
    const git = (...args: string[]) => command(["git", ...args], temp.directory, { HUSKY: "1" });
    expect((await git("init", "--quiet")).code).toBe(0);
    await git("config", "user.name", "Hook Fixture");
    await git("config", "user.email", "fixture@example.invalid");
    await mkdir(join(temp.directory, ".husky"));
    for (const hook of ["pre-commit", "pre-push"]) {
      await copyFile(join(root, ".husky", hook), join(temp.directory, ".husky", hook));
    }
    expect(
      (await command([process.execPath, "scripts/prepare.ts"], temp.directory, { HUSKY: "0" }))
        .code,
    ).toBe(0);
    expect((await git("config", "--local", "--get", "core.hooksPath")).code).not.toBe(0);
    expect(
      (await command([process.execPath, "scripts/prepare.ts"], temp.directory, { HUSKY: "1" }))
        .code,
    ).toBe(0);
    expect((await git("config", "--local", "--get", "core.hooksPath")).stdout.trim()).toBe(
      ".husky/_",
    );
    await Bun.write(join(temp.directory, "sample.ts"), "export const staged = 1;\n");
    await git("add", "sample.ts");
    const unstaged = "export const staged = 2;\n";
    await Bun.write(join(temp.directory, "sample.ts"), unstaged);
    const beforeIndex = await Bun.file(join(temp.directory, ".git/index")).bytes();
    const staged = (await git("show", ":sample.ts")).stdout;
    for (const phase of ["lint", "format:check", "check"]) {
      await Bun.write(
        join(temp.directory, "package.json"),
        JSON.stringify({
          scripts: Object.fromEntries(
            ["lint", "format:check", "check"].map((
              name,
            ) => [name, `bun -e 'process.exit(${name === phase ? 1 : 0})'`]),
          ),
        }),
      );
      const result = phase === "check"
        ? await command(["sh", ".husky/_/pre-push", "origin", "unused"], temp.directory, {
          HUSKY: "1",
        })
        : await git("-c", "core.fsmonitor=false", "commit", "--quiet", "-m", "must fail");
      expect(result.code).not.toBe(0);
      expect(result.output).toContain(phase);
      expect(await Bun.file(join(temp.directory, "sample.ts")).text()).toBe(unstaged);
      expect((await git("show", ":sample.ts")).stdout).toBe(staged);
      // Git itself may refresh index stat data during commit; hooks must preserve staged blobs.
    }
    const hookIndex = await Bun.file(join(temp.directory, ".git/index")).bytes();
    await command(["sh", ".husky/_/pre-commit"], temp.directory, { HUSKY: "1" });
    expect(await Bun.file(join(temp.directory, ".git/index")).bytes()).toEqual(hookIndex);
    expect(beforeIndex.length).toBeGreaterThan(0);
    // Commit only inside this disposable fixture, then test a push to a local bare repository.
    expect(
      (await command(
        ["git", "-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "fixture"],
        temp.directory,
        { HUSKY: "0" },
      )).code,
    ).toBe(0);
    const remote = join(temp.directory, "remote.git");
    expect((await command(["git", "init", "--bare", "--quiet", remote], temp.directory)).code).toBe(
      0,
    );
    await git("remote", "add", "fixture", remote);
    const push = await git("push", "fixture", "HEAD:refs/heads/main");
    expect(push.code).not.toBe(0);
    expect(push.output).toContain("pre-push");
    expect((await command(["git", "--git-dir", remote, "show-ref"], temp.directory)).code).toBe(1);
  } finally {
    await temp.cleanup();
  }
});

test("CI workflow uses the pinned toolchain and same aggregate check", async () => {
  const workflow = Bun.YAML.parse(
    await Bun.file(join(root, ".github/workflows/check.yml")).text(),
  ) as {
    on: Record<string, unknown>;
    permissions: Record<string, string>;
    concurrency: { "cancel-in-progress": boolean; };
    jobs: {
      check: {
        "runs-on": string;
        "timeout-minutes": number;
        env: { HUSKY: string; };
        steps: Array<{ uses?: string; run?: string; with?: Record<string, unknown>; }>;
      };
    };
  };
  expect(Object.keys(workflow.on).sort()).toEqual(["pull_request", "push", "workflow_dispatch"]);
  expect(workflow.on.push).toEqual({ branches: ["main"] });
  expect(workflow.permissions).toEqual({ contents: "read" });
  expect(workflow.concurrency["cancel-in-progress"]).toBe(true);
  const job = workflow.jobs.check;
  expect(job["runs-on"]).toBe("ubuntu-24.04");
  expect(job["timeout-minutes"]).toBeGreaterThan(0);
  expect(job.env.HUSKY).toBe("0");
  const actions = job.steps.filter((step) => step.uses);
  expect(actions).toHaveLength(2);
  for (const action of actions) {
    expect(action.uses).toMatch(/^(actions\/checkout|oven-sh\/setup-bun)@[a-f0-9]{40}$/);
  }
  expect(actions[1]?.with?.["bun-version-file"]).toBe(".bun-version");
  expect(job.steps.map((step) => step.run).filter(Boolean)).toEqual([
    "bun install --frozen-lockfile",
    [
      "sudo apt-get update",
      "sudo apt-get install --yes bubblewrap apparmor-profiles",
      "sudo install -m 0644 /usr/share/apparmor/extra-profiles/bwrap-userns-restrict /etc/apparmor.d/bwrap-userns-restrict",
      "sudo apparmor_parser -r /etc/apparmor.d/bwrap-userns-restrict",
      "bun run setup:browser --with-deps",
      "",
    ].join("\n"),
    "bun run check",
  ]);
});
