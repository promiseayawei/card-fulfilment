export interface CardRecord {
  id: number
  fullName: string
  defaultPin: string
  accountNumber: string
  cardNo: string
  gsapNo: string
  caregiver: string
  school: string
  lga: string
  done: boolean
  doneAt: string | null
  doneBy: string | null
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
