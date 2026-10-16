export interface EventChannel<T> extends AsyncIterable<T> {
  push(value: T): void;
  close(): void;
}
export function createEventChannel<T>(): EventChannel<T> {
  const buffer: T[] = [];
  let waiting: ((result: IteratorResult<T>) => void) | null = null;
  let closed = false;
  const release = (result: IteratorResult<T>) => {
    const resolve = waiting;
    waiting = null;
    resolve?.(result);
  };
  return {
    push(value) {
      if (closed) return;
      if (waiting) release({ value, done: false });
      else buffer.push(value);
    },
    close() {
      closed = true;
      if (waiting) release({ value: undefined, done: true });
    },
    [Symbol.asyncIterator]: () => ({
      next: () => {
        if (buffer.length)
          return Promise.resolve({ value: buffer.shift()!, done: false });
        if (closed) return Promise.resolve({ value: undefined, done: true });
        return new Promise<IteratorResult<T>>((resolve) => {
          waiting = resolve;
        });
      },
    }),
  };
}
