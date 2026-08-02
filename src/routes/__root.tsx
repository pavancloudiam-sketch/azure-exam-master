import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SiteHeader } from "../features/shared/components/SiteHeader";
import { SiteFooter } from "../features/shared/components/SiteFooter";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/features/auth/hooks/use-auth";
import { TenantBrandingProvider } from "@/features/organizations/hooks/use-tenant-branding";
import {
  AppErrorBoundary,
  ErrorFallback,
  describeError,
  logError,
} from "@/features/observability";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const [requestId, setRequestId] = useState<string | undefined>(undefined);

  useEffect(() => {
    setRequestId(
      logError("ui.unhandled_error", "Route render failed", error, {
        boundary: "tanstack_root_error_component",
      }),
    );
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <ErrorFallback
        error={describeError(error, requestId)}
        onRetry={() => {
          router.invalidate();
          reset();
        }}
      />
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "AskMeExam — Practice with Confidence." },
      {
        name: "description",
        content:
          "Independent Microsoft Entra ID certification practice platform. Practice with Confidence.",
      },
      { name: "author", content: "AskMeExam" },
      { property: "og:title", content: "AskMeExam — Practice with Confidence." },
      {
        property: "og:description",
        content: "Independent Microsoft Entra ID certification practice platform.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@Lovable" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  // Last-resort capture for errors that escape React (async callbacks,
  // rejected promises). Logged only — the UI is already unaffected.
  useEffect(() => {
    const onError = (event: ErrorEvent) =>
      logError("ui.unhandled_error", "Uncaught window error", event.error ?? event.message, {
        boundary: "window",
      });
    const onRejection = (event: PromiseRejectionEvent) =>
      logError("ui.unhandled_error", "Unhandled promise rejection", event.reason, {
        boundary: "promise",
      });
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
      <TenantBrandingProvider>
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <SiteHeader />
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <AppErrorBoundary boundary="root_outlet">
          <Outlet />
        </AppErrorBoundary>
        <SiteFooter />
        <Toaster richColors closeButton position="top-right" />
      </div>
      </TenantBrandingProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
