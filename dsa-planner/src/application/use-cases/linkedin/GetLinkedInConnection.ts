import type { LinkedInConnection } from '@/domain/entities/LinkedInConnection'
import type { ILinkedInConnectionRepository } from '@/domain/repositories/ILinkedInConnectionRepository'

export class GetLinkedInConnection {
  constructor(private readonly repo: ILinkedInConnectionRepository) {}

  execute(userId: string): Promise<LinkedInConnection | null> {
    return this.repo.findByUserId(userId)
  }
}
