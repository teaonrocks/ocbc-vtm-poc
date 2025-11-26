import { Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { motion } from 'framer-motion'
import {
  Send,
  CreditCard,
  BookOpen,
  AlertTriangle,
  CheckCircle2,
  PhoneCall,
} from 'lucide-react'
import { BankingAction } from '../../data/bank-store'
import { useBankStore } from '../../data/bank-store'

interface ActionCardsProps {
  action: BankingAction
  onIntentCompleted?: () => void
}

export function ActionCards({ action, onIntentCompleted }: ActionCardsProps) {
  const { addTransaction, setCurrentAction, balance } = useBankStore()
  const [amountInput, setAmountInput] = useState<string>('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [remittanceConfirmed, setRemittanceConfirmed] = useState(false)
  const completionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const REMITTANCE_SUCCESS_MESSAGE = 'Your transfer is being processed.'
  const REMITTANCE_FOLLOW_UP_DELAY = 2600

  useEffect(() => {
    if (action.intent !== 'Remittance') {
      setAmountInput('')
      setValidationError(null)
      setRemittanceConfirmed(false)
      if (completionTimeoutRef.current) {
        clearTimeout(completionTimeoutRef.current)
        completionTimeoutRef.current = null
      }
      return
    }

    if (typeof action.amount === 'number' && Number.isFinite(action.amount)) {
      setAmountInput(action.amount.toString())
    } else {
      setAmountInput('')
    }
    setValidationError(null)
  }, [action.intent, action.amount])

  useEffect(() => {
    return () => {
      if (completionTimeoutRef.current) {
        clearTimeout(completionTimeoutRef.current)
        completionTimeoutRef.current = null
      }
    }
  }, [])

  const parseAmountInput = (value: string) => {
    if (!value || !value.trim()) {
      return null
    }
    const normalized = value.replace(/,/g, '')
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : null
  }

  const handleAmountInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value
    setAmountInput(nextValue)
    if (validationError) {
      const parsed = parseAmountInput(nextValue)
      if (parsed !== null && parsed > 0 && parsed <= balance) {
        setValidationError(null)
      }
    }
  }

  const handleRemittance = () => {
    if (!action.recipient) {
      setValidationError('Recipient is missing. Please try again.')
      return
    }

    const parsedAmount = parseAmountInput(amountInput)

    if (parsedAmount === null || parsedAmount <= 0) {
      setValidationError('Enter an amount greater than 0.')
      return
    }

    if (parsedAmount > balance) {
      setValidationError('Amount exceeds your current balance.')
      return
    }

    addTransaction({
      type: 'debit',
      amount: parsedAmount,
      recipient: action.recipient,
      description: `Remittance to ${action.recipient}`,
    })
    setValidationError(null)
    setRemittanceConfirmed(true)

    setCurrentAction({
      ...action,
      amount: parsedAmount,
      spokenResponse: REMITTANCE_SUCCESS_MESSAGE,
      timestamp: Date.now(),
    })

    if (completionTimeoutRef.current) {
      clearTimeout(completionTimeoutRef.current)
    }
    completionTimeoutRef.current = setTimeout(() => {
      onIntentCompleted?.()
      completionTimeoutRef.current = null
    }, REMITTANCE_FOLLOW_UP_DELAY)
  }

  useEffect(() => {
    if (action.intent !== 'CardApp') {
      return
    }
    const timer = setTimeout(() => {
      onIntentCompleted?.()
    }, 2000)
    return () => clearTimeout(timer)
  }, [action.intent, onIntentCompleted])

  useEffect(() => {
    if (action.intent !== 'UpdateBook') {
      return
    }
    const timer = setTimeout(() => {
      onIntentCompleted?.()
    }, 4000)
    return () => clearTimeout(timer)
  }, [action.intent, onIntentCompleted])

  switch (action.intent) {
    case 'Remittance': {
      const parsedAmount = parseAmountInput(amountInput)
      const amountIsValid =
        parsedAmount !== null && parsedAmount > 0 && parsedAmount <= balance
      const missingAmountHint = typeof action.amount !== 'number'

      if (remittanceConfirmed) {
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-800 rounded-xl p-8 border border-cyan-500/30 shadow-xl text-center"
          >
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 140, damping: 12 }}
              className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-cyan-500/20"
            >
              <CheckCircle2 className="text-cyan-300" size={56} />
            </motion.div>
            <h2 className="text-2xl font-bold text-white mb-2">Transfer initiated</h2>
            <p className="text-slate-300 text-sm">
              {REMITTANCE_SUCCESS_MESSAGE} Please stay nearby while we finalize the remittance.
            </p>
          </motion.div>
        )
      }

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
              <div className="mt-1">
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={amountInput}
                  onChange={handleAmountInputChange}
                  placeholder="Enter amount"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-4 py-2 text-xl font-semibold text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                />
              </div>
              {validationError && (
                <p className="mt-2 text-sm text-amber-300">{validationError}</p>
              )}
              {missingAmountHint && (
                <p className="mt-2 text-xs text-slate-400">
                  Your voice request didn&apos;t specify an amount. Please enter the
                  transfer amount to continue.
                </p>
              )}
            </div>
            <div>
              <label className="text-gray-400 text-sm">Current Balance</label>
              <div className="text-white text-xl mt-1">${balance.toLocaleString()}</div>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleRemittance}
              disabled={!amountIsValid || !action.recipient}
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
    }

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
              Loan applications are treated as high value transactions. I can&apos;t
              finish this on the kiosk, but a live agent can complete it with you.
            </p>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row">
            <Link
              to={'/live-agent' as any}
              onClick={() => onIntentCompleted?.()}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 transition-colors"
            >
              <PhoneCall size={18} />
              Connect to live agent
            </Link>
            <button
              onClick={() => setCurrentAction(null)}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
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
          <h2 className="text-2xl font-bold text-white mb-4">
            Card replacement needs a live agent
          </h2>
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6 text-left">
            <p className="text-red-300 font-semibold mb-2">
              High value and security sensitive
            </p>
            <p className="text-gray-300 text-sm">
              For your safety, we can&apos;t complete card replacement on this kiosk. A live
              agent will verify your identity and finish the process.
            </p>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row">
            <Link
              to={'/live-agent' as any}
              onClick={() => onIntentCompleted?.()}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-6 transition-colors"
            >
              <PhoneCall size={18} />
              Connect to live agent
            </Link>
            <button
              onClick={() => setCurrentAction(null)}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      )

    case 'ClarificationNeeded':
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-amber-500/30 bg-slate-900/50 p-8 text-center shadow-xl"
        >
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/20">
            <AlertTriangle className="text-amber-300" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">
            Need a bit more info
          </h2>
          <p className="text-slate-300 text-sm">
            We couldn’t determine the intent of your request. Please mention if
            you’d like to make a remittance, apply for a loan, replace a card,
            update your bank book, or submit a card application.
          </p>
        </motion.div>
      )

    default:
      return null
  }
}

