import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, Activity } from 'lucide-react'
import { LiveAgentAssistPanel } from '../components/LiveAgent/LiveAgentAssistPanel'
import { useBankStore } from '../data/bank-store'

export const Route = createFileRoute('/live-agent')({
  component: LiveAgentRoute,
})

function LiveAgentRoute() {
  const { currentAction, language } = useBankStore()

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-5xl space-y-8 px-4 py-10">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-500">
              OCBC Virtual Teller
            </p>
            <h1 className="text-3xl font-semibold">Live Agent Session</h1>
            <p className="text-slate-400">
              Share your kiosk screen, camera, and annotations with a human
              specialist.
            </p>
          </div>
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-white transition hover:border-slate-500"
          >
            <ArrowLeft size={16} />
            Back to kiosk
          </Link>
        </header>

        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-300">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-cyan-300" />
            <span>
              Current intent:{' '}
              {currentAction ? currentAction.intent : 'No request captured'}
            </span>
          </div>
          {currentAction?.spokenResponse && (
            <p className="mt-2 text-slate-400">{currentAction.spokenResponse}</p>
          )}
        </div>

        <LiveAgentAssistPanel
          currentAction={currentAction}
          language={language}
        />
      </div>
    </div>
  )
}


