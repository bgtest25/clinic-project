/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // amazon-cognito-identity-js (and its transitive deps) reference Node's
  // `global` — undefined in a real browser, so without this the app throws
  // "ReferenceError: global is not defined" before it ever renders.
  define: {
    global: 'globalThis',
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
