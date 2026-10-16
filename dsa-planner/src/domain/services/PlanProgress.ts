interface PlanDay {
  readonly id: string
  readonly orderIndex: number
  readonly isCompleted: boolean
}

/** The day the user should do next: the first unfinished day in plan order. */
export function findCurrentPlanDay<T extends PlanDay>(items: readonly T[]): T | null {
  return [...items].sort((a, b) => a.orderIndex - b.orderIndex).find((i) => !i.isCompleted) ?? null
}

export function planProgress(items: readonly PlanDay[]): { done: number; total: number; percent: number } {
  const done = items.filter((i) => i.isCompleted).length
  const total = items.length
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) }
}
