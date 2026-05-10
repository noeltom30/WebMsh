import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    include: [
      './tests/unit/**/*.test.js',
      './tests/integration/**/*.test.jsx',
      './tests/Irfan/**/*.test.js',
      './tests/Irfan/**/*.test.jsx',
    ],
    coverage: {
      reporter: ['text', 'html'],
      reportsDirectory: '../tests/reports/frontend-coverage',
    },
  },
})
