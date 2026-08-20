export interface ApiRecord {
  id: number
  full_name: string
  default_pin: string | null
  account_number: string
  card_no: string | null
  gsap_no: string | null
  caregiver: string | null
  school: string | null
  lga: string | null
  done: boolean
  done_at: string | null
  done_by: string | null
  created_at: string
  updated_at: string
}

import type { CardRecord } from '../types'

export function toCardRecord(r: ApiRecord): CardRecord {
  return {
    id: r.id,
    fullName: r.full_name ?? '',
    defaultPin: r.default_pin ?? '',
    accountNumber: r.account_number ?? '',
    cardNo: r.card_no ?? '',
    gsapNo: r.gsap_no ?? '',
    caregiver: r.caregiver ?? '',
    school: r.school ?? '',
    lga: r.lga ?? '',
    done: r.done,
    doneAt: r.done_at,
    doneBy: r.done_by,
  }
}

export class ApiRequestError extends Error {
  status: number
  errors?: Record<string, string[]>
  constructor(message: string, status: number, errors?: Record<string, string[]>) {
    super(message)
    this.status = status
    this.errors = errors
  }
}

const TOKEN_KEY = 'kegow-api-token'

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY)
}

function setToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  sessionStorage.removeItem(TOKEN_KEY)
}

function baseUrl(): string {
  const url = import.meta.env.VITE_API_BASE_URL
  if (!url) {
    throw new Error('VITE_API_BASE_URL is not configured — set it in .env to the Laravel API base URL.')
  }
  return String(url).replace(/\/+$/, '')
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  let res: Response
  try {
    res = await fetch(`${baseUrl()}${path}`, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new ApiRequestError('Could not reach the server. Check your connection and the API URL.', 0)
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`
    let errors: Record<string, string[]> | undefined
    try {
      const body = await res.json()
      if (body?.message) message = body.message
      errors = body?.errors
    } catch {
      /* non-JSON error body, keep the generic message */
    }
    if (res.status === 401) clearToken()
    throw new ApiRequestError(message, res.status, errors)
  }

  return res.json() as Promise<T>
}

export async function checkHealth(): Promise<boolean> {
  try {
    await request<{ ok: boolean }>('/health')
    return true
  } catch {
    return false
  }
}

export async function login(pin: string): Promise<void> {
  const data = await request<{ token: string; expires_at: string | null }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ pin }),
  })
  setToken(data.token)
}

export interface ImportPayloadRecord {
  full_name: string
  default_pin?: string
  account_number: string
  card_no?: string
  gsap_no?: string
  caregiver?: string
  school?: string
  lga?: string
}

export interface ImportResult {
  imported: number
  updated: number
  skipped: number
  errors: { row: number; reason: string }[]
}

export function importRecords(records: ImportPayloadRecord[], sourceFile?: string): Promise<ImportResult> {
  return request<ImportResult>('/records/import', {
    method: 'POST',
    body: JSON.stringify({ records, source_file: sourceFile }),
  })
}

export interface SearchParams {
  full_name?: string
  card_no?: string
  account_number?: string
  school?: string
  caregiver?: string
  page?: number
  per_page?: number
}

export interface SearchResult {
  data: ApiRecord[]
  total: number
  page: number
  per_page: number
}

export function searchRecords(params: SearchParams, signal?: AbortSignal): Promise<SearchResult> {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, String(value))
  }
  return request<SearchResult>(`/records?${query.toString()}`, { signal })
}

export function getRecord(id: number): Promise<ApiRecord> {
  return request<ApiRecord>(`/records/${id}`)
}

export function markDone(ids: number[]): Promise<{ updated: number; already_done: number[] }> {
  return request('/records/mark-done', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  })
}

export async function exportRecords(): Promise<void> {
  const token = getToken()
  let res: Response
  try {
    res = await fetch(`${baseUrl()}/records/export`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
  } catch {
    throw new ApiRequestError('Could not reach the server for export.', 0)
  }
  if (!res.ok) throw new ApiRequestError(`Export failed (${res.status})`, res.status)

  const blob = await res.blob()
  const disposition = res.headers.get('Content-Disposition') || ''
  const filename = /filename="?([^"]+)"?/.exec(disposition)?.[1] || 'card-records.xlsx'

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
