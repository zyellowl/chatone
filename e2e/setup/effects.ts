import { request } from '@playwright/test';
import type { FullConfig } from '@playwright/test';
import { getE2EUser } from './user';

export default async function setup(config: FullConfig) {
  const { baseURL, storageState } = config.projects[0].use;
  if (!baseURL || typeof storageState !== 'string') {
    throw new Error('Effects checks require a preview URL and storage path');
  }
  const user = getE2EUser();
  const api = await request.newContext({ baseURL });
  try {
    const registration = await api.post('/api/auth/register', {
      data: { ...user, username: 'effects-preview', confirm_password: user.password },
    });
    if (!registration.ok()) {
      throw new Error(`Preview registration failed: ${registration.status()}`);
    }
    const login = await api.post('/api/auth/login', { data: user });
    if (!login.ok()) {
      throw new Error(`Preview login failed: ${login.status()}`);
    }
    await api.storageState({ path: storageState });
  } finally {
    await api.dispose();
  }
}
