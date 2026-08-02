import * as React from "react";
import { Timer } from "lucide-react";

import { cn } from "@/lib/utils";
import { getAttemptTimeRemaining } from "../services/attempt-service";

function format(totalSeconds: number) {
  const safe = Math.max(totalSeconds, 0);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Countdown for timed mode only. The value is anchored to the server clock:
 * remaining seconds come from `get_attempt_time_remaining` and are re-synced
 * periodically, while ticks in between use the monotonic `performance.now`
 * clock. Changing the device clock therefore cannot add time — and the
 * database rejects answers past the deadline regardless of what is displayed.
 */
/**
 * Milestones (in seconds) that are announced to assistive technology. The
 * countdown itself is `aria-live="off"` — announcing every tick would make
 * the exam unusable with a screen reader — so we announce a small set of
 * meaningful thresholds instead.
 */
const ANNOUNCE_AT = [1800, 900, 600, 300, 120, 60];

function announcement(seconds: number) {
  if (seconds >= 3600) return `${Math.round(seconds / 60)} minutes remaining`;
  if (seconds >= 60) return `${Math.round(seconds / 60)} minutes remaining`;
  return `${seconds} seconds remaining`;
}

export function ExamTimer({
  attemptId,
  onExpire,
}: {
  attemptId: string;
  onExpire: () => void;
}) {
  const [remaining, setRemaining] = React.useState<number | null>(null);
  const [spoken, setSpoken] = React.useState<string>("");
  const announced = React.useRef<Set<number>>(new Set());
  const anchor = React.useRef<{ seconds: number; at: number } | null>(null);
  const fired = React.useRef(false);
  const expire = React.useRef(onExpire);
  expire.current = onExpire;

  React.useEffect(() => {
    let active = true;

    const sync = async () => {
      try {
        const seconds = await getAttemptTimeRemaining(attemptId);
        if (!active || seconds === null) return;
        anchor.current = { seconds, at: performance.now() };
        setRemaining(seconds);
      } catch {
        /* keep counting from the last known server anchor */
      }
    };

    void sync();
    const syncId = window.setInterval(() => void sync(), 30_000);
    const tickId = window.setInterval(() => {
      const base = anchor.current;
      if (!base) return;
      const next = Math.max(
        0,
        Math.round(base.seconds - (performance.now() - base.at) / 1000),
      );
      setRemaining(next);
      const milestone = ANNOUNCE_AT.find(
        (mark) => next <= mark && next > mark - 2 && !announced.current.has(mark),
      );
      if (milestone) {
        announced.current.add(milestone);
        setSpoken(announcement(milestone));
      }
      if (next <= 0 && !fired.current) {
        fired.current = true;
        setSpoken("Time is up. Your exam is being submitted.");
        expire.current();
      }
    }, 1000);

    return () => {
      active = false;
      window.clearInterval(syncId);
      window.clearInterval(tickId);
    };
  }, [attemptId]);

  if (remaining === null) return null;

  const low = remaining <= 300;
  return (
    <>
    <p
      role="timer"
      aria-live="off"
      className={cn(
        "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium tabular-nums",
        low ? "border-destructive/50 bg-destructive/10 text-destructive-ink" : "border-border bg-surface",
      )}
    >
      <Timer className="size-4" aria-hidden="true" />
      <span className="sr-only">Time remaining</span>
      {format(remaining)}
    </p>
      <span aria-live="assertive" className="sr-only">
        {spoken}
      </span>
    </>
  );
}