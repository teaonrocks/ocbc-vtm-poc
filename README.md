## OCBC Ignite Innovation Challenge 2025 – Smart Banking Kiosk (VTM Prototype)

An end-to-end **Virtual Teller Machine (VTM)** prototype built for the **OCBC Ignite Innovation Challenge 2025**.  
This monorepo demonstrates how a branch kiosk could:

- Capture a customer's voice request
- Run on-device speech-to-text (Whisper via `@xenova/transformers` or a local `faster-whisper` service)
- Classify the intent through a local LLM served by Ollama
- Render the appropriate guided banking workflow
- Escalate to a **remote live agent** over WebRTC with screen-share, video, audio, and annotations

Alongside the kiosk, the repo still ships with the vanilla TanStack Start demo routes (reachable from the side drawer) so you can explore framework features.

---

## High‑Level Overview

- **Problem space**: Modernise in-branch banking with a kiosk that handles routine requests autonomously, and hands off gracefully to a human when needed.
- **Design goals**:
  - Run as much AI as possible **locally** (privacy, latency, offline‑friendliness).
  - Provide a **clear, guided UI** for common retail banking journeys (payments, cards, loans).
  - Offer a **seamless escalation path** to a remote agent with context preserved.
- **Outcome**: A working prototype with:
  - Voice → text → intent pipeline
  - On‑device and server‑based ASR options
  - Live Agent ticketing and dashboard
  - WebRTC-based video, audio, screen‑share, and annotation overlay

---

## Portfolio Highlights

- **End‑to‑end architecture**:
  - Frontend kiosk and agent UIs built with **TanStack Start + React 19**.
  - Separate **WebRTC signaling server**, **Live Agent ticket bridge**, and **ASR microservice**.
  - Shared **webrtc-client** package used by both kiosk and agent experiences.
- **Local AI integration**:
  - Browser‑side transcription via `@xenova/transformers` (Whisper small) with WebGPU/WASM fallback.
  - Optional `faster-whisper` FastAPI service (`packages/asr-service`) for lower‑latency transcription.
  - Intent extraction via a **structured JSON prompt** to an Ollama‑hosted `llama3.2:3b` model.
- **Banking workflows**:
  - Zustand store driving a set of **action cards** for common flows (e.g. remittance, card replacement, loan enquiry).
  - State includes balances, transactions, and derived UI state for a kiosk‑like experience.
- **Live Agent experience**:
  - WebRTC session that carries **kiosk camera**, **kiosk screen share**, and **agent video/audio**.
  - **Annotation overlay**: agents can draw over the shared screen via a WebRTC data channel.
  - Separate **Live Agent dashboard** (`packages/liveAgentPOC`) with ticket filters, status updates, and an embedded video console.
- **Demo‑ready configuration**:
  - HTTPS‑ready local dev (mkcert‑friendly).
  - LAN env templates for 2‑machine demos (kiosk + agent).
  - Manual test checklists and troubleshooting notes for hackathon judges.

---

## Monorepo Layout

- `src/**` – Main VTM kiosk + built‑in `/agent` console (TanStack Start app).
- `packages/asr-service` – Python FastAPI service wrapping `faster-whisper`.
- `packages/signaling-server` – Node.js WebSocket/HTTP signaling server for WebRTC.
- `packages/webrtc-client` – Shared WebRTC utilities consumed by kiosk and agent apps.
- `packages/liveAgentPOC` – Standalone Live Agent dashboard + ticket bridge.
- `docs/**` – Detailed ASR setup and LAN environment templates.

The root project is a **pnpm workspace** tying these pieces together.

---

## Tech Stack

- React 19 + Vite + TanStack Router/Start
- Zustand for client state (`src/data/bank-store.ts`)
- Tailwind CSS 4 (via `@tailwindcss/vite`)
- Local AI: `@xenova/transformers` (Whisper transcription)
- Optional ASR microservice: `faster-whisper` via FastAPI (`packages/asr-service`)
- WebRTC (P2P media + data channels) with an Express/`ws` signaling server
- Framer Motion, Lucide icons, shadcn‑compatible styling utilities

---

## Demo Flow (Kiosk + Live Agent)

1. **Customer speaks a request at the kiosk**
   - The dashboard route records audio via the Web MediaRecorder API.
   - Audio is streamed to `useLocalAI().transcribeAudio` and transcribed via Whisper (on‑device or ASR service).
2. **LLM extracts intent**
   - `src/functions/ai-intent.ts` sends the transcript to an Ollama‑hosted `llama3.2:3b` model with a banking‑focused system prompt and `format: 'json'`.
   - A lightweight keyword‑based fallback keeps the flow running even if the LLM is unavailable.
