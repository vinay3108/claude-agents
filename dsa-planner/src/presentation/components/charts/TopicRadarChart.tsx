'use client'
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'
import { CHART_COLORS, ChartEmpty, TOOLTIP_PROPS } from './chartTheme'

interface TopicMastery {
  name: string
  masteryScore: number
}

interface TopicRadarChartProps {
  topics: TopicMastery[]
  loading?: boolean
}

export function TopicRadarChart({ topics, loading }: TopicRadarChartProps) {
  if (loading) return <Skeleton className="h-72 w-full" />

  const top10 = topics.slice(0, 10)
  if (top10.length === 0) return <ChartEmpty heightClass="h-72" message="No topic data yet. Sync to map your strengths." />

  return (
    <ResponsiveContainer width="100%" height={288}>
      <RadarChart data={top10} outerRadius="72%">
        <PolarGrid stroke={CHART_COLORS.grid} />
        <PolarAngleAxis dataKey="name" tick={{ fontSize: 11, fill: CHART_COLORS.axis }} />
        <Radar
          name="Mastery"
          dataKey="masteryScore"
          stroke={CHART_COLORS.primary}
          strokeWidth={2}
          fill={CHART_COLORS.primary}
          fillOpacity={0.18}
          dot={{ r: 2.5, fill: CHART_COLORS.primary, strokeWidth: 0 }}
        />
        <Tooltip {...TOOLTIP_PROPS} formatter={(v) => [`${v}%`, 'Mastery']} />
      </RadarChart>
    </ResponsiveContainer>
  )
}
