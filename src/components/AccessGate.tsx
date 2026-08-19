import { useState, type FormEvent, type ReactNode } from 'react'
import { ApiRequestError, getToken, login } from '../lib/api'

export default function AccessGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(() => !!getToken())
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (unlocked) return <>{children}</>

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await login(pin)
      setUnlocked(true)
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not reach the server.')
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="access-gate">
      <form className="access-card" onSubmit={handleSubmit}>
        <h1>Kegow Card Portal</h1>
        <p>Enter the access PIN to continue.</p>
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          value={pin}
          onChange={(e) => {
            setPin(e.target.value)
            setError(null)
          }}
          placeholder="Access PIN"
        />
        {error && <p className="access-error">{error}</p>}
        <button type="submit" className="btn-primary" disabled={loading || !pin}>
          {loading ? 'Checking…' : 'Unlock'}
        </button>
      </form>
    </div>
  )
}
