/**
 * Recharts needs real colour values in SVG attributes; these point at the theme
 * tokens in globals.css so charts follow the light/dark theme automatically.
 */
export const CHART_COLORS = {
  primary: 'var(--signal)',
  secondary: 'var(--info)',
  tertiary: 'var(--ember)',
  grid: 'color-mix(in oklch, var(--foreground) 10%, transparent)',
  axis: 'var(--muted-foreground)',
} as const

export const AXIS_TICK = { fontSize: 11, fill: CHART_COLORS.axis, fontFamily: 'var(--font-code)' } as const

export const TOOLTIP_PROPS = {
  cursor: { fill: 'color-mix(in oklch, var(--foreground) 5%, transparent)' },
  contentStyle: {
    background: 'var(--popover)',
    border: '1px solid var(--border)',
    borderRadius: '0.75rem',
    color: 'var(--popover-foreground)',
    fontSize: 12,
    boxShadow: '0 12px 32px -12px rgb(0 0 0 / 0.5)',
  },
  labelStyle: { color: 'var(--muted-foreground)', marginBottom: 4 },
  itemStyle: { color: 'var(--popover-foreground)' },
} as const

interface ChartEmptyProps {
  readonly message: string
  readonly heightClass?: string
}

export function ChartEmpty({ message, heightClass = 'h-64' }: ChartEmptyProps) {
  return (
    <div
      className={`flex ${heightClass} items-center justify-center rounded-xl border border-dashed text-center text-sm text-muted-foreground`}
    >
      <p className="max-w-xs px-4">{message}</p>
    </div>
  )
}
