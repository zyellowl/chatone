const SUBSCRIPTION_MODELS = new Set([
  'gpt-5.6-sol',
  'gpt-5.6-terra',
  'gpt-5.6-luna',
  'gpt-5.5',
  'gpt-5.4',
  'gpt-5.4-mini',
  'gpt-5.3-codex-spark',
]);

const absolute = (value) => Math.abs(Number(value) || 0);

function getDateKey(value, timezoneOffset = 0) {
  const date = new Date(value);
  return new Date(date.getTime() - timezoneOffset * 60_000).toISOString().slice(0, 10);
}

function aggregateUsage(transactions, { timezoneOffset = 0 } = {}) {
  const requests = new Map();

  for (const transaction of transactions) {
    const createdAt = transaction.createdAt || transaction.updatedAt || new Date();
    const model = transaction.model || 'Unknown model';
    const requestKey =
      transaction.messageId ||
      `${transaction.conversationId || 'unknown'}:${model}:${new Date(createdAt).toISOString()}`;
    const request = requests.get(requestKey) || {
      id: requestKey,
      messageId: transaction.messageId,
      conversationId: transaction.conversationId,
      model,
      createdAt: new Date(createdAt).toISOString(),
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      tokenValue: 0,
    };

    if (transaction.tokenType === 'prompt') {
      const structuredInput = absolute(transaction.inputTokens);
      const cacheRead = absolute(transaction.readTokens);
      const cacheWrite = absolute(transaction.writeTokens);
      request.inputTokens += structuredInput || absolute(transaction.rawAmount);
      request.cacheReadTokens += cacheRead;
      request.cacheWriteTokens += cacheWrite;
    } else if (transaction.tokenType === 'completion') {
      request.outputTokens += absolute(transaction.rawAmount);
    }

    request.tokenValue += absolute(transaction.tokenValue);
    if (new Date(createdAt) > new Date(request.createdAt)) {
      request.createdAt = new Date(createdAt).toISOString();
    }
    requests.set(requestKey, request);
  }

  const modelMap = new Map();
  const dailyMap = new Map();
  const recent = [];

  for (const request of requests.values()) {
    const billingMode = SUBSCRIPTION_MODELS.has(request.model) ? 'subscription' : 'metered';
    const costUSD = billingMode === 'metered' ? request.tokenValue / 1_000_000 : 0;
    const totalTokens =
      request.inputTokens +
      request.outputTokens +
      request.cacheReadTokens +
      request.cacheWriteTokens;
    const normalized = { ...request, totalTokens, costUSD, billingMode };
    delete normalized.tokenValue;
    recent.push(normalized);

    const modelUsage = modelMap.get(request.model) || {
      model: request.model,
      provider: billingMode === 'subscription' ? 'ChatGPT subscription' : 'ZenMux',
      billingMode,
      requests: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      totalTokens: 0,
      costUSD: 0,
    };
    modelUsage.requests += 1;
    modelUsage.inputTokens += request.inputTokens;
    modelUsage.outputTokens += request.outputTokens;
    modelUsage.cacheReadTokens += request.cacheReadTokens;
    modelUsage.cacheWriteTokens += request.cacheWriteTokens;
    modelUsage.totalTokens += totalTokens;
    modelUsage.costUSD += costUSD;
    modelMap.set(request.model, modelUsage);

    const date = getDateKey(request.createdAt, timezoneOffset);
    const dailyUsage = dailyMap.get(date) || {
      date,
      requests: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      totalTokens: 0,
      costUSD: 0,
    };
    dailyUsage.requests += 1;
    dailyUsage.inputTokens += request.inputTokens;
    dailyUsage.outputTokens += request.outputTokens;
    dailyUsage.cacheReadTokens += request.cacheReadTokens;
    dailyUsage.cacheWriteTokens += request.cacheWriteTokens;
    dailyUsage.totalTokens += totalTokens;
    dailyUsage.costUSD += costUSD;
    dailyMap.set(date, dailyUsage);
  }

  const models = [...modelMap.values()].sort((a, b) => b.totalTokens - a.totalTokens);
  const daily = [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date));
  recent.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const summary = models.reduce(
    (result, model) => {
      result.requests += model.requests;
      result.inputTokens += model.inputTokens;
      result.outputTokens += model.outputTokens;
      result.cacheReadTokens += model.cacheReadTokens;
      result.cacheWriteTokens += model.cacheWriteTokens;
      result.totalTokens += model.totalTokens;
      result.estimatedZenMuxCostUSD += model.costUSD;
      if (model.billingMode === 'subscription') {
        result.subscriptionRequests += model.requests;
      }
      return result;
    },
    {
      requests: 0,
      subscriptionRequests: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      totalTokens: 0,
      estimatedZenMuxCostUSD: 0,
    },
  );

  return { summary, daily, models, recent: recent.slice(0, 20) };
}

module.exports = { aggregateUsage };
