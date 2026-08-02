import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, Loader2, OctagonAlert, Inbox } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { PrimaryButton, SecondaryButton } from "./buttons";

export type StatusTone = "info" | "success" | "warning" | "error";

const toneStyles: Record<StatusTone, { className: string; Icon: typeof Info }> = {
  info: { className: "border-accent/40 bg-accent/5 text-foreground", Icon: Info },
  success: { className: "border-success/40 bg-success/5 text-foreground", Icon: CheckCircle2 },
  warning: { className: "border-warning/40 bg-warning/10 text-foreground", Icon: AlertTriangle },
  error: {
    className: "border-destructive/40 bg-destructive/5 text-foreground",
    Icon: OctagonAlert,
  },
};

const toneIconColor: Record<StatusTone, string> = {
  info: "text-accent-ink",
  success: "text-success-ink",
  warning: "text-warning-ink",
  error: "text-destructive-ink",
};

export function StatusAlert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: StatusTone;
  title: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const { className: toneClass, Icon } = toneStyles[tone];
  return (
    <Alert className={cn(toneClass, className)}>
      <Icon className={cn("size-4", toneIconColor[tone])} aria-hidden="true" />
      <AlertTitle>{title}</AlertTitle>
      {children ? <AlertDescription>{children}</AlertDescription> : null}
    </Alert>
  );
}

export function Spinner({
  className,
  label = "Loading",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span role="status" aria-live="polite" className="inline-flex items-center gap-2">
      <Loader2 className={cn("size-5 animate-spin text-accent-ink", className)} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function LoadingBlock({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 rounded-lg border border-border bg-card py-12">
      <Spinner label={label} />
      <span className="text-sm text-muted-foreground">{label}…</span>
    </div>
  );
}

export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="space-y-2 rounded-lg border border-border bg-card p-4">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
}: {
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  icon?: typeof Inbox;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-surface px-6 py-12 text-center">
      <Icon className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      {description ? (
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? (
        <PrimaryButton className="mt-5" onClick={action.onClick}>
          {action.label}
        </PrimaryButton>
      ) : null}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this content. Please try again.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-destructive/40 bg-destructive/5 px-6 py-10 text-center"
    >
      <OctagonAlert className="mx-auto size-8 text-destructive-ink" aria-hidden="true" />
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      {onRetry ? (
        <SecondaryButton className="mt-5" onClick={onRetry}>
          Try again
        </SecondaryButton>
      ) : null}
    </div>
  );
}

/** Toast helpers so call sites never import sonner directly. */
export const notify = {
  success: (message: string, description?: string) => toast.success(message, { description }),
  error: (message: string, description?: string) => toast.error(message, { description }),
  warning: (message: string, description?: string) => toast.warning(message, { description }),
  info: (message: string, description?: string) => toast(message, { description }),
};