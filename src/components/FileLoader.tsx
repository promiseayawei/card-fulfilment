import { useRef, useState, type FormEvent } from 'react'
import { decryptWithPassword, fileIsEncrypted } from '../lib/decrypt'
import { importRecords, ApiRequestError, type ImportPayloadRecord, type ImportResult } from '../lib/api'
import {
  buildFieldMapping,
  openFileWithPicker,
  parseWorkbookBuffer,
  rowsToImportRecords,
  supportsFileSystemAccess,
  type LoadedSheet,
  type ParsedRecord,
} from '../lib/xlsxIO'

const FIELD_LABELS: Record<string, string> = {
  fullName: 'Full Name',
  defaultPin: 'Default PIN',
  accountNumber: 'Account Number',
  cardNo: 'Card No.',
  gsapNo: 'Gsap No.',
  caregiver: 'Caregiver',
  school: 'School',
  lga: 'LGA',
}

// Keeps a single request body small enough to clear typical shared-hosting
// body-size limits, and turns one giant all-or-nothing POST into resumable
// progress.
const CHUNK_SIZE = 500

interface Props {
  onImported: () => void
}

interface PendingEncryptedFile {
  buf: Uint8Array
  fileName: string
}

interface ImportProgress {
  sentRecords: number
  totalRecords: number
  batch: number
  totalBatches: number
}

interface PayloadResult {
  payload: ImportPayloadRecord[]
  duplicateAccounts: number
  cardNoConflicts: { cardNo: string; names: string[] }[]
}

function toPayload(records: ParsedRecord[]): PayloadResult {
  const withData = records.filter((r) => r.fullName.trim() || r.accountNumber.trim())

  // Pass 1: keep the last occurrence of each account_number — in a real
  // roster a repeated account number usually means a corrected row further
  // down the sheet.
  const byAccount = new Map<string, ParsedRecord>()
  let duplicateAccounts = 0
  for (const r of withData) {
    const key = r.accountNumber.trim().toLowerCase()
    if (key && byAccount.has(key)) duplicateAccounts++
    byAccount.set(key || `__no-account-${byAccount.size}`, r)
  }

  // Pass 2: card_no must be unique too, but unlike account_number a repeat
  // here means two *different* accounts were accidentally given the same
  // physical card — that's a data error, not a correction, so both rows are
  // pulled out and reported rather than guessing which one is right.
  const byCardNo = new Map<string, ParsedRecord[]>()
  for (const r of byAccount.values()) {
    const key = r.cardNo.trim().toLowerCase()
    if (!key) continue
    const list = byCardNo.get(key) ?? []
    list.push(r)
    byCardNo.set(key, list)
  }
  const conflictingRecords = new Set<ParsedRecord>()
  const cardNoConflicts: { cardNo: string; names: string[] }[] = []
  for (const [key, list] of byCardNo) {
    if (list.length > 1) {
      list.forEach((r) => conflictingRecords.add(r))
      cardNoConflicts.push({ cardNo: list[0].cardNo || key, names: list.map((r) => r.fullName || '(unnamed)') })
    }
  }

  const payload = [...byAccount.values()]
    .filter((r) => !conflictingRecords.has(r))
    .map((r) => ({
      full_name: r.fullName,
      account_number: r.accountNumber,
      ...(r.defaultPin ? { default_pin: r.defaultPin } : {}),
      ...(r.cardNo ? { card_no: r.cardNo } : {}),
      ...(r.gsapNo ? { gsap_no: r.gsapNo } : {}),
      ...(r.caregiver ? { caregiver: r.caregiver } : {}),
      ...(r.school ? { school: r.school } : {}),
      ...(r.lga ? { lga: r.lga } : {}),
    }))

  return { payload, duplicateAccounts, cardNoConflicts }
}

function emptyResult(): ImportResult {
  return { imported: 0, updated: 0, skipped: 0, errors: [] }
}

