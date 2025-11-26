import { create } from 'zustand'

export type BankingIntent =
  | 'Remittance'
  | 'Loan'
  | 'CardReplacement'
  | 'UpdateBook'
  | 'CardApp'
  | 'ClarificationNeeded'

export interface BankingAction {
  intent: BankingIntent
  amount?: number
  recipient?: string
  duration?: number
  spokenResponse?: string
  transcript?: string
  translatedTranscript?: string
  timestamp: number
}

export interface Transaction {
  id: string
  type: 'debit' | 'credit'
  amount: number
  recipient?: string
  description: string
  timestamp: number
}

export interface BankState {
  balance: number
  transactions: Transaction[]
  currentAction: BankingAction | null
  language: string
  languageSource: 'auto' | 'manual'
  isRecording: boolean
  isProcessing: boolean
  setBalance: (balance: number) => void
  addTransaction: (transaction: Omit<Transaction, 'id' | 'timestamp'>) => void
  setCurrentAction: (action: BankingAction | null) => void
  setLanguage: (lang: string, source?: 'auto' | 'manual') => void
  setIsRecording: (recording: boolean) => void
  setIsProcessing: (processing: boolean) => void
  reset: () => void
}

const initialBalance = 50000
const initialTransactions: Transaction[] = [
  {
    id: '1',
    type: 'credit',
    amount: 50000,
    description: 'Initial Deposit',
    timestamp: Date.now() - 86400000 * 7,
  },
  {
    id: '2',
    type: 'debit',
    amount: 1500,
    recipient: 'John Doe',
    description: 'Remittance to John Doe',
    timestamp: Date.now() - 86400000 * 3,
  },
  {
    id: '3',
    type: 'debit',
    amount: 250,
    description: 'ATM Withdrawal',
    timestamp: Date.now() - 86400000 * 1,
  },
]

export const useBankStore = create<BankState>((set) => ({
  balance: initialBalance,
  transactions: initialTransactions,
  currentAction: null,
  language: 'en',
  languageSource: 'auto',
  isRecording: false,
  isProcessing: false,
  setBalance: (balance) => set({ balance }),
  addTransaction: (transaction) =>
    set((state) => ({
      transactions: [
        {
          ...transaction,
          id: Date.now().toString(),
          timestamp: Date.now(),
        },
        ...state.transactions,
      ],
      balance:
        transaction.type === 'credit'
          ? state.balance + transaction.amount
          : state.balance - transaction.amount,
    })),
  setCurrentAction: (action) => set({ currentAction: action }),
  setLanguage: (language, source = 'auto') =>
    set({
      language,
      languageSource: source,
    }),
  setIsRecording: (isRecording) => set({ isRecording }),
  setIsProcessing: (isProcessing) => set({ isProcessing }),
  reset: () =>
    set({
      currentAction: null,
      isRecording: false,
      isProcessing: false,
      languageSource: 'auto',
    }),
}))


