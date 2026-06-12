/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // スマホ実機のマイク検証用 (getUserMedia は HTTPS 必須): `bun run dev:https`
  plugins: [react(), tailwindcss(), ...(mode === 'https' ? [basicSsl()] : [])],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
}))
