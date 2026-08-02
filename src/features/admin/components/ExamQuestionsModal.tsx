import * as React from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

import { Modal } from "@/features/shared/components/ui/Modal";
import {
  EmptyState,
  LoadingBlock,
  PrimaryButton,
  SecondaryButton,
  StatusAlert,
  StatusBadge,
  TextField,
} from "@/features/shared/components/ui";
import type { Exam, Question } from "../types/questions";
import type { ExamAssignment } from "../services/exam-admin-service";

/**
 * Manages which questions an exam delivers and in what order. Only stems and
 * metadata are shown — option keys and explanations are never fetched here.
 */
export function ExamQuestionsModal({
  open,
  onOpenChange,
  exam,
  assignments,
  loading,
  candidates,
  search,
  onSearchChange,
  onAdd,
  onRemove,
  onReorder,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exam: Exam | null;
  assignments: ExamAssignment[];
  loading: boolean;
  candidates: Question[];
  search: string;
  onSearchChange: (value: string) => void;
  onAdd: (question: Question) => Promise<void>;
  onRemove: (questionId: string) => Promise<void>;
  onReorder: (orderedRowIds: string[]) => Promise<void>;
}) {
  const [busy, setBusy] = React.useState(false);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  function move(index: number, delta: number) {
    const next = assignments.map((row) => row.id);
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    const current = next[index] as string;
    next[index] = next[target] as string;
    next[target] = current;
    void run(() => onReorder(next));
  }

  const assignedIds = new Set(assignments.map((row) => row.question_id));
  const available = candidates.filter((question) => !assignedIds.has(question.id));

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={exam ? `Questions — ${exam.title}` : "Questions"}
      description="Add existing questions, set the delivery order, or remove a question from future deliveries."
    >
      <div className="space-y-6">
        <StatusAlert tone="info" title="History is preserved">
          Removing a question only affects future deliveries. Submitted attempts keep the question
          and the recorded answer.
        </StatusAlert>

        <section className="space-y-2">
          <h3 className="text-sm font-medium text-foreground">
            Assigned questions ({assignments.length})
          </h3>
          {loading ? (
            <LoadingBlock label="Loading assigned questions" />
          ) : assignments.length === 0 ? (
            <EmptyState
              title="No questions assigned"
              description="Add at least one active question before publishing this exam."
            />
          ) : (
            <ol className="divide-y divide-border rounded-md border border-border">
              {assignments.map((row, index) => (
                <li key={row.id} className="flex items-start justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm">
                      {index + 1}. {row.question?.stem ?? "Question"}
                    </p>
                    <div className="mt-1 flex gap-2">
                      <StatusBadge tone={row.question?.is_active ? "success" : "neutral"}>
                        {row.question?.is_active ? "Active" : "Inactive"}
                      </StatusBadge>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <SecondaryButton
                      size="sm"
                      aria-label="Move up"
                      disabled={busy || index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp className="size-4" aria-hidden="true" />
                    </SecondaryButton>
                    <SecondaryButton
                      size="sm"
                      aria-label="Move down"
                      disabled={busy || index === assignments.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown className="size-4" aria-hidden="true" />
                    </SecondaryButton>
                    <SecondaryButton
                      size="sm"
                      disabled={busy}
                      onClick={() => void run(() => onRemove(row.question_id))}
                    >
                      Remove
                    </SecondaryButton>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-medium text-foreground">Add existing questions</h3>
          <TextField
            id="exam-question-search"
            label="Search questions"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search by stem"
          />
          {available.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No further active questions match for this certification.
            </p>
          ) : (
            <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded-md border border-border">
              {available.map((question) => (
                <li key={question.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="min-w-0 truncate text-sm">{question.stem}</span>
                  <PrimaryButton
                    size="sm"
                    disabled={busy}
                    onClick={() => void run(() => onAdd(question))}
                  >
                    Add
                  </PrimaryButton>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex justify-end">
          <SecondaryButton onClick={() => onOpenChange(false)}>Close</SecondaryButton>
        </div>
      </div>
    </Modal>
  );
}