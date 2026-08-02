import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  Modal,
  PrimaryButton,
  SecondaryButton,
  StatusAlert,
  TextField,
  notify,
} from "@/features/shared/components/ui";
import { requestRefund } from "../services/billing-service";

export function RefundRequestDialog({
  orderId,
  orderNumber,
  open,
  onOpenChange,
}: {
  orderId: string;
  orderNumber: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");

  const submit = useMutation({
    mutationFn: () => requestRefund(orderId, reason),
    onSuccess: () => {
      notify.success("Refund requested", "An administrator will review your request.");
      setReason("");
      onOpenChange(false);
      void queryClient.invalidateQueries({ queryKey: ["my-purchases"] });
      void queryClient.invalidateQueries({ queryKey: ["my-refunds"] });
      void queryClient.invalidateQueries({ queryKey: ["my-notifications"] });
    },
    onError: (e: Error) => notify.error("Could not request a refund", e.message),
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Request a refund for ${orderNumber}`}
      description="Refunds are reviewed by an administrator against the published refund policy."
      footer={
        <>
          <SecondaryButton onClick={() => onOpenChange(false)}>Cancel</SecondaryButton>
          <PrimaryButton
            loading={submit.isPending}
            loadingText="Sending…"
            disabled={reason.trim().length < 5}
            onClick={() => submit.mutate()}
          >
            Send request
          </PrimaryButton>
        </>
      }
    >
      <TextField
        id="refund-reason"
        label="Why are you requesting a refund?"
        required
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        hint="At least a short sentence, so the reviewer has context."
      />
      <StatusAlert tone="info" title="What happens next">
        You will see the status of this request on this page and receive a message at each step:
        received, approved or rejected, and processed.
      </StatusAlert>
    </Modal>
  );
}