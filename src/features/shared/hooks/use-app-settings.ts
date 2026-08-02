import { useQuery } from "@tanstack/react-query";

import {
  FALLBACK_SETTINGS,
  fetchApplicationSettings,
  type ApplicationSettings,
} from "../services/settings-service";

export const appSettingsQueryKey = ["application-settings"] as const;

/**
 * Shared read of the platform settings. One cached query serves every page, so
 * public pages never issue duplicate lookups, and the fallback values keep the
 * shell rendering if the read fails. Admin edits invalidate this key, so the
 * cache is never stale after a save.
 */
export function useAppSettings(): ApplicationSettings {
  const query = useQuery({
    queryKey: appSettingsQueryKey,
    queryFn: fetchApplicationSettings,
    staleTime: 5 * 60 * 1000,
    placeholderData: FALLBACK_SETTINGS,
  });
  return query.data ?? FALLBACK_SETTINGS;
}
