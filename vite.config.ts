import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      stream: fileURLToPath(new URL('./src/utils/mocks/streamMock.ts', import.meta.url))
    }
  }
})
