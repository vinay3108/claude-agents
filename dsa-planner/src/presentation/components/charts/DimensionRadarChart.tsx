'use client'
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts'
import { CHART_COLORS, TOOLTIP_PROPS } from './chartTheme'

interface Props {
  dimensionScores: Record<string, number>
}

const DIMENSION_LABELS: Record<string, string> = {
  requirements: 'Requirements',
  components: 'Components',
  scalability: 'Scalability',
  trade_offs: 'Trade-offs',
  communication: 'Communication',
}

export function DimensionRadarChart({ dimensionScores }: Props) {
  const data = Object.entries(DIMENSION_LABELS).map(([key, label]) => ({
    dimension: label,
    score: dimensionScores[key] ?? 0,
    fullMark: 10,
  }))

  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={data}>
        <PolarGrid stroke={CHART_COLORS.grid} />
        <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 12, fill: CHART_COLORS.axis }} />
        <Radar
          dataKey="score"
          stroke={CHART_COLORS.primary}
          fill={CHART_COLORS.primary}
          fillOpacity={0.2}
          strokeWidth={2}
        />
        <Tooltip {...TOOLTIP_PROPS} formatter={(value) => [`${value}/10`, 'Score']} />
      </RadarChart>
    </ResponsiveContainer>
  )
}
