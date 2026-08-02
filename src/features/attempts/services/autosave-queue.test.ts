import { describe, expect, it, vi } from "vitest";

import {
  AutosaveQueue,
  autosaveStorageKey,
  backoffDelay,
  detectResumeConflicts,
  readPersistedQueue,
  sameSelection,
  type StorageLike,
} from "./autosave-queue";

function memoryStorage(
  seed: Record<string, string> = {},
): StorageLike & { map: Map<string, string> } {
  const map = new Map(Object.entries(seed));
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}

/** Manual scheduler so backoff timing is asserted, not waited on. */
function scheduler() {
  const jobs: { fn: () => void; delay: number; id: number }[] = [];
  let id = 0;
  return {
    delays: () => jobs.map((job) => job.delay),
    pending: () => jobs.length,
    schedule: (fn: () => void, delay: number) => {
      jobs.push({ fn, delay, id: ++id });
      return id;
    },
    cancel: (handle: unknown) => {
      const index = jobs.findIndex((job) => job.id === handle);
      if (index >= 0) jobs.splice(index, 1);
    },
    runOnce: async () => {
      const job = jobs.shift();
      if (!job) return;
      job.fn();
      for (let i = 0; i < 8; i += 1) await Promise.resolve();
    },
    runAll: async () => {
      let guard = 0;
      while (jobs.length > 0 && guard < 20) {
        guard += 1;
        const job = jobs.shift()!;
        job.fn();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      }
    },
  };
}

const flush = async () => {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
};

describe("backoff", () => {
  it("grows exponentially and caps at the maximum", () => {
    expect(backoffDelay(1, 1000, 30_000)).toBe(1000);
    expect(backoffDelay(2, 1000, 30_000)).toBe(2000);
    expect(backoffDelay(3, 1000, 30_000)).toBe(4000);
    expect(backoffDelay(10, 1000, 30_000)).toBe(30_000);
  });
});

