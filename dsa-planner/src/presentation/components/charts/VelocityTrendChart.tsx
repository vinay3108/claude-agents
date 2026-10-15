'use client'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'
import type { SnapshotDataPoint } from '@/application/services/AnalyticsService'
import { AXIS_TICK, CHART_COLORS, ChartEmpty, TOOLTIP_PROPS } from './chartTheme'

interface Props {
  data: SnapshotDataPoint[]
  loading: boolean
}

const GRADIENT_ID = 'velocity-fill'

export function VelocityTrendChart({ data, loading }: Props) {
  if (loading) return <Skeleton className="h-56 w-full" />
  if (data.length < 2) {
    return <ChartEmpty heightClass="h-56" message="Sync daily to build history — the trend appears after 2 snapshots." />
  }

  return (
    <ResponsiveContainer width="100%" height={224}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.35} />
            <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
        <XAxis
          dataKey="date"
          tick={AXIS_TICK}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: string) => v.slice(5)}
          minTickGap={24}
        />
        <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip
          {...TOOLTIP_PROPS}
          labelFormatter={(label) => `Date: ${label}`}
          formatter={(value) => [value, 'Problems solved']}
        />
        <Area
          type="monotone"
          dataKey="totalSolved"
          stroke={CHART_COLORS.primary}
          strokeWidth={2}
          fill={`url(#${GRADIENT_ID})`}
          activeDot={{ r: 4, strokeWidth: 0, fill: CHART_COLORS.primary }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
