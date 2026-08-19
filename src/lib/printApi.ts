export interface PrinterInfo {
  name: string
  displayName: string
  description: string
  isDefault: boolean
}

interface PrintAPI {
  isElectron: true
  listPrinters: () => Promise<PrinterInfo[]>
  printSilent: (deviceName?: string) => Promise<{ success: boolean; failureReason?: string }>
}

export function getPrintApi(): PrintAPI | null {
  return (window as unknown as { printAPI?: PrintAPI }).printAPI ?? null
}
