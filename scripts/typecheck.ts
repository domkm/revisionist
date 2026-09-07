const resolved = Bun.spawnSync([process.execPath, "run", "--bun", "effect-tsgo", "get-exe-path"], {
  stdout: "pipe",
  stderr: "inherit",
});
if (resolved.exitCode !== 0) process.exit(resolved.exitCode);
const compiler = resolved.stdout.toString().trim();
for (const project of ["tsconfig.json", "src/web/tsconfig.json"]) {
  const result = Bun.spawnSync([compiler, "-p", project], {
    stdout: "inherit",
    stderr: "inherit",
  });
  if (result.exitCode !== 0) process.exit(result.exitCode);
}
