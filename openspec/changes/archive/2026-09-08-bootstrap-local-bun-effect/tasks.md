## 1. Toolchain

- [x] 1.1 Create the private package, runtime pins, Bun configuration, ignores, and lockfile using the [selected tools](design.md#decisions). Verify compatible versions and frozen installation.
- [x] 1.2 Configure strict typechecking through direct Effect compiler invocation and compiler/Husky validation. Verify TypeScript and floating-Effect diagnostics in server/browser configurations with `HUSKY=0`, without modifying TypeScript's binary.
- [x] 1.3 Configure typed lint rules, browser import restrictions, and formatting. Use passing/failing fixtures across browser, server, tests, and tooling; verify source and generated skills remain unchanged.
- [x] 1.4 Document and provision browser/isolation prerequisites. Verify Chromium launch, namespace support, and actionable missing-prerequisite failures.

## 2. Integration example

- [x] 2.1 Add shared schemas and Effect response/configuration services. Verify decoding and invalid configuration with unit tests.
- [x] 2.2 Add HTTP through the selected Effect Bun adapter. Verify native HTML routes, reload, [local binding scenarios](specs/project-bootstrap/spec.md#requirement-local-integration-verification), Host/origin rejection, and port-conflict cleanup.
- [x] 2.3 Implement the schema bridge. Verify SDK schema discovery and invalid input/output rejection from [MCP interoperability](specs/project-bootstrap/spec.md#requirement-mcp-interoperability-verification).
- [x] 2.4 Add the modern stdio entry and example tool. Run the remaining MCP scenarios using both the SDK client and raw requests.
- [x] 2.5 Compose entry, logging, and shutdown. Verify both modes against the [logging policy](design.md#mcp-adapter-and-logging), request cancellation, and all [cleanup scenarios](specs/project-bootstrap/spec.md#requirement-resource-cleanup-verification).
- [x] 2.6 Add React and browser tests. Automate the [browser success/failure scenarios](specs/project-bootstrap/spec.md#requirement-local-integration-verification), including local assets and page-error detection.

## 3. Build and checks

- [x] 3.1 Implement development, startup, source-test, and build commands. Verify both startup modes, source tests without build output, and executable compilation.
- [x] 3.2 Implement the isolated smoke harness using the [test design](design.md#build-and-test-implementation). Run all [standalone build scenarios](specs/project-bootstrap/spec.md#requirement-standalone-local-build), browser success/failure checks, and shutdown checks; verify isolation failures cannot silently bypass tests.
- [x] 3.3 Complete the [command contract](specs/project-bootstrap/spec.md#requirement-shared-validation-commands). Verify every phase, injected failures, missing prerequisites, and source/index non-mutation.

## 4. Hooks and CI

- [x] 4.1 Install Husky hooks. Run all [hook scenarios](specs/project-bootstrap/spec.md#requirement-non-writing-git-hooks) in a disposable Git fixture.
- [x] 4.2 Add the workflow from [Hooks and CI](design.md#hooks-and-ci). Validate syntax, action SHAs, permissions, timeouts, concurrency, and prerequisite/check execution with CI environment settings.
- [x] 4.3 Run frozen setup and the full check in a clean temporary copy. Verify compiler availability with hooks disabled and unchanged TypeScript binary, manifests, and lockfile; distinguish local verification from observed GitHub runs.

## 5. Documentation and handoff

- [x] 5.1 Write README setup, prerequisites, commands, example/MCP invocation, version updates, and hook limitations/bypass guidance. Verify commands, identify tested platforms, and label the example API as replaceable.
- [x] 5.2 Run the full check and review scope. Report results, duration, and remaining limitations.
