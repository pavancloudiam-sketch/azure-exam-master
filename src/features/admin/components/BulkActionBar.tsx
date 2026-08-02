import * as React from "react";

import {
  ConfirmDialog,
  PrimaryButton,
  SecondaryButton,
  SelectField,
  TextField,
  type SelectOption,
} from "@/features/shared/components/ui";
import {
  BULK_ACTION_LABELS,
  type BulkAction,
} from "@/features/admin/services/question-service";
import { DIFFICULTY_LABELS, type Difficulty } from "@/features/admin/types/questions";

type Kind = BulkAction["kind"];

const ACTION_OPTIONS: SelectOption[] = (Object.keys(BULK_ACTION_LABELS) as Kind[]).map((value) => ({
  value,
  label: BULK_ACTION_LABELS[value],
}));

const DESTRUCTIVE_NOTE: Partial<Record<Kind, string>> = {
  deactivate: "Deactivated questions stop being delivered in new exams. Attempt history is unchanged.",
  archive: "Archiving hides the question from the working bank and deactivates it. Nothing is deleted.",
  technical_review: "The questions move to technical review and are flagged for a reviewer.",
  language_review: "The questions move to language review and are flagged for a reviewer.",
};

/**
 * Selection toolbar for the question bank. Every action is confirmed in a
 * dialog that restates the action and the number of affected questions before
 * anything is written.
 */
export function BulkActionBar({
  selectedCount,
  domainOptions,
  topicOptionsFor,
  topicOptions,
  onClearSelection,
  onApply,
}: {
  selectedCount: number;
  domainOptions: SelectOption[];
  topicOptionsFor: (domainId: string) => SelectOption[];
  topicOptions: SelectOption[];
  onClearSelection: () => void;
  onApply: (action: BulkAction) => Promise<void>;
}) {
  const [kind, setKind] = React.useState<Kind>("activate");
  const [domainId, setDomainId] = React.useState("");
  const [topicId, setTopicId] = React.useState("");
  const [tags, setTags] = React.useState("");
  const [difficulty, setDifficulty] = React.useState<Difficulty>("medium");
  const [confirming, setConfirming] = React.useState(false);

  const parsedTags = tags
    .split(/[|,;]/)
    .map((tag) => tag.trim())
    .filter(Boolean);

  const build = (): BulkAction | null => {
    switch (kind) {
      case "assign_domain":
        return topicId ? { kind, topicId } : null;
      case "assign_topic":
        return topicId ? { kind, topicId } : null;
      case "add_tags":
        return parsedTags.length > 0 ? { kind, tags: parsedTags } : null;
      case "set_difficulty":
        return { kind, difficulty };
      default:
        return { kind } as BulkAction;
    }
  };

  const action = build();
  const disabled = selectedCount === 0 || action === null;

  return (
    <div
      className="rounded-lg border border-border bg-surface p-4"
      role="group"
      aria-label="Bulk actions"
    >
      <div className="flex flex-wrap items-end gap-4">
        <p className="text-sm font-medium" aria-live="polite">
          {selectedCount} selected
        </p>

        <div className="min-w-56">
          <SelectField
            id="bulk-action"
            label="Bulk action"
            options={ACTION_OPTIONS}
            value={kind}
            onValueChange={(next) => {
              setKind(next as Kind);
              setTopicId("");
            }}
          />
        </div>

        {kind === "assign_domain" ? (
          <>
            <div className="min-w-52">
              <SelectField
                id="bulk-domain"
                label="Domain"
                options={domainOptions}
                value={domainId}
                onValueChange={(next) => {
                  setDomainId(next);
                  setTopicId("");
                }}
              />
            </div>
            <div className="min-w-52">
              <SelectField
                id="bulk-domain-topic"
                label="Topic in domain"
                options={domainId ? topicOptionsFor(domainId) : []}
                value={topicId}
                onValueChange={setTopicId}
                hint="Questions are classified through a topic, so pick the topic inside the domain."
              />
            </div>
          </>
        ) : null}

        {kind === "assign_topic" ? (
          <div className="min-w-64">
            <SelectField
              id="bulk-topic"
              label="Topic"
              options={topicOptions}
              value={topicId}
              onValueChange={setTopicId}
            />
          </div>
        ) : null}

        {kind === "add_tags" ? (
          <div className="min-w-64">
            <TextField
              id="bulk-tags"
              label="Tags"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              hint="Separate with a pipe, comma or semicolon."
            />
          </div>
        ) : null}

        {kind === "set_difficulty" ? (
          <div className="min-w-44">
            <SelectField
              id="bulk-difficulty"
              label="Difficulty"
              options={(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((value) => ({
                value,
                label: DIFFICULTY_LABELS[value],
              }))}
              value={difficulty}
              onValueChange={(next) => setDifficulty(next as Difficulty)}
            />
          </div>
        ) : null}

        <div className="flex gap-2">
          <PrimaryButton disabled={disabled} onClick={() => setConfirming(true)}>
            Apply to selection
          </PrimaryButton>
          <SecondaryButton onClick={onClearSelection} disabled={selectedCount === 0}>
            Clear selection
          </SecondaryButton>
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`${BULK_ACTION_LABELS[kind]} ${selectedCount} question${selectedCount === 1 ? "" : "s"}?`}
        description={
          DESTRUCTIVE_NOTE[kind] ??
          "This change is applied to every selected question and recorded in the audit log."
        }
        confirmLabel={BULK_ACTION_LABELS[kind]}
        onConfirm={async () => {
          if (action) await onApply(action);
          setConfirming(false);
        }}
      />
    </div>
  );
}
