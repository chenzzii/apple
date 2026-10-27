import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  server: { host: true, port: 5173 },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    // The campaign is loaded with import.meta.glob; a cached transform would miss newly added
    // level files, so do not reuse transformed modules between runs.
    fsModuleCache: false,
    environment: 'node',
  },
});
