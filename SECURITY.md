# Security Policy

## Supported versions

Until `nx-sprout` reaches 1.0, security fixes are provided for the most recent published release.
Older releases and development snapshots may receive fixes at the maintainers' discretion, but
users should upgrade before reporting a problem that is already fixed in the latest release.

## Reporting a vulnerability

Please do not disclose suspected vulnerabilities in a public issue, discussion, or pull request.

Use GitHub's private vulnerability reporting from the repository's **Security** tab by selecting
**Report a vulnerability**. If private vulnerability reporting is unavailable, open a public issue
that asks the maintainers for a private contact channel, but do not include technical details in
that issue.

Include as much of the following as possible:

- The affected `nx-sprout` version, operating system, and architecture
- The Node, Nx, and package-manager versions used by the target workspace
- Reproduction steps or a minimal workspace that contains no proprietary data or secrets
- The expected and observed behavior
- The potential impact and any known mitigations
- Whether the issue is already public or has been reported elsewhere

The maintainers will aim to acknowledge a report within five business days, confirm the scope and
severity, and coordinate remediation and disclosure with the reporter. Resolution time depends on
the impact and complexity of the issue.

## Scope

Security reports may cover the `nx-sprout` executable, its release artifacts and workflows, or its
handling of workspace metadata, generator schemas, command arguments, and process execution.

Vulnerabilities that originate entirely in Nx, OpenTUI, AJV, Bun, Node.js, or another dependency
should also be reported to that upstream project. Please report them here as well when
`nx-sprout` makes the issue exploitable or requires a mitigation.
