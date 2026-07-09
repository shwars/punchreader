import { describe, expect, it } from "vitest";
import { pointFromRotatedSpace, pointToRotatedSpace } from "./rotation";

describe("rotation coordinate transforms", () => {
  it.each([0, 90, 180, 270])("round-trips corners through %i degrees", (rotation) => {
    const width = 1000;
    const height = 600;
    const points = [
      { x: 25, y: 40 },
      { x: 960, y: 50 },
      { x: 970, y: 560 },
      { x: 35, y: 570 }
    ];

    for (const point of points) {
      const rotated = pointToRotatedSpace(point, width, height, rotation);
      const restored = pointFromRotatedSpace(rotated, width, height, rotation);

      expect(restored.x).toBeCloseTo(point.x, 6);
      expect(restored.y).toBeCloseTo(point.y, 6);
    }
  });

  it("maps 90-degree points into the recognizer's rotated canvas", () => {
    expect(pointToRotatedSpace({ x: 10, y: 20 }, 100, 60, 90)).toEqual({ x: 40, y: 10 });
    expect(pointFromRotatedSpace({ x: 40, y: 10 }, 100, 60, 90)).toEqual({ x: 10, y: 20 });
  });
});
