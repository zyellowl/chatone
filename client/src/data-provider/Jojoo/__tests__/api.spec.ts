import { getProfile, publishProfile, saveProfile } from '../api';
import type { ProfileSnapshot } from '../types';

const snapshot: ProfileSnapshot = {
  version: 3,
  publishedVersion: 3,
  updatedAt: '2026-09-01T00:00:00.000Z',
  profile: {
    version: 1,
    displayName: 'Jojo',
    headline: 'Engineer',
    introduction: 'Builder',
    focusAreas: ['Agents'],
    experience: [],
    projects: [],
    links: [],
  },
};

function response(payload: object) {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
  } as Response;
}

describe('Jojoo content API', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  it('loads the encrypted owner snapshot directly from the local service', async () => {
    fetchMock.mockResolvedValue(response(snapshot));

    await expect(getProfile()).resolves.toEqual(snapshot);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8788/api/studio/content',
      expect.objectContaining({ credentials: 'include', cache: 'no-store' }),
    );
  });

  it('saves and publishes the exact selected version', async () => {
    fetchMock.mockResolvedValue(response(snapshot));

    await saveProfile(snapshot.profile, snapshot.version);
    await publishProfile(snapshot.version);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:8788/api/studio/content',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ profile: snapshot.profile, expectedVersion: 3 }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:8788/api/studio/content/publish',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ expectedVersion: 3 }) }),
    );
  });
});
