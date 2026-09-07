export const phases = ["typecheck", "lint", "format:check", "test", "build", "test:smoke"] as const;
export async function check(cwd = process.cwd()) {
  const started = performance.now();
  for (const phase of phases) {
    console.error(`Checking ${phase}…`);
    const child = Bun.spawn([process.execPath, "run", phase], {
      cwd,
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });
    const code = await child.exited;
    if (code !== 0) {
      console.error(`Check failed: ${phase} (exit ${code})`);
      return code;
    }
  }
  console.error(`All checks passed in ${((performance.now() - started) / 1000).toFixed(1)}s.`);
  return 0;
}
if (import.meta.main) process.exit(await check());
