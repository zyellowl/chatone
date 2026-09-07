import { defineConfig } from '@playwright/test';
import effects from './playwright.config.effects';
// Exercise touch controls while retaining enough space for history management checks.
// libraries-effects.spec.ts also exercises the 390 px iPhone layout.
export default defineConfig(effects, {
  testMatch: ['libraries-effects.spec.ts', 'chat.spec.ts', 'conversation-management.spec.ts'],
  timeout: 60000,
  expect: { timeout: 30000 },
  use: { ...effects.use, hasTouch: true },
});
