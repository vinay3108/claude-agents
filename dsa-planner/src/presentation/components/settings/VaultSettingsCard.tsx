"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { agentFetch } from "@/presentation/hooks/useAgentApi";
import { useMutation, useQuery } from "@tanstack/react-query";
type Status = {
  enabled: boolean;
  isVaultUser: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  lastResult: Record<string, number> | null;
};
export function VaultSettingsCard({ index }: { readonly index: number }) {
  const status = useQuery({
    queryKey: ["vault"],
    queryFn: () => agentFetch<Status>("/api/vault/sync"),
  });
  const sync = useMutation({
    mutationFn: () => agentFetch("/api/vault/sync", { method: "POST" }),
    onSuccess: () => status.refetch(),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{index}. Obsidian vault</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {!status.data?.enabled ? (
          <p className="text-muted-foreground">
            Not connected. Set VAULT_PATH and VAULT_USER_ID in the server
            environment.
          </p>
        ) : !status.data.isVaultUser ? (
          <p className="text-muted-foreground">
            The vault belongs to another account.
          </p>
        ) : (
          <>
            <p>
              Last sync:{" "}
              {status.data.lastSyncAt
                ? new Date(status.data.lastSyncAt).toLocaleString()
                : "never"}
            </p>
            {status.data.lastError && (
              <p className="text-destructive">{status.data.lastError}</p>
            )}
            <Button
              size="sm"
              onClick={() => sync.mutate()}
              disabled={sync.isPending}
            >
              {sync.isPending ? "Syncing…" : "Sync vault now"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
