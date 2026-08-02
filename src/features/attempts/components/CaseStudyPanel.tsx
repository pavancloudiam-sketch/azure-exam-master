import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import type { AttemptCaseStudy } from "../types";

function Section({ title, body }: { title: string; body: string | null }) {
  if (!body || body.trim() === "") return null;
  return (
    <section className="border-t border-border pt-3 first:border-t-0 first:pt-0">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h4>
      <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">{body}</p>
    </section>
  );
}

/**
 * Case-study narrative panel. Sits beside the question on wide screens and
 * collapses above it on small screens, so the scenario is always reachable
 * while answering any question that belongs to the case study.
 */
export function CaseStudyPanel({
  caseStudy,
  questionNumbers,
}: {
  caseStudy: AttemptCaseStudy;
  questionNumbers: number[];
}) {
  const [open, setOpen] = React.useState(true);

  return (
    <section
      aria-label={`Case study: ${caseStudy.title}`}
      className="rounded-lg border border-border bg-surface"
    >
      <div className="flex items-start justify-between gap-3 border-b border-border p-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent-ink">
            Case study
          </p>
          <h3 className="mt-1 text-base font-semibold">{caseStudy.title}</h3>
          {questionNumbers.length > 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Applies to question{questionNumbers.length === 1 ? "" : "s"}{" "}
              {questionNumbers.join(", ")}. You can move between them freely.
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-md border border-border px-3 text-sm font-medium lg:hidden"
        >
          {open ? "Hide" : "Show"}
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden="true" />
        </button>
      </div>

      <div
        className={cn(
          "space-y-3 p-4 lg:max-h-[70vh] lg:overflow-y-auto lg:block",
          open ? "block" : "hidden",
        )}
      >
        <Section title="Organisation overview" body={caseStudy.organization_overview} />
        <Section title="Existing environment" body={caseStudy.existing_environment} />
        <Section title="Business requirements" body={caseStudy.business_requirements} />
        <Section title="Technical requirements" body={caseStudy.technical_requirements} />
        <Section title="Security requirements" body={caseStudy.security_requirements} />
        <Section title="Constraints" body={caseStudy.constraints} />

        {caseStudy.exhibits.length > 0 ? (
          <section className="border-t border-border pt-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Exhibits
            </h4>
            <ul className="mt-2 space-y-3">
              {caseStudy.exhibits.map((exhibit, position) => (
                <li key={position} className="rounded-md border border-border bg-background p-3">
                  <p className="text-sm font-medium">{exhibit.title ?? `Exhibit ${position + 1}`}</p>
                  {exhibit.content ? (
                    <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                      {exhibit.content}
                    </p>
                  ) : null}
                  {exhibit.url ? (
                    <img
                      src={exhibit.url}
                      alt={exhibit.caption ?? exhibit.title ?? `Exhibit ${position + 1}`}
                      loading="lazy"
                      className="mt-2 w-full rounded-md border border-border"
                    />
                  ) : null}
                  {exhibit.caption ? (
                    <p className="mt-1 text-xs text-muted-foreground">{exhibit.caption}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </section>
  );
}
