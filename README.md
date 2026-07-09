# PunchReader

Offline mobile web app for reading old 80-column computer punch cards from phone photos.

## Features

- React + Vite + TypeScript PWA that can be installed on iPhone/Android.
- Local-only image processing; photos are not uploaded.
- Camera/file capture with the bundled `sample/photo.jpg` as a fixture.
- Automatic card crop with draggable four-corner correction handles.
- Perspective-normalized 80 x 12 punch grid with detected/uncertain-cell overlay.
- Selectable decoders:
  - GOST/UPP 8-bit with odd parity
  - GOST/UPP 7-bit
  - IBM Hollerith 026
  - IBM Hollerith 029
- Editable recognized line before appending to a persistent local deck.
- Export accumulated text as `.txt` and diagnostics as `.json`.

## Development

```bash
npm install
npm run dev
```

Open the dev server URL from a phone on the same network to test camera capture.

## Verification

```bash
npm test
npm run build
```

The production build precaches the OpenCV.js chunk for offline recognition. That chunk is large, so the PWA cache limit is intentionally raised in `vite.config.ts`.

## GitHub Pages

The repository includes a GitHub Actions workflow at `.github/workflows/deploy-pages.yml`.

1. Push to `main`.
2. In GitHub, open Settings -> Pages.
3. Set Source to GitHub Actions.

The workflow runs tests, builds `dist`, and deploys it to Pages. It sets `BASE_PATH` automatically:

- `/` for a user or organization site such as `username.github.io`
- `/<repo-name>/` for a project site such as `username.github.io/punchreader/`

For a local Pages-style build, run:

```bash
BASE_PATH=/punchreader/ npm run build
```

## Recognition Notes

The recognizer treats holes as authoritative and does not OCR printed text. The first version favors review and correction over fully automatic archival accuracy, especially for worn cards, uneven lighting, and cards whose printed guide text is dark enough to be mistaken for holes.
