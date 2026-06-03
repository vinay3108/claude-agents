import type { ProblemNote } from '../entities/ProblemNote'

export interface IProblemNoteRepository {
  findSubmissionIdsByUserId(userId: string): Promise<Set<string>>
  saveMany(notes: ProblemNote[]): Promise<void>
  findByUserId(userId: string): Promise<ProblemNote[]>
}
