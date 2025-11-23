# VTM to Live Agent Integration Setup

## Current Setup

- **VTM Application (Computer 1)**: `pnpm dev --host 0.0.0.0 --port 3000`
- **Live Agent Dashboard (Computer 2)**: `pnpm --filter liveAgentPOC dev --host 0.0.0.0 --port 3100`
- **Ticket/WebSocket Bridge**: `pnpm --filter liveAgentPOC dev:bridge` on `https://localhost:8081`
- **WebRTC Signaling Server**: `pnpm dev:signaling-server` on `https://localhost:4100`

## Architecture

```
VTM (Port 3000, Computer 1)
      ↓  HTTP POST /api/ticket + WebRTC session metadata
Ticket Bridge (Port 8081, Computer 2)
      ↓  WebSocket broadcast
Live Agent Dashboard (Port 3100, Computer 2)
      ↕
WebRTC Signaling Server (Port 4100) — shared by kiosk + agent peers
```

## Setup Steps

### 1. Start the ticket/WebSocket bridge

```bash
pnpm --filter liveAgentPOC dev:bridge
```

> Set `LIVE_AGENT_TLS_CERT` and `LIVE_AGENT_TLS_KEY` (pointing to your mkcert PEM files) before running the command above so the bridge serves HTTPS + WSS.

You should see:
```
============================================================
🚀 Live Agent Server Started
============================================================
📡 WebSocket server: wss://localhost:8081
🌐 HTTPS API server: https://localhost:8081
📮 VTM endpoint: https://localhost:8081/api/ticket
============================================================
Waiting for connections...
```

> This server listens on all interfaces so kiosks on the LAN can call it directly.

### 2. Start the Live Agent Dashboard

```bash
pnpm --filter liveAgentPOC dev --host 0.0.0.0 --port 3100
```

> Tip: run `NODE_NO_HTTP2=1 pnpm --filter liveAgentPOC dev --host 0.0.0.0 --port 3100` on Windows to prevent Node from forcing HTTP/2.

**Client-only fallback (no Nitro):**
```bash
DISABLE_NITRO=1 pnpm --filter liveAgentPOC dev --host 0.0.0.0 --port 3100
```
> This skips Nitro/server functions so SSR demos won’t work, but the Live Agent dashboard still loads for troubleshooting.

Dashboard will be at: `https://<HOST_IP>:3100`

**Check browser console** - you should see:
```
🔌 Attempting to connect to WebSocket server...
✅ WebSocket connected to Live Agent server
```

### 3. Integrate with Your VTM (Port 3000)

Point the kiosk at the bridge host by adding these entries to `.env.local` on Computer 1 (use `docs/lan-env.template` from the repo root as a starter file and update `<HOST_IP>`):

```
VITE_LIVE_AGENT_API_URL=https://<HOST_IP>:8081/api/ticket
VITE_LIVE_AGENT_WS_URL=wss://<HOST_IP>:8081
VITE_SIGNALING_HTTP_URL=https://<HOST_IP>:4100
VITE_SIGNALING_WS_URL=wss://<HOST_IP>:4100/ws
VITE_DISABLE_STUN=1
```

> For the Live Agent dashboard project itself, copy `packages/liveAgentPOC/lan-env.template` to `.env.local` on the host machine so the dashboard’s WebSocket + signaling URLs target `https://<HOST_IP>:4100` and `https://<HOST_IP>:8081`.
> After editing either `.env.local`, restart `pnpm dev:signaling-server`, `pnpm --filter liveAgentPOC dev:bridge`, `pnpm dev`, and `pnpm --filter liveAgentPOC dev --host 0.0.0.0 --port 3100` so all processes pick up the new hosts.
> Set `VITE_DISABLE_STUN=1` whenever the kiosks are on the same LAN without outbound DNS/Internet access—this keeps the browser from hitting public STUN servers and relies on host-only ICE candidates.

If you need a plain JS snippet instead of the built-in panel, add this code to your VTM application:

```javascript
// Add to your VTM application
async function requestLiveAgent(issueDetails) {
  const ticket = {
    id: crypto.randomUUID(),
    atmId: 'VTM-001',
    timestamp: new Date().toISOString(),
    status: 'pending',
    customerName: issueDetails.customerName || '',
    issueType: issueDetails.issueType || 'Customer Request',
    description: issueDetails.description || 'Customer requested assistance',
    priority: issueDetails.priority || 'high'
  }

  const endpoint =
    window?.LIVE_AGENT_ENDPOINT ?? 'https://localhost:8081/api/ticket'

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ticket)
  })

  const result = await response.json()
  return { success: response.ok, ticketId: ticket.id }
}

// Hook up to your "Live Agent" button
document.getElementById('liveAgentButton').addEventListener('click', async () => {
  const confirmed = confirm('Would you like to connect with a live agent?')
  
  if (confirmed) {
    const result = await requestLiveAgent({
      customerName: 'Customer Name', // Get from your app
      issueType: 'Customer Request',
      description: 'Customer needs assistance',
      priority: 'high'
    })
    
    if (result.success) {
      alert('✅ Live agent has been notified!')
    } else {
      alert('❌ Failed to connect. Please try again.')
    }
  }
})
```

