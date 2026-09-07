## Context

The repository has no application code or toolchain. See [proposal.md](proposal.md) for scope and [project-bootstrap](specs/project-bootstrap/spec.md) for acceptance criteria.

## Goals / Non-Goals

Separate adapters, services, and browser code without introducing separately packaged services. Keep the integration example replaceable.

## Decisions

### Package and runtime

Use one private ESM package; workspace packaging adds no value until modules have independent consumers.

```text
src/
  main.ts     composition and process entry
  app/        Effect services and configuration
  mcp/        SDK adapter and schema bridge
  server/     Effect Bun HTTP integration
  shared/     browser-safe schemas
  web/        HTML, React, CSS
scripts/      setup, build, checks
tests/        unit, integration, browser, compiled smoke
```

Use separate browser and server/tooling type configurations. Exclude Bun/Node globals from browser types, and enforce browser import restrictions with lint rules: no application/server/MCP modules or Bun/Node built-ins.

Bun owns dependencies, scripts, development, tests, bundling, and executable compilation. Pin its version in `.bun-version`, keep `packageManager` consistent, and commit `bun.lock`. Pin compatible published versions of all direct dependencies; use repository-local tools.

### Effect and Bun HTTP

Pin Effect 4 RC and matching `@effect/platform-bun`. Share one runtime and scope for services, configuration, typed errors, and resources. Keep Promise conversions and cancellation propagation in adapters; React presentation remains ordinary React.

Use `BunHttpServer` with native Bun HTML routes and Effect API handlers. It provides server lifetime and request cancellation without a custom `Bun.serve` wrapper. Verify the pinned release's HTML imports, reload, and compiled assets; add glue only for a reproduced gap. [Effect implementation](https://github.com/Effect-TS/effect/blob/main/packages/platform/bun/src/BunHttpServer.ts)

Acquire HTTP before exposing its URL through MCP. Transport closure and termination close the shared scope, including partial startup failures.

Disable Bun port sharing so an explicit occupied port fails. Mark the API effect interruptible and disable the adapter's preemptive graceful wait so scope closure cancels pending requests before stopping the listener.

Compatibility patch: published `@effect/platform-bun@4.0.0-rc.112` drops native HTML routes in `server.reload`, producing a 404 for `/` after API installation. Use Bun's dependency patch to preserve routes at both reload sites, matching the upstream fix. Source and compiled browser tests cover this patch; remove it when upgrading to a fixed release.

### MCP adapter and logging

Use `@modelcontextprotocol/server` v2's modern stdio entry, restricted to protocol `2026-07-28`; use the matching client for tests. Let the SDK handle protocol errors specified in [MCP interoperability verification](specs/project-bootstrap/spec.md#requirement-mcp-interoperability-verification).

Define JSON-compatible tool inputs and outputs once with Effect Schema. One bridge supplies both runtime validation and JSON Schema conversion through `StandardSchemaWithJSON`; validation alone is insufficient. Inject invalid outputs through test-only handlers. [SDK schema handling](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/packages/server/src/server/mcp.ts)

In MCP mode, send application logs and startup URLs to stderr: the host parses stdout as JSON-RPC. Allow browser-console forwarding only when verified stderr-only; otherwise disable forwarding, not DevTools logging. Normal forwarding is allowed in `--web-only` development.

The pinned SDK checks version claims during the opening exchange, then pins the connection era. A transport guard uses the SDK's `UnsupportedProtocolVersionError` for unsupported claims on subsequent requests. Keep terminal Effect failure reporting inside the stderr-configured context; disable the runner's outer error reporter.

### Integration example

Use `GET /api/health` returning `name`, `version`, and `status: "ok"`. A read-only `revisionist_status` tool adds `browserUrl`. React decodes the HTTP response and renders connected or unavailable status.

Bind to `127.0.0.1`, port `0`; validate explicit ports and reject conflicts or non-loopback configuration. Print the URL to stderr and leave browser opening to the developer or test harness. Serve assets locally. Validate Host and reject cross-origin API requests without permissive CORS; loopback is not document-access authorization.

### Compiler, linting, and formatting

