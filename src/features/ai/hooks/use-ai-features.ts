import { useQuery } from "@tanstack/react-query";

import { listAiFeatureFlags } from "../services/ai.functions";
import type { AiFeature } from "../constants";

/** Reads the AI module switches. Hidden UI is a convenience — the server re-checks. */
export function useAiFeatureFlags() {
  return useQuery({
    queryKey: ["ai", "feature-flags"],
    queryFn: () => listAiFeatureFlags(),
    staleTime: 60_000,
  });
}

export function useAiFeatureEnabled(feature: AiFeature): boolean {
  const { data } = useAiFeatureFlags();
  return data?.some((flag) => flag.key === feature && flag.isEnabled) ?? false;
}
