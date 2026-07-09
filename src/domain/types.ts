export const CARD_COLUMNS = 80;
export const CARD_ROWS = 12;
export const ROW_LABELS = ["12", "11", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

export type RowLabel = (typeof ROW_LABELS)[number];
export type HoleGrid = boolean[][];

export interface DecodeUnknown {
  index: number;
  pattern: string;
  reason: string;
}

export interface DecodeResult {
  text: string;
  confidence: number;
  unknowns: DecodeUnknown[];
  warnings: string[];
}

export interface EncodingProfile {
  id: string;
  label: string;
  layout: "row-major" | "column-major";
  decode: (grid: HoleGrid) => DecodeResult;
}

export interface DeckLine {
  id: string;
  text: string;
  encodingId: string;
  createdAt: string;
  confidence: number;
}

export interface Point {
  x: number;
  y: number;
}

export type CellConfidenceGrid = number[][];

export interface RecognitionOutput {
  grid: HoleGrid;
  confidences: CellConfidenceGrid;
  corners: Point[];
  warpedDataUrl: string;
  warnings: string[];
}

export function createEmptyGrid(): HoleGrid {
  return Array.from({ length: CARD_ROWS }, () => Array.from({ length: CARD_COLUMNS }, () => false));
}
