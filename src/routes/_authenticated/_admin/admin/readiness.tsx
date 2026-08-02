import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { PageShell } from "@/features/shared/components/PageShell";
import {
  EmptyState,
  ErrorState,
  LoadingBlock,
  SecondaryButton,
  SelectField,
  StatCard,
  StatusAlert,
  StatusBadge,
  SurfaceCard,
  TextField,
} from "@/features/shared/components/ui";
import {
  getBlueprintReadiness,
  getQuestionBankReadiness,
  listBlueprints,
  type ReadinessCount,
} from "@/features/exams/services/blueprint-service";
import { listCertifications } from "@/features/admin/services/taxonomy-service";
import { questionTypeLabel } from "@/features/exams/types";

function CountList({
  title,
  rows,
  filter,
  labelFor,
}: {
  title: string;
  rows: ReadinessCount[];
  filter: string;
  labelFor?: (name: string) => string;
}) {
  const visible = rows.filter((row) =>
    !filter ? true : row.name.toLowerCase().includes(filter.toLowerCase()),
  );
  return (
    <SurfaceCard title={title} description="Approved questions available in the bank.">
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">No matching entries.</p>
      ) : (
        <ul className="space-y-2">
          {visible.map((row) => (
            <li
              key={row.name}
              className="flex items-center justify-between gap-3 border-b border-border pb-2 text-sm last:border-0 last:pb-0"
            >
              <span className="min-w-0 truncate">{labelFor ? labelFor(row.name) : row.name}</span>
              <span className="shrink-0 font-medium tabular-nums">{row.approved}</span>
            </li>
          ))}
        </ul>
      )}
    </SurfaceCard>
  );
}

