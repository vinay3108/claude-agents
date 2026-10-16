import { createAgentServices } from "@/infrastructure/agent/createAgentServices";
import { apiError, apiOk } from "@/shared/utils/api-response";
import { getCurrentUser } from "@/shared/utils/get-current-user";
import { knowledgeQuerySchema } from "@/shared/utils/route-params";
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    const query = knowledgeQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const { repos, deps } = createAgentServices();
    const items = query.q
      ? await repos.knowledge.search(user.id, {
          text: query.q,
          kind: query.kind,
          topic: query.topic,
          limit: 20,
          queryEmbedding: await deps.embedder
            .embedQuery(query.q)
            .catch(() => null),
        })
      : await repos.knowledge.list(user.id, {
          kind: query.kind,
          topic: query.topic,
          limit: 20,
          offset: query.offset,
        });
    return apiOk(items, { limit: 20, page: Math.floor(query.offset / 20) + 1 });
  } catch (error) {
    return apiError(error);
  }
}
