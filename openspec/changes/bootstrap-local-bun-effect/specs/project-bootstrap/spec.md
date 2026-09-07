## Purpose

Provide reproducible development setup, local integration checks, and standalone builds. The integration example can be replaced as review features are added; its API names and payloads are not product contracts.

## ADDED Requirements

### Requirement: Reproducible developer installation

The repository SHALL document the pinned runtime, installation, and test prerequisites. Setup SHALL prepare dependencies, compiler diagnostics, and local hooks using repository-managed tooling.

#### Scenario: Install a clean checkout

- **WHEN** documented setup runs on a supported host with `bun install --frozen-lockfile`
- **THEN** tooling and test prerequisites are available without changing manifests or the lockfile

#### Scenario: Detect dependency drift

- **WHEN** a manifest disagrees with the lockfile
- **THEN** frozen installation fails without updating it

### Requirement: Local integration verification

A runnable example SHALL connect services, stdio MCP, HTTP, and a browser client in one server process without accessing user documents. HTTP SHALL remain loopback-only, select an available port by default, and report its URL. Automated checks SHALL verify these behaviors.

#### Scenario: Start two independent instances

- **WHEN** two instances start with default configuration
- **THEN** each reports a reachable loopback URL without a port collision

#### Scenario: Request a non-local interface

- **WHEN** configuration requests a non-loopback bind
- **THEN** startup fails clearly without leaving a listener open

#### Scenario: Browser executes the client

- **WHEN** an automated browser opens the reported URL and receives a valid API response
- **THEN** JavaScript renders that response using local assets without uncaught page errors

#### Scenario: Browser request fails

- **WHEN** the browser's API request fails
- **THEN** the page renders failure rather than a successful connection

### Requirement: MCP interoperability verification

The MCP adapter SHALL support only protocol `2026-07-28` over stdio. Automated checks SHALL verify discovery, schema validation, service invocation, and protocol-only stdout.

#### Scenario: Modern request without initialization

- **WHEN** the first request is a valid tool call with required protocol metadata
- **THEN** it returns a schema-valid result without initialization or prior discovery

#### Scenario: Discover the server and tool schemas

- **WHEN** a client calls `server/discover` and `tools/list`
- **THEN** discovery advertises only the supported version, and tool input/output JSON Schemas match runtime validation

#### Scenario: Reject invalid tool data

- **WHEN** tests supply invalid arguments or inject invalid structured results
- **THEN** invalid arguments do not reach the handler, and invalid results are not returned as successes

#### Scenario: Unsupported protocol

- **WHEN** an otherwise valid request declares an unsupported version
- **THEN** error `-32022` contains `data.supported: ["2026-07-28"]` and `data.requested` equal to the rejected version

#### Scenario: Legacy initialization attempt

- **WHEN** a client sends legacy `initialize`
- **THEN** an error identifies the supported version without establishing a legacy session

#### Scenario: Startup and application logging

- **WHEN** startup or diagnostic logs are emitted during MCP operation
- **THEN** they go to stderr without corrupting stdout protocol messages

### Requirement: Resource cleanup verification

Automated checks SHALL verify that host disconnect, termination, and failed startup release listeners and cancel pending work.

#### Scenario: MCP host disconnects

- **WHEN** the host closes stdin
- **THEN** the child exits and its HTTP listener becomes unreachable

#### Scenario: Explicit local shutdown

- **WHEN** the process receives a supported termination signal
- **THEN** pending work is interrupted, the process exits, and its port is released

#### Scenario: Startup fails after acquiring a resource

- **WHEN** startup fails after acquiring the listener
- **THEN** the process exits nonzero and releases it

### Requirement: Standalone local build

The build SHALL produce a host-platform executable containing its runtime and browser assets. Automated smoke checks SHALL make the checkout, dependency directories, separate assets, and external JavaScript runtimes inaccessible to it.

#### Scenario: Execute without development files

- **WHEN** the executable runs with only its binary and required OS resources available
- **THEN** MCP and HTTP calls succeed, and an automated browser renders responses using embedded assets

#### Scenario: Verify filesystem isolation

- **WHEN** the smoke harness prepares that environment
- **THEN** it verifies that a known original checkout file is unreadable at its absolute path before testing integration

### Requirement: Shared validation commands

The repository SHALL expose these `bun run` commands:

| Command               | Contract                                                                      |
| --------------------- | ----------------------------------------------------------------------------- |
| `dev`                 | Browser development without MCP stdin, with client reload                     |
| `start`               | Source example in MCP stdio mode                                              |
| `typecheck`           | Server, browser, tests, and tooling types plus Effect correctness diagnostics |
| `lint`                | Type-aware correctness checks, including Promise safety                       |
| `lint:fix` / `format` | Explicit lint fixes / formatting                                              |
| `format:check`        | Non-writing formatting check                                                  |
| `test`                | Unit, source integration, and browser tests                                   |
| `build`               | Compile the standalone executable                                             |
| `test:smoke`          | Isolated and browser checks against the built executable                      |
| `check`               | Typecheck, lint, format check, test, build, then smoke checks                 |

Checks SHALL preserve source files and the Git index; ignored output and caches are permitted. Failed phases and missing prerequisites SHALL produce nonzero exits.

#### Scenario: Entire check succeeds

- **WHEN** every phase passes
- **THEN** `bun run check` succeeds without tracked-file changes

#### Scenario: Detect a real failure

- **WHEN** any check phase fails
- **THEN** `bun run check` exits nonzero and identifies the failed phase

#### Scenario: Effect correctness diagnostics are active

- **WHEN** typechecking finds a floating Effect covered by an enabled error diagnostic
- **THEN** the CLI fails without requiring an editor extension

#### Scenario: Promise-safety rules are active

- **WHEN** linting finds an unhandled Promise or a Promise used where a synchronous callback is required
- **THEN** lint fails under the enabled rules independently of Effect compiler diagnostics

#### Scenario: Browser or isolation prerequisites are missing

- **WHEN** a required browser, OS library, or isolation facility is unavailable
- **THEN** checks fail with setup guidance instead of skipping tests

### Requirement: Non-writing Git hooks

Hooks SHALL run lint and format checks before commits and `bun run check` before pushes, blocking failed operations. They SHALL NOT fix, stage, stash, or commit files. Documentation SHALL explain that checks use the working tree, not an isolated staged snapshot.

#### Scenario: Commit with a lint failure

- **WHEN** a commit encounters a lint failure
- **THEN** the hook rejects it without modifying source or index

#### Scenario: Push with failing tests

- **WHEN** a push encounters a failing aggregate check
- **THEN** the hook prevents it

#### Scenario: Partially staged changes

- **WHEN** hooks run with staged and unstaged changes
- **THEN** both contents remain unchanged

### Requirement: Continuous integration uses the same checks

GitHub Actions SHALL run on pull requests, default-branch pushes, and manual dispatch. A clean Linux runner SHALL use the pinned runtime, frozen installation, test prerequisites, and `bun run check`.

#### Scenario: Validate a proposed change

- **WHEN** a pull request triggers CI
- **THEN** the proposed revision runs the same aggregate check as local development, failing if any phase fails

#### Scenario: Prepare tooling in CI

- **WHEN** installation runs with local hooks disabled
- **THEN** compiler availability validation still runs without modifying TypeScript, hook installation is skipped, and compiler validation errors fail the job
