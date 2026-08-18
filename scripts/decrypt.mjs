#!/usr/bin/env node
// One-time local helper: strips Excel password protection so the file can be
// opened in the browser app (SheetJS can't read encrypted workbooks, and we
// don't want the password touching browser/network code).
import { readFileSync, writeFileSync } from 'node:fs'
import { OfficeFile } from 'office-crypto'

const [, , input, password, output] = process.argv

if (!input || !password || !output) {
  console.error('Usage: npm run decrypt -- <input.xlsx> <password> <output.xlsx>')
  process.exit(1)
}

const buf = readFileSync(input)
const file = OfficeFile(buf)
file.loadKey({ password })
writeFileSync(output, file.decrypt())
console.log(`Decrypted -> ${output}`)
