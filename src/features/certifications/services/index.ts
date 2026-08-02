import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { PublicCertification, PublicCertificationDomain } from "../types";

/**
 * Public (unauthenticated) certification catalogue. Backed by the
 * `get_public_certifications` RPC, which only returns active certifications
 * with their active domains/topics and published exam counts.
 */
export async function listPublicCertifications(): Promise<PublicCertification[]> {
  const { data, error } = await supabase.rpc("get_public_certifications");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...row,
    domains: (row.domains as unknown as PublicCertificationDomain[] | null) ?? [],
  })) as PublicCertification[];
}

export const publicCertificationsQuery = () =>
  queryOptions({
    queryKey: ["public-certifications"],
    queryFn: listPublicCertifications,
    staleTime: 5 * 60_000,
  });
