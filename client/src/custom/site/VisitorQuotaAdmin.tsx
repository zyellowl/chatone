import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RotateCcw } from 'lucide-react';
import { request } from 'librechat-data-provider';
import { useLocalize } from '~/hooks';

interface VisitorUsage {
  visitorKey: string;
  used: number;
  remaining: number;
  epoch: number;
  revision: number;
  blocked: boolean;
  updatedAt: string;
}

interface VisitorUsageResponse {
  limit: number;
  visitors: VisitorUsage[];
}

const queryKey = ['jojoo', 'visitor-quota'] as const;

export default function VisitorQuotaAdmin() {
  const localize = useLocalize();
  const queryClient = useQueryClient();
  const usage = useQuery<VisitorUsageResponse>(
    queryKey,
    () => request.get('/api/admin/visitor-quota/quota'),
    { retry: false, staleTime: 10_000 },
  );
  const reset = useMutation(
    (key: string) => request.post(`/api/admin/visitor-quota/quota/${key}/reset`),
    { onSuccess: () => queryClient.invalidateQueries(queryKey) },
  );

  return (
    <section className="site-editor-card">
      <header>
        <h2>{localize('com_workspace_site_visitor_quota')}</h2>
        <p>{localize('com_workspace_site_visitor_quota_desc')}</p>
      </header>
      {usage.isLoading ? (
        <p className="site-privacy-note">{localize('com_workspace_site_visitor_quota_loading')}</p>
      ) : null}
      {usage.isError ? (
        <p className="site-privacy-note">{localize('com_workspace_site_visitor_quota_forbidden')}</p>
      ) : null}
      {usage.data?.visitors.length === 0 ? (
        <p className="site-privacy-note">{localize('com_workspace_site_visitor_quota_empty')}</p>
      ) : null}
      {usage.data?.visitors.length ? (
        <div className="site-visitor-quota-list">
          {usage.data.visitors.map((visitor) => (
            <article key={visitor.visitorKey}>
              <div>
                <strong>
                  {localize('com_workspace_site_visitor_quota_identity', {
                    0: visitor.visitorKey,
                  })}
                </strong>
                <span>
                  {localize('com_workspace_site_visitor_quota_usage', {
                    0: visitor.used,
                    1: visitor.remaining,
                  })}
                </span>
                <small>{new Date(visitor.updatedAt).toLocaleString()}</small>
              </div>
              <button
                type="button"
                disabled={reset.isLoading}
                onClick={() => reset.mutate(visitor.visitorKey)}
              >
                <RotateCcw aria-hidden="true" />
                {localize('com_workspace_site_visitor_quota_reset')}
              </button>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
