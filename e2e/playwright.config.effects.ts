import { defineConfig } from '@playwright/test';
import mockConfig from './playwright.config.mock';

const previewURL = process.env.E2E_BASE_URL ? new URL(process.env.E2E_BASE_URL) : null;
if (
  !previewURL ||
  !['localhost', '127.0.0.1'].includes(previewURL.hostname) ||
  previewURL.port === '3080' ||
  process.env.E2E_USE_MEMORY_MONGO !== 'true'
) {
  throw new Error('Effects checks require a separate loopback port and E2E_USE_MEMORY_MONGO=true');
}

export default defineConfig(mockConfig, {
  globalSetup: require.resolve('./setup/effects'),
  testMatch: 'libraries-effects.spec.ts',
  timeout: 30000,
  reporter: [['list']],
});
