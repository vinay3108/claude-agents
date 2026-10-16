interface Envelope<T> {
  success: boolean;
  data?: T;
  error?: { message: string };
}
export async function agentFetch<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, init);
  const json = (await response.json().catch(() => null)) as Envelope<T> | null;
  if (!response.ok || !json?.success)
    throw new Error(
      json?.error?.message ?? `Request failed (${response.status})`,
    );
  return json.data as T;
}
