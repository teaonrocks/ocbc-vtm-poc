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

| Script                      | Description                                                 |
| --------------------------- | ----------------------------------------------------------- |
| `pnpm dev`                  | Start Vite + TanStack Start in development mode             |
| `pnpm dev:asr-service`      | Run the FastAPI Whisper microservice on port 8000           |
| `pnpm dev:signaling-server` | Launch the Node/WebSocket signaling service on port 4100    |
| `pnpm dev:stack`            | Fire up signaling, ASR, and the kiosk UI together for demos |
| `pnpm build`                | Production build                                            |
| `pnpm serve`                | Preview the production build                                |
| `pnpm test`                 | Run Vitest                                                  |
| `pnpm lint`                 | Run ESLint                                                  |
| `pnpm format`               | Run Prettier                                                |
| `pnpm check`                | Format + lint in one go                                     |

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

## Live Agent Escalation (WebRTC)

When a kiosk customer needs a human, the dashboard’s **Live Agent Assist** panel spins up a peer-to-peer WebRTC call that streams:

- The kiosk’s camera + microphone feed
- A full-screen capture of the kiosk UI
- The remote agent’s camera/mic (optional but supported)

### Signaling service

- Package: `packages/signaling-server`
- Stack: Express + `ws`, in-memory room registry, STUN/TURN aware
- Default port: `4100`
- Health check: `GET /healthz`
- WebSocket endpoint: `ws://<host>:4100/ws?sessionId=XXXX&role=vtm|agent`

### Environment variables

| Variable                  | Where                          | Purpose                                                                                      |
| ------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------- |
| `SIGNALING_PORT`          | `packages/signaling-server`    | Override the HTTP/WebSocket port (defaults to `4100`).                                       |
| `STUN_SERVERS`            | `packages/signaling-server`    | Comma-separated list of STUN URLs (defaults to Google + Twilio).                             |
| `TURN_SERVERS`            | `packages/signaling-server`    | Optional comma-separated TURN URLs for tougher NATs.                                         |
| `VITE_SIGNALING_HTTP_URL` | frontend (`src/lib/webrtc.ts`) | Base URL the kiosk + agent UIs call for REST endpoints (`http://localhost:4100` by default). |
| `VITE_SIGNALING_WS_URL`   | frontend                       | Explicit WebSocket URL if you need something other than `ws://localhost:4100/ws`.            |

### Manual test checklist

1. Terminal A: `pnpm dev:signaling-server`
2. Terminal B: `pnpm dev` (or `pnpm dev:stack` to include the ASR service)
3. Browser/device 1 (kiosk): open `/`, scroll to **Live Agent Assist**, click **Request Live Agent**, grant camera + screen permissions.
4. Browser/device 2 (agent): open `/agent`, wait for the new session ID to appear (or paste it), click **Answer**.
5. Verify:
   - Agent sees both the kiosk camera feed and the kiosk screen feed.
   - Audio is flowing both ways.
   - The kiosk displays the agent video and reports connection status.
6. Use **End Session / Hang Up** on either side and confirm both peers drop.

> For hackathon demos on the same Wi‑Fi, STUN-only ICE servers work fine. Add TURN credentials (e.g., Coturn, Twilio ICE, LiveKit Cloud) before showing this on restrictive corporate or LTE networks.

---

## Project Structure Highlights

- `src/routes/index.tsx` – Main kiosk experience
- `src/routes/__root.tsx` – Global document shell + header + TanStack devtools
- `src/routes/agent.tsx` – Agent console that lists escalations and answers WebRTC calls
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
