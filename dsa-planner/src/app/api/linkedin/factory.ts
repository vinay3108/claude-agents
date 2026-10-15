import { createDrizzleClient } from '@/infrastructure/db/client'
import { LinkedInOAuthClient } from '@/infrastructure/linkedin/LinkedInOAuthClient'
import type { LinkedInConfig } from '@/infrastructure/linkedin/linkedinConfig'
import { DrizzleLinkedInConnectionRepository } from '@/infrastructure/repositories/DrizzleLinkedInConnectionRepository'
import { ConnectLinkedInAccount } from '@/application/use-cases/linkedin/ConnectLinkedInAccount'
import { DisconnectLinkedInAccount } from '@/application/use-cases/linkedin/DisconnectLinkedInAccount'
import { GetLinkedInConnection } from '@/application/use-cases/linkedin/GetLinkedInConnection'

/** Composition root for the LinkedIn routes: wires use cases to real adapters. */
const repository = () => new DrizzleLinkedInConnectionRepository(createDrizzleClient())

export const linkedinUseCases = {
  connect: (config: LinkedInConfig) => new ConnectLinkedInAccount(repository(), new LinkedInOAuthClient(config)),
  get: () => new GetLinkedInConnection(repository()),
  disconnect: () => new DisconnectLinkedInAccount(repository()),
}
