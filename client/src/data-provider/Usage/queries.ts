import { useRecoilValue } from 'recoil';
import { QueryKeys, dataService } from 'librechat-data-provider';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  TSubscriptionAuthStatus,
  TSubscriptionUsageResponse,
  TUsageRange,
  TUsageResponse,
} from 'librechat-data-provider';
import store from '~/store';

export const useUsageQuery = (range: TUsageRange) => {
  const queriesEnabled = useRecoilValue<boolean>(store.queriesEnabled);
  const timezoneOffset = new Date().getTimezoneOffset();

  return useQuery<TUsageResponse>(
    [QueryKeys.usage, range, timezoneOffset],
    () => dataService.getUsage(range, timezoneOffset),
    {
      enabled: queriesEnabled,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      staleTime: 30_000,
    },
  );
};

export const useSubscriptionUsageQuery = () => {
  const queriesEnabled = useRecoilValue<boolean>(store.queriesEnabled);

  return useQuery<TSubscriptionUsageResponse>(
    [QueryKeys.usage, 'subscription'],
    () => dataService.getSubscriptionUsage(),
    {
      enabled: queriesEnabled,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      staleTime: 60_000,
      retry: 1,
    },
  );
};

const subscriptionAuthKey = [QueryKeys.usage, 'subscription-auth'] as const;

export const useSubscriptionAuthQuery = () => {
  const queriesEnabled = useRecoilValue<boolean>(store.queriesEnabled);

  return useQuery<TSubscriptionAuthStatus>(
    subscriptionAuthKey,
    () => dataService.getSubscriptionAuth(),
    {
      enabled: queriesEnabled,
      refetchInterval: 3_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      staleTime: 1_000,
      retry: 1,
    },
  );
};

export const useStartSubscriptionAuthMutation = () => {
  const queryClient = useQueryClient();
  return useMutation<TSubscriptionAuthStatus, Error>({
    mutationFn: () => dataService.startSubscriptionAuth(),
    onSuccess: (status) => queryClient.setQueryData(subscriptionAuthKey, status),
  });
};

export const useCancelSubscriptionAuthMutation = () => {
  const queryClient = useQueryClient();
  return useMutation<TSubscriptionAuthStatus, Error>({
    mutationFn: () => dataService.cancelSubscriptionAuth(),
    onSuccess: (status) => queryClient.setQueryData(subscriptionAuthKey, status),
  });
};

export const useLogoutSubscriptionAuthMutation = () => {
  const queryClient = useQueryClient();
  return useMutation<TSubscriptionAuthStatus, Error>({
    mutationFn: () => dataService.logoutSubscriptionAuth(),
    onSuccess: (status) => {
      queryClient.setQueryData(subscriptionAuthKey, status);
      void queryClient.invalidateQueries([QueryKeys.usage, 'subscription']);
    },
  });
};
