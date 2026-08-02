import { cn } from "@/lib/utils";
import type { PaletteState } from "../types";

const stateStyles: Record<PaletteState, string> = {
  current: "border-primary bg-primary text-primary-foreground",
  answered: "border-accent bg-accent/15 text-foreground",
  unanswered: "border-border bg-background text-muted-foreground",
  marked: "border-warning bg-warning/20 text-foreground",
  "answered-marked": "border-warning bg-accent/15 text-foreground ring-2 ring-warning/50",
};

const stateLabels: Record<PaletteState, string> = {
  current: "current question",
  answered: "answered",
  unanswered: "not answered",
  marked: "marked for review",
  "answered-marked": "answered and marked for review",
};

export const PALETTE_LEGEND: { state: PaletteState; label: string }[] = [
  { state: "current", label: "Current" },
  { state: "answered", label: "Answered" },
  { state: "unanswered", label: "Unanswered" },
  { state: "marked", label: "Marked for review" },
  { state: "answered-marked", label: "Answered + marked" },
];

export function QuestionPalette({
  states,
  onJump,
}: {
  states: PaletteState[];
  onJump: (index: number) => void;
}) {
  return (
    <nav aria-label="Question navigation">
      <ul className="grid grid-cols-8 gap-2 lg:grid-cols-6">
        {states.map((state, position) => (
          <li key={position}>
            <button
              type="button"
              onClick={() => onJump(position)}
              aria-current={state === "current" ? "true" : undefined}
              aria-label={`Question ${position + 1}, ${stateLabels[state]}`}
              className={cn(
                "flex size-11 items-center justify-center rounded-md border text-sm font-medium transition-colors sm:size-9",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                stateStyles[state],
              )}
            >
              {position + 1}
            </button>
          </li>
        ))}
      </ul>
      <ul className="mt-4 space-y-2 text-xs text-muted-foreground">
        {PALETTE_LEGEND.map((item) => (
          <li key={item.state} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={cn("size-4 rounded border", stateStyles[item.state])}
            />
            {item.label}
          </li>
        ))}
      </ul>
    </nav>
  );
}