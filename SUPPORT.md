# Support and Compatibility

## Release policy

`nx-sprout` is currently a pre-1.0 project. Only the most recent published release is supported;
users may be asked to reproduce a problem after upgrading. Compatibility may change between minor
versions while the public interface is being established.

## Runtime requirements

| Component | Supported baseline | Notes |
| --- | --- | --- |
| Node.js | 22.12 or newer | Required to run the target workspace's Nx CLI; Node 24 is used in CI. |
| Bun | 1.4 or newer | Required only when running from source; release executables embed Bun. |
| Nx | 23.0.0 through 23.2.1 | CI qualifies the oldest and newest supported versions against a real Nx workspace. |
| Package layout | `node_modules` installs | Yarn Plug'n'Play is not supported. |

### Nx compatibility status

CI installs Nx 23.0.0 and 23.2.1 into a representative workspace and verifies installed and local
generator discovery, project discovery through the real Nx CLI, command construction and execution,
and dry-run isolation. Those boundary versions define the currently supported Nx range. Versions
newer than 23.2.1 and other Nx major versions are unqualified and should be treated as best-effort
until they are added to the compatibility matrix.

## Release platforms

| Platform | Architectures | Support level | Notes |
| --- | --- | --- | --- |
| Linux | x64, ARM64 | Built and smoke-tested in CI | Release binaries target glibc-based distributions; musl/Alpine is not currently qualified. |
| macOS | Intel, Apple Silicon | Built and smoke-tested in CI | Current GitHub-hosted runner versions are used. |
| Windows | x64 | Built and smoke-tested in CI | Windows ARM64 is not currently released. |

An interactive terminal is required for the TUI. Non-interactive `--help` and `--version` commands
are supported without starting the renderer.

## Workspace and generator support

Supported discovery includes direct dependencies installed under `node_modules` and local packages
declared by package-manager workspace globs. Generator options are limited to the schema features
listed in the README. Completion metadata for files, directories, targets, and tags is not yet
rendered as a picker.

Generator execution is delegated to the workspace's own Nx installation. A failed or cancelled
generator may have already changed files, so run `nx-sprout` from a clean version-control state and
review the resulting diff before committing. `nx-sprout` waits for a cancelled Nx process to stop
before starting another process, but it cannot roll back arbitrary filesystem changes made by a
generator.

## Getting help

Use GitHub Issues for reproducible bugs and feature requests. Include:

- The `nx-sprout`, Node, Nx, and package-manager versions
- The operating system, architecture, and terminal application
- Whether `nx-sprout` was run from source or as a release executable
- A minimal reproduction and sanitized output from the failed command

Do not include secrets or proprietary workspace contents. Follow `SECURITY.md` instead of opening
a public issue when the report may describe a vulnerability.
