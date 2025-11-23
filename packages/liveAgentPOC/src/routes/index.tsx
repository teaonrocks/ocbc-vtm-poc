import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { LogIn } from 'lucide-react'

export const Route = createFileRoute('/')({ component: WelcomePage })

function WelcomePage() {
  const navigate = useNavigate()

  const handleLogin = () => {
    navigate({ to: '/home' })
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-[#E1251B] to-white flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">
            Welcome
          </h1>
          <p className="text-xl text-white/80">
            Please login to continue
          </p>
        </div>
        
        <button
          onClick={handleLogin}
          className="w-full px-8 py-4 bg-[#E1251B] hover:bg-[#C41F17] text-white font-semibold rounded-lg transition-colors shadow-lg shadow-[#E1251B]/50 flex items-center justify-center gap-3"
        >
          <LogIn size={24} />
          Login
        </button>
      </div>
    </div>
  )
}
