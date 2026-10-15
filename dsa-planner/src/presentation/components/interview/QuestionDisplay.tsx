import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { InterviewQuestion } from '@/domain/entities/InterviewQuestion'

interface Props {
  question: InterviewQuestion
}

export function QuestionDisplay({ question }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">Question {question.orderIndex + 1}</CardTitle>
          {question.expectedConcepts.map((c) => (
            <Badge key={c} variant="outline" className="text-xs">
              {c}
            </Badge>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{question.questionText}</p>
      </CardContent>
    </Card>
  )
}
