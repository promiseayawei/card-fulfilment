import type { SearchCriteria } from '../types'
import { emptyCriteria } from '../types'

interface Props {
  criteria: SearchCriteria
  onChange: (criteria: SearchCriteria) => void
  resultCount: number
  totalCount: number
}

const FIELDS: { key: keyof SearchCriteria; label: string; placeholder: string }[] = [
  { key: 'fullName', label: 'Full Name', placeholder: 'e.g. Jane Doe' },
  { key: 'cardNo', label: 'Card No.', placeholder: 'e.g. 00001' },
  { key: 'accountNumber', label: 'Account No.', placeholder: 'e.g. 0123456789' },
  { key: 'school', label: 'School', placeholder: 'e.g. Bright Future Academy' },
  { key: 'caregiver', label: 'Caregiver', placeholder: 'e.g. Mr. John Doe' },
]

export default function SearchPanel({ criteria, onChange, resultCount, totalCount }: Props) {
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
      <div className="search-meta">
        <span>
          {resultCount} of {totalCount} record{totalCount === 1 ? '' : 's'} match
        </span>
        <button type="button" className="btn-link" onClick={() => onChange(emptyCriteria)}>
          Clear filters
        </button>
      </div>
    </div>
  )
}
