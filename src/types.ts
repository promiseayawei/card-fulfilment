export interface CardRecord {
  rowIndex: number
  fullName: string
  defaultPin: string
  accountNumber: string
  cardNo: string
  gsapNo: string
  caregiver: string
  school: string
  done: boolean
  /** Any other columns from the sheet, kept around for on-screen verification. */
  extra: { label: string; value: string }[]
}

export interface SearchCriteria {
  fullName: string
  cardNo: string
  accountNumber: string
  school: string
  caregiver: string
}

export const emptyCriteria: SearchCriteria = {
  fullName: '',
  cardNo: '',
  accountNumber: '',
  school: '',
  caregiver: '',
}
