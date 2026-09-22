import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { VERSION } from "../src/constants/version.constant.ts";

describe("application version", () => {
  test("matches package.json", async () => {
    const packageJson = (await Bun.file(resolve(import.meta.dir, "../package.json")).json()) as {
      version: string;
    };

    expect(VERSION).toBe(packageJson.version);
  });
});
