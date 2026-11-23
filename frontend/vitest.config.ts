import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()], test: {
  include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  coverage: { provider: 'v8', include: ['src/**/*.{ts,tsx}'], exclude: ['src/**/*.test.*', 'src/**/*.d.ts'], reporter: ['text', 'json-summary', 'html'] },
} });
