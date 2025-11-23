# 🚀 Quick Start Guide - Live Agent POC

## For the Live Agent (You)

### Step 1: Setup
```bash
# From the repo root (installs every workspace package)
pnpm install
```

### Step 2: Start the ticket bridge
```bash
# Runs packages/liveAgentPOC/server/websocket-server.js on https://localhost:8081
pnpm --filter liveAgentPOC dev:bridge
```

You should see:
```
📡 WebSocket server: wss://localhost:8081
🌐 HTTPS API server: https://localhost:8081
📮 VTM endpoint: https://localhost:8081/api/ticket
```

### Step 3: Start the dashboard
```bash
# Boots the Live Agent UI on https://localhost:3100
pnpm --filter liveAgentPOC dev
```

Open your browser to: `https://localhost:3100`

### Step 4: Login
Click the "Login" button on the welcome page to access the dashboard.

### Step 5: Test It
Open `atm-test-simulator.html` (or trigger the kiosk integration) and click "Request Live Agent" to create a test ticket.

---

## For the ATM Side (Your Friend)

### Quick Integration (3 simple steps)

**Step 1:** Add this function to your ATM code:

```javascript
async function requestLiveAgent(issueDetails) {
  const ticket = {
    id: crypto.randomUUID(),
    atmId: 'ATM-001', // Your ATM ID
    timestamp: new Date().toISOString(),
    status: 'pending',
    customerName: issueDetails.customerName || '',
    issueType: issueDetails.issueType,
    description: issueDetails.description,
    priority: issueDetails.priority || 'high'
  }

  try {
    const response = await fetch('https://localhost:8081/api/ticket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ticket)
    })
    
    const result = await response.json()
    return { success: response.ok, ticketId: ticket.id }
  } catch (error) {
    console.error('Error:', error)
    return { success: false, error: error.message }
  }
}
```

**Step 2:** Call it when the "Live Agent" button is pressed:

```javascript
document.getElementById('liveAgentButton').addEventListener('click', async () => {
  const result = await requestLiveAgent({
    issueType: 'Card Stuck',
    description: 'Customer needs assistance',
    priority: 'high',
    customerName: 'John Doe' // Optional
  })

  if (result.success) {
    alert('Help is on the way!')
  }
})
```

**Step 3:** Test it!

---

## Using on Two Different Computers

### On the Live Agent Computer:

1. Find your IP address:
   - Mac: System Preferences → Network
   - Windows: Open CMD and type `ipconfig`
   - Look for something like `192.168.1.100`

2. Start the server and dashboard as normal

### On the ATM Computer:

1. Update the URL in your code:
   ```javascript
   // Change from:
   'https://localhost:8081/api/ticket'
   
   // To (replace with actual IP):
   'https://192.168.1.100:8081/api/ticket'
   ```

2. Make sure both computers are on the **same WiFi network**

3. Test the connection!

---

## Common Issue Types

Use these for `issueType` when creating tickets:

- `"Card Stuck"` - Card trapped in ATM
- `"Cash Dispense Error"` - Wrong amount dispensed
- `"Screen Not Working"` - Touch screen issues
- `"Receipt Not Printed"` - Receipt problems
- `"PIN Entry Problem"` - PIN pad issues
- `"Transaction Failed"` - General transaction failures
- `"Other"` - Any other issues

---

## Testing Checklist

- [ ] WebSocket/HTTP bridge is running on port 8081
- [ ] Live Agent dashboard is running on port 3100
- [ ] Can login to the dashboard
- [ ] Test ticket appears in the dashboard
- [ ] Can click on ticket to see details
- [ ] Can change ticket status
- [ ] Filters work correctly
- [ ] Clicking **Start Working** opens the embedded call console with kiosk camera + screen

---

## Live Session Workflow

1. The kiosk (or the ATM simulator) posts a ticket to `https://localhost:8081/api/ticket` and includes the WebRTC `sessionId`.
2. The Live Agent dashboard receives the ticket over WebSocket, surfaces the session ID, and keeps the queue in sync.
3. When you click **Start Working**, the dashboard will:
   - Update the ticket status to `in-progress`.
   - Join the kiosk’s WebRTC room via the shared signaling server.
   - Start your webcam locally so the customer can see you.
4. The **Live Session Monitor** card streams the customer’s camera, shared screen, and audio so you can guide them in real time.
5. Use **Mark as Resolved** (or Hang Up in the panel) to drop the call and free the session.

---

## Need Help?

1. Check the browser console for errors (F12)
2. Check the server terminal for errors
3. Verify both computers are on the same network (if using two computers)
4. Make sure no firewall is blocking port 8081 (bridge) or 3100 (dashboard)
5. Read the full [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md) for detailed information

---

## Example Test Data

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "atmId": "ATM-001",
  "timestamp": "2025-11-21T10:30:00.000Z",
  "status": "pending",
  "customerName": "Jane Smith",
  "issueType": "Card Stuck",
  "description": "Customer's debit card is stuck in the card reader after PIN verification",
  "priority": "high"
}
```

---

**Ready to go!** 🎉

Start with the test simulator (`atm-test-simulator.html`) to verify everything works before connecting the real ATM.
