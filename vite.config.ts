import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// office-crypto (used to open password-protected Excel files entirely
// client-side) imports Node's `crypto` module; polyfill just that so the
// password never has to leave the browser.
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ['crypto', 'buffer', 'stream', 'vm'],
      globals: { Buffer: true, global: true, process: true },
    }),
  ],
})
