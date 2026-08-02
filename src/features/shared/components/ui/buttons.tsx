import * as React from "react";
import { Loader2 } from "lucide-react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BaseProps = Omit<ButtonProps, "variant"> & {
  loading?: boolean;
  loadingText?: string;
};

function withVariant(variant: ButtonProps["variant"], displayName: string) {
  const Component = React.forwardRef<HTMLButtonElement, BaseProps>(
    ({ loading = false, loadingText, disabled, children, className, ...props }, ref) => (
      <Button
        ref={ref}
        variant={variant}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn("shadow-none", className)}
        {...props}
      >
        {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
        {loading && loadingText ? loadingText : children}
      </Button>
    ),
  );
  Component.displayName = displayName;
  return Component;
}

/** Primary action. One per view where possible. */
export const PrimaryButton = withVariant("default", "PrimaryButton");
/** Secondary / low-emphasis action. */
export const SecondaryButton = withVariant("outline", "SecondaryButton");
/** Destructive action (deactivate, cancel attempt, etc.). */
export const DestructiveButton = withVariant("destructive", "DestructiveButton");