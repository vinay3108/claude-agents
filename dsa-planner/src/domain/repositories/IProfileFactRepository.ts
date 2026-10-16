import type {
  ProfileFact,
  ProfileFactKey,
  ProfileFactStatus,
  ProposalDecision,
  ProposeFactInput,
} from "../entities/ProfileFact";

export interface IProfileFactRepository {
  list(
    userId: string,
    options?: {
      keys?: readonly ProfileFactKey[];
      statuses?: readonly ProfileFactStatus[];
    },
  ): Promise<ProfileFact[]>;
  findByKey(userId: string, key: ProfileFactKey): Promise<ProfileFact | null>;
  propose(userId: string, input: ProposeFactInput): Promise<ProposalDecision>;
  confirm(userId: string, id: string): Promise<ProfileFact | null>;
  reject(userId: string, id: string): Promise<ProfileFact | null>;
  editAndConfirm(
    userId: string,
    id: string,
    value: unknown,
  ): Promise<ProfileFact | null>;
  rejectProposedByRun(userId: string, runId: string): Promise<number>;
}
