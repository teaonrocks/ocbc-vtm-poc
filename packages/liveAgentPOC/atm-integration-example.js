/**
 * ATM Integration Example
 * 
 * This file shows how to integrate the Live Agent system into your ATM application.
 * Copy the relevant functions into your ATM code.
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

// Change this to your Live Agent computer's IP address when using on different computers
const LIVE_AGENT_SERVER = 'https://localhost:8081/api/ticket'

// ============================================================================
// METHOD 1: Simple HTTP POST (Recommended for POC)
// ============================================================================

/**
 * Send a live agent request when the user presses the "Live Agent" button
 * @param {Object} issueDetails - Details about the customer's issue
 */
async function requestLiveAgent(issueDetails) {
  // Create the ticket object
  const ticket = {
    id: generateUniqueId(), // or use crypto.randomUUID() in modern browsers
    atmId: getATMId(), // Your ATM identifier (e.g., "ATM-001", "ATM-BRANCH-123")
    timestamp: new Date().toISOString(),
    status: 'pending',
    customerName: issueDetails.customerName || '', // Optional
    issueType: issueDetails.issueType, // e.g., "Card Stuck", "Cash Dispense Error"
    description: issueDetails.description, // Detailed description
    priority: issueDetails.priority || 'high' // "low", "medium", or "high"
  }

  try {
    const response = await fetch(LIVE_AGENT_SERVER, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ticket)
    })

    const result = await response.json()

    if (response.ok) {
      console.log('✅ Live agent notified successfully', result)
      return { success: true, ticketId: ticket.id }
    } else {
      console.error('❌ Failed to notify live agent', result)
      return { success: false, error: result.error }
    }
  } catch (error) {
    console.error('❌ Error connecting to live agent server', error)
    return { success: false, error: error.message }
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a unique ID for the ticket
 */
function generateUniqueId() {
  // Modern browsers support crypto.randomUUID()
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

/**
 * Get the ATM ID - Replace this with your actual ATM identification logic
 */
function getATMId() {
  // Example: You might get this from your ATM configuration
  return 'ATM-001'
  
  // Or from a configuration object:
  // return window.ATM_CONFIG?.id || 'ATM-UNKNOWN'
  
  // Or from local storage:
  // return localStorage.getItem('atmId') || 'ATM-UNKNOWN'
}

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

/**
 * Example 1: Card stuck in ATM
 */
async function handleCardStuck() {
  const result = await requestLiveAgent({
    issueType: 'Card Stuck',
    description: 'Customer\'s card got stuck in the ATM slot after PIN entry',
    priority: 'high',
    customerName: 'John Doe' // Optional: if you have this information
  })

  if (result.success) {
    // Show success message to customer
    displayMessage('Help is on the way! A live agent has been notified.')
  } else {
    // Show error message
    displayMessage('Unable to connect to support. Please call our helpline.')
  }
}

/**
 * Example 2: Cash dispense error
 */
async function handleCashDispenseError(requestedAmount, dispensedAmount) {
  const result = await requestLiveAgent({
    issueType: 'Cash Dispense Error',
    description: `Customer requested $${requestedAmount} but received $${dispensedAmount}. Transaction needs verification.`,
    priority: 'high',
    customerName: '' // Leave empty if not available
  })

  if (result.success) {
    displayMessage(`Issue reported (Ticket #${result.ticketId.slice(0, 8)}). Please wait for assistance.`)
  }
}

/**
 * Example 3: Generic live agent button
 */
function setupLiveAgentButton() {
  const liveAgentButton = document.getElementById('liveAgentButton')
  
  liveAgentButton.addEventListener('click', async () => {
    // Disable button while processing
    liveAgentButton.disabled = true
    liveAgentButton.textContent = 'Connecting...'

    // Get issue details from your UI or use a default
    const result = await requestLiveAgent({
      issueType: 'Customer Request',
      description: 'Customer has requested assistance from a live agent',
      priority: 'medium'
    })

    if (result.success) {
      // Show success screen
      showSuccessScreen(`
        <h2>Help is on the way!</h2>
        <p>A live agent has been notified and will assist you shortly.</p>
        <p>Ticket ID: ${result.ticketId.slice(0, 8)}</p>
      `)
    } else {
      // Show error screen
      showErrorScreen('Unable to connect. Please call our 24/7 helpline: 1-800-XXX-XXXX')
      liveAgentButton.disabled = false
      liveAgentButton.textContent = 'Request Live Agent'
    }
  })
}

// ============================================================================
// UI HELPER FUNCTIONS (Replace with your actual UI logic)
// ============================================================================

function displayMessage(message) {
  // Replace with your actual UI display logic
  alert(message)
  console.log(message)
}

function showSuccessScreen(html) {
  // Replace with your actual UI logic
  console.log('Success:', html)
}

function showErrorScreen(message) {
  // Replace with your actual UI logic
  console.error('Error:', message)
}

// ============================================================================
// INITIALIZATION
// ============================================================================

// Call this when your ATM application loads
function initializeLiveAgentSupport() {
  console.log('Live Agent support initialized')
  console.log('Server:', LIVE_AGENT_SERVER)
  
  // Set up the live agent button if it exists
  if (document.getElementById('liveAgentButton')) {
    setupLiveAgentButton()
  }
}

// Initialize when the page loads
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', initializeLiveAgentSupport)
}

// ============================================================================
// EXPORT FOR MODULE USAGE
// ============================================================================

// If using ES modules:
// export { requestLiveAgent, handleCardStuck, handleCashDispenseError }
