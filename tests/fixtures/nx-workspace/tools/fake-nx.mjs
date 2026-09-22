import { existsSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const argumentValue = (name) => {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
};

if (args[0] === "show" && args[1] === "projects") {
  process.stdout.write(JSON.stringify(["demo-app", "shared-ui"]));
  process.exit(0);
}

if (args.includes("--ignore-sigterm")) {
  const readyMarker = argumentValue("--ready-marker");
  if (readyMarker) writeFileSync(readyMarker, "ready\n");
  process.on("SIGTERM", () => {});
  await new Promise((resolve) => setTimeout(resolve, 10_000));
}

if (args.includes("--slow-shutdown")) {
  const readyMarker = argumentValue("--ready-marker");
  const shutdownMarker = argumentValue("--shutdown-marker");
  if (readyMarker) writeFileSync(readyMarker, "ready\n");

  let shuttingDown = false;
  process.on("SIGTERM", () => {
    if (shuttingDown) return;
    shuttingDown = true;
    setTimeout(() => {
      if (shutdownMarker) writeFileSync(shutdownMarker, "stopped\n");
      process.exit(0);
    }, 120);
  });

  await new Promise((resolve) => setTimeout(resolve, 2_000));
}

const requiredMarker = argumentValue("--require-marker");
if (requiredMarker && !existsSync(requiredMarker)) {
  process.stderr.write("Replacement started before cancellation completed\n");
  process.exit(9);
}

if (args.includes("--fail")) {
  process.stderr.write("NX generator failed\n");
  process.exit(7);
}

const dryRun = args.includes("--dry-run");
const generator = args[1] ?? "unknown";
const name = args.find((argument, index) => index > 1 && !argument.startsWith("--")) ?? "unnamed";

await new Promise((resolve) => setTimeout(resolve, args.includes("--slow") ? 2_000 : 40));

if (dryRun) {
  process.stdout.write(`NX dry run for ${generator}\n`);
  process.stdout.write(`CREATE libs/demo/src/lib/${name}.ts\n`);
  process.stdout.write("\nNOTE: The dry run made no changes.\n");
} else {
  process.stdout.write(`NX executed ${generator} for ${name}\n`);
}
