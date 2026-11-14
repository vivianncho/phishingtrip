import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Deliberately independent of the preview server: no PORT, API, or database.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/components/mockups/stillwater/**/*.test.tsx'],
    setupFiles: ['./src/components/mockups/stillwater/test/setup.ts'],
    clearMocks: true,
    restoreMocks: true,
    unstubGlobals: true,
  },
});
