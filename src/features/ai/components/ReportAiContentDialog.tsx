import * as React from "react";

import { Modal } from "@/features/shared/components/ui/Modal";
import {
  PrimaryButton,
  SecondaryButton,
  SelectField,
  notify,
} from "@/features/shared/components/ui";
import { Textarea } from "@/components/ui/textarea";
import { reportAiContent } from "../services/coach.functions";

const REASONS = [
  { value: "inaccurate", label: "Inaccurate or misleading" },
  { value: "unsafe", label: "Unsafe or inappropriate" },
  { value: "reveals_exam_content", label: "Looks like real exam content" },
  { value: "off_topic", label: "Off topic" },
  { value: "other", label: "Something else" },
];

export function ReportAiContentDialog({
  open,
  onClose,
  reportedText,
  attemptId,
  questionId,
  requestId,
  feature = "ai_coach",
}: {
  open: boolean;
  onClose: () => void;
  reportedText: string;
  attemptId?: string;
  questionId?: string;
  requestId?: string;
  feature?: "ai_coach" | "ai_interview_coach" | "ai_study_assistant";
}) {
  const [reason, setReason] = React.useState("inaccurate");
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function submit() {
    setSaving(true);
    try {
      await reportAiContent({
        data: {
          feature,
          reason: reason as "inaccurate",
          reportedText,
          ...(note.trim() ? { note: note.trim() } : {}),
          ...(attemptId ? { attemptId } : {}),
          ...(questionId ? { questionId } : {}),
          ...(requestId ? { requestId } : {}),
        },
      });
      notify.success("Thanks — this response has been reported for review.");
      setNote("");
      onClose();
    } catch {
      notify.error("Could not submit that report. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="Report this AI response"
      description="Flag unsafe or inaccurate AskMe AI output. Your score is never affected."
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <PrimaryButton type="button" onClick={submit} disabled={saving}>
            {saving ? "Sending…" : "Send report"}
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-4">
        <SelectField
          id="ai-report-reason"
          label="Reason"
          value={reason}
          onValueChange={setReason}
          options={REASONS}
        />
        <div className="space-y-1.5">
          <label htmlFor="ai-report-note" className="text-sm font-medium">
            What was wrong? (optional)
          </label>
          <Textarea
            id="ai-report-note"
            value={note}
            maxLength={1000}
            rows={4}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Add any detail that helps a reviewer."
          />
        </div>
      </div>
    </Modal>
  );
}