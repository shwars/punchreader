import {
  CARD_COLUMNS,
  CARD_ROWS,
  CellConfidenceGrid,
  HoleGrid,
  Point,
  RecognitionOutput,
  createEmptyGrid
} from "../domain/types";
import { applyHomography, defaultCorners, findLightCardBox, orderCorners, solveHomography } from "./geometry";
import { findCardCornersWithOpenCv } from "./opencv";

const WARPED_WIDTH = 1200;
const WARPED_HEIGHT = 360;
const HOLE_THRESHOLD = 0.09;

export interface RecognizeOptions {
  corners?: Point[];
  rotation?: number;
}

export async function recognizePunchCard(bitmap: ImageBitmap, options: RecognizeOptions = {}): Promise<RecognitionOutput> {
  const sourceCanvas = drawSource(bitmap, options.rotation ?? 0);
  const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
  if (!sourceContext) {
    throw new Error("Could not create image analysis context.");
  }

  const warnings: string[] = [];
  const sourceImageData = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const autoCorners =
    options.corners ??
    (await findCardCornersWithOpenCv(sourceCanvas)) ??
    findLightCardBox(sourceImageData) ??
    defaultCorners(sourceCanvas.width, sourceCanvas.height);

  if (!options.corners && autoCorners) {
    warnings.push("Auto crop was used. Drag the four handles if the card edges look off.");
  }

  const corners = orderCorners(autoCorners);
  const warped = warpPerspective(sourceImageData, corners, WARPED_WIDTH, WARPED_HEIGHT);
  const { grid, confidences } = detectHoles(warped);
  const warpedCanvas = document.createElement("canvas");
  warpedCanvas.width = WARPED_WIDTH;
  warpedCanvas.height = WARPED_HEIGHT;
  warpedCanvas.getContext("2d")?.putImageData(warped, 0, 0);

  const punchedCells = grid.flat().filter(Boolean).length;
  if (punchedCells === 0) {
    warnings.push("No holes were detected. Check crop, rotation, and lighting.");
  } else if (punchedCells > 350) {
    warnings.push("Many dark cells were detected; printed guide text may be confusing the threshold.");
  }

  return {
    grid,
    confidences,
    corners,
    warpedDataUrl: warpedCanvas.toDataURL("image/jpeg", 0.86),
    warnings
  };
}

export async function loadBitmapFromFile(file: File): Promise<ImageBitmap> {
  return createImageBitmap(file, { imageOrientation: "from-image" });
}

export async function loadBitmapFromUrl(url: string): Promise<ImageBitmap> {
  const response = await fetch(url);
  const blob = await response.blob();
  return createImageBitmap(blob, { imageOrientation: "from-image" });
}

function drawSource(bitmap: ImageBitmap, rotation: number): HTMLCanvasElement {
  const normalizedRotation = ((rotation % 360) + 360) % 360;
  const sideways = normalizedRotation === 90 || normalizedRotation === 270;
  const canvas = document.createElement("canvas");
  canvas.width = sideways ? bitmap.height : bitmap.width;
  canvas.height = sideways ? bitmap.width : bitmap.height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not create source canvas.");
  }

  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate((normalizedRotation * Math.PI) / 180);
  context.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  return canvas;
}

function warpPerspective(source: ImageData, corners: Point[], width: number, height: number): ImageData {
  const targetCorners = [
    { x: 0, y: 0 },
    { x: width - 1, y: 0 },
    { x: width - 1, y: height - 1 },
    { x: 0, y: height - 1 }
  ];
  const inverse = solveHomography(targetCorners, corners);
  const output = new ImageData(width, height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourcePoint = applyHomography(inverse, x, y);
      const color = sampleBilinear(source, sourcePoint.x, sourcePoint.y);
      const targetOffset = (y * width + x) * 4;
      output.data[targetOffset] = color[0];
      output.data[targetOffset + 1] = color[1];
      output.data[targetOffset + 2] = color[2];
      output.data[targetOffset + 3] = 255;
    }
  }

  return output;
}

function sampleBilinear(image: ImageData, x: number, y: number): [number, number, number] {
  const safeX = Math.max(0, Math.min(image.width - 2, x));
  const safeY = Math.max(0, Math.min(image.height - 2, y));
  const x0 = Math.floor(safeX);
  const y0 = Math.floor(safeY);
  const dx = safeX - x0;
  const dy = safeY - y0;
  const samples = [
    getPixel(image, x0, y0),
    getPixel(image, x0 + 1, y0),
    getPixel(image, x0, y0 + 1),
    getPixel(image, x0 + 1, y0 + 1)
  ];

  return [0, 1, 2].map((channel) => {
    const top = samples[0][channel] * (1 - dx) + samples[1][channel] * dx;
    const bottom = samples[2][channel] * (1 - dx) + samples[3][channel] * dx;
    return Math.round(top * (1 - dy) + bottom * dy);
  }) as [number, number, number];
}

function getPixel(image: ImageData, x: number, y: number): [number, number, number] {
  const offset = (y * image.width + x) * 4;
  return [image.data[offset], image.data[offset + 1], image.data[offset + 2]];
}

function detectHoles(image: ImageData): { grid: HoleGrid; confidences: CellConfidenceGrid } {
  const grid = createEmptyGrid();
  const confidences: CellConfidenceGrid = Array.from({ length: CARD_ROWS }, () =>
    Array.from({ length: CARD_COLUMNS }, () => 0)
  );
  const cellWidth = image.width / CARD_COLUMNS;
  const cellHeight = image.height / CARD_ROWS;

  for (let row = 0; row < CARD_ROWS; row += 1) {
    for (let column = 0; column < CARD_COLUMNS; column += 1) {
      const sample = sampleCell(image, column * cellWidth, row * cellHeight, cellWidth, cellHeight);
      grid[row][column] = sample.darkRatio >= HOLE_THRESHOLD;
      confidences[row][column] = Math.min(1, Math.abs(sample.darkRatio - HOLE_THRESHOLD) / HOLE_THRESHOLD);
    }
  }

  return { grid, confidences };
}

function sampleCell(image: ImageData, x: number, y: number, width: number, height: number): { darkRatio: number } {
  const startX = Math.floor(x + width * 0.28);
  const endX = Math.ceil(x + width * 0.72);
  const startY = Math.floor(y + height * 0.22);
  const endY = Math.ceil(y + height * 0.78);
  let dark = 0;
  let total = 0;

  for (let row = startY; row < endY; row += 1) {
    for (let column = startX; column < endX; column += 1) {
      const offset = (row * image.width + column) * 4;
      const luma = 0.2126 * image.data[offset] + 0.7152 * image.data[offset + 1] + 0.0722 * image.data[offset + 2];
      if (luma < 95) {
        dark += 1;
      }
      total += 1;
    }
  }

  return { darkRatio: total === 0 ? 0 : dark / total };
}