3. **Banking workflow is rendered**
   - `useBankStore` updates current intent and relevant banking data.
   - `ActionCards` in `src/components/Dashboard` render contextual flows (e.g. transfer money, pay a bill, request a new card).
4. **Optional Live Agent escalation**
   - Customer triggers **Live Agent Assist**.
   - The kiosk opens a WebRTC session via the shared signaling server, streams camera + screen, and pushes a ticket to the Live Agent dashboard.
5. **Agent picks up the session**
   - In the dashboard (`packages/liveAgentPOC`), an agent sees the new ticket, clicks **Start Working**, and joins the WebRTC call.
   - The agent can annotate the kiosk’s shared screen in real time over a WebRTC data channel.

---

## Prerequisites

- Node.js 20+ and pnpm 9+
- A browser with WebGPU / WASM SIMD (recent Chrome, Edge, or Chromium; macOS Safari Technical Preview also works)
- Microphone permission
- [Ollama](https://ollama.com/download) running locally with the `llama3.2:3b` model pulled (used for intent extraction)

For the optional ASR and Live Agent components, see the sections below.

---

## Local Setup (Kiosk App)

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

3. **Configure ElevenLabs text-to-speech (optional but recommended)**

   Create or update `.env.local` in the repo root with the credentials you get from [ElevenLabs](https://elevenlabs.io/docs/overview):

   ```text
   ELEVENLABS_API_KEY=sk-...
   ELEVENLABS_DEFAULT_VOICE_ID=<voice-id-from-dashboard>
   ELEVENLABS_MODEL_ID=eleven_turbo_v2_5
   ```

   - `ELEVENLABS_API_KEY` keeps your REST key on the server only—never expose it through `VITE_` vars.
   - `ELEVENLABS_DEFAULT_VOICE_ID` can come from any stock or custom voice you’ve enabled in the ElevenLabs console.
   - `ELEVENLABS_MODEL_ID` accepts any of the published models (e.g., `eleven_turbo_v2_5` for balanced quality/latency or `eleven_flash_v2_5` for faster playback).

   These values are also included in `docs/lan-env.template` so kiosk deployments on a LAN can copy everything in one go.

4. **Run the dev server**

   ```bash
   pnpm dev        # default https://localhost:3000 (self-signed)
   # or expose to another device/kiosk
   pnpm dev --host
   ```

   > On Windows, run `set NODE_NO_HTTP2=1 && pnpm dev --host 0.0.0.0 --port 3000` so Vite serves HTTPS over HTTP/1.

5. Open the site, allow microphone access, and try one of the sample voice commands listed at the bottom of the dashboard (e.g. “Send $1000 to John Doe”).

---

## Scripts

| Script                      | Description                                                  |
| --------------------------- | ------------------------------------------------------------ |
| `pnpm dev`                  | Start Vite + TanStack Start in development mode             |
| `pnpm dev:asr-service`      | Run the FastAPI Whisper microservice on port 8000           |
| `pnpm dev:signaling-server` | Launch the Node/WebSocket signaling service on port 4100    |
| `pnpm dev:stack`            | Fire up signaling, ASR, and the kiosk UI together for demos |
| `pnpm build`                | Production build                                             |
| `pnpm serve`                | Preview the production build                                 |
| `pnpm test`                 | Run Vitest                                                   |
| `pnpm lint`                 | Run ESLint                                                   |
| `pnpm format`               | Run Prettier                                                 |
| `pnpm check`                | Format + lint in one go                                      |

Add new shadcn components with the latest CLI:

```bash
pnpx shadcn@latest add button
```

---

## How It Works (Under the Hood)

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
- WebSocket endpoint: `wss://<host>:4100/ws?sessionId=XXXX&role=vtm|agent`

### Environment variables

| Variable                  | Where                                   | Purpose                                                                                           |
| ------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `SIGNALING_PORT`          | `packages/signaling-server`             | Override the HTTP/WebSocket port (defaults to `4100`).                                            |
| `STUN_SERVERS`            | `packages/signaling-server`             | Comma-separated list of STUN URLs (defaults to Google + Twilio).                                 |
| `TURN_SERVERS`            | `packages/signaling-server`             | Optional comma-separated TURN URLs for tougher NATs.                                              |
| `SIGNALING_TLS_CERT/KEY`  | `packages/signaling-server`             | PEM files for enabling HTTPS/WSS on the signaling server (required when kiosks run over HTTPS).   |
| `VITE_SIGNALING_HTTP_URL` | kiosk + agent UIs (`@ocbc/webrtc-client`) | Base URL the kiosk + agent UIs call for REST endpoints (`https://localhost:4100` by default).     |
| `VITE_SIGNALING_WS_URL`   | kiosk + agent UIs                       | Explicit WebSocket URL if you need something other than `wss://localhost:4100/ws`.                |
| `VITE_LIVE_AGENT_API_URL` | kiosk (`src/lib/live-agent.ts`)        | HTTPS endpoint that receives “Request Live Agent” tickets (`https://localhost:8081/api/ticket`).  |
| `VITE_LIVE_AGENT_WS_URL`  | `packages/liveAgentPOC`, kiosk bridge  | Optional override for the dashboard WebSocket feed; defaults to the same host as the API URL.     |
| `LIVE_AGENT_TLS_CERT/KEY` | `packages/liveAgentPOC/server`         | PEM files for enabling HTTPS/WSS on the ticket bridge (`pnpm --filter liveAgentPOC dev:bridge`).  |

### Live Agent dashboard (`packages/liveAgentPOC`)

Need an operator-facing board with richer ticket context? A dedicated TanStack Start app now ships under `packages/liveAgentPOC`:

1. `pnpm --filter liveAgentPOC dev:bridge` – starts the ticket bridge (`server/websocket-server.js`) on `https://localhost:8081` for HTTPS + secure WebSocket traffic. Set `LIVE_AGENT_TLS_CERT`/`LIVE_AGENT_TLS_KEY` to your mkcert files if they aren’t stored at the project root.
2. `pnpm --filter liveAgentPOC dev` – launches the dashboard UI on `https://localhost:3100`.
   - If HTTPS over HTTP/2 keeps crashing on your platform, run the client-only fallback:
     ```bash
     DISABLE_NITRO=1 pnpm --filter liveAgentPOC dev --host 0.0.0.0 --port 3100
     ```
     This skips Nitro (no server functions / SSR demos) but keeps the Live Agent dashboard fully usable.
3. Ensure the kiosk is pointing at the bridge (`VITE_LIVE_AGENT_API_URL=https://localhost:8081/api/ticket`).
4. Log into the dashboard, watch tickets stream in, and press **Start Working** to auto-join the kiosk’s WebRTC session (camera, mic, and shared screen) via the shared signaling server.

> The built-in `/agent` route inside the kiosk app is still handy for quick smoke tests, but the Live Agent dashboard adds ticket filters, metadata, and the new embedded video console for supervisors.

### Manual test checklist

1. Terminal A: `SIGNALING_TLS_CERT=/absolute/path/to/cert.pem SIGNALING_TLS_KEY=/absolute/path/to/cert-key.pem pnpm dev:signaling-server`
2. Terminal B: `pnpm dev` (or `pnpm dev:stack` to include the ASR service)
3. Browser/device 1 (kiosk): open `/`, scroll to **Live Agent Assist**, click **Request Live Agent**, grant camera + screen permissions.
4. Browser/device 2 (agent): open `/agent`, wait for the new session ID to appear (or paste it), click **Answer**.
5. Verify:
   - Agent sees both the kiosk camera feed and the kiosk screen feed.
   - Audio is flowing both ways.
   - The kiosk displays the agent video and reports connection status.
6. Use **End Session / Hang Up** on either side and confirm both peers drop.

> For hackathon demos on the same Wi‑Fi, STUN-only ICE servers work fine. Add TURN credentials (e.g., Coturn, Twilio ICE, LiveKit Cloud) before showing this on restrictive corporate or LTE networks.

### Two-computer LAN setup

When the kiosk (Computer 1) and the live agent dashboard (Computer 2) run on different machines, point everything at the agent machine’s IP address.

1. **Pick a host (usually the live agent laptop) and note its LAN IP** via `ipconfig`/`ifconfig`.
2. **On the host machine (Computer 2)** start the shared services:

   ```bash
   # Terminal A – WebRTC signaling server
   pnpm dev:signaling-server

   # Terminal B – Ticket bridge (HTTP + WS) used by the Live Agent dashboard
   pnpm --filter liveAgentPOC dev:bridge

   # Terminal C – Live Agent dashboard (Vite dev server)
   pnpm --filter liveAgentPOC dev --host 0.0.0.0 --port 3100
   ```

   > The bridge listens on `http://0.0.0.0:8081` (tickets + WebSocket) and the dashboard exposes `http://HOST_IP:3100`.
   > If your kiosk/agent UIs are running over HTTPS (the default), start both the signaling server and ticket bridge with valid TLS certs so they actually serve `https://` / `wss://` endpoints; otherwise, update the env templates below to use `http://` / `ws://` consistently to avoid mixed-content errors. After changing `.env.local`, stop and re-run all four processes (signaling server, ticket bridge, kiosk UI, agent UI) so they pick up the new URLs.

3. **On the kiosk machine (Computer 1)** create `.env.local` and point it back to the host (copy `docs/lan-env.template` as a starting point):

   ```text
   VITE_SIGNALING_HTTP_URL=https://<HOST_IP>:4100
   VITE_SIGNALING_WS_URL=wss://<HOST_IP>:4100/ws
   VITE_LIVE_AGENT_API_URL=https://<HOST_IP>:8081/api/ticket
   VITE_DISABLE_STUN=1
   ```

   Then run the kiosk with LAN access:

   ```bash
   pnpm dev --host 0.0.0.0 --port 3000
   ```

4. **On the live agent dashboard project (`packages/liveAgentPOC`)** copy `lan-env.template` to `.env.local`, update `<HOST_IP>`, and ensure `VITE_LIVE_AGENT_WS_URL` points to the bridge (`wss://<HOST_IP>:8081`) so the dashboard listens to the right WebSocket feed.

5. **Agent UI**: Either open `http://HOST_IP:3100` (dashboard) or the built-in kiosk route `http://HOST_IP:3000/agent`. Both expect the same `.env.local` entries above so they talk to the host’s signaling server.

6. **Firewall / permissions**: Allow inbound traffic on ports `3000`, `3100`, `4100`, and `8081` on the host machine. All WebRTC peers still negotiate STUN/TURN via the signaling server running on port `4100`.

> `VITE_DISABLE_STUN=1` tells the shared WebRTC client to skip public STUN lookups and rely on host candidates only—perfect for offline LAN demos where Google STUN isn’t reachable.

### WebRTC verification checklist

- In both the kiosk and agent browsers, open DevTools → Network → WS and confirm `wss://<HOST_IP>:4100/ws` (signaling) and `wss://<HOST_IP>:8081` (ticket bridge) stay in the **Open** state; refresh if they still point at `localhost`.
- When starting a Live Agent session, watch DevTools → Console for ICE candidate errors (usually indicate permissions or mixed protocols).
- After both peers join, ensure the kiosk shows agent camera/screen tiles and the agent dashboard lists **Camera**, **Screen**, and **Audio** tracks under the session details.

### Annotation overlay

- Agents connected via `/agent` (or the standalone dashboard) can draw arrows and circles directly on top of the kiosk’s shared screen.  
- These strokes ride on a WebRTC data channel labeled `annotations`, so they stay in lockstep with the media streams.  
- The kiosk UI includes a **“Show agent annotations”** toggle in the Live Agent panel, and shapes auto-expire after ~20 seconds to avoid clutter.

---

## ASR Microservice (`packages/asr-service`)

For environments where browser‑side Whisper is not ideal, this repo includes a `faster-whisper` service:

- **Stack**: Python 3.10+, FastAPI, `faster-whisper`, `uvicorn`.
- **Features**:
  - Configurable model size (`FWHISPER_MODEL`, default `distil-large-v3`).
  - Device selection (`cpu`, `cuda`, `auto`) and quantisation (`int8`, `float16`, etc.).
  - Integration test script to verify transcription end‑to‑end.

Basic setup (see `packages/asr-service/README.md` and `docs/asr-server.md` for full details):

```bash
cd packages/asr-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp env.example .env   # configure model/device if needed
uvicorn main:app --reload --port 8000
```

The kiosk app can then be wired to call this service for transcription instead of running Whisper in the browser.

---

## Project Structure Highlights

- `src/routes/index.tsx` – Main kiosk experience
- `src/routes/__root.tsx` – Global document shell + header + TanStack devtools
- `src/routes/agent.tsx` – Agent console that lists escalations and answers WebRTC calls
- `packages/liveAgentPOC` – Standalone Live Agent dashboard + ticket bridge
- `packages/webrtc-client` – Shared signaling helpers consumed by both kiosk and dashboard apps
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

---

## Acknowledgements & Disclaimer

- Built as a **time-boxed prototype** for the **OCBC Ignite Innovation Challenge 2025**.
- This repository is shared purely for **portfolio and learning purposes** and is **not an official OCBC product**.
- All trademarks and logos referenced here belong to their respective owners.

