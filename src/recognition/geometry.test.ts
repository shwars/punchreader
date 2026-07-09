import { describe, expect, it } from "vitest";
import { applyHomography, defaultCorners, orderCorners, solveHomography } from "./geometry";

describe("recognition geometry", () => {
  it("orders corners as top-left, top-right, bottom-right, bottom-left", () => {
    const ordered = orderCorners([
      { x: 100, y: 90 },
      { x: 10, y: 10 },
      { x: 90, y: 10 },
      { x: 10, y: 100 }
    ]);

    expect(ordered).toEqual([
      { x: 10, y: 10 },
      { x: 90, y: 10 },
      { x: 100, y: 90 },
      { x: 10, y: 100 }
    ]);
  });

  it("solves a homography between two rectangles", () => {
    const source = defaultCorners(1200, 360);
    const target = [
      { x: 0, y: 0 },
      { x: 80, y: 0 },
      { x: 80, y: 12 },
      { x: 0, y: 12 }
    ];
    const matrix = solveHomography(source, target);
    const mapped = applyHomography(matrix, source[2].x, source[2].y);

    expect(mapped.x).toBeCloseTo(80, 4);
    expect(mapped.y).toBeCloseTo(12, 4);
  });
});
