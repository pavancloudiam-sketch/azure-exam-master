import * as React from "react";

import { Modal } from "@/features/shared/components/ui/Modal";
import {
  EmptyState,
  PrimaryButton,
  SecondaryButton,
  SelectField,
  StatusAlert,
} from "@/features/shared/components/ui";
import type { Exam, ExamQuestion, Question } from "../types/questions";

/**
 * Assigns an existing question to an exam, or removes it from future
 * deliveries of that exam. Submitted attempts keep their recorded answers.
 */
export function AssignExamModal({
  open,
  onOpenChange,
  question,
  exams,
  assignments,
  onAssign,
  onRemove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question: Question | null;
  exams: Exam[];
  assignments: ExamQuestion[];
  onAssign: (examId: string) => Promise<void>;
  onRemove: (examId: string) => Promise<void>;
}) {
  const [examId, setExamId] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const assigned = React.useMemo(
    () =>
      question
        ? assignments
            .filter((row) => row.question_id === question.id)
            .map((row) => exams.find((exam) => exam.id === row.exam_id))
            .filter((exam): exam is Exam => Boolean(exam))
        : [],
    [assignments, exams, question],
  );

  const available = exams.filter((exam) => !assigned.some((row) => row.id === exam.id));

  React.useEffect(() => {
    if (open) setExamId(available[0]?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, question?.id]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Exam assignments"
      description="Assign this question to an exam or remove it from future assignments."
    >
      <div className="space-y-5">
        <StatusAlert tone="info" title="History is preserved">
          Removing an assignment only affects future exam deliveries. Attempts already submitted keep
          this question in their review data.
        </StatusAlert>

        <div className="space-y-2">
          <h3 className="text-sm font-medium text-foreground">Currently assigned</h3>
          {assigned.length === 0 ? (
            <EmptyState title="Not assigned yet" description="This question is not part of any exam." />
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {assigned.map((exam) => (
                <li key={exam.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="text-sm">{exam.title}</span>
                  <SecondaryButton
                    size="sm"
                    disabled={busy}
                    onClick={() => void run(() => onRemove(exam.id))}
                  >
                    Remove
                  </SecondaryButton>
                </li>
              ))}
            </ul>
          )}
        </div>

        {available.length > 0 ? (
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <SelectField
                id="assign-exam"
                label="Add to exam"
                options={available.map((exam) => ({ value: exam.id, label: exam.title }))}
                value={examId}
                onValueChange={setExamId}
              />
            </div>
            <PrimaryButton
              disabled={!examId}
              loading={busy}
              onClick={() => void run(() => onAssign(examId))}
            >
              Assign
            </PrimaryButton>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {exams.length === 0
              ? "No exams exist yet."
              : "This question is already assigned to every exam."}
          </p>
        )}

        <div className="flex justify-end">
          <SecondaryButton onClick={() => onOpenChange(false)}>Close</SecondaryButton>
        </div>
      </div>
    </Modal>
  );
}