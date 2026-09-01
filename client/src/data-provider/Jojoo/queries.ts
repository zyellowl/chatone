import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteBlogArticle,
  getBlogArticle,
  getProfile,
  jojooQueryKeys,
  listBlogArticles,
  publishProfile,
  saveBlogArticle,
  saveProfile,
  uploadBlogMedia,
} from './api';
import type { BlogArticle, BlogMutation, ProfileSnapshot, PublicProfile } from './types';

export function useJojooProfileQuery() {
  return useQuery(jojooQueryKeys.profile, ({ signal }) => getProfile(signal), {
    staleTime: 15_000,
    retry: 1,
  });
}

export function useSaveJojooProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation<ProfileSnapshot, Error, { profile: PublicProfile; expectedVersion: number }>(
    ({ profile, expectedVersion }) => saveProfile(profile, expectedVersion),
    {
      onSuccess: (snapshot) => queryClient.setQueryData(jojooQueryKeys.profile, snapshot),
    },
  );
}

export function usePublishJojooProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation<ProfileSnapshot, Error, number>((version) => publishProfile(version), {
    onSuccess: (snapshot) => queryClient.setQueryData(jojooQueryKeys.profile, snapshot),
  });
}

export function useJojooBlogQuery() {
  return useQuery(jojooQueryKeys.blog, ({ signal }) => listBlogArticles(signal), {
    staleTime: 15_000,
    retry: 1,
  });
}

export function useJojooArticleQuery(id?: string) {
  return useQuery(
    jojooQueryKeys.article(id || 'new'),
    ({ signal }) => getBlogArticle(id!, signal),
    { enabled: Boolean(id), retry: 1 },
  );
}

export function useSaveJojooArticleMutation() {
  const queryClient = useQueryClient();
  return useMutation<
    Awaited<ReturnType<typeof saveBlogArticle>>,
    Error,
    { article: BlogMutation; id?: string }
  >(({ article, id }) => saveBlogArticle(article, id), {
    onSuccess: (saved) => {
      queryClient.setQueryData(jojooQueryKeys.article(saved.id), saved);
      void queryClient.invalidateQueries(jojooQueryKeys.blog);
    },
  });
}

export function useDeleteJojooArticleMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>((id) => deleteBlogArticle(id), {
    onSuccess: (_result, id) => {
      queryClient.setQueryData<BlogArticle[]>(jojooQueryKeys.blog, (articles) =>
        articles?.filter((article) => article.id !== id),
      );
    },
  });
}

export function useUploadJojooMediaMutation() {
  return useMutation(uploadBlogMedia);
}
