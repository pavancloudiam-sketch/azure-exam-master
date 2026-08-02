import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PrimaryButton, SecondaryButton } from "@/features/shared/components/ui";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  total: number;
  answered: number;
  unanswered: number;
  marked: number;
  submitting: boolean;
  onConfirm: () => void;
};

/** Pre-submission summary + confirmation shown before an exam is finalised. */
export function SubmitReviewDialog({
  open,
  onOpenChange,
  total,
  answered,
  unanswered,
  marked,
  submitting,
  onConfirm,
}: Props) {
  const stats = [
    { label: "Answered", value: answered },
    { label: "Unanswered", value: unanswered },
    { label: "Marked for review", value: marked },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Submit this exam?</DialogTitle>
          <DialogDescription>
            Your exam has {total} questions. Once submitted, your answers are locked and scored.
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-3 gap-3">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-md border border-border bg-surface p-3 text-center">
              <dt className="text-xs text-muted-foreground">{stat.label}</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums">{stat.value}</dd>
            </div>
          ))}
        </dl>

        {unanswered > 0 ? (
          <p className="text-sm text-destructive-ink">
            {unanswered} question{unanswered === 1 ? "" : "s"} still unanswered — unanswered
            questions score zero.
          </p>
        ) : null}

        <DialogFooter>
          <SecondaryButton onClick={() => onOpenChange(false)}>Keep working</SecondaryButton>
          <PrimaryButton onClick={onConfirm} loading={submitting}>
            Submit exam
          </PrimaryButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}