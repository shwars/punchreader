import { statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("sample card fixture", () => {
  it("keeps the sample photo available for visual recognition regression work", () => {
    const stats = statSync(resolve(process.cwd(), "sample/photo.jpg"));

    expect(stats.isFile()).toBe(true);
    expect(stats.size).toBeGreaterThan(100_000);
  });
});
