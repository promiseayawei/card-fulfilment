import { useEffect, useMemo, useState } from 'react'
import './App.css'
import FileLoader from './components/FileLoader'
import SearchPanel from './components/SearchPanel'
import RecordsTable from './components/RecordsTable'
import RecordPreview from './components/RecordPreview'
import Template from './components/Template'
import {
  downloadWorkbook,
  markRowsDone,
  rowsToRecords,
  saveWorkbookToHandle,
  type LoadedSheet,
} from './lib/xlsxIO'
import { emptyCriteria, type CardRecord, type SearchCriteria } from './types'

function norm(v: string) {
  return v.trim().toLowerCase()
}

function matches(record: CardRecord, criteria: SearchCriteria): boolean {
  const checks: [string, string][] = [
    [criteria.fullName, record.fullName],
    [criteria.cardNo, record.cardNo],
    [criteria.accountNumber, record.accountNumber],
    [criteria.school, record.school],
    [criteria.caregiver, record.caregiver],
  ]
  return checks.every(([needle, haystack]) => !needle.trim() || norm(haystack).includes(norm(needle)))
}

function relevance(record: CardRecord, criteria: SearchCriteria): number {
  const pairs: [string, string][] = [
    [criteria.fullName, record.fullName],
    [criteria.cardNo, record.cardNo],
    [criteria.accountNumber, record.accountNumber],
    [criteria.school, record.school],
    [criteria.caregiver, record.caregiver],
  ]
  return pairs.reduce((score, [needle, haystack]) => (needle.trim() && norm(haystack) === norm(needle) ? score + 1 : score), 0)
}

export default function App() {
  const [sheet, setSheet] = useState<LoadedSheet | null>(null)
  const [criteria, setCriteria] = useState<SearchCriteria>(emptyCriteria)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const [printQueue, setPrintQueue] = useState<number[] | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const records = useMemo(() => (sheet ? rowsToRecords(sheet.rows, sheet.headers) : []), [sheet])

  const hasCriteria = Object.values(criteria).some((v) => v.trim())
  const filteredRecords = useMemo(() => {
    if (!hasCriteria) return []
    return records
      .filter((r) => matches(r, criteria))
      .sort((a, b) => relevance(b, criteria) - relevance(a, criteria) || a.fullName.localeCompare(b.fullName))
  }, [records, criteria, hasCriteria])

  const previewRecord = useMemo(
    () => (previewIndex == null ? null : records.find((r) => r.rowIndex === previewIndex) ?? null),
    [records, previewIndex],
  )

  const printRecords = useMemo(
    () => (printQueue ? records.filter((r) => printQueue.includes(r.rowIndex)) : []),
    [records, printQueue],
  )

  useEffect(() => {
    if (!printQueue) return
    const handleAfterPrint = () => {
      if (!sheet) return
      markRowsDone(sheet.rows, sheet.headers, printQueue)
      setSheet({ ...sheet, rows: [...sheet.rows] })
      setSelected((prev) => {
        const next = new Set(prev)
        printQueue.forEach((i) => next.delete(i))
        return next
      })
      setNotice(`Marked ${printQueue.length} record${printQueue.length === 1 ? '' : 's'} as done. Save the file to keep this.`)
      setPrintQueue(null)
    }
    window.addEventListener('afterprint', handleAfterPrint)
    return () => window.removeEventListener('afterprint', handleAfterPrint)
  }, [printQueue, sheet])

  function toggleSelected(rowIndex: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(rowIndex)) next.delete(rowIndex)
      else next.add(rowIndex)
      return next
    })
  }

  function toggleSelectAll() {
    const visible = filteredRecords.map((r) => r.rowIndex)
    const allSelected = visible.length > 0 && visible.every((i) => selected.has(i))
    setSelected((prev) => {
      const next = new Set(prev)
      if (allSelected) visible.forEach((i) => next.delete(i))
      else visible.forEach((i) => next.add(i))
      return next
    })
  }

  function startPrint(rowIndexes: number[]) {
    if (rowIndexes.length === 0) return
    setPrintQueue(rowIndexes)
  }

  async function handleSave() {
    if (!sheet) return
    setSaving(true)
    try {
      if (sheet.fileHandle) {
        const ok = window.confirm(`Save changes directly to "${sheet.fileName}"? This overwrites the original file.`)
        if (ok) {
          await saveWorkbookToHandle(sheet.headers, sheet.rows, sheet.fileHandle)
          setNotice(`Saved to ${sheet.fileName}.`)
        } else {
          downloadWorkbook(sheet.headers, sheet.rows, sheet.fileName)
          setNotice('Downloaded a copy instead.')
        }
      } else {
        downloadWorkbook(sheet.headers, sheet.rows, sheet.fileName)
        setNotice('Downloaded a copy with the updated Done column.')
      }
    } catch (err) {
      setNotice(`Could not save: ${(err as Error).message}`)
    } finally {
      setSaving(false)
    }
  }

  if (printQueue) {
    return (
      <div className="print-mode">
        <div className="print-toolbar no-print">
          <span>{printRecords.length} record{printRecords.length === 1 ? '' : 's'} ready to print</span>
          <button type="button" className="btn-primary" onClick={() => window.print()}>
            Print now
          </button>
          <button type="button" className="btn-secondary" onClick={() => setPrintQueue(null)}>
            Cancel
          </button>
        </div>
        {printRecords.map((r) => (
          <Template key={r.rowIndex} record={r} />
        ))}
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Kegow Card Fulfilment Printer</h1>
        <p className="subtitle">Load the Excel roster, find a record, verify it, then print the activation guide.</p>
      </header>

      <FileLoader sheet={sheet} onLoad={(s) => { setSheet(s); setCriteria(emptyCriteria); setSelected(new Set()); setPreviewIndex(null) }} onClear={() => { setSheet(null); setPreviewIndex(null); setSelected(new Set()) }} />

      {notice && (
        <div className="alert alert-info">
          {notice}
          <button type="button" className="btn-link" onClick={() => setNotice(null)}>
            dismiss
          </button>
        </div>
      )}

      {sheet && (
        <>
          <SearchPanel criteria={criteria} onChange={setCriteria} resultCount={filteredRecords.length} totalCount={records.length} />

          <div className="toolbar">
            <button type="button" className="btn-primary" disabled={selected.size === 0} onClick={() => startPrint([...selected])}>
              Print selected ({selected.size})
            </button>
            <button type="button" className="btn-secondary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : sheet.fileHandle ? 'Save to file' : 'Download updated file'}
            </button>
            {sheet.fileHandle && (
              <button type="button" className="btn-link" onClick={() => downloadWorkbook(sheet.headers, sheet.rows, sheet.fileName)}>
                or download a copy
              </button>
            )}
          </div>

          <div className="main-columns">
            <div className="main-list">
              {hasCriteria ? (
                <RecordsTable
                  records={filteredRecords}
                  selected={selected}
                  previewIndex={previewIndex}
                  onToggle={toggleSelected}
                  onToggleAll={toggleSelectAll}
                  onPreview={setPreviewIndex}
                />
              ) : (
                <div className="search-prompt">Search by full name, card no., account no., school, or caregiver to find records.</div>
              )}
            </div>
            <div className="main-preview">
              <RecordPreview record={previewRecord} onPrintThis={(rowIndex) => startPrint([rowIndex])} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
