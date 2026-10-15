import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { StudyPlan } from '@/domain/entities/StudyPlan'

interface Props {
  plan: StudyPlan
}

export function StudyPlanTimeline({ plan }: Props) {
  const completed = plan.items.filter((i) => i.isCompleted).length
  const total = plan.items.length

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{plan.title}</CardTitle>
          <span className="text-xs text-muted-foreground">
            {completed}/{total} done
          </span>
        </div>
        {plan.targetCompany && (
          <p className="text-xs text-muted-foreground capitalize">
            Target: {plan.targetCompany} · Due {plan.targetDate.toLocaleDateString()}
          </p>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {plan.items.map((item) => (
            <div
              key={item.id}
              className={`flex items-start gap-3 rounded-md border p-2 text-sm ${
                item.isCompleted ? 'opacity-50' : ''
              }`}
            >
              <span className="mt-0.5 text-xs text-muted-foreground w-10 shrink-0">
                Day {item.orderIndex + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`font-medium ${item.isCompleted ? 'line-through' : ''}`}>
                  {item.title}
                </p>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
              {item.isCompleted && (
                <Badge variant="secondary" className="text-xs shrink-0">
                  Done
                </Badge>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