function ReadinessDashboardPage() {
  const [certificationId, setCertificationId] = React.useState("");
  const [blueprintId, setBlueprintId] = React.useState("all");
  const [domainFilter, setDomainFilter] = React.useState("");
  const [topicFilter, setTopicFilter] = React.useState("");

  const certifications = useQuery({ queryKey: ["certifications"], queryFn: listCertifications });
  const blueprints = useQuery({ queryKey: ["admin-blueprints"], queryFn: listBlueprints });

  const certificationOptions = (certifications.data ?? []).map((row) => ({
    value: row.id,
    label: `${row.code} ${row.version} — ${row.name}`,
  }));

  const activeCertification = certificationId || certificationOptions[0]?.value || "";

  const readiness = useQuery({
    queryKey: ["question-bank-readiness", activeCertification],
    queryFn: () => getQuestionBankReadiness(activeCertification),
    enabled: Boolean(activeCertification),
  });

  const blueprintOptions = (blueprints.data ?? [])
    .filter((row) => row.certification_id === activeCertification)
    .map((row) => ({ value: row.id, label: row.name }));

  const blueprintReadiness = useQuery({
    queryKey: ["blueprint-readiness", blueprintId],
    queryFn: () => getBlueprintReadiness(blueprintId),
    enabled: blueprintId !== "all",
  });

  const data = readiness.data;

  return (
    <PageShell
      title="Question-bank readiness"
      description="What the approved question bank can currently support, and where the gaps are."
      actions={
        <div className="flex flex-wrap gap-2">
          <SecondaryButton asChild>
            <Link to="/admin/questions">Add questions</Link>
          </SecondaryButton>
          <SecondaryButton asChild>
            <Link to="/admin/import">Import questions</Link>
          </SecondaryButton>
          <SecondaryButton asChild>
            <Link to="/admin/blueprints">Open blueprints</Link>
          </SecondaryButton>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-4">
          <SelectField
            id="readiness-certification"
            label="Certification version"
            options={certificationOptions}
            value={activeCertification}
            onValueChange={(value) => {
              setCertificationId(value);
              setBlueprintId("all");
            }}
          />
          <SelectField
            id="readiness-blueprint"
            label="Blueprint"
            options={[{ value: "all", label: "No blueprint check" }, ...blueprintOptions]}
            value={blueprintId}
            onValueChange={setBlueprintId}
          />
          <TextField
            id="readiness-domain-filter"
            label="Filter skill areas"
            value={domainFilter}
            onChange={(event) => setDomainFilter(event.target.value)}
            placeholder="Skill area name"
          />
          <TextField
            id="readiness-topic-filter"
            label="Filter topics"
            value={topicFilter}
            onChange={(event) => setTopicFilter(event.target.value)}
            placeholder="Topic name"
          />
        </div>

        {!activeCertification ? (
          <EmptyState
            title="No certifications yet"
            description="Create a certification version before checking question-bank readiness."
          />
        ) : readiness.isLoading ? (
          <LoadingBlock label="Loading readiness data" />
        ) : readiness.isError ? (
          <ErrorState
            description="Readiness data could not be loaded."
            onRetry={() => readiness.refetch()}
          />
        ) : data ? (
          <>
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Total questions" value={data.total} />
              <StatCard label="Approved" value={data.approved} hint="Deliverable to students" />
              <StatCard label="Awaiting review" value={data.awaiting_review} />
              <StatCard label="Flagged duplicates" value={data.flagged_duplicates} />
              <StatCard label="Missing explanation" value={data.missing_explanation} />
              <StatCard label="Missing metadata" value={data.missing_metadata} />
              <StatCard
                label="Non-repeating 50-question attempts"
                value={data.non_repeating_50q_attempts}
                hint="This is a question-pool estimate, not an infrastructure-capacity estimate."
              />
            </section>

            <StatusAlert tone="info" title="How this estimate is calculated">
              {data.estimate_note} This is a question-pool estimate, not an
              infrastructure-capacity estimate.
            </StatusAlert>

            {data.missing_metadata > 0 || data.missing_explanation > 0 ? (
              <StatusAlert tone="warning" title="Content gaps to fix">
                {data.missing_metadata} question(s) are missing metadata and{" "}
                {data.missing_explanation} are missing an explanation.{" "}
                <Link to="/admin/questions" className="underline">
                  Fix missing metadata
                </Link>
                .
              </StatusAlert>
            ) : null}

            {data.awaiting_review > 0 ? (
              <StatusAlert tone="warning" title="Drafts awaiting approval">
                {data.awaiting_review} question(s) are waiting for review before they can be
                delivered.{" "}
                <Link to="/admin/questions" className="underline">
                  Review drafts
                </Link>
                .
              </StatusAlert>
            ) : null}

            {blueprintId !== "all" ? (
              <SurfaceCard
                title="Blueprint satisfiability"
                description="Whether the approved bank can satisfy every weighted skill area."
              >
                {blueprintReadiness.isLoading ? (
                  <LoadingBlock label="Checking blueprint" />
                ) : blueprintReadiness.isError ? (
                  <ErrorState
                    description="Blueprint readiness could not be loaded."
                    onRetry={() => blueprintReadiness.refetch()}
                  />
                ) : blueprintReadiness.data ? (
                  <div className="space-y-4">
                    <StatusAlert
                      tone={blueprintReadiness.data.satisfiable ? "success" : "warning"}
                      title={
                        blueprintReadiness.data.satisfiable
                          ? "Blueprint is satisfiable"
                          : "Blueprint cannot be satisfied yet"
                      }
                    >
                      {blueprintReadiness.data.total_available} approved questions available;
                      maximum deliverable length {blueprintReadiness.data.max_question_count}.
                    </StatusAlert>
                    <ul className="space-y-2">
                      {blueprintReadiness.data.domains.map((domain) => (
                        <li
                          key={domain.domain_id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm"
                        >
                          <span className="min-w-0 truncate font-medium">{domain.name}</span>
                          <span className="text-muted-foreground">
                            {domain.available} available / {domain.required} required
                          </span>
                          <StatusBadge tone={domain.satisfied ? "success" : "error"}>
                            {domain.satisfied ? "Satisfied" : "Shortfall"}
                          </StatusBadge>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </SurfaceCard>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-2">
              <CountList title="By skill area" rows={data.by_domain} filter={domainFilter} />
              <CountList title="By topic" rows={data.by_topic} filter={topicFilter} />
              <CountList
                title="By question type"
                rows={data.by_type}
                filter=""
                labelFor={questionTypeLabel}
              />
              <CountList title="By difficulty" rows={data.by_difficulty} filter="" />
            </div>
          </>
        ) : null}
      </div>
    </PageShell>
  );
}

export const Route = createFileRoute("/_authenticated/_admin/admin/readiness")({
  component: ReadinessDashboardPage,
});
