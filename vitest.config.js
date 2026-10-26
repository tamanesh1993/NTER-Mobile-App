import { defineConfig } from 'vitest/config';

// Unit tests sit next to the code they test (src/**/*.test.js), as in the nter.pro website repo.
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    include: ['src/**/*.test.{js,jsx}'],
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.js'],
  },
});
