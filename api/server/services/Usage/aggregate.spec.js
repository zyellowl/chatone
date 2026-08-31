const { aggregateUsage } = require('./aggregate');

describe('aggregateUsage', () => {
  it('groups prompt and completion transactions into one request', () => {
    const result = aggregateUsage([
      {
        messageId: 'message-1',
        conversationId: 'conversation-1',
        model: 'anthropic/claude-opus-5',
        tokenType: 'prompt',
        inputTokens: 100,
        readTokens: 200,
        writeTokens: 50,
        tokenValue: -4500,
        createdAt: '2026-08-25T01:00:00.000Z',
      },
      {
        messageId: 'message-1',
        conversationId: 'conversation-1',
        model: 'anthropic/claude-opus-5',
        tokenType: 'completion',
        rawAmount: -25,
        tokenValue: -1875,
        createdAt: '2026-08-25T01:00:01.000Z',
      },
    ]);

    expect(result.summary).toMatchObject({
      requests: 1,
      inputTokens: 100,
      outputTokens: 25,
      cacheReadTokens: 200,
      cacheWriteTokens: 50,
      totalTokens: 375,
      estimatedZenMuxCostUSD: 0.006375,
    });
    expect(result.models[0]).toMatchObject({
      model: 'anthropic/claude-opus-5',
      provider: 'ZenMux',
      billingMode: 'metered',
    });
  });

  it('keeps subscription requests out of metered cost', () => {
    const result = aggregateUsage([
      {
        messageId: 'message-2',
        model: 'gpt-5.6-sol',
        tokenType: 'prompt',
        rawAmount: -1000,
        tokenValue: -10000,
        createdAt: '2026-08-25T02:00:00.000Z',
      },
      {
        messageId: 'message-2',
        model: 'gpt-5.6-sol',
        tokenType: 'completion',
        rawAmount: -200,
        tokenValue: -3000,
        createdAt: '2026-08-25T02:00:02.000Z',
      },
    ]);

    expect(result.summary.subscriptionRequests).toBe(1);
    expect(result.summary.estimatedZenMuxCostUSD).toBe(0);
    expect(result.models[0]).toMatchObject({
      provider: 'ChatGPT subscription',
      billingMode: 'subscription',
      costUSD: 0,
    });
  });

  it.each(['gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.5', 'gpt-5.4-mini'])(
    'marks %s as subscription usage',
    (model) => {
      const result = aggregateUsage([
        {
          messageId: `message-${model}`,
          model,
          tokenType: 'completion',
          rawAmount: -20,
          tokenValue: -100,
          createdAt: '2026-08-25T02:00:02.000Z',
        },
      ]);

      expect(result.models[0]).toMatchObject({ billingMode: 'subscription', costUSD: 0 });
    },
  );
});
