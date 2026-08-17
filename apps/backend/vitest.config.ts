// Vitest-Konfiguration für Backend-Unit-Tests

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Gültige Umgebungsvariablen bereitstellen, damit src/config/env.ts beim
    // Import nicht mit process.exit(1) abbricht und echter Produktionscode
    // (Crypto, Middleware, Schemas) getestet werden kann.
    env: {
      DATABASE_URL: 'mysql://test:test@localhost:3306/schuladmin_test',
      JWT_SECRET: 'test-jwt-secret-mindestens-32-zeichen-lang!!',
      JWT_REFRESH_SECRET: 'test-refresh-secret-mindestens-32-zeichen!!',
      FRONTEND_URL: 'http://localhost:5173',
      NODE_ENV: 'test',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/app.ts', 'src/config/**'],
    },
  },
});
