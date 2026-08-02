import { cn } from "@/lib/utils";
import { REVIEW_FILTER_LABELS, type ReviewFilter } from "../types";

const ORDER: ReviewFilter[] = ["all", "correct", "incorrect", "unanswered", "marked"];

/** Filter toolbar. Uses a radio group so arrow keys move between filters. */
export function ReviewFilters({
  value,
  counts,
  onChange,
}: {
  value: ReviewFilter;
  counts: Record<ReviewFilter, number>;
  onChange: (filter: ReviewFilter) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Filter questions" className="flex flex-wrap gap-2">
      {ORDER.map((filter) => {
        const selected = filter === value;
        return (
          <button
            key={filter}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(filter)}
            className={cn(
              "min-h-11 rounded-md border px-3 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-foreground hover:border-accent",
            )}
          >
            {REVIEW_FILTER_LABELS[filter]}
            <span className="ml-2 tabular-nums opacity-80">{counts[filter]}</span>
          </button>
        );
      })}
    </div>
  );
}