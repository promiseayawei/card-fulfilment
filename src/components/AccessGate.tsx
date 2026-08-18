import { useState, type FormEvent, type ReactNode } from 'react'

const STORAGE_KEY = 'kegow-portal-unlocked'
const EXPECTED_PIN = String(import.meta.env.VITE_ACCESS_PIN ?? '2468')

export default function AccessGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(STORAGE_KEY) === '1')
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  if (unlocked) return <>{children}</>

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (pin === EXPECTED_PIN) {
      sessionStorage.setItem(STORAGE_KEY, '1')
      setUnlocked(true)
    } else {
      setError(true)
      setPin('')
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
            setError(false)
          }}
          placeholder="Access PIN"
        />
        {error && <p className="access-error">Incorrect PIN.</p>}
        <button type="submit" className="btn-primary">
          Unlock
        </button>
      </form>
    </div>
  )
}
