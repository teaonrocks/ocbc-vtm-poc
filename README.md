# Smart Banking Kiosk (VTM POC)

This project is a TanStack Start proof‑of‑concept that simulates a branch kiosk capable of:

- Capturing a customer's voice request
- Running on-device speech-to-text (Whisper via `@xenova/transformers`)
- Classifying the intent through a local LLM served by Ollama
- Showing the appropriate banking workflow

Alongside the kiosk, the repo still ships with the vanilla TanStack Start demo routes (reachable from the side drawer) so you can explore framework features.

---

## Tech Stack

- React 19 + Vite + TanStack Router/Start
- Zustand for client state (`src/data/bank-store.ts`)
- Tailwind CSS 4 (via `@tailwindcss/vite`)
- Local AI: `@xenova/transformers` (Whisper transcription)
- Framer Motion, Lucide icons, shadcn-compatible styling utilities

---

## Prerequisites

- Node.js 20+ and pnpm 9+
- A browser with WebGPU / WASM SIMD (recent Chrome, Edge, or Chromium; macOS Safari Technical Preview also works)
- Microphone permission
- [Ollama](https://ollama.com/download) running locally with the `llama3.2:3b` model pulled (used for intent extraction)

---

## Local Setup

1. **Install dependencies**

   ```bash
   pnpm install
   ```

2. **Prepare the LLM backend**

   ```bash
   # Only once
   ollama pull llama3.2:3b

   # In a separate terminal
   ollama serve
   ```

   The app calls `http://127.0.0.1:11434/api/generate`. Change `OLLAMA_URL` in `src/functions/ai-intent.ts` if your Ollama host differs.

3. **Run the dev server**

   ```bash
   pnpm dev        # default http://localhost:3000
   # or expose to another device/kiosk
   pnpm dev --host
   ```

4. Open the site, allow microphone access, and try one of the sample voice commands listed at the bottom of the dashboard (e.g. “Send $1000 to John Doe”).

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

### 4. Additional demos

- The header drawer links to `/demo/start/**` routes that mirror the stock TanStack Start examples. They’re untouched and safe to delete once you no longer need them.

---

## Project Structure Highlights

- `src/routes/index.tsx` – Main kiosk experience
- `src/routes/__root.tsx` – Global document shell + header + TanStack devtools
- `src/components/Dashboard/*` – Audio visualizer and intent-specific cards
- `src/hooks/useLocalAI.ts` – Shared hook for on-device transcription
- `src/functions/ai-intent.ts` – Server function that brokers Ollama requests

---

## Troubleshooting

- **Whisper never loads**: ensure your browser supports WebGPU/WASM SIMD and that you’re not blocking module workers. Watch the console for `Failed to load Whisper` errors.
- **LLM errors** (`Ollama API error`): verify `ollama serve` is running locally and the `llama3.2:3b` model exists.
- **Microphone denied**: reset permissions in your browser settings; the kiosk relies on live audio input.

---

## Learning Resources

- [TanStack Start Docs](https://tanstack.com/start/latest)
- [Xenova Transformers docs](https://xenova.github.io/transformers.js/)
- [Ollama documentation](https://github.com/ollama/ollama)

Happy hacking!