export default function FileLoader({ onImported }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [pending, setPending] = useState<PendingEncryptedFile | null>(null)
  const [password, setPassword] = useState('')
  const [unlocking, setUnlocking] = useState(false)
  const [sheet, setSheet] = useState<LoadedSheet | null>(null)
  const [duplicateCount, setDuplicateCount] = useState(0)
  const [cardNoConflicts, setCardNoConflicts] = useState<{ cardNo: string; names: string[] }[]>([])
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleLoaded(file: File) {
    setLoading(true)
    setError(null)
    setPending(null)
    setResult(null)
    try {
      const buf = new Uint8Array(await file.arrayBuffer())
      if (fileIsEncrypted(buf)) {
        setPending({ buf, fileName: file.name })
        return
      }
      setSheet(parseWorkbookBuffer(buf, file.name))
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
      setSheet(parseWorkbookBuffer(decrypted, pending.fileName))
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
      const file = await openFileWithPicker()
      if (file) await handleLoaded(file)
      return
    }
    inputRef.current?.click()
  }

  async function handleImport() {
    if (!sheet) return
    setImporting(true)
    setError(null)
    setResult(null)

    const parsed = rowsToImportRecords(sheet.rows, sheet.headers)
    const { payload, duplicateAccounts, cardNoConflicts: conflicts } = toPayload(parsed)
    const localSkips = duplicateAccounts + conflicts.reduce((n, c) => n + c.names.length, 0)

    if (payload.length === 0) {
      setResult({ ...emptyResult(), skipped: localSkips })
      setDuplicateCount(duplicateAccounts)
      setCardNoConflicts(conflicts)
      setSheet(null)
      setImporting(false)
      return
    }

    const chunks: ImportPayloadRecord[][] = []
    for (let i = 0; i < payload.length; i += CHUNK_SIZE) chunks.push(payload.slice(i, i + CHUNK_SIZE))

    const totals = emptyResult()
    setProgress({ sentRecords: 0, totalRecords: payload.length, batch: 0, totalBatches: chunks.length })

    try {
      let sentSoFar = 0
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        const res = await importRecords(chunk, sheet.fileName)
        totals.imported += res.imported
        totals.updated += res.updated
        totals.skipped += res.skipped
        totals.errors.push(...res.errors.map((e) => ({ ...e, row: e.row + sentSoFar })))
        sentSoFar += chunk.length
        setProgress({ sentRecords: sentSoFar, totalRecords: payload.length, batch: i + 1, totalBatches: chunks.length })
      }
      totals.skipped += localSkips
      setResult(totals)
      setDuplicateCount(duplicateAccounts)
      setCardNoConflicts(conflicts)
      setSheet(null)
      onImported()
    } catch (err) {
      setResult(totals)
      setError(
        (err instanceof ApiRequestError ? err.message : 'Could not import this file.') +
          ` (${totals.imported + totals.updated} of ${payload.length} records were sent before this failed — safe to re-import the same file, already-saved rows will just be updated again.)`,
      )
    } finally {
      setImporting(false)
      setProgress(null)
    }
  }

  const mapping = sheet ? buildFieldMapping(sheet.headers) : null
  const progressPct = progress && progress.totalRecords > 0 ? Math.round((progress.sentRecords / progress.totalRecords) * 100) : 0

  return (
    <section className="file-loader">
      <h2 className="section-title">Import</h2>

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleLoaded(file)
          e.target.value = ''
        }}
      />

      <div className="file-loader-bar">
        <button type="button" className="btn-primary" onClick={handlePickerClick} disabled={loading || importing}>
          {loading ? 'Reading…' : 'Import Excel file'}
        </button>
        {sheet && !importing && (
          <button type="button" className="btn-secondary" onClick={() => setSheet(null)}>
            Cancel
          </button>
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

      {sheet && mapping && !importing && (
        <div className="file-summary">
          <div className="file-summary-row">
            <span className="file-summary-name">{sheet.fileName}</span>
            <span className="file-summary-count">{sheet.rows.length} row{sheet.rows.length === 1 ? '' : 's'} detected</span>
          </div>
          <div className="mapping-checklist">
            {Object.entries(FIELD_LABELS).map(([field, label]) => {
              const found = mapping.has(field as keyof ParsedRecord)
              return (
                <span key={field} className={found ? 'chip chip-ok' : 'chip chip-missing'}>
                  {found ? '✓' : '⚠'} {label}
                </span>
              )
            })}
          </div>
          <button type="button" className="btn-primary" style={{ marginTop: 12 }} onClick={handleImport}>
            Import {sheet.rows.length} record{sheet.rows.length === 1 ? '' : 's'} to server
          </button>
        </div>
      )}

      {progress && (
        <div className="import-progress">
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="hint">
            Importing {progress.sentRecords.toLocaleString()} of {progress.totalRecords.toLocaleString()} records — batch{' '}
            {progress.batch} of {progress.totalBatches} ({progressPct}%)
          </span>
        </div>
      )}

      {result && (
        <div className="alert alert-info">
          Imported {result.imported}, updated {result.updated}, skipped {result.skipped}.
          {duplicateCount > 0 && (
            <p>{duplicateCount} duplicate account number{duplicateCount === 1 ? '' : 's'} in the file — only the last occurrence of each was kept.</p>
          )}
          {cardNoConflicts.length > 0 && (
            <>
              <p>
                {cardNoConflicts.length} card no.{cardNoConflicts.length === 1 ? '' : 's'} assigned to more than one person in this
                file — none of these were imported. Fix the card no. in the source file and re-import just these:
              </p>
              <ul>
                {cardNoConflicts.map((c) => (
                  <li key={c.cardNo}>Card No. {c.cardNo}: {c.names.join(', ')}</li>
                ))}
              </ul>
            </>
          )}
          {result.errors.length > 0 && (
            <ul>
              {result.errors.map((e, i) => (
                <li key={i}>Row {e.row}: {e.reason}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
