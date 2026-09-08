## Why

Revisionist needs a reproducible development foundation before adding Markdown review features.

## What Changes

- Establish the Bun-first, Effect-first TypeScript toolchain.
- Add a replaceable local MCP/HTTP/React example and a standalone executable with embedded assets.
- Provide automated integration checks, including browser execution and isolated executable tests.
- Share validation commands across local development, Husky hooks, and GitHub Actions.
- Document setup, development, verification, and dependency updates.

## Capabilities

### New Capabilities

- `project-bootstrap`: Reproducible setup, local integration, standalone builds, and shared validation.

### Modified Capabilities

None.

## Impact

Adds dependency/configuration files, example modules, tests, scripts, Git hooks, and one Linux CI workflow. Tool choices and test prerequisites are defined in [design.md](design.md).

## Non-goals

Markdown review features, document access, persistence, remote MCP, plugin packaging, and release distribution. Example API names, payloads, and browser-launch behavior are not product contracts.
