/**
 * Durable autosave queue for the exam runner.
 *
 * Every answer change is written to a local queue first and only then pushed
 * to the server. The queue survives refreshes and browser restarts (it is
 * mirrored into `localStorage`), retries failed pushes with exponential
 * backoff, pauses while the device is offline and replays automatically when
 * connectivity returns. Answers can therefore never be lost by a dropped
 * request, a reload or a closed tab.
 *
 * The module is deliberately free of React and Supabase imports so it can be
 * unit-tested with injected clocks, storage and transports.
 */

export type AutosavePayload = {
  questionId: string;
  selected: string[];
  markedForReview: boolean;
  /**
   * `yes_no` questions only: the explicit Yes/No per statement. Carried so a
   * queued edit restores the same UI state after a refresh. Never scored.
   */
  statementResponses?: Record<string, "yes" | "no">;
};


export type QueuedSave = AutosavePayload & {
  /** Local wall-clock time of the edit — used for conflict detection. */
  updatedAt: number;
  /** Failed delivery attempts so far. */
  attempts: number;
};

export type AutosaveStatus = {
  pending: number;
  flushing: boolean;
  offline: boolean;
  /** Non-null while the queue is retrying after a failure. */
  error: string | null;
  /** Local time of the last successful push. */
  lastSavedAt: number | null;
};

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export type AutosaveQueueOptions = {
  attemptId: string;
  save: (item: AutosavePayload) => Promise<void>;
  storage?: StorageLike | null;
  isOnline?: () => boolean;
  now?: () => number;
  schedule?: (fn: () => void, ms: number) => unknown;
  cancel?: (handle: unknown) => void;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Attempts before the failure is surfaced to the student. */
  reportAfterAttempts?: number;
  onStatus?: (status: AutosaveStatus) => void;
};

export function autosaveStorageKey(attemptId: string) {
  return `askmeexam.autosave.${attemptId}`;
}

export function backoffDelay(attempts: number, base: number, max: number) {
  const raw = base * 2 ** Math.max(0, attempts - 1);
  return Math.min(raw, max);
}

/** Reads a persisted queue without instantiating the runtime queue. */
export function readPersistedQueue(
  attemptId: string,
  storage: StorageLike | null | undefined,
): QueuedSave[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(autosaveStorageKey(attemptId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is QueuedSave =>
        !!item &&
        typeof item === "object" &&
        typeof (item as QueuedSave).questionId === "string" &&
        Array.isArray((item as QueuedSave).selected),
    );
  } catch {
    return [];
  }
}

export class AutosaveQueue {
  private items: QueuedSave[] = [];
  private flushing = false;
  private offline = false;
  private error: string | null = null;
  private lastSavedAt: number | null = null;
  private timer: unknown = null;
  private stopped = false;

  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly reportAfterAttempts: number;
  private readonly now: () => number;
  private readonly isOnline: () => boolean;
  private readonly schedule: (fn: () => void, ms: number) => unknown;
  private readonly cancel: (handle: unknown) => void;

  constructor(private readonly options: AutosaveQueueOptions) {
    this.baseDelayMs = options.baseDelayMs ?? 1000;
    this.maxDelayMs = options.maxDelayMs ?? 30_000;
    this.reportAfterAttempts = options.reportAfterAttempts ?? 2;
    this.now = options.now ?? (() => Date.now());
    this.isOnline = options.isOnline ?? (() => true);
    this.schedule =
      options.schedule ??
      ((fn, ms) => (typeof setTimeout === "function" ? setTimeout(fn, ms) : null));
    this.cancel =
      options.cancel ??
      ((handle) => {
        if (handle !== null && typeof clearTimeout === "function") {
          clearTimeout(handle as ReturnType<typeof setTimeout>);
        }
      });
    this.items = readPersistedQueue(options.attemptId, options.storage);
    this.offline = !this.isOnline();
  }

  get status(): AutosaveStatus {
    return {
      pending: this.items.length,
      flushing: this.flushing,
      offline: this.offline,
      error: this.error,
      lastSavedAt: this.lastSavedAt,
    };
  }

  /** Queued but not yet delivered edits — used to restore state on resume. */
  get pendingItems(): QueuedSave[] {
    return this.items.map((item) => ({ ...item }));
  }

  /** Adds (or replaces) the queued edit for a question and starts a flush. */
  enqueue(payload: AutosavePayload) {
    const existing = this.items.findIndex((item) => item.questionId === payload.questionId);
    const entry: QueuedSave = {
      ...payload,
      selected: [...payload.selected],
      updatedAt: this.now(),
      attempts: 0,
    };
    // Latest write per question wins: an older queued edit for the same
    // question is superseded, never sent twice.
    if (existing >= 0) this.items.splice(existing, 1, entry);
    else this.items.push(entry);
    this.persist();
    this.emit();
    void this.flush();
  }

