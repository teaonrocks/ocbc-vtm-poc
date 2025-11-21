# Smart Banking Kiosk (VTM POC)

This project is a TanStack Start proof‑of‑concept that simulates a branch kiosk capable of:

- Capturing a customer's voice request
- Running on-device speech-to-text (Whisper via `@xenova/transformers`)
- Classifying the intent through a local LLM served by Ollama
- Showing the appropriate banking workflow
- Requiring face verification for high-value remittances

Alongside the kiosk, the repo still ships with the vanilla TanStack Start demo routes (reachable from the side drawer) so you can explore framework features.

---

## Tech Stack

- React 19 + Vite + TanStack Router/Start
- Zustand for client state (`src/data/bank-store.ts`)
- Tailwind CSS 4 (via `@tailwindcss/vite`)
- Local AI: `@xenova/transformers` (Whisper transcription) + `@vladmandic/face-api`
- Framer Motion, Lucide icons, shadcn-compatible styling utilities

---

## Prerequisites

- Node.js 20+ and pnpm 9+
- A browser with WebGPU / WASM SIMD (recent Chrome, Edge, or Chromium; macOS Safari Technical Preview also works)
- Microphone & camera permissions
- [Ollama](https://ollama.com/download) running locally with the `llama3.2:3b` model pulled (used for intent extraction)

---

## Local Setup

1. **Install dependencies**

   ```bash
   pnpm install
   ```

2. **Download face-recognition models** (once, or whenever you clear `public/models`)

   ```bash
   node scripts/download-models.js
   ```

   The assets are stored under `public/models` so they can be fetched by the browser.

3. **Prepare the LLM backend**

   ```bash
   # Only once
   ollama pull llama3.2:3b

   # In a separate terminal
   ollama serve
   ```

   The app calls `http://127.0.0.1:11434/api/generate`. Change `OLLAMA_URL` in `src/functions/ai-intent.ts` if your Ollama host differs.

4. **Run the dev server**

   ```bash
   pnpm dev        # default http://localhost:3000
   # or expose to another device/kiosk
   pnpm dev --host
   ```

5. Open the site, allow microphone + camera access, and try one of the sample voice commands listed at the bottom of the dashboard (e.g. “Send $1000 to John Doe”).

---

## Scripts

| Script        | Description                                     |
| ------------- | ----------------------------------------------- |
| `pnpm dev`    | Start Vite + TanStack Start in development mode |
| `pnpm build`  | Production build                                |
| `pnpm serve`  | Preview the production build                    |
| `pnpm test`   | Run Vitest                                      |
| `pnpm lint`   | Run ESLint                                      |
| `pnpm format` | Run Prettier                                    |
| `pnpm check`  | Format + lint in one go                         |

Add new shadcn components with the latest CLI:

```bash
pnpx shadcn@latest add button
```

---

## How It Works

### 1. Voice capture & transcription (`src/routes/index.tsx` + `useLocalAI`)

- The dashboard route handles media recording via the Web MediaRecorder API.
- Audio chunks are passed to `useLocalAI().transcribeAudio`, which lazily loads `@xenova/transformers` and executes the `Xenova/whisper-small` model in the browser (preferring WebGPU, falling back to WASM).
- Detected language codes update the Zustand store so UI badges stay in sync.

### 2. Intent analysis (`src/functions/ai-intent.ts`)

- A TanStack Start server function posts the user text to Ollama with a banking-specific system prompt and `format: 'json'`.
- On failure, a lightweight keyword parser provides a fallback intent to keep demos flowing.

### 3. State & workflow rendering (`src/data/bank-store.ts`, `src/components/Dashboard`)

- `useBankStore` maintains balance, transactions, recording status, and the current action card.
- `ActionCards` renders contextual flows for each intent (remittance, loan, card app, etc.) and writes back to the store (e.g., `addTransaction`).
- High-value remittances (> $5k) toggle `needsFaceVerification`, which pops the biometric modal.

### 4. Face verification (`src/components/Dashboard/FaceVerification.tsx`)

- When triggered, the modal streams camera input and repeatedly calls `useLocalAI().verifyFace`, which wraps `@vladmandic/face-api`.
- Model files are served from `public/models`. Verification currently checks for a confident face detection as a stand-in for a production matcher.

### 5. Additional demos

- The header drawer links to `/demo/start/**` routes that mirror the stock TanStack Start examples. They’re untouched and safe to delete once you no longer need them.

---

## Project Structure Highlights

- `src/routes/index.tsx` – Main kiosk experience
- `src/routes/__root.tsx` – Global document shell + header + TanStack devtools
- `src/components/Dashboard/*` – Audio visualizer, face-verification modal, and intent-specific cards
- `src/hooks/useLocalAI.ts` – Shared hook for on-device transcription + vision
- `src/functions/ai-intent.ts` – Server function that brokers Ollama requests
- `scripts/download-models.js` – Helper to fetch `face-api` model weights

---

## Troubleshooting

- **Whisper never loads**: ensure your browser supports WebGPU/WASM SIMD and that you’re not blocking module workers. Watch the console for `Failed to load Whisper` errors.
- **Face verification stuck on “Loading models”**: confirm the contents of `public/models` and rerun `node scripts/download-models.js` if needed.
- **LLM errors** (`Ollama API error`): verify `ollama serve` is running locally and the `llama3.2:3b` model exists.
- **Microphone/Camera denied**: reset permissions in your browser settings; the kiosk relies on both streams.

---

## Learning Resources

- [TanStack Start Docs](https://tanstack.com/start/latest)
- [Xenova Transformers docs](https://xenova.github.io/transformers.js/)
- [face-api.js guide](https://github.com/vladmandic/face-api)
- [Ollama documentation](https://github.com/ollama/ollama)

Happy hacking!
