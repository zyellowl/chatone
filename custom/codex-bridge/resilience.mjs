const defaultRetryDelaysMs = [750, 1_500, 3_000, 6_000, 8_000];

export function subscriptionErrorDetail(error) {
  return error instanceof Error ? error.message : String(error);
}

export function isRetryableSubscriptionError(error) {
  const detail = subscriptionErrorDetail(error);
  if (/usage limit|quota|insufficient|model .*not supported|MODEL_NOT_FOUND/i.test(detail)) {
    return false;
  }
  return /overloaded|server(?:s)? (?:are|is) (?:currently )?busy|try again later|temporar(?:y|ily)|bad gateway|gateway timeout|502|503|504|ECONNRESET|ECONNREFUSED|EPIPE|ETIMEDOUT|fetch failed/i.test(
    detail,
  );
}

export function waitWithAbort(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    let timer;
    const cleanup = () => signal?.removeEventListener('abort', abort);
    const abort = () => {
      clearTimeout(timer);
      cleanup();
      reject(new Error('SUBSCRIPTION_REQUEST_ABORTED'));
    };
    timer = setTimeout(() => {
      cleanup();
      resolve();
    }, milliseconds);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) {
      abort();
    }
  });
}

export function createAbortableQueue(maxConcurrent = 1) {
  const concurrency =
    Number.isFinite(maxConcurrent) && maxConcurrent > 0 ? Math.floor(maxConcurrent) : 1;
  const waiting = [];
  let active = 0;

  const dispatch = () => {
    while (active < concurrency && waiting.length > 0) {
      const entry = waiting.shift();
      if (entry.signal?.aborted) {
        entry.reject(new Error('SUBSCRIPTION_REQUEST_ABORTED'));
        continue;
      }
      active += 1;
      entry.cleanup();
      entry.resolve(() => {
        active -= 1;
        dispatch();
      });
    }
  };

  const acquire = (signal) =>
    new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new Error('SUBSCRIPTION_REQUEST_ABORTED'));
        return;
      }
      const entry = {
        signal,
        resolve,
        reject,
        cleanup: () => signal?.removeEventListener('abort', abort),
      };
      const abort = () => {
        const index = waiting.indexOf(entry);
        if (index >= 0) {
          waiting.splice(index, 1);
        }
        entry.cleanup();
        reject(new Error('SUBSCRIPTION_REQUEST_ABORTED'));
      };
      signal?.addEventListener('abort', abort, { once: true });
      waiting.push(entry);
      dispatch();
    });

  return {
    async run(operation, signal) {
      const release = await acquire(signal);
      try {
        return await operation();
      } finally {
        release();
      }
    },
    get active() {
      return active;
    },
    get pending() {
      return waiting.length;
    },
  };
}

export function createSubscriptionRetryPolicy({
  delaysMs = defaultRetryDelaysMs,
  wait = waitWithAbort,
  now = Date.now,
} = {}) {
  const retryDelays = delaysMs.length > 0 ? delaysMs : defaultRetryDelaysMs;
  let retryNotBefore = 0;

  return {
    async run(operation, { signal, shouldRetry = isRetryableSubscriptionError, onRetry } = {}) {
      for (let attempt = 1; attempt <= retryDelays.length + 1; attempt += 1) {
        const cooldownMs = Math.max(0, retryNotBefore - now());
        if (cooldownMs > 0) {
          await wait(cooldownMs, signal);
        }
        try {
          return await operation({ attempt });
        } catch (error) {
          const delayMs = retryDelays[attempt - 1];
          if (delayMs == null || signal?.aborted || !shouldRetry(error)) {
            throw error;
          }
          retryNotBefore = Math.max(retryNotBefore, now() + delayMs);
          onRetry?.({ attempt, nextAttempt: attempt + 1, delayMs, error });
          await wait(delayMs, signal);
        }
      }
      throw new Error('SUBSCRIPTION_RETRY_EXHAUSTED');
    },
    get retryNotBefore() {
      return retryNotBefore;
    },
  };
}
