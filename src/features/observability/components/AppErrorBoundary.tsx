import * as React from "react";

import { describeError } from "../errors";
import { logError } from "../logger";
import { ErrorFallback } from "./ErrorFallback";

type Props = {
  children: React.ReactNode;
  /** Names the failing area in logs, e.g. "exam_runner". */
  boundary: string;
  /** Renders inside a card instead of a full-height screen. */
  compact?: boolean;
};

type State = { cause: unknown; requestId?: string | undefined };

/**
 * Feature-level error boundary. Catches render/lifecycle crashes, logs a
 * structured event, and shows a safe fallback with a support reference.
 */
export class AppErrorBoundary extends React.Component<Props, State> {
  override state: State = { cause: null };

  static getDerivedStateFromError(cause: unknown): Partial<State> {
    return { cause };
  }

  override componentDidCatch(cause: unknown) {
    const requestId = logError("ui.unhandled_error", "Unhandled UI error", cause, {
      boundary: this.props.boundary,
    });
    this.setState({ requestId });
  }

  private reset = () => this.setState({ cause: null, requestId: undefined });

  override render() {
    if (this.state.cause == null) return this.props.children;
    const described = describeError(this.state.cause, this.state.requestId);
    return (
      <ErrorFallback
        error={described}
        onRetry={this.reset}
        {...(this.props.compact ? { compact: true } : {})}
      />
    );
  }
}
