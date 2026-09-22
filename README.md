# nx-sprout

An editor-agnostic terminal interface for discovering and running Nx generators.

`nx-sprout` finds the Nx workspace from your current directory, discovers installed and local
generator collections, builds a form from each generator's JSON Schema, validates options, and
shows cancellable dry-run output before making changes. Nx itself always runs with Node from the
target workspace; Bun owns only the TUI.

## Requirements

For development:

- Bun 1.4 or newer
- Node.js 22.12 or newer
- An Nx 23.0.0 through 23.2.1 workspace with dependencies installed

With mise installed, `mise install` installs the versions pinned by `.mise.toml`.

A compiled `nx-sprout` executable includes Bun and the application dependencies. Node is still
required because the target workspace's Nx CLI runs under Node.

## Support and security

See [SUPPORT.md](SUPPORT.md) for the current Nx, runtime, platform, and release support policy.
Report suspected vulnerabilities privately by following [SECURITY.md](SECURITY.md).

## Run from source

```sh
mise install
bun ci
bun run demo
```

The demo uses a representative fixture and fake Nx executable, so it cannot change a real
workspace.

To use a real workspace:

```sh
bun run src/cli.ts --workspace /path/to/nx-workspace
```

## Install a release

Each `v*` tag publishes native executables for Linux x64/ARM64, macOS Intel/Apple Silicon,
and Windows x64 on the repository’s GitHub Releases page. Download the asset matching your
computer and compare it with `SHA256SUMS.txt`.

Each executable also has an SPDX JSON SBOM named `<asset>.spdx.json` and GitHub artifact
attestations for its build provenance and SBOM. After replacing `OWNER/REPOSITORY` and the asset
name, verify the downloaded binary with:

```sh
gh attestation verify ./nx-sprout-<platform>-<architecture> \
  --repo OWNER/REPOSITORY
```

When all release files are in the same directory, verify their checksums on Linux with
`sha256sum --check SHA256SUMS.txt` or on macOS with
`shasum --algorithm 256 --check SHA256SUMS.txt`. The checksum manifest has its own GitHub
attestation and can be verified with the same `gh attestation verify` command.

On Linux or macOS, rename the downloaded asset and put it on `PATH`:

```sh
chmod +x nx-sprout-<platform>-<architecture>
mkdir -p ~/.local/bin
mv nx-sprout-<platform>-<architecture> ~/.local/bin/nx-sprout
nx-sprout --version
```

On Windows, rename `nx-sprout-windows-x64.exe` to `nx-sprout.exe` and place it in a directory on
`PATH`. The executable includes Bun and application dependencies. Every target Nx workspace
still needs its own dependencies installed and a supported Node.js available on `PATH`.

To build locally instead:

```sh
bun run build
mkdir -p ~/.local/bin
cp dist/nx-sprout ~/.local/bin/nx-sprout
chmod +x ~/.local/bin/nx-sprout
```

Then run `nx-sprout` from any directory inside an Nx workspace.

## Command-line options

```text
--workspace <path>       Start in a specific Nx workspace or child directory
--nx-bin <path>          Override the workspace-local Nx executable
--preview                Enable automatic dry-run previews
--no-preview             Disable automatic dry-run previews
--preview-delay <ms>     Override the preview debounce delay
-v, --version            Print the version
-h, --help               Print help
```

## Controls

`Ctrl+C` exits from any screen and cancels the active preview or generator process. Cancelling a
generator after execution begins may leave partial workspace changes; the execution screen warns
before cancellation, and `nx-sprout` waits for the process to stop before starting another one.

### Generator picker

- Type to search generator names, collections, aliases, and descriptions.
- `Enter` moves to the result list and selects the highlighted generator.
- `Esc` exits.

### Generator options

- `Tab` and `Shift+Tab` move between fields.
- `Ctrl+R` runs a dry-run immediately.
- `F2` toggles internal/advanced fields.
- `Ctrl+G` opens the execution confirmation screen.
- `Ctrl+Enter` is also accepted when the terminal supports an enhanced keyboard protocol.
- `Esc` returns to the generator picker.

Executing without `--dry-run` always requires a second confirmation step.

## Workspace configuration

Create `.nx-sprout.json` in the Nx workspace root:

```json
{
  "generatorAllowlist": ["@nx/angular:*", "@nx/workspace:library"],
  "generatorBlocklist": ["*:stories"],
  "dryRunOnChange": true,
  "dryRunDelayMs": 350,
  "showInternalOptions": false
}
```

All settings are optional. Invalid configuration produces a warning and falls back to safe
defaults.

## Supported schema behavior

- Required, important, regular, deprecated, and internal option ordering
- Strings, numbers, integers, booleans, enums, arrays, and JSON objects
- `x-prompt` labels, list choices, confirmations, and multiselect choices
- `x-priority`, `x-deprecated`, `x-hint`, and `x-dropdown`
- Workspace project dropdowns, including implicit `project` and `projectName` fields
- Positional arguments from `$default.$source: "argv"`
- AJV validation, including standard JSON Schema constraints
- Structured option serialization without invoking a shell

## Verify

```sh
bun run check
bun run build
./dist/nx-sprout --help
```

The real-Nx compatibility suite is separate from the fast default tests. Install a supported Nx
version into its isolated fixture and run it with:

```sh
npm install --no-save --package-lock=false --ignore-scripts --no-audit --no-fund \
  --prefix tests/fixtures/real-nx-workspace nx@23.2.1
bun run test:integration:nx
```

## Current limitations

- Generator discovery covers installed dependency packages and local packages declared through
  package-manager workspace globs. Yarn Plug'n'Play is not yet supported.
- Free-form arrays and object options use comma-separated or JSON text entry; declared
  `x-prompt` multiselect choices use an interactive checklist.
- File, directory, target, and tag completion metadata is not yet rendered as a picker.
