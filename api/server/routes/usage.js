const express = require('express');
const { logger } = require('@librechat/data-schemas');
const { requireJwtAuth } = require('../middleware');
const { getTransactions } = require('~/models');
const { aggregateUsage } = require('~/server/services/Usage/aggregate');

const router = express.Router();

const RANGE_DAYS = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};
const VALID_RANGES = new Set([...Object.keys(RANGE_DAYS), 'all']);
const SUBSCRIPTION_BRIDGE_BASE_URL =
  process.env.CODEX_BRIDGE_BASE_URL || 'http://host.docker.internal:4317/v1';
const SUBSCRIPTION_USAGE_URL =
  process.env.CODEX_BRIDGE_USAGE_URL || `${SUBSCRIPTION_BRIDGE_BASE_URL}/subscription/usage`;

async function proxySubscriptionAuth(res, { action, method = 'GET', timeout = 12_000 } = {}) {
  const suffix = action ? `/${action}` : '';
  try {
    const response = await fetch(`${SUBSCRIPTION_BRIDGE_BASE_URL}/subscription/auth${suffix}`, {
      method,
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(timeout),
    });
    const payload = await response.json();
    res.set('Cache-Control', 'private, no-store');
    return res.status(response.status).json(payload);
  } catch (error) {
    logger.warn(`[Usage] Subscription authentication ${action || 'status'} is unavailable`, error);
    return res.status(503).json({
      error: {
        message: 'ChatGPT sign-in is temporarily unavailable.',
        type: 'chatgpt_subscription_error',
        code: 'subscription_auth_unavailable',
      },
    });
  }
}

router.get('/subscription/auth', requireJwtAuth, async (_req, res) => proxySubscriptionAuth(res));

router.post('/subscription/auth/login', requireJwtAuth, async (_req, res) =>
  proxySubscriptionAuth(res, { action: 'login', method: 'POST' }),
);

router.post('/subscription/auth/cancel', requireJwtAuth, async (_req, res) =>
  proxySubscriptionAuth(res, { action: 'cancel', method: 'POST' }),
);

router.post('/subscription/auth/logout', requireJwtAuth, async (_req, res) =>
  proxySubscriptionAuth(res, { action: 'logout', method: 'POST' }),
);

router.get('/subscription', requireJwtAuth, async (_req, res) => {
  logger.info('[Usage] Loading subscription quota');
  try {
    const response = await fetch(SUBSCRIPTION_USAGE_URL, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(22_000),
    });
    if (!response.ok) {
      throw new Error(`Subscription bridge returned HTTP ${response.status}`);
    }
    const quota = await response.json();
    logger.info(`[Usage] Subscription quota loaded (available=${quota.available === true})`);
    res.set('Cache-Control', 'private, no-store');
    return res.json(quota);
  } catch (error) {
    logger.warn('[Usage] Subscription quota is unavailable', error);
    res.set('Cache-Control', 'private, no-store');
    return res.json({
      available: false,
      source: 'openai-subscription',
      updatedAt: new Date().toISOString(),
      errorCode: 'subscription_quota_unavailable',
    });
  }
});

router.get('/', requireJwtAuth, async (req, res) => {
  const range = VALID_RANGES.has(req.query.range) ? req.query.range : '30d';
  const requestedOffset = Number(req.query.timezoneOffset);
  const timezoneOffset = Number.isFinite(requestedOffset)
    ? Math.max(-840, Math.min(840, requestedOffset))
    : 0;
  const filter = { user: req.user.id };

  if (range !== 'all') {
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - RANGE_DAYS[range]);
    filter.createdAt = { $gte: start };
  }

  try {
    const transactions = await getTransactions(filter);
    res.set('Cache-Control', 'private, no-store');
    return res.json({
      range,
      updatedAt: new Date().toISOString(),
      ...aggregateUsage(transactions, { timezoneOffset }),
    });
  } catch (error) {
    logger.error('[Usage] Failed to aggregate usage statistics', error);
    return res.status(500).json({ message: 'Usage data is temporarily unavailable.' });
  }
});

module.exports = router;
