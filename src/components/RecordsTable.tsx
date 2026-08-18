import type { CardRecord } from '../types'

interface Props {
  records: CardRecord[]
  selected: Set<number>
  previewIndex: number | null
  onToggle: (rowIndex: number) => void
  onToggleAll: () => void
  onPreview: (rowIndex: number) => void
}

export default function RecordsTable({ records, selected, previewIndex, onToggle, onToggleAll, onPreview }: Props) {
  const allSelected = records.length > 0 && records.every((r) => selected.has(r.rowIndex))

  return (
    <div className="table-wrap">
      <table className="records-table">
        <thead>
          <tr>
            <th className="col-check">
              <input type="checkbox" checked={allSelected} onChange={onToggleAll} aria-label="Select all" />
            </th>
            <th>Full Name</th>
            <th>Card No.</th>
            <th>Account No.</th>
            <th>School</th>
            <th>Caregiver</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr
              key={r.rowIndex}
              className={[r.done ? 'row-done' : '', r.rowIndex === previewIndex ? 'row-active' : ''].join(' ').trim()}
              onClick={() => onPreview(r.rowIndex)}
            >
              <td className="col-check" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selected.has(r.rowIndex)}
                  onChange={() => onToggle(r.rowIndex)}
                  aria-label={`Select ${r.fullName}`}
                />
              </td>
              <td>{r.fullName || <span className="muted">—</span>}</td>
              <td>{r.cardNo || <span className="muted">—</span>}</td>
              <td>{r.accountNumber || <span className="muted">—</span>}</td>
              <td>{r.school || <span className="muted">—</span>}</td>
              <td>{r.caregiver || <span className="muted">—</span>}</td>
              <td>
                {r.done ? <span className="badge badge-done">Done</span> : <span className="badge badge-pending">Pending</span>}
              </td>
            </tr>
          ))}
          {records.length === 0 && (
            <tr>
              <td colSpan={7} className="empty-row">
                No records match your search.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
