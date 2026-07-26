import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.js'],
    setupFiles: './tests/setup.js',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['app.js', 'config.js', 'errorHandler.js', 'logger.js', 'validators.js', 'routes/**'],
      thresholds: {
        statements: 80,
        branches: 55,
        functions: 80,
        lines: 80,
      },
    },
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});
