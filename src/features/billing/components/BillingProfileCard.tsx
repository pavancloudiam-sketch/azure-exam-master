import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { PrimaryButton, StatusAlert, SurfaceCard, TextField, CheckboxField, notify } from "@/features/shared/components/ui";
import {
  getMyBillingProfile,
  saveMyBillingProfile,
  type BillingProfileInput,
} from "../services/billing-service";

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;

const EMPTY: BillingProfileInput = {
  legal_name: "",
  is_business: false,
  gstin: null,
  address_line1: null,
  address_line2: null,
  city: null,
  state_name: null,
  state_code: null,
  postal_code: null,
  place_of_supply: null,
};

/** Billing details used on receipts. India-only fields for the launch jurisdiction. */
export function BillingProfileCard() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<BillingProfileInput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const profile = useQuery({
    queryKey: ["my-billing-profile"],
    queryFn: getMyBillingProfile,
  });

  const current: BillingProfileInput =
    form ??
    (profile.data
      ? {
          legal_name: profile.data.legal_name,
          is_business: profile.data.is_business,
          gstin: profile.data.gstin,
          address_line1: profile.data.address_line1,
          address_line2: profile.data.address_line2,
          city: profile.data.city,
          state_name: profile.data.state_name,
          state_code: profile.data.state_code,
          postal_code: profile.data.postal_code,
          place_of_supply: profile.data.place_of_supply,
        }
      : EMPTY);

  const save = useMutation({
    mutationFn: saveMyBillingProfile,
    onSuccess: () => {
      notify.success("Billing details saved");
      void queryClient.invalidateQueries({ queryKey: ["my-billing-profile"] });
    },
    onError: (e: Error) => notify.error("Could not save billing details", e.message),
  });

  function set<K extends keyof BillingProfileInput>(key: K, value: BillingProfileInput[K]) {
    setForm({ ...current, [key]: value });
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!current.legal_name.trim()) {
      setError("Enter the name the receipt should be made out to.");
      return;
    }
    if (current.gstin && !GSTIN_PATTERN.test(current.gstin.trim().toUpperCase())) {
      setError("Enter a valid 15-character GST number, or leave it blank.");
      return;
    }
    if (current.state_code && !/^[0-9]{2}$/.test(current.state_code)) {
      setError("State code must be two digits.");
      return;
    }
    save.mutate({
      ...current,
      legal_name: current.legal_name.trim(),
      gstin: current.gstin ? current.gstin.trim().toUpperCase() : null,
    });
  }

  return (
    <SurfaceCard>
      <h3 className="text-base font-semibold">Billing details</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Used on AskMeExam receipts. India only for now. A GST number is optional and is recorded
        for your records — tax is not calculated or filed automatically.
      </p>
      <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
        <TextField
          id="legal_name"
          label="Name on receipt"
          required
          value={current.legal_name}
          onChange={(e) => set("legal_name", e.target.value)}
        />
        <TextField
          id="gstin"
          label="GST number (optional)"
          hint="15 characters, business buyers only"
          value={current.gstin ?? ""}
          onChange={(e) => set("gstin", e.target.value || null)}
        />
        <TextField
          id="address_line1"
          label="Address line 1"
          value={current.address_line1 ?? ""}
          onChange={(e) => set("address_line1", e.target.value || null)}
        />
        <TextField
          id="address_line2"
          label="Address line 2"
          value={current.address_line2 ?? ""}
          onChange={(e) => set("address_line2", e.target.value || null)}
        />
        <TextField
          id="city"
          label="City"
          value={current.city ?? ""}
          onChange={(e) => set("city", e.target.value || null)}
        />
        <TextField
          id="postal_code"
          label="PIN code"
          value={current.postal_code ?? ""}
          onChange={(e) => set("postal_code", e.target.value || null)}
        />
        <TextField
          id="state_name"
          label="State"
          value={current.state_name ?? ""}
          onChange={(e) => set("state_name", e.target.value || null)}
        />
        <TextField
          id="state_code"
          label="State code"
          hint="Two-digit GST state code"
          value={current.state_code ?? ""}
          onChange={(e) => set("state_code", e.target.value || null)}
        />
        <TextField
          id="place_of_supply"
          label="Place of supply"
          value={current.place_of_supply ?? ""}
          onChange={(e) => set("place_of_supply", e.target.value || null)}
        />
        <div className="sm:col-span-2">
          <CheckboxField
            id="is_business"
            label="This is a business purchase"
            checked={current.is_business}
            onCheckedChange={(checked) => set("is_business", checked)}
          />
        </div>
        {error ? (
          <div className="sm:col-span-2">
            <StatusAlert tone="error" title="Check your details">
              {error}
            </StatusAlert>
          </div>
        ) : null}
        <div className="sm:col-span-2">
          <PrimaryButton type="submit" loading={save.isPending} loadingText="Saving…">
            Save billing details
          </PrimaryButton>
        </div>
      </form>
    </SurfaceCard>
  );
}