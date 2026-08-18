import { InvalidKeyError, OfficeFile, isEncrypted } from 'office-crypto'

export function fileIsEncrypted(buf: Uint8Array): boolean {
  try {
    return isEncrypted(buf)
  } catch {
    return false
  }
}

export function decryptWithPassword(buf: Uint8Array, password: string): Uint8Array {
  const file = OfficeFile(buf)
  try {
    file.loadKey({ password, verifyPassword: true })
  } catch (err) {
    if (err instanceof InvalidKeyError) throw new Error('Incorrect password.')
    throw err
  }
  return file.decrypt()
}