  /** Called when the browser reports connectivity changes. */
  setOnline(online: boolean) {
    const wasOffline = this.offline;
    this.offline = !online;
    const changed = wasOffline !== this.offline;
    if (changed) this.emit();
    if (online) {
      this.clearTimer();
      void this.flush();
    }
  }

  /**
   * Drains the queue and resolves once it is empty, or rejects when the queue
   * cannot be delivered (offline, or the transport keeps failing). Used before
   * submission so no answer is left behind.
   */
  async drain(): Promise<void> {
    this.clearTimer();
    await this.flush(true);
    if (this.items.length > 0) {
      throw new Error(
        this.offline
          ? "You are offline, so some answers have not been saved yet."
          : (this.error ?? "Some answers could not be saved."),
      );
    }
  }

  stop() {
    this.stopped = true;
    this.clearTimer();
  }

  /** Removes the persisted queue (after a successful submission). */
  clearPersisted() {
    this.items = [];
    this.options.storage?.removeItem(autosaveStorageKey(this.options.attemptId));
    this.emit();
  }

  private clearTimer() {
    if (this.timer !== null) {
      this.cancel(this.timer);
      this.timer = null;
    }
  }

  private persist() {
    try {
      const key = autosaveStorageKey(this.options.attemptId);
      if (this.items.length === 0) this.options.storage?.removeItem(key);
      else this.options.storage?.setItem(key, JSON.stringify(this.items));
    } catch {
      /* storage full or unavailable — the in-memory queue still applies */
    }
  }

  private emit() {
    this.options.onStatus?.(this.status);
  }

  private async flush(force = false): Promise<void> {
    if (this.flushing || this.stopped) return;
    if (this.items.length === 0) return;
    if (!this.isOnline()) {
      this.offline = true;
      this.emit();
      return;
    }
    this.offline = false;
    this.flushing = true;
    this.emit();

    try {
      while (this.items.length > 0) {
        if (this.stopped) break;
        if (!this.isOnline()) {
          this.offline = true;
          break;
        }
        const item = this.items[0]!;
        try {
          await this.options.save({
            questionId: item.questionId,
            selected: item.selected,
            markedForReview: item.markedForReview,
          });
          // The item may have been superseded while in flight; only drop it
          // when it is still the same edit.
          if (this.items[0] === item) this.items.shift();
          this.persist();
          this.lastSavedAt = this.now();
          this.error = null;
          this.emit();
        } catch (cause) {
          item.attempts += 1;
          this.persist();
          if (!this.isOnline()) {
            this.offline = true;
            break;
          }
          if (item.attempts >= this.reportAfterAttempts) {
            this.error = cause instanceof Error ? cause.message : "We could not save that answer.";
          }
          this.emit();
          if (force) break;
          this.scheduleRetry(item.attempts);
          break;
        }
      }
    } finally {
      this.flushing = false;
      this.emit();
    }
  }

  private scheduleRetry(attempts: number) {
    if (this.stopped || this.timer !== null) return;
    const delay = backoffDelay(attempts, this.baseDelayMs, this.maxDelayMs);
    this.timer = this.schedule(() => {
      this.timer = null;
      void this.flush();
    }, delay);
  }
}

/**
 * Conflict detection for resume: the same attempt open on another device can
 * have written a different answer for a question we still hold locally.
 */
export type ResumeConflict = {
  questionId: string;
  localSelected: string[];
  remoteSelected: string[];
};

export function detectResumeConflicts(
  queued: QueuedSave[],
  remote: {
    question_id: string;
    selected_option_ids: string[] | null;
    answered_at?: string | null;
  }[],
): ResumeConflict[] {
  const remoteById = new Map(remote.map((row) => [row.question_id, row]));
  const conflicts: ResumeConflict[] = [];
  for (const item of queued) {
    const row = remoteById.get(item.questionId);
    if (!row) continue;
    const remoteSelected = row.selected_option_ids ?? [];
    if (sameSelection(remoteSelected, item.selected)) continue;
    const remoteAt = row.answered_at ? Date.parse(row.answered_at) : NaN;
    // Only a *newer* remote write is a genuine conflict; an older one is just
    // our own pending edit that never reached the server.
    if (Number.isFinite(remoteAt) && remoteAt <= item.updatedAt) continue;
    conflicts.push({
      questionId: item.questionId,
      localSelected: [...item.selected],
      remoteSelected: [...remoteSelected],
    });
  }
  return conflicts;
}

export function sameSelection(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((value, index) => value === right[index]);
}
