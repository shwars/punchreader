import type { PointerEvent as ReactPointerEvent } from "react";
import { Point } from "../domain/types";

interface CropPreviewProps {
  imageUrl: string;
  corners: Point[] | null;
  onCornersChange: (corners: Point[]) => void;
  naturalSize: { width: number; height: number } | null;
  onNaturalSize: (size: { width: number; height: number }) => void;
}

const LABELS = ["TL", "TR", "BR", "BL"];

export default function CropPreview({
  imageUrl,
  corners,
  onCornersChange,
  naturalSize,
  onNaturalSize
}: CropPreviewProps) {
  function updateCorner(index: number, event: ReactPointerEvent<HTMLButtonElement>): void {
    if (!naturalSize || !corners) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const size = naturalSize;
    const target = event.currentTarget.parentElement;
    if (!target) {
      return;
    }

    const rect = target.getBoundingClientRect();
    const next = [...corners];
    const previousBodyTouchAction = document.body.style.touchAction;
    document.body.style.touchAction = "none";

    function move(pointerEvent: PointerEvent): void {
      pointerEvent.preventDefault();
      const x = ((pointerEvent.clientX - rect.left) / rect.width) * size.width;
      const y = ((pointerEvent.clientY - rect.top) / rect.height) * size.height;
      next[index] = {
        x: Math.max(0, Math.min(size.width, x)),
        y: Math.max(0, Math.min(size.height, y))
      };
      onCornersChange([...next]);
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    move(event.nativeEvent);

    const stop = (): void => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      document.body.style.touchAction = previousBodyTouchAction;
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  }

  return (
    <div className="crop-preview">
      <img
        src={imageUrl}
        alt="Selected punch card"
        onLoad={(event) =>
          onNaturalSize({
            width: event.currentTarget.naturalWidth,
            height: event.currentTarget.naturalHeight
          })
        }
      />
      {corners && naturalSize ? (
        <>
          <svg className="crop-lines" viewBox={`0 0 ${naturalSize.width} ${naturalSize.height}`} aria-hidden="true">
            <polygon points={corners.map((point) => `${point.x},${point.y}`).join(" ")} />
          </svg>
          {corners.map((point, index) => (
            <button
              className="corner-handle"
              key={LABELS[index]}
              onPointerDown={(event) => updateCorner(index, event)}
              style={{
                left: `${(point.x / naturalSize.width) * 100}%`,
                top: `${(point.y / naturalSize.height) * 100}%`
              }}
              type="button"
              aria-label={`Move ${LABELS[index]} crop corner`}
            >
              {LABELS[index]}
            </button>
          ))}
        </>
      ) : null}
    </div>
  );
}
