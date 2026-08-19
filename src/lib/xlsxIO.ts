import * as XLSX from 'xlsx'

export interface LoadedSheet {
  fileName: string
  headers: string[]
  rows: Record<string, string>[]
}

export interface ParsedRecord {
  fullName: string
  defaultPin: string
  accountNumber: string
  cardNo: string
  gsapNo: string
  caregiver: string
  school: string
  lga: string
}

// Accepted header aliases -> canonical field. Compared after lowercasing and
// stripping everything but letters/digits, so "Card No.", "card_no", "CardNo"
// all match "cardno".
const ALIASES: Record<string, keyof ParsedRecord> = {
  fullname: 'fullName',
  name: 'fullName',
  studentname: 'fullName',
  holdername: 'fullName',
  cardholdername: 'fullName',
  idwacctname: 'fullName',
  defaultpin: 'defaultPin',
  pin: 'defaultPin',
  defaultpincode: 'defaultPin',
  accountnumber: 'accountNumber',
  accountno: 'accountNumber',
  acctno: 'accountNumber',
  idwacctno: 'accountNumber',
  cardno: 'cardNo',
  cardnumber: 'cardNo',
  idwcardno: 'cardNo',
  gsapno: 'gsapNo',
  gsapnumber: 'gsapNo',
  idwgsapno: 'gsapNo',
  caregiver: 'caregiver',
  parentguardian: 'caregiver',
  guardian: 'caregiver',
  idwcaregiver: 'caregiver',
  school: 'school',
  schoolname: 'school',
  idwschool: 'school',
  lga: 'lga',
  idwlga: 'lga',
  localgovernment: 'lga',
  localgovernmentarea: 'lga',
}

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function parseWorkbookBuffer(buf: ArrayBuffer | Uint8Array, fileName: string): LoadedSheet {
  const wb = XLSX.read(buf, { type: 'array' })
  const sheetName = wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]

  const headerRow = (XLSX.utils.sheet_to_json(ws, { header: 1 })[0] as string[]) ?? []
  const headers = headerRow.map((h) => String(h ?? '').trim()).filter((h) => h.length > 0)

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: '',
  }).map((row) => {
    const out: Record<string, string> = {}
    for (const h of headers) {
      out[h] = row[h] == null ? '' : String(row[h])
    }
    return out
  })

  return { fileName, headers, rows }
}

export async function readWorkbookFromFile(file: File): Promise<LoadedSheet> {
  const buf = await file.arrayBuffer()
  return parseWorkbookBuffer(buf, file.name)
}

export function buildFieldMapping(headers: string[]): Map<keyof ParsedRecord, string> {
  const headerByField = new Map<keyof ParsedRecord, string>()
  for (const header of headers) {
    const canonical = ALIASES[normalizeHeader(header)]
    if (canonical && !headerByField.has(canonical)) {
      headerByField.set(canonical, header)
    }
  }
  return headerByField
}

export function rowsToImportRecords(rows: Record<string, string>[], headers: string[]): ParsedRecord[] {
  const headerByField = buildFieldMapping(headers)
  const get = (field: keyof ParsedRecord, row: Record<string, string>) => {
    const header = headerByField.get(field)
    return header ? (row[header] ?? '') : ''
  }

  return rows.map((row) => ({
    fullName: get('fullName', row),
    defaultPin: get('defaultPin', row),
    accountNumber: get('accountNumber', row),
    cardNo: get('cardNo', row),
    gsapNo: get('gsapNo', row),
    caregiver: get('caregiver', row),
    school: get('school', row),
    lga: get('lga', row),
  }))
}

export function supportsFileSystemAccess(): boolean {
  return typeof (window as unknown as { showOpenFilePicker?: unknown }).showOpenFilePicker === 'function'
}

export async function openFileWithPicker(): Promise<File | null> {
  const picker = (window as unknown as {
    showOpenFilePicker: (opts: unknown) => Promise<FileSystemFileHandle[]>
  }).showOpenFilePicker
  try {
    const [handle] = await picker({
      types: [
        {
          description: 'Excel files',
          accept: {
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.ms-excel': ['.xls'],
          },
        },
      ],
      excludeAcceptAllOption: false,
      multiple: false,
    })
    return await handle.getFile()
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') return null
    throw err
  }
}
