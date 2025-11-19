import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { Send, CreditCard, FileText, BookOpen, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { BankingAction } from '../../data/bank-store'
import { useBankStore } from '../../data/bank-store'

interface ActionCardsProps {
  action: BankingAction
}

export function ActionCards({ action }: ActionCardsProps) {
  const { addTransaction, setCurrentAction, balance } = useBankStore()

  const handleRemittance = () => {
    if (action.amount && action.recipient) {
      addTransaction({
        type: 'debit',
        amount: action.amount,
        recipient: action.recipient,
        description: `Remittance to ${action.recipient}`,
      })
      setCurrentAction(null)
    }
  }

  const handleLoan = () => {
    if (action.amount && action.duration) {
      // For demo: Loan approval just shows confirmation
      setTimeout(() => {
        setCurrentAction(null)
      }, 3000)
    }
  }

  useEffect(() => {
    if (action.intent === 'CardApp') {
      const timer = setTimeout(() => {
        setCurrentAction(null)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [action.intent, setCurrentAction])

  useEffect(() => {
    if (action.intent === 'UpdateBook') {
      const timer = setTimeout(() => {
        setCurrentAction(null)
      }, 4000)
      return () => clearTimeout(timer)
    }
  }, [action.intent, setCurrentAction])

  useEffect(() => {
    if (action.intent === 'CardReplacement') {
      const timer = setTimeout(() => {
        setCurrentAction(null)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [action.intent, setCurrentAction])

  switch (action.intent) {
    case 'Remittance':
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-800 rounded-xl p-8 border border-cyan-500/30 shadow-xl"
        >
          <div className="flex items-center gap-4 mb-6">
            <Send className="text-cyan-400" size={32} />
            <h2 className="text-2xl font-bold text-white">Remittance</h2>
          </div>

          <div className="space-y-4 mb-6">
            <div>
              <label className="text-gray-400 text-sm">Recipient</label>
              <div className="text-white text-xl font-semibold mt-1">
                {action.recipient || 'Not specified'}
              </div>
            </div>
            <div>
              <label className="text-gray-400 text-sm">Amount</label>
              <div className="text-white text-2xl font-bold mt-1">
                ${action.amount?.toLocaleString() || '0.00'}
              </div>
            </div>
            <div>
              <label className="text-gray-400 text-sm">Current Balance</label>
              <div className="text-white text-xl mt-1">${balance.toLocaleString()}</div>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleRemittance}
              disabled={!action.amount || !action.recipient}
              className="flex-1 bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              Confirm Transfer
            </button>
            <button
              onClick={() => setCurrentAction(null)}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      )

    case 'Loan':
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-800 rounded-xl p-8 border border-blue-500/30 shadow-xl"
        >
          <div className="flex items-center gap-4 mb-6">
            <CreditCard className="text-blue-400" size={32} />
            <h2 className="text-2xl font-bold text-white">Loan Application</h2>
          </div>

          <div className="space-y-4 mb-6">
            <div>
              <label className="text-gray-400 text-sm">Loan Amount</label>
              <div className="text-white text-2xl font-bold mt-1">
                ${action.amount?.toLocaleString() || '0.00'}
              </div>
            </div>
            <div>
              <label className="text-gray-400 text-sm">Duration</label>
              <div className="text-white text-xl mt-1">
                {action.duration || 'N/A'} months
              </div>
            </div>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
            <p className="text-blue-300 text-sm">
              Your loan application is being processed. You will receive a notification shortly.
            </p>
          </div>

          <button
            onClick={handleLoan}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Submit Application
          </button>
        </motion.div>
      )

    case 'CardApp':
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-slate-800 rounded-xl p-8 border border-green-500/30 shadow-xl text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="mb-6"
          >
            <CheckCircle2 className="text-green-400 mx-auto" size={64} />
          </motion.div>
          <h2 className="text-2xl font-bold text-white mb-4">Card Application</h2>
          <p className="text-gray-400 mb-6">
            Your card application has been submitted successfully!
          </p>
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
            <p className="text-green-300 text-sm">
              You will receive your new card within 7-10 business days.
            </p>
          </div>
        </motion.div>
      )

    case 'UpdateBook':
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-800 rounded-xl p-8 border border-purple-500/30 shadow-xl"
        >
          <div className="flex items-center gap-4 mb-6">
            <BookOpen className="text-purple-400" size={32} />
            <h2 className="text-2xl font-bold text-white">Updating Bank Book</h2>
          </div>

          <div className="bg-black/50 rounded-lg p-6 font-mono text-sm space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.3 }}
                className="text-green-400"
              >
                {new Date().toLocaleDateString()} | Transaction #{1000 + i} | $
                {(Math.random() * 1000).toFixed(2)}
              </motion.div>
            ))}
          </div>

          <div className="mt-6 text-center">
            <motion.div
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ repeat: Infinity, duration: 1 }}
              className="text-purple-400"
            >
              Printing...
            </motion.div>
          </div>
        </motion.div>
      )

    case 'CardReplacement':
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-slate-800 rounded-xl p-8 border border-red-500/30 shadow-xl text-center"
        >
          <motion.div
            initial={{ rotate: 0 }}
            animate={{ rotate: [0, -10, 10, -10, 0] }}
            transition={{ duration: 0.5 }}
            className="mb-6"
          >
            <AlertTriangle className="text-red-400 mx-auto" size={64} />
          </motion.div>
          <h2 className="text-2xl font-bold text-white mb-4">Card Blocked</h2>
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
            <p className="text-red-300 font-semibold mb-2">
              Your card has been blocked immediately.
            </p>
            <p className="text-gray-400 text-sm">
              A replacement card will be issued and sent to your registered address within 5-7
              business days.
            </p>
          </div>
          <div className="text-gray-500 text-sm">
            Reference ID: CARD-{Date.now().toString().slice(-8)}
          </div>
        </motion.div>
      )

    default:
      return null
  }
}

