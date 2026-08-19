import type { CardRecord } from '../types'

interface Props {
  record: CardRecord | null
  loading: boolean
  onPrintThis: (id: number) => void
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="preview-row">
      <span className="preview-label">{label}</span>
      <span className="preview-value">{value || <span className="muted">(empty)</span>}</span>
    </div>
  )
}

export default function RecordPreview({ record, loading, onPrintThis }: Props) {
  if (loading) {
    return (
      <div className="record-preview record-preview-empty">
        <p>Loading record…</p>
      </div>
    )
  }

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
        <Row label="LGA" value={record.lga} />
      </div>
      <button type="button" className="btn-primary" onClick={() => onPrintThis(record.id)}>
        Print this record
      </button>
    </div>
  )
}
