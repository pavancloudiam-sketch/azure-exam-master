import { ChevronLeft, ChevronRight } from "lucide-react";

import { SecondaryButton } from "./buttons";

export function PaginationControls({
  page,
  pageCount,
  onPageChange,
  totalItems,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
}) {
  const canPrev = page > 1;
  const canNext = page < pageCount;

  return (
    <nav
      aria-label="Pagination"
      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:justify-between"
    >
      <p className="min-w-0 text-sm text-muted-foreground" aria-live="polite">
        Page {page} of {pageCount}
        {typeof totalItems === "number" ? ` · ${totalItems} items` : ""}
      </p>
      <div className="flex shrink-0 gap-2">
        <SecondaryButton
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={!canPrev}
          aria-label="Previous page"
        >
          <ChevronLeft aria-hidden="true" />
          Previous
        </SecondaryButton>
        <SecondaryButton
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={!canNext}
          aria-label="Next page"
        >
          Next
          <ChevronRight aria-hidden="true" />
        </SecondaryButton>
      </div>
    </nav>
  );
}