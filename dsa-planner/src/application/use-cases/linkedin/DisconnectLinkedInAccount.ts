import type { ILinkedInConnectionRepository } from '@/domain/repositories/ILinkedInConnectionRepository'
import { AppError } from '@/shared/errors/AppError'

export class DisconnectLinkedInAccount {
  constructor(private readonly repo: ILinkedInConnectionRepository) {}

  async execute(userId: string): Promise<void> {
    const removed = await this.repo.deleteByUserId(userId)
    if (!removed) throw AppError.notFound('LinkedIn connection')
  }
}
