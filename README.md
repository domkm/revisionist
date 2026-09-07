# Revisionist

Local Markdown review tooling built with Bun, Effect, and React. The current bootstrap connects a stdio MCP server, an HTTP status endpoint, and a browser page. Document loading, annotations, and diffs are not implemented; the status APIs are replaceable integration examples.

## Setup

The supported development and build target is **Linux x64**. Install **Bun 1.3.14**, as pinned in `.bun-version`; project commands do not require a separate Node installation.

```sh
bun install --frozen-lockfile
```

Installation validates the Effect compiler, prepares dprint, and installs repository-local Husky hooks. Set `HUSKY=0` to skip hook installation without skipping compiler validation.

### Test prerequisites

Tests require Chromium, its OS libraries, bubblewrap, and Linux user/PID namespace support. On Ubuntu 24.04:

```sh
sudo apt-get update
sudo apt-get install --yes bubblewrap
bun run setup:browser --with-deps
bun run prerequisites
bun run check
```

Playwright downloads its pinned Chromium build to the user cache. `--with-deps` may request elevated privileges to install OS packages. These are test tools, not runtime dependencies of the executable.

If host or container policies prohibit bubblewrap, use a supported host or ask its administrator to permit bubblewrap specifically. Do not disable host-wide security restrictions. Missing prerequisites fail checks with setup guidance; tests do not silently skip browser execution or isolation.

## Development

```sh
bun run dev
```

Open the loopback URL printed to stderr. Development mode supports client reload and browser-console forwarding without MCP stdin. The server binds only `127.0.0.1` and chooses an available port; use `bun run dev --port 4321` to select one. The page displays the result of `GET /api/health` using local assets.

## MCP

Run `bun run start` for source execution. Configure an MCP host to spawn Bun directly with absolute paths:

```json
{
  "command": "/absolute/path/to/bun",
  "args": ["/absolute/path/to/revisionist/src/main.ts"]
}
```

Alternatively, run `bun run build` and configure the host to spawn the absolute path to `dist/revisionist`, with no arguments. The executable embeds Bun and the browser assets.

Only **MCP `2026-07-28`** is supported. Hosts must send modern per-request protocol metadata; legacy `initialize` clients are rejected. With the official v2 client, use `versionNegotiation: { mode: { pin: "2026-07-28" } }`. A tool call can precede discovery.

`revisionist_status` returns the example status and browser URL. In MCP mode, stdout contains only JSON-RPC; logs and startup URLs use stderr. Browser-console forwarding is disabled, but DevTools logging remains available. Closing stdin or sending SIGINT/SIGTERM cancels pending work and releases the listener.

## Checks

| Command                | Purpose                                                                                  |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| `bun run typecheck`    | Strict server/browser/tooling checks and Effect correctness diagnostics                  |
| `bun run lint`         | Non-writing, type-aware Oxlint, including Promise safety and browser import restrictions |
| `bun run lint:fix`     | Explicit supported lint fixes                                                            |
| `bun run format`       | Explicit dprint formatting                                                               |
| `bun run format:check` | Non-writing formatting check                                                             |
| `bun run test`         | Prerequisite check, unit tests, source MCP/HTTP tests, and Chromium tests                |
| `bun run build`        | Compile `dist/revisionist` for Linux x64                                                 |
| `bun run test:smoke`   | Prerequisite check and isolated/browser tests of the already-built executable            |
| `bun run check`        | Typecheck → lint → format check → test → build → smoke; stop on the first failure        |
| `bun run check:clean`  | Frozen install and full check in a disposable Git copy with Node blocked                 |

Source tests do not require a build. Smoke tests run the executable inside bubblewrap without access to the checkout, dependencies, host `/proc`, or another JavaScript runtime. The browser and driver connect from outside over loopback.

Checks leave source files and the Git index unchanged. `check:clean` also verifies that setup preserves TypeScript's binary and that a mismatched manifest fails frozen installation without changing the lockfile.

### Hooks and CI

Husky runs lint and format checks before commits and the full check before pushes. Hooks inspect the **working tree**, not an isolated staged snapshot: unstaged errors can block a commit, and unstaged fixes can hide staged errors. Hooks preserve partial staging and never fix, stage, or stash files.

Use `HUSKY=0 git commit ...` or `HUSKY=0 git push ...` for a deliberate bypass, and run `bun run check` separately before publishing. GitHub Actions runs frozen installation and the same check on pull requests, pushes to `main`, and manual dispatch.

## Maintaining the toolchain

- Keep direct dependency versions exact. Update `.bun-version`, `packageManager`, and `@oven/bun-linux-x64` together. Builds use this official Bun binary to avoid embedding Homebrew-specific loader and ICU paths.
- Upgrade Effect and `@effect/platform-bun` together. Verify the TypeScript/`@effect/tsgo` and Oxlint/`oxlint-tsgolint` pairs. Reinstall Chromium after Playwright upgrades, update pinned dprint plugins and action SHAs as needed, then run `bun run check:clean` with the regenerated lockfile.
- `bun run typecheck` invokes the compiler resolved by `effect-tsgo get-exe-path` for both server and browser code; it does not patch TypeScript. For editor integration, use the `@effect/tsgo` language server as the sole TypeScript service.
- The patch in `patches/` preserves native HTML routes when `@effect/platform-bun@4.0.0-rc.112` reloads its HTTP handler. Remove it when upgrading to a release with the fix, and rerun source, reload, and compiled browser tests.
