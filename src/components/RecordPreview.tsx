import type { CardRecord } from '../types'

interface Props {
  record: CardRecord | null
  onPrintThis: (rowIndex: number) => void
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="preview-row">
      <span className="preview-label">{label}</span>
      <span className="preview-value">{value || <span className="muted">(empty)</span>}</span>
    </div>
  )
}

export default function RecordPreview({ record, onPrintThis }: Props) {
  if (!record) {
    return (
      <div className="record-preview record-preview-empty">
        <p>Click a record in the list to verify its details here before printing.</p>
      </div>
    )
  }

  return (
    <div className="record-preview">
      <div className="preview-header">
        <h3>{record.fullName || 'Unnamed record'}</h3>
        {record.done && <span className="badge badge-done">Already printed</span>}
      </div>
      <div className="preview-grid">
        <Row label="Full Name" value={record.fullName} />
        <Row label="Default PIN" value={record.defaultPin} />
        <Row label="Account Number" value={record.accountNumber} />
        <Row label="Card No." value={record.cardNo} />
        <Row label="Gsap No." value={record.gsapNo} />
        <Row label="Caregiver" value={record.caregiver} />
        <Row label="School" value={record.school} />
        {record.extra.map((f) => (
          <Row key={f.label} label={f.label} value={f.value} />
        ))}
      </div>
      <button type="button" className="btn-primary" onClick={() => onPrintThis(record.rowIndex)}>
        Print this record
      </button>
    </div>
  )
}