describe("AutosaveQueue", () => {
  it("saves an answer immediately when online", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const queue = new AutosaveQueue({ attemptId: "a1", save, storage: memoryStorage() });
    queue.enqueue({ questionId: "q1", selected: ["o1"], markedForReview: false });
    await flush();
    expect(save).toHaveBeenCalledTimes(1);
    expect(queue.status.pending).toBe(0);
  });

  it("retries with exponential backoff until the save succeeds", async () => {
    const clock = scheduler();
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValue(undefined);
    const queue = new AutosaveQueue({
      attemptId: "a1",
      save,
      storage: memoryStorage(),
      schedule: clock.schedule,
      cancel: clock.cancel,
      baseDelayMs: 100,
      maxDelayMs: 1000,
    });
    queue.enqueue({ questionId: "q1", selected: ["o1"], markedForReview: false });
    await flush();
    expect(clock.delays()).toEqual([100]);
    await clock.runAll();
    await flush();
    expect(save).toHaveBeenCalledTimes(3);
    expect(queue.status.pending).toBe(0);
    expect(queue.status.error).toBeNull();
  });

  it("queues while offline and replays on reconnect, in order", async () => {
    let online = false;
    const seen: string[] = [];
    const save = vi.fn(async (item: { questionId: string }) => {
      seen.push(item.questionId);
    });
    const queue = new AutosaveQueue({
      attemptId: "a1",
      save,
      storage: memoryStorage(),
      isOnline: () => online,
    });
    queue.enqueue({ questionId: "q1", selected: ["o1"], markedForReview: false });
    queue.enqueue({ questionId: "q2", selected: ["o2"], markedForReview: true });
    await flush();
    expect(save).not.toHaveBeenCalled();
    expect(queue.status.offline).toBe(true);
    expect(queue.status.pending).toBe(2);

    online = true;
    queue.setOnline(true);
    await flush();
    expect(seen).toEqual(["q1", "q2"]);
    expect(queue.status.pending).toBe(0);
    expect(queue.status.offline).toBe(false);
  });

  it("collapses repeated edits of the same question to the latest value", async () => {
    let online = false;
    const save = vi.fn().mockResolvedValue(undefined);
    const queue = new AutosaveQueue({
      attemptId: "a1",
      save,
      storage: memoryStorage(),
      isOnline: () => online,
    });
    queue.enqueue({ questionId: "q1", selected: ["o1"], markedForReview: false });
    queue.enqueue({ questionId: "q1", selected: ["o2"], markedForReview: false });
    expect(queue.status.pending).toBe(1);
    online = true;
    queue.setOnline(true);
    await flush();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]![0].selected).toEqual(["o2"]);
  });

  it("persists the queue so answers survive a refresh or browser restart", async () => {
    const storage = memoryStorage();
    const queue = new AutosaveQueue({
      attemptId: "a1",
      save: vi.fn().mockResolvedValue(undefined),
      storage,
      isOnline: () => false,
    });
    queue.enqueue({ questionId: "q1", selected: ["o1"], markedForReview: true });
    expect(storage.map.has(autosaveStorageKey("a1"))).toBe(true);

    // A brand-new queue (fresh page load) rehydrates and delivers the answer.
    const save = vi.fn().mockResolvedValue(undefined);
    const revived = new AutosaveQueue({ attemptId: "a1", save, storage });
    expect(revived.pendingItems).toHaveLength(1);
    revived.setOnline(true);
    await flush();
    expect(save).toHaveBeenCalledWith({
      questionId: "q1",
      selected: ["o1"],
      markedForReview: true,
    });
    expect(storage.map.has(autosaveStorageKey("a1"))).toBe(false);
  });

  it("drain rejects while answers are still queued offline", async () => {
    const queue = new AutosaveQueue({
      attemptId: "a1",
      save: vi.fn().mockResolvedValue(undefined),
      storage: memoryStorage(),
      isOnline: () => false,
    });
    queue.enqueue({ questionId: "q1", selected: ["o1"], markedForReview: false });
    await expect(queue.drain()).rejects.toThrow(/offline/i);
  });

  it("drain resolves once the queue is empty", async () => {
    const queue = new AutosaveQueue({
      attemptId: "a1",
      save: vi.fn().mockResolvedValue(undefined),
      storage: memoryStorage(),
    });
    queue.enqueue({ questionId: "q1", selected: ["o1"], markedForReview: false });
    await expect(queue.drain()).resolves.toBeUndefined();
    expect(queue.status.pending).toBe(0);
  });

  it("surfaces an error only after repeated failures, and never drops the answer", async () => {
    const clock = scheduler();
    const queue = new AutosaveQueue({
      attemptId: "a1",
      save: vi.fn().mockRejectedValue(new Error("server exploded")),
      storage: memoryStorage(),
      schedule: clock.schedule,
      cancel: clock.cancel,
      baseDelayMs: 10,
      reportAfterAttempts: 2,
    });
    queue.enqueue({ questionId: "q1", selected: ["o1"], markedForReview: false });
    await flush();
    expect(queue.status.error).toBeNull();
    expect(clock.pending()).toBe(1);
    await clock.runOnce();
    await flush();
    queue.stop();
    expect(queue.status.error).toMatch(/server exploded/);
    expect(queue.status.pending).toBe(1);
  });

  it("ignores corrupted persisted data", () => {
    const storage = memoryStorage({ [autosaveStorageKey("a1")]: "{not json" });
    expect(readPersistedQueue("a1", storage)).toEqual([]);
  });
});

describe("resume conflict detection", () => {
  const queued = [
    { questionId: "q1", selected: ["o1"], markedForReview: false, updatedAt: 1_000, attempts: 0 },
  ];

  it("flags a newer remote answer that differs from the local one", () => {
    const conflicts = detectResumeConflicts(queued, [
      {
        question_id: "q1",
        selected_option_ids: ["o2"],
        answered_at: new Date(5_000).toISOString(),
      },
    ]);
    expect(conflicts).toEqual([
      { questionId: "q1", localSelected: ["o1"], remoteSelected: ["o2"] },
    ]);
  });

  it("ignores an older remote answer — that is just our unsent edit", () => {
    expect(
      detectResumeConflicts(queued, [
        {
          question_id: "q1",
          selected_option_ids: ["o2"],
          answered_at: new Date(500).toISOString(),
        },
      ]),
    ).toEqual([]);
  });

  it("ignores identical selections regardless of order", () => {
    expect(
      detectResumeConflicts(
        [{ ...queued[0]!, selected: ["a", "b"] }],
        [
          {
            question_id: "q1",
            selected_option_ids: ["b", "a"],
            answered_at: new Date(9_000).toISOString(),
          },
        ],
      ),
    ).toEqual([]);
    expect(sameSelection(["a", "b"], ["b", "a"])).toBe(true);
    expect(sameSelection(["a"], ["a", "b"])).toBe(false);
  });
});
