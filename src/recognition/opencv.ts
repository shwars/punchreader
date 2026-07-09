import { Point } from "../domain/types";
import { orderCorners } from "./geometry";

let cvPromise: Promise<any | null> | null = null;

export async function findCardCornersWithOpenCv(canvas: HTMLCanvasElement): Promise<Point[] | null> {
  const cv = await loadOpenCv();
  if (!cv) {
    return null;
  }

  let src;
  let gray;
  let blurred;
  let edges;
  let contours;
  let hierarchy;

  try {
    src = cv.imread(canvas);
    gray = new cv.Mat();
    blurred = new cv.Mat();
    edges = new cv.Mat();
    contours = new cv.MatVector();
    hierarchy = new cv.Mat();

    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
    cv.Canny(blurred, edges, 45, 140);
    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    let best: Point[] | null = null;
    let bestArea = 0;

    for (let i = 0; i < contours.size(); i += 1) {
      const contour = contours.get(i);
      const perimeter = cv.arcLength(contour, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(contour, approx, 0.03 * perimeter, true);
      const area = Math.abs(cv.contourArea(contour));

      if (approx.rows === 4 && area > bestArea && area > canvas.width * canvas.height * 0.08) {
        const points: Point[] = [];
        for (let row = 0; row < 4; row += 1) {
          points.push({
            x: approx.data32S[row * 2],
            y: approx.data32S[row * 2 + 1]
          });
        }
        best = orderCorners(points);
        bestArea = area;
      }

      approx.delete();
      contour.delete();
    }

    return best;
  } catch {
    return null;
  } finally {
    src?.delete();
    gray?.delete();
    blurred?.delete();
    edges?.delete();
    contours?.delete();
    hierarchy?.delete();
  }
}

async function loadOpenCv(): Promise<any | null> {
  if (!cvPromise) {
    cvPromise = import("@techstark/opencv-js")
      .then(async (module) => {
        const cv = (module as any).default ?? module;
        if (cv.Mat) {
          return cv;
        }
        await new Promise<void>((resolve) => {
          cv.onRuntimeInitialized = () => resolve();
          setTimeout(resolve, 2500);
        });
        return cv.Mat ? cv : null;
      })
      .catch(() => null);
  }

  return cvPromise;
}
