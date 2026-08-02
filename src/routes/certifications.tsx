import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { PageShell } from "@/features/shared/components/PageShell";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, SkeletonList } from "@/features/shared/components/ui";
import { CertificationCard } from "@/features/certifications/components";
import { publicCertificationsQuery } from "@/features/certifications/services";

type StatusFilter = "all" | "active" | "retired";

const statusFilters: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "retired", label: "Retired" },
];

export const Route = createFileRoute("/certifications")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search["q"] === "string" ? search["q"] : "",
    status: (["all", "active", "retired"] as const).includes(search["status"] as StatusFilter)
      ? (search["status"] as StatusFilter)
      : ("all" as StatusFilter),
    provider: typeof search["provider"] === "string" ? search["provider"] : "all",
  }),
  loader: ({ context }) => {
    void context.queryClient.ensureQueryData(publicCertificationsQuery());
  },
  head: () => ({
    meta: [
      { title: "Certifications — Microsoft Entra ID Practice | AskMeExam" },
      {
        name: "description",
        content:
          "Browse Microsoft Entra ID certification tracks on AskMeExam: exam versions, domain weightings, topic counts and available practice exams.",
      },
      { property: "og:title", content: "Certifications — Microsoft Entra ID Practice" },
      {
        property: "og:description",
        content:
          "Certification tracks with versions, domains, topic counts and practice exam availability.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: ({ error }) => (
    <PageShell title="Certifications">
      <ErrorState title="Could not load certifications" description={error.message} />
    </PageShell>
  ),
  notFoundComponent: () => (
    <PageShell title="Certifications">
      <EmptyState title="Nothing here" description="This page is not available." />
    </PageShell>
  ),
  component: CertificationsPage,
});

function CertificationsPage() {
  const { q, status, provider } = Route.useSearch();
  const navigate = useNavigate({ from: "/certifications" });
  const { data, isLoading, error, refetch } = useQuery(publicCertificationsQuery());

  const certifications = useMemo(() => data ?? [], [data]);

  const providers = useMemo(
    () => Array.from(new Set(certifications.map((c) => c.provider))).sort(),
    [certifications],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return certifications.filter((c) => {
      if (provider !== "all" && c.provider !== provider) return false;
      if (status === "active" && c.lifecycle_status === "retired") return false;
      if (status === "retired" && c.lifecycle_status !== "retired") return false;
      if (!needle) return true;
      return [c.name, c.code, c.exam_code ?? "", c.provider, c.description ?? "", c.version]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [certifications, provider, q, status]);

  const setSearch = (patch: Partial<{ q: string; status: StatusFilter; provider: string }>) =>
    void navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });

  return (
    <PageShell
      title="Certifications"
      description="Microsoft Entra ID certification tracks available for practice on AskMeExam, with the exam version, domain weightings and how many practice exams are published."
    >
      <section aria-label="Search and filter certifications" className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="space-y-2">
              <label
                htmlFor="certification-search"
                className="text-sm font-medium text-foreground"
              >
                Search certifications
              </label>
              <Input
                id="certification-search"
                type="search"
                value={q}
                placeholder="Name, code or exam code…"
                onChange={(event) => setSearch({ q: event.target.value })}
                className="sm:w-72"
              />
            </div>
            {providers.length > 1 ? (
              <div className="space-y-2">
                <label
                  htmlFor="certification-provider"
                  className="text-sm font-medium text-foreground"
                >
                  Provider
                </label>
                <select
                  id="certification-provider"
                  value={provider}
                  onChange={(event) => setSearch({ provider: event.target.value })}
                  className="h-9 rounded-md border border-border bg-background px-3 text-sm sm:w-56"
                >
                  <option value="all">All providers</option>
                  {providers.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
          <div
            role="group"
            aria-label="Filter by status"
            className="inline-flex rounded-md border border-border bg-card p-1"
          >
            {statusFilters.map((filter) => {
              const selected = status === filter.value;
              return (
                <button
                  key={filter.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setSearch({ status: filter.value })}
                  className={`rounded px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                    selected
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section aria-label="Certification list" className="mt-8">
        {isLoading ? (
          <SkeletonList rows={3} />
        ) : error ? (
          <ErrorState
            title="Could not load certifications"
            description="Please try again in a moment."
            onRetry={() => void refetch()}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={
              certifications.length === 0
                ? "No certifications published yet"
                : "No certifications match your search"
            }
            description={
              certifications.length === 0
                ? "Certification tracks appear here as soon as they are published."
                : "Try a different search term or clear the filters."
            }
          />
        ) : (
          <>
            <p className="sr-only" aria-live="polite">
              {filtered.length} certification{filtered.length === 1 ? "" : "s"} shown
            </p>
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((certification) => (
                <CertificationCard key={certification.id} certification={certification} />
              ))}
            </div>
          </>
        )}
      </section>

      <p className="mt-10 text-sm text-muted-foreground">
        Ready to practise?{" "}
        <Link to="/exams" className="underline">
          Browse practice exams
        </Link>{" "}
        or{" "}
        <Link to="/pricing" className="underline">
          view pricing
        </Link>
        .
      </p>
    </PageShell>
  );
}
