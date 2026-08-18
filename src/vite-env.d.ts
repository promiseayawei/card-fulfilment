/// <reference types="vite/client" />

// Minimal File System Access API typings (not yet in all lib.dom.d.ts versions).
interface FileSystemFileHandle {
  getFile(): Promise<File>
  createWritable(): Promise<FileSystemWritableFileStream>
}

interface FileSystemWritableFileStream extends WritableStream {
  write(data: BufferSource | Blob | string): Promise<void>
  close(): Promise<void>
}

interface Window {
  showOpenFilePicker?(options?: unknown): Promise<FileSystemFileHandle[]>
}
