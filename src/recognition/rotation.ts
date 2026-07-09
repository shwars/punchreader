import { Point } from "../domain/types";

export function pointToRotatedSpace(point: Point, width: number, height: number, rotation: number): Point {
  switch (normalizeRotation(rotation)) {
    case 90:
      return { x: height - point.y, y: point.x };
    case 180:
      return { x: width - point.x, y: height - point.y };
    case 270:
      return { x: point.y, y: width - point.x };
    default:
      return point;
  }
}

export function pointFromRotatedSpace(point: Point, width: number, height: number, rotation: number): Point {
  switch (normalizeRotation(rotation)) {
    case 90:
      return { x: point.y, y: height - point.x };
    case 180:
      return { x: width - point.x, y: height - point.y };
    case 270:
      return { x: width - point.y, y: point.x };
    default:
      return point;
  }
}

export function normalizeRotation(rotation: number): 0 | 90 | 180 | 270 {
  const normalized = ((rotation % 360) + 360) % 360;
  if (normalized === 90 || normalized === 180 || normalized === 270) {
    return normalized;
  }
  return 0;
}
