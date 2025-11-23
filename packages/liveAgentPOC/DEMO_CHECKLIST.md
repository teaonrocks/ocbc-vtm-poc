# 🎯 Demo Day Checklist

## Before Demo Day

### Live Agent Side (You) - Setup Checklist

- [ ] **Install Dependencies**
  ```bash
  npm install
  cd server && npm install && cd ..
  ```

- [ ] **Test WebSocket Server**
  ```bash
  cd server && npm start
  ```
  Verify you see: "WebSocket server running on wss://localhost:8081"

- [ ] **Test Dashboard**
  ```bash
  npm run dev
  ```
  Verify dashboard opens at https://localhost:3100

- [ ] **Test Login Flow**
  - Click "Login" button
  - Verify you reach the home page with tickets

- [ ] **Test Ticket Creation**
  - Open `atm-test-simulator.html`
  - Fill form and click "Request Live Agent"
  - Verify ticket appears in dashboard

- [ ] **Test Ticket Management**
  - Click on a ticket
  - Change status to "In Progress"
  - Change status to "Resolved"
  - Verify status updates work

- [ ] **Test Filters**
  - Click "Pending" filter
  - Click "In Progress" filter
  - Click "Resolved" filter
  - Click "All" filter

### ATM Side (Your Friend) - Integration Checklist

- [ ] **Get Integration Code**
  - Copy code from `atm-integration-example.js`
  - Add to your ATM application

- [ ] **Add Live Agent Button**
  ```html
  <button id="liveAgentButton">Request Live Agent</button>
  ```

- [ ] **Connect Button to Function**
  ```javascript
  document.getElementById('liveAgentButton').addEventListener('click', async () => {
    const result = await requestLiveAgent({
      issueType: 'Customer Request',
      description: 'Customer needs assistance',
      priority: 'high'
    })
    
    if (result.success) {
      alert('Help is on the way!')
    }
  })
  ```

- [ ] **Test on Same Computer**
  - Use `https://localhost:8081/api/ticket`
  - Click "Request Live Agent" button
  - Verify ticket appears in Live Agent dashboard

### Network Setup (Two Computers)

- [ ] **Find Live Agent Computer IP**
  - Mac: System Preferences → Network
  - Windows: CMD → `ipconfig`
  - Write down IP: ________________

- [ ] **Update ATM Code**
  ```javascript
  // Change this line in your ATM code:
  const LIVE_AGENT_SERVER = 'https://YOUR_IP_HERE:8081/api/ticket'
  ```

- [ ] **Connect to Same WiFi**
  - Both computers on same network
  - Test connectivity with ping

- [ ] **Test Connection**
  - Start server on Live Agent computer
  - Send test ticket from ATM computer
  - Verify ticket appears

## Demo Day - Live Agent Side

- [ ] Start WebSocket server early (at least 15 min before)
- [ ] Start dashboard
- [ ] Login to dashboard
- [ ] Clear any test tickets (refresh page)
- [ ] Keep browser window visible on screen
- [ ] Have backup: ATM test simulator open in another tab

## Demo Day - ATM Side

- [ ] Verify server URL points to correct IP
- [ ] Test connection before demo
- [ ] Have "Live Agent" button clearly visible
- [ ] Prepare sample scenarios:
  - [ ] Card stuck scenario
  - [ ] Cash dispense error scenario
  - [ ] General help request

## During Demo

### Scenario 1: Card Stuck
**ATM Side:**
1. Show customer using ATM
2. Simulate card stuck issue
3. Click "Request Live Agent" button
4. Show confirmation message

**Live Agent Side:**
1. Show new ticket appear instantly
2. Click on ticket to show details
3. Show ticket information:
   - ATM ID
   - Issue type: "Card Stuck"
   - Priority: High
   - Description
4. Click "Start Working" button
5. (Simulate helping customer)
6. Click "Mark as Resolved"

### Scenario 2: Cash Dispense Error
**ATM Side:**
1. Simulate withdrawal
2. Show incorrect cash dispensed
3. Click "Request Live Agent"

**Live Agent Side:**
1. Show ticket appear
2. Open ticket details
3. Show all information captured
4. Update status to "In Progress"

### Key Points to Highlight

- ✅ **Real-time**: Tickets appear instantly
- ✅ **Organized**: Filter and manage tickets easily
- ✅ **Detailed**: All customer information captured
- ✅ **Status Tracking**: Clear workflow from pending to resolved
- ✅ **Priority System**: High priority tickets clearly marked
- ✅ **Statistics**: Dashboard shows ticket counts

## Troubleshooting During Demo

### Ticket Not Appearing
1. Check server is running
2. Check browser console (F12)
3. Refresh dashboard page
4. Use ATM test simulator as backup

### Connection Issues
1. Verify both computers on same WiFi
2. Check IP address is correct
3. Check firewall not blocking ports
4. Fall back to same-computer demo

### Server Crashed
1. Restart server: `cd server && npm start`
2. Refresh dashboard
3. Continue with new tickets

## Backup Plan

If network fails:
1. Use single computer
2. Open ATM test simulator (`atm-test-simulator.html`)
3. Create tickets from simulator
4. Show ticket management in dashboard

## Post-Demo Questions to Prepare For

**Q: How does the customer know help is coming?**
A: The ATM shows a confirmation message with ticket ID and "Help is on the way" message.

**Q: Can multiple agents access the system?**
A: Yes, the WebSocket broadcasts to all connected clients, so multiple agents can see tickets.

**Q: What if the network is down?**
A: The ATM can show a fallback message with a phone number to call.

**Q: How fast is the response?**
A: Tickets appear in the dashboard instantly (< 100ms typically).

**Q: Can you prioritize tickets?**
A: Yes, tickets have priority levels (High, Medium, Low) and can be filtered.

**Q: What information is captured?**
A: ATM ID, timestamp, issue type, description, customer name (optional), priority.

## Success Criteria

- [ ] Tickets send from ATM to Live Agent dashboard
- [ ] Real-time display works
- [ ] Can view ticket details
- [ ] Can update ticket status
- [ ] System is stable during demo
- [ ] Clear value proposition demonstrated

---

## Emergency Contacts

**Live Agent Computer Owner:** ________________
**ATM Computer Owner:** ________________
**WiFi Network Name:** ________________
**Backup Phone:** ________________

---

**Good luck with your demo!** 🎉

Remember: Keep it simple, focus on the key value proposition, and have backups ready!
