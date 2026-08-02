import { Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { AI_DISCLAIMER, AI_GENERATED_LABEL } from "../constants";

/**
 * Required on every AskMe AI surface. `variant="inline"` marks a single block
 * of AI output; `variant="panel"` carries the full independence notice.
 */
export function AiDisclaimer({
  variant = "panel",
  className,
}: {
  variant?: "panel" | "inline";
  className?: string;
}) {
  if (variant === "inline") {
    return (
      <p className={cn("text-muted-foreground flex items-center gap-1.5 text-xs", className)}>
        <Sparkles aria-hidden className="size-3.5" />
        <span>{AI_GENERATED_LABEL}</span>
      </p>
    );
  }

  return (
    <aside
      role="note"
      className={cn(
        "bg-muted/60 text-muted-foreground rounded-lg border px-4 py-3 text-xs leading-relaxed",
        className,
      )}
    >
      <span className="text-foreground font-medium">About AskMe AI: </span>
      {AI_DISCLAIMER}
    </aside>
  );
}
