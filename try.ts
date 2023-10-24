export type DelayStrategy = (
  retryCount: number,
  options: TryForOptions
) => number;

export const LinearDelayStrategy: DelayStrategy = (retryCount, options) =>
  options.delayDuration * retryCount;

export const ExponentialDelayStrategy: DelayStrategy = (retryCount, options) =>
  options.delayDuration * (retryCount * retryCount);

export const ConstantDelayStrategy: DelayStrategy = (_, options) =>
  options.delayDuration;

interface TryForOptions {
  maxRetries: number;
  timeout: number;
  delayDuration: number;
  delayStrategy: DelayStrategy;
  cancel?: any;
  abortOnSameError: boolean;
  onError?: (error: unknown) => Action | void;
}

type TryForOptionAp = (options: TryForOptions) => void;

export const WithMaxRetries =
  (maxRetries: number): TryForOptionAp =>
  (options) =>
    (options.maxRetries = maxRetries);

/**
 * Action can be returned from onError to control the retry behavior.
 * Continue will continue the retry loop.
 * Abort will abort the retry loop regardless of other options and throw the error.
 */
export const enum Action {
  Continue,
  Abort,
}

export const WithOnError =
  (onError: (error: unknown) => Action | void): TryForOptionAp =>
  (options) =>
    (options.onError = onError);

export const WithTimeout =
  (maxDuration: number): TryForOptionAp =>
  (options) =>
    (options.timeout = maxDuration);

export const WithDelayDuration =
  (delayDuration: number): TryForOptionAp =>
  (options) =>
    (options.delayDuration = delayDuration);

export const WithDelayStrategy =
  (delayStrategy: DelayStrategy): TryForOptionAp =>
  (options) =>
    (options.delayStrategy = delayStrategy);

export const Every =
  (delayDuration: number): TryForOptionAp =>
  (options) => {
    options.delayDuration = delayDuration;
    options.delayStrategy = ConstantDelayStrategy;
  };

export const WithAbortOnSameError = (): TryForOptionAp => (options) =>
  (options.abortOnSameError = true);

function errorsEqual(previousError: unknown, err: unknown) {
  if (previousError instanceof Error && err instanceof Error) {
    return previousError.message === err.message;
  }

  return previousError === err;
}

export const Repeat = async <T>(
  fn: () => Promise<T>,
  ...extraOptions: TryForOptionAp[]
): Promise<T> => {
  const options: TryForOptions = {
    maxRetries: 0,
    timeout: 0,
    delayDuration: 100,
    delayStrategy: LinearDelayStrategy,
    abortOnSameError: false,
  };

  extraOptions.forEach((option) => option(options));

  let retryCount = 0;
  let retryDuration = 0;

  const startTime = Date.now();
  let previousError: unknown;

  while (true) {
    if (retryCount > 0 && retryDuration > 0) {
      await new Promise((resolve) => setTimeout(resolve, retryDuration));
    }

    try {
      return await fn();
    } catch (err) {
      if (options.onError) {
        const action = options.onError(err);

        if (action === Action.Abort) {
          throw err;
        }
      }

      if (
        options.abortOnSameError &&
        previousError &&
        errorsEqual(previousError, err)
      ) {
        throw err;
      }

      previousError = err;

      retryCount++;
      retryDuration = options.delayStrategy(retryCount, options);

      if (options.maxRetries > 0 && retryCount >= options.maxRetries) {
        throw err;
      }

      if (options.timeout > 0 && Date.now() - startTime > options.timeout) {
        throw err;
      }
    }
  }
};
