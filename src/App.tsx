import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import FileLoader from './components/FileLoader'
import SearchPanel from './components/SearchPanel'
import RecordsTable from './components/RecordsTable'
import RecordPreview from './components/RecordPreview'
import Template from './components/Template'
import {
  ApiRequestError,
  checkHealth,
  exportRecords,
  getRecord,
  markDone,
  searchRecords,
  toCardRecord,
} from './lib/api'
import { getPrintApi, type PrinterInfo } from './lib/printApi'
import { emptyCriteria, type CardRecord, type SearchCriteria } from './types'

const printApi = getPrintApi()
const PER_PAGE = 50

export default function App() {
  const [serverOnline, setServerOnline] = useState<boolean | null>(null)
  const [criteria, setCriteria] = useState<SearchCriteria>(emptyCriteria)
  const [records, setRecords] = useState<CardRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)

  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [previewId, setPreviewId] = useState<number | null>(null)
  const [previewRecord, setPreviewRecord] = useState<CardRecord | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const [printQueue, setPrintQueue] = useState<number[] | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const [printers, setPrinters] = useState<PrinterInfo[]>([])
  const [selectedPrinter, setSelectedPrinter] = useState('')
  const [printing, setPrinting] = useState(false)

  const searchSeq = useRef(0)
  // Every record ever seen this session, keyed by id — accumulates across
  // pages/searches (unlike `records`, which is replaced on every fetch) so a
  // record selected on page 1 is still printable after paging to page 3.
  const recordCache = useRef(new Map<number, CardRecord>())
  const [cacheVersion, setCacheVersion] = useState(0)

  function cacheRecords(list: CardRecord[]) {
    list.forEach((r) => recordCache.current.set(r.id, r))
  }

  useEffect(() => {
    checkHealth().then(setServerOnline)
  }, [])

  // Debounced, race-safe search: fires on criteria change (reset to page 1)
  // and on page change, but never lets a slow older response clobber a
  // newer one. Empty criteria still searches — it just means "browse
  // everything, paginated" rather than "show nothing."
  useEffect(() => {
    const controller = new AbortController()
    const mySeq = ++searchSeq.current
    const timer = setTimeout(
      () => {
        setSearching(true)
        setSearchError(null)
        searchRecords(
          {
            full_name: criteria.fullName,
            card_no: criteria.cardNo,
            account_number: criteria.accountNumber,
            school: criteria.school,
            caregiver: criteria.caregiver,
            page,
            per_page: PER_PAGE,
          },
          controller.signal,
        )
          .then((res) => {
            if (searchSeq.current !== mySeq) return
            const mapped = res.data.map(toCardRecord)
            setRecords(mapped)
            setTotal(res.total)
            cacheRecords(mapped)
          })
          .catch((err) => {
            if (err instanceof DOMException && err.name === 'AbortError') return
            if (searchSeq.current !== mySeq) return
            setSearchError(err instanceof ApiRequestError ? err.message : 'Search failed.')
          })
          .finally(() => {
            if (searchSeq.current === mySeq) setSearching(false)
          })
      },
      page === 1 ? 350 : 0,
    )
    // Cancels both an unfired debounce timer and an in-flight request —
    // whichever applies — so rapid typing doesn't pile up abandoned queries
    // on the server.
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [criteria, page, refreshTick])

  useEffect(() => {
    setPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [criteria])

  useEffect(() => {
    if (previewId == null) {
      setPreviewRecord(null)
      return
    }
    let cancelled = false
    setPreviewLoading(true)
    getRecord(previewId)
      .then((r) => {
        if (!cancelled) {
          const cr = toCardRecord(r)
          setPreviewRecord(cr)
          cacheRecords([cr])
        }
      })
      .catch((err) => {
        if (!cancelled) setNotice(err instanceof ApiRequestError ? err.message : 'Could not load that record.')
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [previewId])

  // Self-healing: if a selected id somehow isn't in the cache yet (e.g. a
  // stale selection from before a refresh), fetch it before printing rather
  // than silently rendering fewer records than were selected.
  useEffect(() => {
    if (!printQueue) return
    const missing = printQueue.filter((id) => !recordCache.current.has(id))
    if (missing.length === 0) return
    Promise.all(
      missing.map((id) =>
        getRecord(id)
          .then(toCardRecord)
          .catch(() => null),
      ),
    ).then((fetched) => {
      const ok = fetched.filter((r): r is CardRecord => !!r)
      cacheRecords(ok)
      if (ok.length < missing.length) {
        setNotice(`${missing.length - ok.length} selected record(s) could not be loaded and were skipped.`)
      }
      setCacheVersion((v) => v + 1)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [printQueue])

  const printRecords = useMemo(
    () => (printQueue ? printQueue.map((id) => recordCache.current.get(id)).filter((r): r is CardRecord => !!r) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [printQueue, cacheVersion],
  )

  function applyDone(ids: number[]) {
    const now = new Date().toISOString()
    setRecords((prev) => prev.map((r) => (ids.includes(r.id) ? { ...r, done: true, doneAt: now } : r)))
    setPreviewRecord((prev) => (prev && ids.includes(prev.id) ? { ...prev, done: true, doneAt: now } : prev))
    ids.forEach((id) => {
      const cached = recordCache.current.get(id)
      if (cached) recordCache.current.set(id, { ...cached, done: true, doneAt: now })
    })
  }

  function finalizePrint(ids: number[]) {
    markDone(ids)
      .then((res) => {
        applyDone(ids)
        setSelected((prev) => {
          const next = new Set(prev)
          ids.forEach((i) => next.delete(i))
          return next
        })
        setNotice(`Marked ${res.updated} record${res.updated === 1 ? '' : 's'} as done.`)
      })
      .catch((err) => {
        setNotice(err instanceof ApiRequestError ? err.message : 'Could not mark records as done.')
      })
    setPrintQueue(null)
  }

  // Plain browser: window.print() opens the OS dialog, and 'afterprint' is
  // our only signal that the job was sent (or cancelled — no way to tell
  // which, so we optimistically mark done either way).
  useEffect(() => {
    if (!printQueue || printApi) return
    const handleAfterPrint = () => finalizePrint(printQueue)
    window.addEventListener('afterprint', handleAfterPrint)
    return () => window.removeEventListener('afterprint', handleAfterPrint)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [printQueue])

  // Electron: skip the dialog entirely and print straight to the chosen
  // printer, so load the printer list as soon as we enter print mode.
  useEffect(() => {
    if (!printQueue || !printApi) return
    printApi.listPrinters().then((list) => {
      setPrinters(list)
      setSelectedPrinter((current) => current || list.find((p) => p.isDefault)?.name || list[0]?.name || '')
    })
  }, [printQueue])

  async function handleSilentPrint() {
    if (!printApi || !printQueue) return
    setPrinting(true)
    try {
      const result = await printApi.printSilent(selectedPrinter)
      if (result.success) {
        finalizePrint(printQueue)
      } else {
        setNotice(`Print failed: ${result.failureReason || 'unknown error'}`)
      }
    } finally {
      setPrinting(false)
    }
  }

  function toggleSelected(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    const visible = records.map((r) => r.id)
    const allSelected = visible.length > 0 && visible.every((i) => selected.has(i))
    setSelected((prev) => {
      const next = new Set(prev)
      if (allSelected) visible.forEach((i) => next.delete(i))
      else visible.forEach((i) => next.add(i))
      return next
    })
  }

  function startPrint(ids: number[]) {
    if (ids.length === 0) return
    setPrintQueue(ids)
  }

  async function handleExport() {
    setExporting(true)
    try {
      await exportRecords()
    } catch (err) {
      setNotice(err instanceof ApiRequestError ? err.message : 'Export failed.')
    } finally {
      setExporting(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))

  if (printQueue) {
    return (
      <div className="print-mode">
        <div className="print-toolbar no-print">
          <span>{printRecords.length} record{printRecords.length === 1 ? '' : 's'} ready to print</span>
          {printApi ? (
            <>
              <select
                className="printer-select"
                value={selectedPrinter}
                onChange={(e) => setSelectedPrinter(e.target.value)}
                disabled={printers.length === 0}
              >
                {printers.length === 0 && <option>Loading printers…</option>}
                {printers.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.displayName || p.name}
                    {p.isDefault ? ' (default)' : ''}
                  </option>
                ))}
              </select>
              <button type="button" className="btn-primary" onClick={handleSilentPrint} disabled={printing || printers.length === 0}>
                {printing ? 'Printing…' : 'Print now'}
              </button>
            </>
          ) : (
            <button type="button" className="btn-primary" onClick={() => window.print()}>
              Print now
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={() => setPrintQueue(null)}>
            Cancel
          </button>
        </div>
        {printRecords.map((r) => (
          <Template key={r.id} record={r} />
        ))}
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Kegow Card Fulfilment Printer</h1>
        <p className="subtitle">Search the shared roster, verify a record, then print the activation guide.</p>
      </header>

      {serverOnline === false && (
        <div className="alert alert-error">Can't reach the server right now — check your connection.</div>
      )}

      <FileLoader onImported={() => setRefreshTick((t) => t + 1)} />

      {notice && (
        <div className="alert alert-info">
          {notice}
          <button type="button" className="btn-link" onClick={() => setNotice(null)}>
            dismiss
          </button>
        </div>
      )}

      <SearchPanel criteria={criteria} onChange={setCriteria} resultCount={total} />

      <div className="toolbar">
        <button type="button" className="btn-primary" disabled={selected.size === 0} onClick={() => startPrint([...selected])}>
          Print selected ({selected.size})
        </button>
        <button type="button" className="btn-secondary" onClick={handleExport} disabled={exporting}>
          {exporting ? 'Exporting…' : 'Export current data'}
        </button>
      </div>

      <div className="main-columns">
        <div className="main-list">
          {searchError ? (
            <div className="alert alert-error">{searchError}</div>
          ) : (
            <>
              <RecordsTable
                records={records}
                selected={selected}
                previewId={previewId}
                onToggle={toggleSelected}
                onToggleAll={toggleSelectAll}
                onPreview={setPreviewId}
              />
              {searching && <p className="hint" style={{ marginTop: 8 }}>Searching…</p>}
              {totalPages > 1 && (
                <div className="toolbar" style={{ marginTop: 12 }}>
                  <button type="button" className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Previous
                  </button>
                  <span className="hint">Page {page} of {totalPages} · {total} total</span>
                  <button type="button" className="btn-secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
        <div className="main-preview">
          <RecordPreview record={previewRecord} loading={previewLoading} onPrintThis={(id) => startPrint([id])} />
        </div>
      </div>
    </div>
  )
}
