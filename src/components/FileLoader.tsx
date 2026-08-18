import { useRef, useState, type FormEvent } from 'react'
import { decryptWithPassword, fileIsEncrypted } from '../lib/decrypt'
import type { LoadedSheet } from '../lib/xlsxIO'
import { buildFieldMapping, openFileWithPicker, parseWorkbookBuffer, supportsFileSystemAccess } from '../lib/xlsxIO'

const FIELD_LABELS: Record<string, string> = {
  fullName: 'Full Name',
  defaultPin: 'Default PIN',
  accountNumber: 'Account Number',
  cardNo: 'Card No.',
  gsapNo: 'Gsap No.',
  caregiver: 'Caregiver',
  school: 'School',
}

interface Props {
  sheet: LoadedSheet | null
  onLoad: (sheet: LoadedSheet) => void
  onClear: () => void
}

interface PendingEncryptedFile {
  buf: Uint8Array
  fileName: string
  fileHandle: FileSystemFileHandle | null
}

export default function FileLoader({ sheet, onLoad, onClear }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [pending, setPending] = useState<PendingEncryptedFile | null>(null)
  const [password, setPassword] = useState('')
  const [unlocking, setUnlocking] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleLoaded(file: File, handle: FileSystemFileHandle | null) {
    setLoading(true)
    setError(null)
    setPending(null)
    try {
      const buf = new Uint8Array(await file.arrayBuffer())
      if (fileIsEncrypted(buf)) {
        setPending({ buf, fileName: file.name, fileHandle: handle })
        return
      }
      const loaded = parseWorkbookBuffer(buf, file.name)
      loaded.fileHandle = handle
      onLoad(loaded)
    } catch (err) {
      setError((err as Error)?.message ?? 'Could not read this file.')
    } finally {
      setLoading(false)
    }
  }

  function handleUnlock(e: FormEvent) {
    e.preventDefault()
    if (!pending) return
    setUnlocking(true)
    setError(null)
    try {
      const decrypted = decryptWithPassword(pending.buf, password)
      const loaded = parseWorkbookBuffer(decrypted, pending.fileName)
      loaded.fileHandle = pending.fileHandle
      onLoad(loaded)
      setPending(null)
      setPassword('')
    } catch (err) {
      setError((err as Error)?.message ?? 'Could not decrypt this file.')
    } finally {
      setUnlocking(false)
    }
  }

  async function handlePickerClick() {
    if (supportsFileSystemAccess()) {
      const result = await openFileWithPicker()
      if (result) await handleLoaded(result.file, result.handle)
      return
    }
    inputRef.current?.click()
  }

  const mapping = sheet ? buildFieldMapping(sheet.headers) : null
  const doneCount = sheet
    ? [...sheet.rows].filter((r) => mapping?.doneHeader && /^(yes|y|true|1|done)$/i.test((r[mapping.doneHeader] ?? '').trim())).length
    : 0

  return (
    <section className="file-loader">
      <h2 className="section-title">Files</h2>

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleLoaded(file, null)
          e.target.value = ''
        }}
      />

      <div className="file-loader-bar">
        <button type="button" className="btn-primary" onClick={handlePickerClick} disabled={loading}>
          {loading ? 'Reading…' : sheet ? 'Open a different file' : 'Open Excel file'}
        </button>
        {sheet && (
          <button type="button" className="btn-secondary" onClick={onClear}>
            Close file
          </button>
        )}
        {!supportsFileSystemAccess() && (
          <span className="hint">
            Direct save-back isn't available in this browser — use Chrome or Edge for that, or export a copy instead.
          </span>
        )}
      </div>

      {pending && (
        <form className="password-prompt" onSubmit={handleUnlock}>
          <p>
            <strong>{pending.fileName}</strong> is password-protected. The password is only used in your browser to
            unlock it — it isn't uploaded anywhere.
          </p>
          <div className="password-prompt-row">
            <input
              type="password"
              autoFocus
              placeholder="File password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="submit" className="btn-primary" disabled={unlocking || !password}>
              {unlocking ? 'Unlocking…' : 'Unlock file'}
            </button>
            <button
              type="button"
              className="btn-link"
              onClick={() => {
                setPending(null)
                setPassword('')
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      {sheet && mapping && (
        <div className="file-summary">
          <div className="file-summary-row">
            <span className="file-summary-name">{sheet.fileName}</span>
            <span className="file-summary-count">
              {sheet.rows.length} record{sheet.rows.length === 1 ? '' : 's'} · {doneCount} marked done
            </span>
          </div>
          <div className="mapping-checklist">
            {Object.entries(FIELD_LABELS).map(([field, label]) => {
              const found = mapping.headerByField.has(field)
              return (
                <span key={field} className={found ? 'chip chip-ok' : 'chip chip-missing'}>
                  {found ? '✓' : '⚠'} {label}
                </span>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
