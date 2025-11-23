# Live Agent Integration Guide

This document explains how to set up and use the Live Agent system for receiving tickets from the ATM side.

## System Architecture

The system consists of two parts:
1. **Live Agent Dashboard** (This application) - Displays and manages support tickets
2. **ATM Interface** (Your friend's application) - Sends tickets when "Live Agent" button is pressed

## Setup Instructions

### 1. Install Dependencies

#### For the Live Agent Dashboard:
```bash
npm install
```

#### For the WebSocket Server:
```bash
cd server
npm install
```

### 2. Start the WebSocket Server

The WebSocket server facilitates communication between the ATM and Live Agent systems.

```bash
cd server
npm start
```

The server will run on:
- WebSocket: `wss://localhost:8081`
- HTTPS API: `https://localhost:8081`

### 3. Start the Live Agent Dashboard

In the main project directory:
```bash
npm run dev
```

The dashboard will be available at `https://localhost:3100`

## Integration with ATM Side

Your friend needs to send tickets to the Live Agent system. There are two methods:

### Method 1: HTTP POST Request (Recommended for Demo)

When the user presses the "Live Agent" button on the ATM, send a POST request to:

**Endpoint:** `https://localhost:8081/api/ticket`

**Request Body:**
```json
{
  "id": "unique-ticket-id",
  "atmId": "ATM-001",
  "timestamp": "2025-11-21T10:30:00.000Z",
  "status": "pending",
  "customerName": "John Doe",
  "issueType": "Card Stuck",
  "description": "Customer's card got stuck in the ATM slot",
  "priority": "high"
}
```

**Example using fetch:**
```javascript
async function sendLiveAgentRequest() {
  const ticket = {
    id: crypto.randomUUID(),
    atmId: 'ATM-001',
    timestamp: new Date().toISOString(),
    status: 'pending',
    customerName: 'John Doe',
    issueType: 'Card Stuck',
    description: 'Customer needs immediate assistance',
    priority: 'high'
  }

  const response = await fetch('https://localhost:8081/api/ticket', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(ticket)
  })

  const result = await response.json()
  console.log('Ticket sent:', result)
}
```

### Method 2: WebSocket Connection

For real-time bidirectional communication:

```javascript
const ws = new WebSocket('wss://localhost:8081')

ws.onopen = () => {
  console.log('Connected to Live Agent server')
  
  // Send a new ticket
  const ticket = {
    id: crypto.randomUUID(),
    atmId: 'ATM-001',
    timestamp: new Date().toISOString(),
    status: 'pending',
    customerName: 'John Doe',
    issueType: 'Card Stuck',
    description: 'Customer needs assistance',
    priority: 'high'
  }
  
  ws.send(JSON.stringify({
    type: 'new_ticket',
    ticket: ticket
  }))
}

ws.onmessage = (event) => {
  const data = JSON.parse(event.data)
  console.log('Received from server:', data)
}
```

## Ticket Data Structure

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique identifier for the ticket |
| `atmId` | string | Yes | ATM machine identifier |
| `timestamp` | string | Yes | ISO 8601 timestamp |
| `status` | string | Yes | `pending`, `in-progress`, or `resolved` |
| `customerName` | string | No | Customer's name (if available) |
| `issueType` | string | Yes | Brief description of the issue type |
| `description` | string | Yes | Detailed description of the issue |
| `priority` | string | Yes | `low`, `medium`, or `high` |

## Priority Levels

- **High**: Urgent issues requiring immediate attention (e.g., card stuck, cash dispense errors)
- **Medium**: Important but not critical issues
- **Low**: Minor issues or general inquiries

## Testing the Integration

### Test from Terminal (curl):

```bash
curl -X POST https://localhost:8081/api/ticket \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-123",
    "atmId": "ATM-001",
    "timestamp": "2025-11-21T10:30:00.000Z",
    "status": "pending",
    "customerName": "Test User",
    "issueType": "Test Issue",
    "description": "This is a test ticket",
    "priority": "high"
  }'
```

### Test from Browser Console:

Open the browser console on any page and run:

```javascript
fetch('https://localhost:8081/api/ticket', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: crypto.randomUUID(),
    atmId: 'ATM-TEST',
    timestamp: new Date().toISOString(),
    status: 'pending',
    customerName: 'Browser Test',
    issueType: 'Test from Browser',
    description: 'Testing ticket creation',
    priority: 'high'
  })
}).then(r => r.json()).then(console.log)
```

## Features

### Live Agent Dashboard
- ✅ Real-time ticket reception
- ✅ Ticket filtering by status
- ✅ Status management (pending → in-progress → resolved)
- ✅ Priority indicators
- ✅ Detailed ticket view
- ✅ Connection status indicator
- ✅ Statistics dashboard

### ATM Side Requirements
Your friend should implement:
- "Live Agent" button in the ATM UI
- Ticket creation with all required fields
- HTTP POST request or WebSocket message to the server
- Error handling for connection issues

## Troubleshooting

### Dashboard not receiving tickets
1. Check if the WebSocket server is running (`cd server && npm start`)
2. Verify the server is on port 8081
3. Check browser console for connection errors

### CORS Issues
If testing from different domains, you may need to enable CORS in the server. Add this to `websocket-server.js`:

```javascript
res.setHeader('Access-Control-Allow-Origin', '*')
res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
```

### Connection Refused
- Ensure both computers are on the same network
- Replace `localhost` with the actual IP address of the Live Agent computer
- Check firewall settings

## Network Setup for Two Computers

1. Find your Live Agent computer's IP address:
   - Mac: System Preferences → Network
   - Windows: `ipconfig`
   - Linux: `ifconfig` or `ip addr`

2. Update the ATM code to use your IP instead of localhost:
   ```javascript
   const url = 'https://192.168.1.100:8081/api/ticket' // Replace with your IP
   ```

3. Ensure both computers are on the same WiFi network

## Support

For issues or questions, check the browser console and server logs for error messages.
