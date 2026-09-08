import { expect, test } from "bun:test";
import { join } from "node:path";
import { command, fixture, tool } from "../helpers/fixture.ts";

test("direct compiler catches Effect and TypeScript errors in server and browser code with hooks disabled", async () => {
  const sandbox = await fixture();
  try {
    const setup = await command([process.execPath, "scripts/prepare.ts"], sandbox.directory, {
      HUSKY: "0",
    });
    expect(setup.code).toBe(0);
    const paths = ["src/server/probe.ts", "src/web/probe.ts"];
    for (const path of paths) {
      await Bun.write(join(sandbox.directory, path), "export const work = 1;\n");
    }
    for (const path of paths) {
      const file = join(sandbox.directory, path);
      await Bun.write(
        file,
        "import { Effect } from \"effect\";\nEffect.succeed(1);\nexport const wrong: number = \"text\";\n",
      );
      const result = await command([process.execPath, "run", "typecheck"], sandbox.directory);
      expect(result.code).not.toBe(0);
      expect(result.output).toContain("effect(floatingEffect)");
      expect(result.output).toContain("TS2322");
      await Bun.write(
        file,
        "import { Effect } from \"effect\";\nexport const work = Effect.succeed(1);\n",
      );
      expect((await command([process.execPath, "run", "typecheck"], sandbox.directory)).code).toBe(
        0,
      );
    }
  } finally {
    await sandbox.cleanup();
  }
});

for (const scope of ["src/server", "src/web", "scripts", "tests"]) {
  test(`typed lint catches Promise errors in ${scope}`, async () => {
    const sandbox = await fixture();
    try {
      const path = join(sandbox.directory, scope, "probe.ts");
      for (
        const [source, rule] of [
          ["Promise.resolve(1);\n", "no-floating-promises"],
          [
            "export const invoke = (f: () => void) => f();\ninvoke(async () => {});\n",
            "no-misused-promises",
          ],
        ]
      ) {
        await Bun.write(path, source!);
        const result = await command(tool("oxlint", "--type-aware", path), sandbox.directory);
        expect(result.code).not.toBe(0);
        expect(result.output).toContain(rule!);
      }
      await Bun.write(path, "export const invoke = async () => { await Promise.resolve(1); };\n");
      expect((await command(tool("oxlint", "--type-aware", path), sandbox.directory)).code).toBe(0);
    } finally {
      await sandbox.cleanup();
    }
  });
}

for (const extension of ["ts", "tsx"]) {
  test(`React hook rules cover browser .${extension} files`, async () => {
    const sandbox = await fixture();
    try {
      const path = join(sandbox.directory, `src/web/probe.${extension}`);
      for (
        const [source, rule] of [
          [
            "import { useState } from \"react\";\nexport function useProbe(flag: boolean) { if (flag) return useState(0); return undefined; }\n",
            "rules-of-hooks",
          ],
          [
            "import { useEffect } from \"react\";\nexport function useProbe(value: string) { useEffect(() => { console.log(value); }, []); }\n",
            "exhaustive-deps",
          ],
        ]
      ) {
        await Bun.write(path, source!);
        const result = await command(tool("oxlint", "--type-aware", path), sandbox.directory);
        expect(result.code).not.toBe(0);
        expect(result.output).toContain(rule!);
      }
      await Bun.write(
        path,
        "import { useState } from \"react\";\nexport function useProbe() { return useState(0); }\n",
      );
      expect((await command(tool("oxlint", "--type-aware", path), sandbox.directory)).code).toBe(0);
    } finally {
      await sandbox.cleanup();
    }
  });
}

test("browser imports reject server APIs and formatting checks never write", async () => {
  const sandbox = await fixture();
  try {
    const path = join(sandbox.directory, "src/web/probe.ts");
    const source = "import { readFile } from \"node:fs\";\nexport const forbidden=readFile;\n";
    await Bun.write(path, source);
    const lint = await command(tool("oxlint", "--type-aware", path), sandbox.directory);
    expect(lint.code).not.toBe(0);
    expect(lint.output).toContain("no-restricted-imports");
    const format = await command(tool("dprint", "check", "src/web/probe.ts"), sandbox.directory);
    expect(format.code).not.toBe(0);
    expect(await Bun.file(path).text()).toBe(source);
  } finally {
    await sandbox.cleanup();
  }
});
