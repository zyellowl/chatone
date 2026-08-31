import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Clock3,
  Coins,
  Database,
  ExternalLink,
  Gauge,
  LogIn,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type {
  TSubscriptionQuotaWindow,
  TSubscriptionUsageResponse,
  TUsageDay,
  TUsageModel,
  TUsageRange,
} from 'librechat-data-provider';
import {
  useCancelSubscriptionAuthMutation,
  useLogoutSubscriptionAuthMutation,
  useStartSubscriptionAuthMutation,
  useSubscriptionAuthQuery,
  useSubscriptionUsageQuery,
  useUsageQuery,
} from '~/data-provider';
import { useLocalize } from '~/hooks';

const ranges: TUsageRange[] = ['7d', '30d', '90d', 'all'];
const rangeLabels = {
  '7d': 'com_usage_range_7d',
  '30d': 'com_usage_range_30d',
  '90d': 'com_usage_range_90d',
  all: 'com_usage_range_all',
} as const;

const compactNumber = new Intl.NumberFormat(undefined, {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const fullNumber = new Intl.NumberFormat();

function formatTokens(value: number, compact = true) {
  return compact ? compactNumber.format(value) : fullNumber.format(value);
}

function formatCost(value: number) {
  if (value === 0) {
    return '$0.00';
  }
  return value < 0.01 ? '<$0.01' : `$${value.toFixed(2)}`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatPlan(value?: string) {
  if (!value) {
    return undefined;
  }
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function SubscriptionConnection({ onConnected }: { onConnected: () => unknown }) {
  const localize = useLocalize();
  const { data, isLoading } = useSubscriptionAuthQuery();
  const startLogin = useStartSubscriptionAuthMutation();
  const cancelLogin = useCancelSubscriptionAuthMutation();
  const logout = useLogoutSubscriptionAuthMutation();
  const pending = data?.status === 'pending' || startLogin.isLoading;
  const busy = pending || cancelLogin.isLoading || logout.isLoading;
  let connectionState = 'idle';
  let connectionLabel = localize('com_usage_chatgpt_not_connected');
  if (data?.connected) {
    connectionState = 'connected';
    connectionLabel = localize('com_usage_chatgpt_connected');
  } else if (pending) {
    connectionState = 'pending';
    connectionLabel = localize('com_usage_chatgpt_connecting');
  }

  let connectionAction;
  if (pending) {
    connectionAction = (
      <>
        {data?.authorizationUrl && (
          <a href={data.authorizationUrl} target="_blank" rel="noreferrer">
            <ExternalLink aria-hidden="true" />
            {localize('com_usage_chatgpt_open_login')}
          </a>
        )}
        <button type="button" onClick={() => cancelLogin.mutate()} disabled={busy}>
          {localize('com_usage_chatgpt_cancel')}
        </button>
      </>
    );
  } else if (data?.connected) {
    connectionAction = (
      <button type="button" onClick={() => logout.mutate()} disabled={busy}>
        <LogOut aria-hidden="true" />
        {localize('com_usage_chatgpt_disconnect')}
      </button>
    );
  } else {
    connectionAction = (
      <button
        type="button"
        className="primary"
        onClick={() => startLogin.mutate()}
        disabled={busy || isLoading}
      >
        <LogIn aria-hidden="true" />
        {localize('com_usage_chatgpt_connect')}
      </button>
    );
  }

  useEffect(() => {
    if (data?.connected) {
      void onConnected();
    }
  }, [data?.connected, onConnected]);

  return (
    <section
      className="personal-subscription-connection"
      aria-labelledby="subscription-connection-heading"
    >
      <div className="personal-subscription-connection-main">
        <div className="personal-subscription-connection-icon" aria-hidden="true">
          {data?.connected ? <CheckCircle2 /> : <LogIn />}
        </div>
        <div className="min-w-0">
          <div className="personal-subscription-connection-title">
            <h2 id="subscription-connection-heading">{localize('com_usage_chatgpt_connection')}</h2>
            <span data-state={connectionState}>{connectionLabel}</span>
          </div>
          <p>{localize('com_usage_chatgpt_connection_desc')}</p>
          {data?.connected && (
            <div className="personal-subscription-connection-meta">
              {data.accountIdSuffix && (
                <span>{localize('com_usage_chatgpt_account', { 0: data.accountIdSuffix })}</span>
              )}
              <span>{localize('com_usage_chatgpt_models', { 0: data.models.length })}</span>
            </div>
          )}
          {data?.status === 'error' && data.message && (
            <div className="personal-subscription-auth-error" role="alert">
              {data.message}
            </div>
          )}
        </div>
      </div>

      <div className="personal-subscription-connection-actions">{connectionAction}</div>

      <div className="personal-subscription-security-note">
        <ShieldCheck aria-hidden="true" />
        <span>{localize('com_usage_chatgpt_secure')}</span>
      </div>
    </section>
  );
}

function QuotaCard({ title, quota }: { title: string; quota: TSubscriptionQuotaWindow }) {
  const localize = useLocalize();
  const remaining = Math.round(quota.remainingPercent);

  return (
    <article className="personal-subscription-quota-card">
      <div className="personal-subscription-quota-title">
        <Clock3 aria-hidden="true" />
        <span>{title}</span>
      </div>
      <strong>{localize('com_usage_remaining_percent', { 0: remaining })}</strong>
      <div
        className="personal-subscription-progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={remaining}
        aria-label={title}
      >
        <span style={{ width: `${remaining}%` }} />
      </div>
      <div className="personal-subscription-quota-meta">
        <span>{localize('com_usage_used_percent', { 0: Math.round(quota.usedPercent) })}</span>
        {quota.resetsAt && (
          <span>{localize('com_usage_resets', { 0: formatDateTime(quota.resetsAt) })}</span>
        )}
      </div>
    </article>
  );
}

function SubscriptionQuota({
  data,
  loading,
}: {
  data?: TSubscriptionUsageResponse;
  loading: boolean;
}) {
  const localize = useLocalize();
  const plan = formatPlan(data?.planType);

  return (
    <section className="personal-subscription-section" aria-labelledby="subscription-quota-heading">
      <div className="personal-usage-section-heading">
        <div>
          <div className="personal-subscription-heading-row">
            <Gauge aria-hidden="true" />
            <h2 id="subscription-quota-heading">{localize('com_usage_gpt_subscription')}</h2>
            {plan && <span>{localize('com_usage_plan', { 0: plan })}</span>}
          </div>
          <p>{localize('com_usage_gpt_quota_desc')}</p>
        </div>
        {data?.available && (
          <span className="personal-subscription-live">{localize('com_usage_quota_live')}</span>
        )}
      </div>

      {loading && !data && <div className="personal-subscription-skeleton" aria-hidden="true" />}
      {data?.available && (data.weekly || data.session) ? (
        <div className="personal-subscription-quota-grid">
          {data.weekly && (
            <QuotaCard title={localize('com_usage_weekly_remaining')} quota={data.weekly} />
          )}
          {data.session && (
            <QuotaCard title={localize('com_usage_session_remaining')} quota={data.session} />
          )}
        </div>
      ) : (
        !loading && (
          <div className="personal-subscription-unavailable">
            {localize('com_usage_quota_unavailable')}
          </div>
        )
      )}
    </section>
  );
}

function DailyChart({ days }: { days: TUsageDay[] }) {
  const localize = useLocalize();
  const visibleDays = days.slice(-30);
  const maximum = Math.max(...visibleDays.map((day) => day.totalTokens), 1);

  if (visibleDays.length === 0) {
    return (
      <div className="personal-usage-empty">
        <Activity aria-hidden="true" />
        <span>{localize('com_usage_no_activity')}</span>
      </div>
    );
  }

  return (
    <div className="personal-usage-chart" role="img" aria-label={localize('com_usage_daily_chart')}>
      {visibleDays.map((day) => {
        const height = Math.max(4, (day.totalTokens / maximum) * 100);
        return (
          <div
            className="personal-usage-chart-column"
            key={day.date}
            title={`${day.date}: ${formatTokens(day.totalTokens, false)} tokens`}
          >
            <div className="personal-usage-chart-bar" style={{ height: `${height}%` }} />
          </div>
        );
      })}
    </div>
  );
}

function ModelRow({ model, maximum }: { model: TUsageModel; maximum: number }) {
  const localize = useLocalize();
  const width = Math.max(3, (model.totalTokens / Math.max(maximum, 1)) * 100);

  return (
    <div className="personal-usage-model-row">
      <div className="personal-usage-model-heading">
        <div className="min-w-0">
          <div className="truncate font-medium text-text-primary">{model.model}</div>
          <div className="mt-0.5 text-xs text-text-secondary">{model.provider}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-medium text-text-primary">{formatTokens(model.totalTokens)}</div>
          <div className="mt-0.5 text-xs text-text-secondary">
            {model.billingMode === 'subscription'
              ? localize('com_usage_included')
              : formatCost(model.costUSD)}
          </div>
        </div>
      </div>
      <div className="personal-usage-progress-track" aria-hidden="true">
        <div className="personal-usage-progress-fill" style={{ width: `${width}%` }} />
      </div>
      <div className="personal-usage-model-meta">
        <span>{localize('com_usage_requests_count', { 0: model.requests })}</span>
        <span>
          {localize('com_usage_cache_read_count', { 0: formatTokens(model.cacheReadTokens) })}
        </span>
      </div>
    </div>
  );
}

export default function UsagePage() {
  const localize = useLocalize();
  const [range, setRange] = useState<TUsageRange>('30d');
  const { data, isLoading, isFetching, error, refetch } = useUsageQuery(range);
  const {
    data: subscriptionData,
    isLoading: isSubscriptionLoading,
    isFetching: isSubscriptionFetching,
    refetch: refetchSubscription,
  } = useSubscriptionUsageQuery();
  const maximumModelTokens = useMemo(
    () => Math.max(...(data?.models.map((model) => model.totalTokens) ?? [1])),
    [data?.models],
  );

  return (
    <main className="personal-usage-page" data-testid="usage-page">
      <div className="personal-usage-shell">
        <header className="personal-usage-header">
          <div>
            <p className="personal-usage-eyebrow">{localize('com_usage_settings')}</p>
            <h1>{localize('com_usage_title')}</h1>
            <p>{localize('com_usage_subtitle')}</p>
          </div>
          <button
            type="button"
            className="personal-usage-refresh"
            onClick={() => void Promise.all([refetch(), refetchSubscription()])}
            disabled={isFetching || isSubscriptionFetching}
            aria-label={localize('com_usage_refresh')}
          >
            <RefreshCw
              className={isFetching || isSubscriptionFetching ? 'animate-spin' : ''}
              aria-hidden="true"
            />
            <span>{localize('com_usage_refresh')}</span>
          </button>
        </header>

        <div className="personal-usage-range" aria-label={localize('com_usage_period')}>
          {ranges.map((option) => (
            <button
              type="button"
              key={option}
              onClick={() => setRange(option)}
              aria-pressed={range === option}
            >
              {localize(rangeLabels[option])}
            </button>
          ))}
        </div>

        <SubscriptionConnection onConnected={refetchSubscription} />

        <SubscriptionQuota data={subscriptionData} loading={isSubscriptionLoading} />

        {isLoading && (
          <div className="personal-usage-loading" role="status">
            <span />
            <span />
            <span />
          </div>
        )}

        {error && !data && (
          <div className="personal-usage-error" role="alert">
            <strong>{localize('com_usage_unavailable')}</strong>
            <p>{localize('com_usage_unavailable_desc')}</p>
            <button type="button" onClick={() => refetch()}>
              {localize('com_ui_retry')}
            </button>
          </div>
        )}

        {data && (
          <>
            <section className="personal-usage-section" aria-labelledby="usage-overview-heading">
              <div className="personal-usage-section-heading">
                <div>
                  <h2 id="usage-overview-heading">{localize('com_usage_overview')}</h2>
                  <p>{localize('com_usage_updated', { 0: formatDateTime(data.updatedAt) })}</p>
                </div>
              </div>

              <div className="personal-usage-metrics">
                <article>
                  <Coins aria-hidden="true" />
                  <span>{localize('com_usage_estimated_cost')}</span>
                  <strong>{formatCost(data.summary.estimatedZenMuxCostUSD)}</strong>
                  <small>
                    {localize('com_usage_subscription_requests', {
                      0: data.summary.subscriptionRequests,
                    })}
                  </small>
                </article>
                <article>
                  <Activity aria-hidden="true" />
                  <span>{localize('com_usage_requests')}</span>
                  <strong>{fullNumber.format(data.summary.requests)}</strong>
                  <small>{localize('com_usage_all_providers')}</small>
                </article>
                <article>
                  <Sparkles aria-hidden="true" />
                  <span>{localize('com_usage_total_tokens')}</span>
                  <strong>{formatTokens(data.summary.totalTokens)}</strong>
                  <small>
                    {localize('com_usage_input_output', {
                      0: formatTokens(data.summary.inputTokens),
                      1: formatTokens(data.summary.outputTokens),
                    })}
                  </small>
                </article>
                <article>
                  <Database aria-hidden="true" />
                  <span>{localize('com_usage_cache_read')}</span>
                  <strong>{formatTokens(data.summary.cacheReadTokens)}</strong>
                  <small>{localize('com_usage_cache_explanation')}</small>
                </article>
              </div>

              <div className="personal-usage-chart-card">
                <div>
                  <h3>{localize('com_usage_activity')}</h3>
                  <span>{localize('com_usage_last_30_points')}</span>
                </div>
                <DailyChart days={data.daily} />
              </div>
            </section>

            <section className="personal-usage-section" aria-labelledby="usage-models-heading">
              <div className="personal-usage-section-heading">
                <div>
                  <h2 id="usage-models-heading">{localize('com_usage_by_model')}</h2>
                  <p>{localize('com_usage_by_model_desc')}</p>
                </div>
              </div>
              <div className="personal-usage-models">
                {data.models.length === 0 ? (
                  <div className="personal-usage-empty compact">
                    <span>{localize('com_usage_no_activity')}</span>
                  </div>
                ) : (
                  data.models.map((model) => (
                    <ModelRow key={model.model} model={model} maximum={maximumModelTokens} />
                  ))
                )}
              </div>
            </section>

            <section className="personal-usage-section" aria-labelledby="usage-recent-heading">
              <div className="personal-usage-section-heading">
                <div>
                  <h2 id="usage-recent-heading">{localize('com_usage_recent')}</h2>
                  <p>{localize('com_usage_recent_desc')}</p>
                </div>
              </div>
              <div className="personal-usage-table-wrap">
                <table className="personal-usage-table">
                  <thead>
                    <tr>
                      <th>{localize('com_usage_model')}</th>
                      <th>{localize('com_usage_time')}</th>
                      <th>{localize('com_usage_tokens')}</th>
                      <th>{localize('com_usage_cost')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent.map((request) => (
                      <tr key={request.id}>
                        <td>{request.model}</td>
                        <td>{formatDateTime(request.createdAt)}</td>
                        <td>{formatTokens(request.totalTokens)}</td>
                        <td>
                          {request.billingMode === 'subscription'
                            ? localize('com_usage_included')
                            : formatCost(request.costUSD)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.recent.length === 0 && (
                  <div className="personal-usage-empty compact">
                    <span>{localize('com_usage_no_activity')}</span>
                  </div>
                )}
              </div>
            </section>

            <aside className="personal-usage-note">
              <strong>{localize('com_usage_about_estimates')}</strong>
              <p>{localize('com_usage_about_estimates_desc')}</p>
            </aside>
          </>
        )}
      </div>
    </main>
  );
}
