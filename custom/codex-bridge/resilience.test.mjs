import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAbortableQueue,
  createSubscriptionRetryPolicy,
  isRetryableSubscriptionError,
} from './resilience.mjs';

test('classifies transient overload separately from permanent failures', () => {
  assert.equal(
    isRetryableSubscriptionError(new Error('Our servers are currently overloaded.')),
    true,
  );
  assert.equal(isRetryableSubscriptionError(new Error('503 Bad Gateway')), true);
  assert.equal(isRetryableSubscriptionError(new Error('usage limit reached')), false);
  assert.equal(isRetryableSubscriptionError(new Error('model is not supported')), false);
});

test('retries transient failures with adaptive delays and keeps the selected model operation', async () => {
  const waits = [];
  const retries = [];
  let attempts = 0;
  let clock = 0;
  const policy = createSubscriptionRetryPolicy({
    delaysMs: [10, 20, 40],
    now: () => clock,
    wait: async (milliseconds) => {
      waits.push(milliseconds);
      clock += milliseconds;
    },
  });

  const result = await policy.run(
    async () => {
      attempts += 1;
      if (attempts < 3) {
        throw new Error('Our servers are currently overloaded. Please try again later.');
      }
      return 'gpt-5.6-sol';
    },
    { onRetry: (event) => retries.push(event.nextAttempt) },
  );

  assert.equal(result, 'gpt-5.6-sol');
  assert.equal(attempts, 3);
  assert.deepEqual(waits, [10, 20]);
  assert.deepEqual(retries, [2, 3]);
});

test('does not retry after output has started', async () => {
  let attempts = 0;
  const policy = createSubscriptionRetryPolicy({ delaysMs: [1], wait: async () => {} });
  await assert.rejects(
    policy.run(
      async () => {
        attempts += 1;
        throw new Error('Our servers are currently overloaded.');
      },
      { shouldRetry: () => false },
    ),
    /overloaded/,
  );
  assert.equal(attempts, 1);
});

test('serializes subscription requests to avoid self-inflicted overload', async () => {
  const queue = createAbortableQueue(1);
  const order = [];
  let releaseFirst;
  const firstGate = new Promise((resolve) => {
    releaseFirst = resolve;
  });
  const first = queue.run(async () => {
    order.push('first-start');
    await firstGate;
    order.push('first-end');
  });
  const second = queue.run(async () => {
    order.push('second-start');
    order.push('second-end');
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(order, ['first-start']);
  releaseFirst();
  await Promise.all([first, second]);
  assert.deepEqual(order, ['first-start', 'first-end', 'second-start', 'second-end']);
});

test('removes an aborted request while it is waiting in the queue', async () => {
  const queue = createAbortableQueue(1);
  let releaseFirst;
  const firstGate = new Promise((resolve) => {
    releaseFirst = resolve;
  });
  const first = queue.run(() => firstGate);
  const controller = new AbortController();
  const second = queue.run(async () => 'unexpected', controller.signal);
  controller.abort();
  await assert.rejects(second, /SUBSCRIPTION_REQUEST_ABORTED/);
  releaseFirst();
  await first;
  assert.equal(queue.pending, 0);
});
