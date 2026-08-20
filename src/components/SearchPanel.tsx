import type { SearchCriteria, StatusFilter } from '../types'
import { emptyCriteria } from '../types'

interface Props {
  criteria: SearchCriteria
  onChange: (criteria: SearchCriteria) => void
  resultCount: number
  status: StatusFilter
  onStatusChange: (status: StatusFilter) => void
}

const FIELDS: { key: keyof SearchCriteria; label: string; placeholder: string }[] = [
  { key: 'fullName', label: 'Full Name', placeholder: 'e.g. Jane Doe' },
  { key: 'cardNo', label: 'Card No.', placeholder: 'e.g. 00001' },
  { key: 'accountNumber', label: 'Account No.', placeholder: 'e.g. 0123456789' },
  { key: 'school', label: 'School', placeholder: 'e.g. Bright Future Academy' },
  { key: 'caregiver', label: 'Caregiver', placeholder: 'e.g. Mr. John Doe' },
]

const STATUS_OPTIONS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'done', label: 'Done' },
]

export default function SearchPanel({ criteria, onChange, resultCount, status, onStatusChange }: Props) {
  return (
    <div className="search-panel">
      <div className="search-grid">
        {FIELDS.map((f) => (
          <label key={f.key} className="search-field">
            <span>{f.label}</span>
            <input
              type="text"
              value={criteria[f.key]}
              placeholder={f.placeholder}
              onChange={(e) => onChange({ ...criteria, [f.key]: e.target.value })}
            />
          </label>
        ))}
      </div>
      <div className="status-filter">
        <span>Status</span>
        <div className="status-filter-options">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              className={`status-chip${status === opt.key ? ' status-chip-active' : ''}`}
              onClick={() => onStatusChange(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div className="search-meta">
        <span>{resultCount} record{resultCount === 1 ? '' : 's'}</span>
        <button type="button" className="btn-link" onClick={() => onChange(emptyCriteria)}>
          Clear filters
        </button>
      </div>
    </div>
  )
}