- Resolve the matching compiler with `effect-tsgo get-exe-path` and invoke it directly for TypeScript 7 and Effect correctness diagnostics, including floating Effects. Run it once per server/browser configuration without replacing TypeScript's installed binary. Keep style suggestions nonblocking. Use its language server as the sole TypeScript editor service. [Effect tooling](https://github.com/Effect-TS/tsgo/blob/main/README.md)
- Use compatible `oxlint` and `oxlint-tsgolint` with `--type-aware`. Enable `typescript/no-floating-promises` and `typescript/no-misused-promises` as errors across browser, server, tests, and tooling. Keep Effect's optional Oxlint patch off to avoid duplicate diagnostics. The separate analysis pass catches Promise errors at SDK/React boundaries. [Oxlint documentation](https://oxc.rs/docs/guide/usage/linter/type-aware.html)
- Add targeted correctness rules and browser-scoped React/hooks/accessibility rules; enabled correctness violations fail linting.
- Use dprint with pinned plugins for the repository's formats. Exclude dependencies, generated output, lockfiles, generated skills, and whitespace-sensitive document fixtures. [dprint plugins](https://dprint.dev/plugins/)

### Build and test implementation

Implement the [command contract](specs/project-bootstrap/spec.md#requirement-shared-validation-commands) with Bun scripts. Build `dist/revisionist` for the host using HTML imports and `bun build --compile`; embedding assets avoids a separate production asset directory. Ignore build output and caches. [Bun executables](https://bun.sh/docs/bundler/executables#full-stack-executables)

Validate Linux x64 for this bootstrap. Pin the official `@oven/bun-linux-x64` compilation runtime to the same Bun version in the lockfile: the locally installed Homebrew build embeds Homebrew-specific loader and ICU paths. Disable compiled `.env` and `bunfig.toml` autoloading. Other build targets require their own runtime pin and verification.

Use `bun:test` for all tests. Source tests must not depend on a compiled build. Supplement the SDK client with raw modern requests so negotiation cannot mask a handshake dependency. Give subprocess tests finite timeouts and guaranteed teardown; these timeouts are not product shutdown deadlines.

Use the pinned Playwright library with matching Chromium under `bun:test`, not a second runner. Test source and compiled builds, using explicit waits, real API responses, intercepted failures, page-error checks, and teardown. [Playwright library](https://playwright.dev/docs/library)

Use Linux bubblewrap for executable isolation. Expose only the binary, required OS libraries, and fresh temporary/device/process mounts—not the checkout, dependencies, host process filesystem, or external JavaScript runtimes. Keep the driver/browser outside and share the host network for loopback access. Probe the original checkout path using the same mount configuration; do not rename or modify the checkout. [bubblewrap](https://github.com/containers/bubblewrap#usage)

Resolve the built ELF's dependencies with `ldd` and mount individual library files. Whole library directories can contain global JavaScript modules and must not be exposed.

Document Chromium, OS libraries, bubblewrap, and namespace setup as test-only prerequisites. Use disposable fixtures for diagnostic failures and Git-hook tests.

### Hooks and CI

Use Husky for the [hook contract](specs/project-bootstrap/spec.md#requirement-non-writing-git-hooks). Working-tree checks can reject unstaged errors or miss staged errors hidden by unstaged fixes; CI checks the proposed revision.

One Bun `prepare` script validates compiler availability, prepares dprint under Bun, then installs Husky. Restrict dependency lifecycle scripts to the pinned compiler helper so dprint's Node-based postinstall does not run. `HUSKY=0` skips only Husky; setup failures fail installation. Hooks use POSIX commands and repository-local Git configuration. [Husky CI guidance](https://typicode.github.io/husky/how-to.html#ci-server-and-docker)

Implement [CI requirements](specs/project-bootstrap/spec.md#requirement-continuous-integration-uses-the-same-checks) in `.github/workflows/check.yml`, targeting `main`. Use a versioned Ubuntu runner and checkout/`oven-sh/setup-bun` actions pinned to verified SHAs. Provision test prerequisites, use read-only contents permission, and configure timeout and superseded-run cancellation.

## Risks / Trade-offs

- Effect RC, compiler compatibility, schema conversion, and embedded assets may have compatibility gaps → verify the pinned combination before expanding the example.
- Typed linting and browser/isolation tests increase setup cost and pre-push latency → document prerequisites and measure full-check duration.
- Bubblewrap needs Linux namespaces → verify development and CI hosts; unsupported environments fail rather than skip tests.
- Bundled runtimes increase binary size → accept the cost of standalone distribution. Linux checks do not establish other-platform support.

## Migration Plan

This is additive setup with no user data migration. Rollback removes the added files and restores repository-local hook configuration.
