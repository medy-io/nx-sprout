import type { ProcessRunner } from "./interfaces/process-runner.interface.ts";

export async function discoverWorkspaceProjects(runner: ProcessRunner): Promise<string[]> {
  const jsonResult = await runner.run(["show", "projects", "--json"]);
  if (jsonResult.cancelled) throw new Error("Nx project discovery was cancelled.");
  if (jsonResult.exitCode === 0) return parseProjectOutput(jsonResult.stdout);

  const fallbackResult = await runner.run(["show", "projects"]);
  if (fallbackResult.cancelled) throw new Error("Nx project discovery was cancelled.");
  if (fallbackResult.exitCode !== 0) {
    const detail =
      fallbackResult.stderr.trim() ||
      fallbackResult.stdout.trim() ||
      jsonResult.stderr.trim() ||
      jsonResult.stdout.trim() ||
      `exit code ${fallbackResult.exitCode}`;
    throw new Error(`Could not load Nx projects: ${detail}`);
  }

  return parseProjectOutput(fallbackResult.stdout);
}

export function parseProjectOutput(output: string): string[] {
  const normalized = stripAnsi(output).trim();
  if (!normalized) return [];

  const jsonStart = normalized.indexOf("[");
  const jsonEnd = normalized.lastIndexOf("]");
  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    try {
      const parsed = JSON.parse(normalized.slice(jsonStart, jsonEnd + 1)) as unknown;
      if (Array.isArray(parsed)) return uniqueSortedStrings(parsed);
    } catch {
      // Older Nx versions return one project per line even when --json is present.
    }
  }

  return uniqueSortedStrings(
    normalized
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("NX ")),
  );
}

function uniqueSortedStrings(values: unknown[]): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0))]
    .sort((left, right) => left.localeCompare(right));
}

function stripAnsi(value: string): string {
  return value.replace(/\x1B\[[0-?]*[ -\/]*[@-~]/g, "");
}