## Testing the Integration

> Replace `localhost` with the host machine IP address when the kiosk runs on another computer.

### Method 1: Use the Test Simulator

1. Open `atm-test-simulator.html` in your browser
2. Fill in the form
3. Click "🆘 Request Live Agent"
4. Check the Live Agent Dashboard - ticket should appear instantly!

### Method 2: Test from Browser Console

Open browser console and run:

```javascript
fetch('https://<HOST_IP>:8081/api/ticket', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: crypto.randomUUID(),
    atmId: 'VTM-TEST',
    timestamp: new Date().toISOString(),
    status: 'pending',
    customerName: 'Test User',
    issueType: 'Test Issue',
    description: 'Testing from console',
    priority: 'high'
  })
}).then(r => r.json()).then(console.log)
```

### Method 3: Test from Terminal

```bash
curl -X POST https://<HOST_IP>:8081/api/ticket \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-123",
    "atmId": "VTM-001",
    "timestamp": "2025-11-21T10:30:00.000Z",
    "status": "pending",
    "customerName": "Test User",
    "issueType": "Card Stuck",
    "description": "Test ticket",
    "priority": "high"
  }'
```

## Verification Checklist

### Server Side
- [ ] WebSocket server is running on port 8081
- [ ] Server shows "Waiting for connections..."
- [ ] No error messages in server console

### Live Agent Dashboard
- [ ] Dashboard is running on port 3000
- [ ] Browser console shows "✅ WebSocket connected to Live Agent server"
- [ ] Connection indicator shows "Connected" (green)
- [ ] DevTools → Network → WS lists `wss://<HOST_IP>:8081` (ticket bridge) and `wss://<HOST_IP>:4100/ws` (signaling) as **open**

### VTM Side
- [ ] VTM application is running on port 3000 (or the port you chose)
- [ ] "Live Agent" button is visible
- [ ] Code is integrated to call `requestLiveAgent()`
- [ ] Kiosk DevTools → Network → WS confirms `wss://<HOST_IP>:4100/ws` is open instead of `localhost`

## Expected Flow

1. **User clicks "Live Agent" on VTM**
   - Confirmation dialog appears
   
2. **User confirms**
   - VTM sends POST request to `https://localhost:8081/api/ticket`
   - Server console shows: `📥 Received ticket from VTM: xxxxxxxx`
   
3. **Server broadcasts to Live Agent**
   - Server console shows: `📡 Broadcasting to X connected client(s)`
   
4. **Live Agent receives ticket**
   - Dashboard console shows: `🎫 New ticket received: xxxxxxxx`
   - Ticket appears at top of list
   - Sound notification (optional - can add later)

## Troubleshooting

### Ticket not appearing in Live Agent dashboard

1. **Check WebSocket connection:**
   - Open browser console on Live Agent dashboard
   - Look for "✅ WebSocket connected" message
   - If you see "❌ WebSocket error", restart the server

2. **Check server is running:**
   ```bash
   lsof -i :8081
   ```
   Should show node process

3. **Check CORS:**
   - Server has CORS enabled for all origins
   - Should work from any localhost port

### "Failed to connect" error from VTM

1. **Check server URL:**
   - Make sure using `https://localhost:8081/api/ticket`
   
2. **Check server is running:**
   - Look for server console output
   
3. **Check network request:**
   - Open browser dev tools → Network tab
   - Click "Live Agent" button
   - Look for POST request to `/api/ticket`
   - Check response

## Console Messages Reference

### Server Console
- `✅ Live Agent dashboard connected` - Dashboard connected via WebSocket
- `📥 Received ticket from VTM: xxxxxxxx` - Received ticket from VTM
- `📡 Broadcasting to X connected client(s)` - Sending to dashboards
- `📝 Ticket xxxxxxxx status updated to resolved` - Status changed

### Live Agent Console
- `🔌 Attempting to connect to WebSocket server...` - Connecting
- `✅ WebSocket connected to Live Agent server` - Connected
- `🎫 New ticket received: xxxxxxxx` - New ticket arrived
- `📝 Ticket status updated: xxxxxxxx` - Status changed

### VTM Console
- `📤 Sending ticket to Live Agent: xxxxxxxx` - Sending ticket
- `✅ Live agent notified successfully` - Success
- `❌ Failed to notify live agent` - Error

## Quick Reference

**Server URLs (replace `<HOST_IP>` as needed):**
- WebSocket: `wss://<HOST_IP>:8081`
- HTTPS API: `https://<HOST_IP>:8081/api/ticket`

**Ticket Format:**
```javascript
{
  id: string,              // UUID
  atmId: string,          // e.g., "VTM-001"
  timestamp: string,      // ISO 8601
  status: "pending",      // Always "pending" from VTM
  customerName: string,   // Optional
  issueType: string,      // Brief description
  description: string,    // Detailed description
  priority: "low"|"medium"|"high"
}
```

## Support Files

- `vtm-integration-code.js` - Complete integration code with examples
- `atm-test-simulator.html` - Browser-based testing tool
- `INTEGRATION_GUIDE.md` - Detailed documentation

---

**Everything is ready!** Start the server, open the Live Agent dashboard, and test with the simulator or integrate with your VTM application.
