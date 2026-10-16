export interface JobQueue {
  enqueue(name: string, task: () => Promise<void>): void;
  idle(): Promise<void>;
}
export function createInProcessQueue(): JobQueue {
  let tail = Promise.resolve();
  return {
    enqueue(name, task) {
      tail = tail
        .then(task)
        .catch((error: unknown) =>
          console.error(`[queue] ${name} failed`, error),
        );
    },
    idle: () => tail,
  };
}
export const importQueue = createInProcessQueue();
