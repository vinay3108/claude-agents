'use client'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'
import { AXIS_TICK, CHART_COLORS, ChartEmpty, TOOLTIP_PROPS } from './chartTheme'

interface CompanyScore {
  company: string
  score: number
}

interface CompanyReadinessBarProps {
  scores: CompanyScore[]
  loading?: boolean
}

/** Bars at or above this score are "ready" and use the signal colour. */
const READY_THRESHOLD = 70

export function CompanyReadinessBar({ scores, loading }: CompanyReadinessBarProps) {
  if (loading) return <Skeleton className="h-64 w-full" />
  if (scores.length === 0 || scores.every((s) => s.score <= 0)) {
    return <ChartEmpty message="Sync your LeetCode profile to score company readiness." />
  }

  const data = scores.map((s) => ({
    name: s.company.charAt(0).toUpperCase() + s.company.slice(1),
    score: s.score,
  }))

  return (
    <ResponsiveContainer width="100%" height={256}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
        <XAxis dataKey="name" tick={AXIS_TICK} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}%`} />
        <Tooltip {...TOOLTIP_PROPS} formatter={(v) => [`${v}%`, 'Readiness']} />
        <Bar dataKey="score" radius={[6, 6, 2, 2]} maxBarSize={44}>
          {data.map((d) => (
            <Cell
              key={d.name}
              fill={d.score >= READY_THRESHOLD ? CHART_COLORS.primary : CHART_COLORS.secondary}
              fillOpacity={d.score >= READY_THRESHOLD ? 0.95 : 0.55}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
