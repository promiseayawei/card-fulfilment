import * as XLSX from 'xlsx'
import type { CardRecord } from '../types'

export const DONE_HEADER = 'Done'

export interface LoadedSheet {
  fileName: string
  headers: string[]
  rows: Record<string, string>[]
  fileHandle: FileSystemFileHandle | null
}

// Accepted header aliases -> canonical field. Compared after lowercasing and
// stripping everything but letters/digits, so "Card No.", "card_no", "CardNo"
// all match "cardno".
const ALIASES: Record<string, keyof Omit<CardRecord, 'rowIndex' | 'done'>> = {
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
}

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function findDoneHeader(headers: string[]): string | null {
  return headers.find((h) => normalizeHeader(h) === 'done') ?? null
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

  if (!findDoneHeader(headers)) {
    headers.push(DONE_HEADER)
    for (const row of rows) row[DONE_HEADER] = ''
  }

  return { fileName, headers, rows, fileHandle: null }
}

export async function readWorkbookFromFile(file: File): Promise<LoadedSheet> {
  const buf = await file.arrayBuffer()
  return parseWorkbookBuffer(buf, file.name)
}

export interface FieldMapping {
  headerByField: Map<string, string>
  doneHeader: string | null
  extraHeaders: string[]
}

export function buildFieldMapping(headers: string[]): FieldMapping {
  const headerByField = new Map<string, string>()
  for (const header of headers) {
    const canonical = ALIASES[normalizeHeader(header)]
    if (canonical && !headerByField.has(canonical)) {
      headerByField.set(canonical, header)
    }
  }
  const doneHeader = findDoneHeader(headers)
  const mapped = new Set([...headerByField.values(), ...(doneHeader ? [doneHeader] : [])])
  const extraHeaders = headers.filter((h) => !mapped.has(h))
  return { headerByField, doneHeader, extraHeaders }
}

export function rowsToRecords(rows: Record<string, string>[], headers: string[]): CardRecord[] {
  const { headerByField, doneHeader, extraHeaders } = buildFieldMapping(headers)

  return rows.map((row, rowIndex) => ({
    rowIndex,
    fullName: headerByField.has('fullName') ? row[headerByField.get('fullName')!] : '',
    defaultPin: headerByField.has('defaultPin') ? row[headerByField.get('defaultPin')!] : '',
    accountNumber: headerByField.has('accountNumber') ? row[headerByField.get('accountNumber')!] : '',
    cardNo: headerByField.has('cardNo') ? row[headerByField.get('cardNo')!] : '',
    gsapNo: headerByField.has('gsapNo') ? row[headerByField.get('gsapNo')!] : '',
    caregiver: headerByField.has('caregiver') ? row[headerByField.get('caregiver')!] : '',
    school: headerByField.has('school') ? row[headerByField.get('school')!] : '',
    done: doneHeader ? /^(yes|y|true|1|done)$/i.test((row[doneHeader] ?? '').trim()) : false,
    extra: extraHeaders.map((h) => ({ label: h, value: row[h] ?? '' })),
  }))
}

export function markRowsDone(rows: Record<string, string>[], headers: string[], rowIndexes: number[]): void {
  const doneHeader = findDoneHeader(headers) ?? DONE_HEADER
  for (const idx of rowIndexes) {
    if (rows[idx]) rows[idx][doneHeader] = 'Yes'
  }
}

function buildWorkbook(headers: string[], rows: Record<string, string>[]): XLSX.WorkBook {
  const ws = XLSX.utils.json_to_sheet(rows, { header: headers })
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  return wb
}

export function downloadWorkbook(headers: string[], rows: Record<string, string>[], fileName: string): void {
  const wb = buildWorkbook(headers, rows)
  XLSX.writeFile(wb, fileName)
}

export async function saveWorkbookToHandle(
  headers: string[],
  rows: Record<string, string>[],
  handle: FileSystemFileHandle,
): Promise<void> {
  const wb = buildWorkbook(headers, rows)
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  const writable = await handle.createWritable()
  await writable.write(out)
  await writable.close()
}

export function supportsFileSystemAccess(): boolean {
  return typeof (window as unknown as { showOpenFilePicker?: unknown }).showOpenFilePicker === 'function'
}

export async function openFileWithPicker(): Promise<{ file: File; handle: FileSystemFileHandle } | null> {
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
    const file = await handle.getFile()
    return { file, handle }
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') return null
    throw err
  }
}
