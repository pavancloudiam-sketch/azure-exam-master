import { Input } from "@/components/ui/input";
import type { ActiveFilter } from "../types/taxonomy";

const filters: { value: ActiveFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export function TaxonomyToolbar({
  searchId,
  searchLabel,
  search,
  onSearchChange,
  status,
  onStatusChange,
  children,
}: {
  searchId: string;
  searchLabel: string;
  search: string;
  onSearchChange: (value: string) => void;
  status: ActiveFilter;
  onStatusChange: (value: ActiveFilter) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="space-y-2">
          <label htmlFor={searchId} className="text-sm font-medium text-foreground">
            {searchLabel}
          </label>
          <Input
            id={searchId}
            type="search"
            value={search}
            placeholder="Search by name…"
            onChange={(event) => onSearchChange(event.target.value)}
            className="sm:w-64"
          />
        </div>
        {children}
      </div>
      <div
        role="group"
        aria-label="Filter by status"
        className="inline-flex rounded-md border border-border bg-card p-1"
      >
        {filters.map((filter) => {
          const selected = status === filter.value;
          return (
            <button
              key={filter.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onStatusChange(filter.value)}
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
  );
}