/**
 * VTM Integration Code
 * 
 * Add this code to your VTM application running on port 8081
 * to send tickets to the Live Agent dashboard when user clicks "Live Agent" button
 */

// Configuration
const LIVE_AGENT_SERVER = 'https://localhost:8081/api/ticket'

/**
 * Send a live agent request
 * Call this function when the user confirms they want to connect with a live agent
 */
async function requestLiveAgent(issueDetails) {
  // Create the ticket object
  const ticket = {
    id: crypto.randomUUID(), // Generate unique ID
    atmId: 'VTM-001', // Your VTM identifier
    timestamp: new Date().toISOString(),
    status: 'pending',
    customerName: issueDetails.customerName || '', // Optional
    issueType: issueDetails.issueType || 'Customer Request',
    description: issueDetails.description || 'Customer has requested assistance from a live agent',
    priority: issueDetails.priority || 'high' // 'low', 'medium', or 'high'
  }

  console.log('📤 Sending ticket to Live Agent:', ticket.id.slice(0, 8))

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
      console.log('✅ Live agent notified successfully')
      return { 
        success: true, 
        ticketId: ticket.id,
        message: 'Live agent has been notified and will assist you shortly'
      }
    } else {
      console.error('❌ Failed to notify live agent:', result)
      return { 
        success: false, 
        error: result.error || 'Failed to connect to live agent'
      }
    }
  } catch (error) {
    console.error('❌ Error connecting to live agent server:', error)
    return { 
      success: false, 
      error: 'Unable to connect to live agent. Please try again.'
    }
  }
}

/**
 * Example usage with confirmation dialog
 */
function handleLiveAgentButtonClick() {
  // Show confirmation dialog
  const confirmed = confirm(
    'Would you like to connect with a live agent?\n\n' +
    'A support representative will be notified and will assist you shortly.'
  )

  if (confirmed) {
    // User confirmed - send the ticket
    requestLiveAgent({
      customerName: 'John Doe', // Get from your app state
      issueType: 'Customer Request', // Or specific issue
      description: 'Customer has requested assistance',
      priority: 'high'
    }).then(result => {
      if (result.success) {
        // Show success message to user
        alert(
          `✅ Live Agent Requested!\n\n` +
          `Ticket ID: ${result.ticketId.slice(0, 8)}\n` +
          `A live agent will assist you shortly.`
        )
      } else {
        // Show error message
        alert(
          `❌ Unable to connect to live agent\n\n` +
          `${result.error}\n\n` +
          `Please try again or call our helpline.`
        )
      }
    })
  } else {
    // User cancelled
    console.log('User cancelled live agent request')
  }
}

/**
 * Hook up to your Live Agent button
 */
// Example 1: Direct button click
document.getElementById('liveAgentButton')?.addEventListener('click', handleLiveAgentButtonClick)

// Example 2: React component
/*
function LiveAgentButton() {
  const handleClick = async () => {
    const confirmed = window.confirm(
      'Would you like to connect with a live agent?'
    )
    
    if (confirmed) {
      const result = await requestLiveAgent({
        customerName: 'Customer Name',
        issueType: 'General Assistance',
        description: 'Customer requested help',
        priority: 'high'
      })
      
      if (result.success) {
        alert('Live agent has been notified!')
      } else {
        alert('Failed to connect. Please try again.')
      }
    }
  }
  
  return (
    <button onClick={handleClick}>
      Request Live Agent
    </button>
  )
}
*/

/**
 * Example with different issue types
 */
function requestLiveAgentForCardStuck() {
  requestLiveAgent({
    issueType: 'Card Stuck',
    description: 'Customer\'s card is stuck in the card reader',
    priority: 'high'
  })
}

function requestLiveAgentForCashError() {
  requestLiveAgent({
    issueType: 'Cash Dispense Error',
    description: 'Incorrect amount dispensed',
    priority: 'high'
  })
}

function requestLiveAgentForGeneralHelp() {
  requestLiveAgent({
    issueType: 'General Assistance',
    description: 'Customer needs help with transaction',
    priority: 'medium'
  })
}

// Export for module usage
// export { requestLiveAgent, handleLiveAgentButtonClick }
