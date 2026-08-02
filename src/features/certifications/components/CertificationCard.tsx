import { StatusBadge } from "@/features/shared/components/ui";
import type { PublicCertification } from "../types";

function formatDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function CertificationCard({ certification }: { certification: PublicCertification }) {
  const retired = certification.lifecycle_status === "retired";
  const effective = formatDate(certification.effective_at);
  const retiredOn = formatDate(certification.retired_at);

  return (
    <article className="flex h-full flex-col rounded-lg border border-border bg-card p-6 shadow-card">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent-ink">
            {certification.provider}
            {certification.exam_code ? ` · ${certification.exam_code}` : ""}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">{certification.name}</h2>
        </div>
        <StatusBadge tone={retired ? "warning" : "success"}>
          {retired ? "Retired" : "Active"}
        </StatusBadge>
      </header>

      {certification.description ? (
        <p className="mt-3 text-sm text-muted-foreground">{certification.description}</p>
      ) : null}

      <dl className="mt-4 grid grid-cols-3 gap-3 border-y border-border py-3 text-center">
        <div>
          <dt className="text-xs text-muted-foreground">Domains</dt>
          <dd className="text-base font-semibold">{certification.domains.length}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Topics</dt>
          <dd className="text-base font-semibold">{certification.topic_count}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Practice exams</dt>
          <dd className="text-base font-semibold">{certification.exam_count}</dd>
        </div>
      </dl>

      <p className="mt-3 text-xs text-muted-foreground">
        Version {certification.version}
        {effective ? ` · effective ${effective}` : ""}
        {retiredOn ? ` · retired ${retiredOn}` : ""}
      </p>

      {certification.domains.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Exam domains
          </h3>
          <ul className="mt-2 space-y-1.5">
            {certification.domains.map((domain) => (
              <li
                key={domain.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2 text-sm"
              >
                <span className="min-w-0 truncate text-foreground">{domain.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {domain.weight_percent !== null ? `${domain.weight_percent}% · ` : ""}
                  {domain.topic_count} topic{domain.topic_count === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">Domain breakdown coming soon.</p>
      )}
    </article>
  );
}
