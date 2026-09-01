import type {
  BlogArticle,
  BlogMediaUpload,
  BlogMutation,
  ProfileSnapshot,
  PublicProfile,
} from './types';

const JOJOO_API_ORIGIN = 'http://127.0.0.1:8788';

export class JojooHttpError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly localPublished = false,
  ) {
    super(code);
    this.name = 'JojooHttpError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${JOJOO_API_ORIGIN}${path}`, {
    ...init,
    credentials: 'include',
    cache: 'no-store',
  });
  if (!response.ok) {
    let code = 'JOJOO_REQUEST_FAILED';
    let localPublished = false;
    try {
      const payload = (await response.json()) as { error?: string; localPublished?: boolean };
      code = payload.error || code;
      localPublished = payload.localPublished === true;
    } catch {
      // Keep a stable error when the service returns a non-JSON response.
    }
    throw new JojooHttpError(code, response.status, localPublished);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export function getProfile(signal?: AbortSignal): Promise<ProfileSnapshot> {
  return request('/api/studio/content', { signal });
}

export function saveProfile(
  profile: PublicProfile,
  expectedVersion: number,
): Promise<ProfileSnapshot> {
  return request('/api/studio/content', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ profile, expectedVersion }),
  });
}

export function publishProfile(expectedVersion: number): Promise<ProfileSnapshot> {
  return request('/api/studio/content/publish', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ expectedVersion }),
  });
}

export function listBlogArticles(signal?: AbortSignal): Promise<BlogArticle[]> {
  return request('/api/studio/blog/articles', { signal });
}

export function getBlogArticle(id: string, signal?: AbortSignal): Promise<BlogArticle> {
  return request(`/api/studio/blog/articles/${encodeURIComponent(id)}`, { signal });
}

export function saveBlogArticle(article: BlogMutation, id?: string): Promise<BlogArticle> {
  return request(
    id ? `/api/studio/blog/articles/${encodeURIComponent(id)}` : '/api/studio/blog/articles',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(article),
    },
  );
}

export function deleteBlogArticle(id: string): Promise<void> {
  return request(`/api/studio/blog/articles/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function uploadBlogMedia(file: File): Promise<BlogMediaUpload> {
  return request('/api/studio/blog/media', {
    method: 'POST',
    headers: { 'content-type': file.type || 'application/octet-stream' },
    body: file,
  });
}

export const jojooQueryKeys = {
  profile: ['jojoo', 'profile'] as const,
  blog: ['jojoo', 'blog'] as const,
  article: (id: string) => ['jojoo', 'blog', id] as const,
};
