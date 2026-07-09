import { useMemo, useRef, useState } from "react";
import CropPreview from "./components/CropPreview";
import WarpedPreview from "./components/WarpedPreview";
import { DeckLine, Point, RecognitionOutput } from "./domain/types";
import { ENCODING_PROFILES, getProfile, scoreProfiles } from "./domain/encodings";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { loadBitmapFromFile, loadBitmapFromUrl, recognizePunchCard } from "./recognition/recognizer";
import sampleCardUrl from "../sample/photo.jpg?url";

const DEFAULT_ENCODING = "gost-upp-8bit-parity";

export default function App() {
  const [deck, setDeck] = useLocalStorage<DeckLine[]>("punchreader.deck", []);
  const [encodingId, setEncodingId] = useState(DEFAULT_ENCODING);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [corners, setCorners] = useState<Point[] | null>(null);
  const [rotation, setRotation] = useState(0);
  const [recognition, setRecognition] = useState<RecognitionOutput | null>(null);
  const [reviewText, setReviewText] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selectedProfile = getProfile(encodingId);
  const decodeResult = useMemo(() => {
    if (!recognition) {
      return null;
    }
    return selectedProfile.decode(recognition.grid);
  }, [recognition, selectedProfile]);
  const profileScores = useMemo(() => (recognition ? scoreProfiles(recognition.grid) : []), [recognition]);
  const bestProfile = profileScores[0]?.profile;

  async function handleFile(file: File): Promise<void> {
    setError(null);
    setRecognition(null);
    setCorners(null);
    setReviewText("");
    setNaturalSize(null);

    const nextUrl = URL.createObjectURL(file);
    setImageUrl((current) => {
      if (current?.startsWith("blob:")) {
        URL.revokeObjectURL(current);
      }
      return nextUrl;
    });
    setBitmap(await loadBitmapFromFile(file));
  }

  async function loadSample(): Promise<void> {
    setError(null);
    setRecognition(null);
    setCorners(null);
    setReviewText("");
    setNaturalSize(null);
    setImageUrl(sampleCardUrl);
    setBitmap(await loadBitmapFromUrl(sampleCardUrl));
  }

  async function analyze(): Promise<void> {
    if (!bitmap) {
      setError("Choose or take a card photo first.");
      return;
    }

    setIsBusy(true);
    setError(null);

    try {
      const output = await recognizePunchCard(bitmap, { corners: corners ?? undefined, rotation });
      setRecognition(output);
      setCorners(output.corners);
      const decoded = selectedProfile.decode(output.grid);
      setReviewText(decoded.text);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Recognition failed.");
    } finally {
      setIsBusy(false);
    }
  }

  function acceptLine(): void {
    if (!reviewText.trim() || !decodeResult) {
      return;
    }

    const line: DeckLine = {
      id: crypto.randomUUID(),
      text: reviewText,
      encodingId,
      createdAt: new Date().toISOString(),
      confidence: decodeResult.confidence
    };
    setDeck((current) => [line, ...current]);
    setReviewText("");
  }

  function updateDeckLine(id: string, text: string): void {
    setDeck((current) => current.map((line) => (line.id === id ? { ...line, text } : line)));
  }

  function deleteDeckLine(id: string): void {
    setDeck((current) => current.filter((line) => line.id !== id));
  }

  function download(filename: string, contents: string, type: string): void {
    const blob = new Blob([contents], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function diagnosticJson(): string {
    return JSON.stringify(
      {
        encodingId,
        decodeResult,
        recognition: recognition
          ? {
              corners: recognition.corners,
              warnings: recognition.warnings,
              grid: recognition.grid,
              confidences: recognition.confidences
            }
          : null,
        deck
      },
      null,
      2
    );
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Offline PWA</p>
          <h1>PunchReader</h1>
          <p>Take a photo of an old 80-column punch card, inspect the detected holes, decode one line, and keep a deck locally.</p>
        </div>
        <button type="button" className="secondary" onClick={loadSample}>
          Use sample card
        </button>
      </header>

      <section className="capture-band" aria-label="Capture and recognition">
        <div className="toolbar">
          <button type="button" onClick={() => inputRef.current?.click()}>
            Take or choose photo
          </button>
          <button type="button" className="secondary" onClick={() => setRotation((value) => (value + 90) % 360)}>
            Rotate {rotation}°
          </button>
          <button type="button" onClick={analyze} disabled={!bitmap || isBusy}>
            {isBusy ? "Recognizing..." : "Recognize"}
          </button>
          <input
            ref={inputRef}
            className="visually-hidden"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) {
                void handleFile(file);
              }
            }}
          />
        </div>

        <label className="field">
          <span>Encoding</span>
          <select
            value={encodingId}
            onChange={(event) => {
              const next = event.target.value;
              setEncodingId(next);
              if (recognition) {
                setReviewText(getProfile(next).decode(recognition.grid).text);
              }
            }}
          >
            {ENCODING_PROFILES.map((profile) => (
              <option value={profile.id} key={profile.id}>
                {profile.label}
              </option>
            ))}
          </select>
        </label>

        {error ? <p className="message error">{error}</p> : null}
        {bestProfile && bestProfile.id !== encodingId ? (
          <p className="message">
            Best auto-score is {bestProfile.label}. The selected profile is still used for the editable line.
          </p>
        ) : null}

        {imageUrl ? (
          <CropPreview
            imageUrl={imageUrl}
            corners={corners}
            onCornersChange={setCorners}
            naturalSize={naturalSize}
            onNaturalSize={setNaturalSize}
          />
        ) : (
          <div className="empty-state">Choose a card photo or load the bundled sample to start.</div>
        )}
      </section>

      {recognition ? (
        <section className="review-grid" aria-label="Recognition review">
          <div>
            <h2>Detected Grid</h2>
            <WarpedPreview
              imageUrl={recognition.warpedDataUrl}
              grid={recognition.grid}
              confidences={recognition.confidences}
            />
            {[...recognition.warnings, ...(decodeResult?.warnings ?? [])].map((warning) => (
              <p className="message" key={warning}>
                {warning}
              </p>
            ))}
          </div>

          <div className="review-panel">
            <h2>Recognized Line</h2>
            <div className="confidence">
              Confidence <strong>{Math.round((decodeResult?.confidence ?? 0) * 100)}%</strong>
            </div>
            <textarea
              value={reviewText}
              onChange={(event) => setReviewText(event.currentTarget.value)}
              rows={6}
              spellCheck={false}
            />
            {decodeResult?.unknowns.length ? (
              <p className="message error">{decodeResult.unknowns.length} unknown pattern(s) are marked with ?.</p>
            ) : null}
            <button type="button" onClick={acceptLine} disabled={!reviewText.trim()}>
              Add to deck
            </button>
          </div>
        </section>
      ) : null}

      <section className="deck-section" aria-label="Accumulated deck">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Local deck</p>
            <h2>{deck.length} accepted line{deck.length === 1 ? "" : "s"}</h2>
          </div>
          <div className="toolbar tight">
            <button
              type="button"
              className="secondary"
              disabled={deck.length === 0}
              onClick={() => void navigator.clipboard.writeText(deck.map((line) => line.text).join("\n"))}
            >
              Copy all
            </button>
            <button
              type="button"
              className="secondary"
              disabled={deck.length === 0}
              onClick={() => download("punchreader-deck.txt", deck.map((line) => line.text).join("\n"), "text/plain")}
            >
              TXT
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => download("punchreader-diagnostics.json", diagnosticJson(), "application/json")}
            >
              JSON
            </button>
            <button type="button" className="danger" disabled={deck.length === 0} onClick={() => setDeck([])}>
              Clear
            </button>
          </div>
        </div>

        {deck.length === 0 ? (
          <div className="empty-state">Accepted lines will stay here on this device until you clear them.</div>
        ) : (
          <ol className="deck-list">
            {deck.map((line) => (
              <li key={line.id}>
                <textarea value={line.text} rows={2} onChange={(event) => updateDeckLine(line.id, event.currentTarget.value)} />
                <div className="deck-meta">
                  <span>{getProfile(line.encodingId).label}</span>
                  <span>{Math.round(line.confidence * 100)}%</span>
                  <button type="button" className="text-button" onClick={() => deleteDeckLine(line.id)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
