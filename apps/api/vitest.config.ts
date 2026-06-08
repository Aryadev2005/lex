import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_ANON_KEY: 'test-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key-that-is-long-enough',
      JWT_SECRET: 'test-jwt-secret-that-is-at-least-32-characters-long-for-validation',
      JWT_EXPIRES_IN: '7d',
      NODE_ENV: 'test',
      API_PORT: '3001',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
  },
});
