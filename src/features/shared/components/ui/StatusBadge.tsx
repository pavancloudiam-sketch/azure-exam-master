import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type BadgeTone = "neutral" | "info" | "success" | "warning" | "error";

const toneClass: Record<BadgeTone, string> = {
  neutral: "border-border bg-surface text-muted-foreground",
  info: "border-accent/30 bg-accent/10 text-accent-ink",
  success: "border-success/30 bg-success/10 text-success-ink",
  warning: "border-warning/30 bg-warning/15 text-warning-ink",
  error: "border-destructive/30 bg-destructive/10 text-destructive-ink",
};

export function StatusBadge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn("shadow-none", toneClass[tone], className)}>
      {children}
    </Badge>
  );
}