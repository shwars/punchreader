import { CARD_COLUMNS, CARD_ROWS, CellConfidenceGrid, HoleGrid } from "../domain/types";

interface WarpedPreviewProps {
  imageUrl: string;
  grid: HoleGrid;
  confidences: CellConfidenceGrid;
}

export default function WarpedPreview({ imageUrl, grid, confidences }: WarpedPreviewProps) {
  const cells = [];

  for (let row = 0; row < CARD_ROWS; row += 1) {
    for (let column = 0; column < CARD_COLUMNS; column += 1) {
      if (!grid[row][column] && confidences[row][column] >= 0.45) {
        continue;
      }

      cells.push(
        <rect
          className={grid[row][column] ? "hole-cell" : "uncertain-cell"}
          key={`${row}-${column}`}
          x={column + 0.2}
          y={row + 0.18}
          width={0.6}
          height={0.64}
          rx={0.08}
        />
      );
    }
  }

  return (
    <div className="warped-preview">
      <img src={imageUrl} alt="Perspective corrected card" />
      <svg viewBox={`0 0 ${CARD_COLUMNS} ${CARD_ROWS}`} aria-label="Detected punch grid overlay">
        {cells}
      </svg>
    </div>
  );
}
