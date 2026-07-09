import { Point } from "../domain/types";

export function orderCorners(points: Point[]): Point[] {
  if (points.length !== 4) {
    return points;
  }

  const bySum = [...points].sort((a, b) => a.x + a.y - (b.x + b.y));
  const byDiff = [...points].sort((a, b) => a.x - a.y - (b.x - b.y));

  return [bySum[0], byDiff[3], bySum[3], byDiff[0]];
}

export function defaultCorners(width: number, height: number): Point[] {
  const insetX = width * 0.08;
  const insetY = height * 0.12;
  return [
    { x: insetX, y: insetY },
    { x: width - insetX, y: insetY },
    { x: width - insetX, y: height - insetY },
    { x: insetX, y: height - insetY }
  ];
}

export function findLightCardBox(imageData: ImageData): Point[] | null {
  const { data, width, height } = imageData;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let count = 0;

  for (let y = 0; y < height; y += 4) {
    for (let x = 0; x < width; x += 4) {
      const offset = (y * width + x) * 4;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const saturation = max === 0 ? 0 : (max - min) / max;
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;

      if (luma > 135 && saturation < 0.32) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        count += 1;
      }
    }
  }

  const area = (maxX - minX) * (maxY - minY);
  if (count < 100 || area < width * height * 0.08) {
    return null;
  }

  return orderCorners([
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY }
  ]);
}

export function solveHomography(from: Point[], to: Point[]): number[] {
  const rows: number[][] = [];

  for (let i = 0; i < 4; i += 1) {
    const { x, y } = from[i];
    const u = to[i].x;
    const v = to[i].y;
    rows.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    rows.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }

  const solved = gaussianElimination(rows);
  return [...solved, 1];
}

export function applyHomography(matrix: number[], x: number, y: number): Point {
  const denominator = matrix[6] * x + matrix[7] * y + matrix[8];
  return {
    x: (matrix[0] * x + matrix[1] * y + matrix[2]) / denominator,
    y: (matrix[3] * x + matrix[4] * y + matrix[5]) / denominator
  };
}

function gaussianElimination(rows: number[][]): number[] {
  const n = 8;

  for (let column = 0; column < n; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < n; row += 1) {
      if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) {
        pivot = row;
      }
    }

    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];

    const divisor = rows[column][column] || 1;
    for (let value = column; value <= n; value += 1) {
      rows[column][value] /= divisor;
    }

    for (let row = 0; row < n; row += 1) {
      if (row === column) {
        continue;
      }
      const factor = rows[row][column];
      for (let value = column; value <= n; value += 1) {
        rows[row][value] -= factor * rows[column][value];
      }
    }
  }

  return rows.map((row) => row[n]);
}
