import { describe, expect, it } from "vitest";
import { ENCODING_PROFILES, buildGostTestGrid, buildIbmTestGrid, getProfile } from "./encodings";
import { createEmptyGrid } from "./types";

describe("encoding profiles", () => {
  it("ships the planned selectable profiles", () => {
    expect(ENCODING_PROFILES.map((profile) => profile.id)).toEqual([
      "gost-upp-8bit-parity",
      "gost-upp-7bit",
      "ibm-hollerith-026",
      "ibm-hollerith-029"
    ]);
  });

  it("decodes GOST/UPP 8-bit odd-parity rows", () => {
    const grid = buildGostTestGrid([0x20, 0x21, 0x0f, 0x00, 0x09], 8);
    const result = getProfile("gost-upp-8bit-parity").decode(grid);

    expect(result.text.startsWith("АБ 09")).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.95);
    expect(result.warnings).toEqual([]);
  });

  it("reports GOST/UPP parity errors", () => {
    const grid = buildGostTestGrid([0x20], 8);
    grid[0][0] = !grid[0][0];
    const result = getProfile("gost-upp-8bit-parity").decode(grid);

    expect(result.warnings.some((warning) => warning.includes("parity"))).toBe(true);
    expect(result.confidence).toBeLessThan(1);
  });

  it("decodes GOST/UPP 7-bit rows", () => {
    const grid = buildGostTestGrid([0x30, 0x31, 0x32], 7);
    const result = getProfile("gost-upp-7bit").decode(grid);

    expect(result.text.startsWith("РСТ")).toBe(true);
  });

  it("decodes IBM Hollerith letters and digits column by column", () => {
    const grid = buildIbmTestGrid("HELLO 1977");
    const result = getProfile("ibm-hollerith-029").decode(grid);

    expect(result.text).toBe("HELLO 1977");
    expect(result.unknowns).toHaveLength(0);
  });

  it("marks unknown IBM punch patterns", () => {
    const grid = createEmptyGrid();
    grid[0][0] = true;
    grid[1][0] = true;
    grid[11][0] = true;

    const result = getProfile("ibm-hollerith-026").decode(grid);

    expect(result.text[0]).toBe("?");
    expect(result.unknowns).toHaveLength(1);
  });
});
