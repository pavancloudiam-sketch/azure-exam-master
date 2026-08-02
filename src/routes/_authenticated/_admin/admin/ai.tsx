import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { PageShell } from "@/features/shared/components/PageShell";
import { LoadingBlock, SurfaceCard, notify } from "@/features/shared/components/ui";
import { Switch } from "@/components/ui/switch";
import {
  AI_RATE_LIMITS,
  AiDisclaimer,
  setAiFeatureFlag,
  useAiFeatureFlags,
  type AiFeature,
} from "@/features/ai";
import { errorToastMessage } from "@/features/observability";

function AdminAiSettings() {
  const flags = useAiFeatureFlags();
  const queryClient = useQueryClient();
  const toggle = useServerFn(setAiFeatureFlag);

  const mutation = useMutation({
    mutationFn: (input: { key: AiFeature; isEnabled: boolean }) => toggle({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ai", "feature-flags"] });
      notify.success("AI settings updated");
    },
    onError: (cause) => notify.error(errorToastMessage(cause)),
  });

  return (
    <PageShell
      title="AskMe AI"
      description="Enable or disable each AskMe AI module. Modules are off until you switch them on, and the server re-checks every request."
    >
      <AiDisclaimer className="mb-6" />

      <SurfaceCard>
        {flags.isLoading ? (
          <LoadingBlock label="Loading AI settings" />
        ) : (
          <ul className="divide-border divide-y">
            {(flags.data ?? []).map((flag) => (
              <li key={flag.key} className="flex items-start justify-between gap-6 py-4">
                <div>
                  <p className="font-medium">{flag.label}</p>
                  <p className="text-muted-foreground mt-1 text-sm">{flag.description}</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Per-student limit: {AI_RATE_LIMITS[flag.key].perHour}/hour ·{" "}
                    {AI_RATE_LIMITS[flag.key].perDay}/day. Enforced server-side on every request.
                  </p>
                </div>
                <Switch
                  checked={flag.isEnabled}
                  aria-label={`Enable ${flag.label}`}
                  disabled={mutation.isPending}
                  onCheckedChange={(checked) =>
                    mutation.mutate({ key: flag.key, isEnabled: checked })
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </SurfaceCard>
    </PageShell>
  );
}

export const Route = createFileRoute("/_authenticated/_admin/admin/ai")({
  head: () => ({
    meta: [
      { title: "AskMe AI settings — AskMeExam" },
      { name: "description", content: "Enable or disable individual AskMe AI modules." },
      { property: "og:title", content: "AskMe AI settings — AskMeExam" },
      { property: "og:description", content: "Enable or disable individual AskMe AI modules." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminAiSettings,
});
