import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckboxField,
  ConfirmDialog,
  DataTable,
  DestructiveButton,
  EmptyState,
  ErrorState,
  LoadingBlock,
  Modal,
  PageHeader,
  PaginationControls,
  PasswordField,
  PrimaryButton,
  RadioField,
  SecondaryButton,
  SelectField,
  SkeletonList,
  Spinner,
  StatusAlert,
  StatusBadge,
  SurfaceCard,
  TextField,
  NavSidebar,
  notify,
} from "@/features/shared/components/ui";

export const Route = createFileRoute("/_authenticated/_admin/internal/design-system")({
  head: () => ({
    meta: [
      { title: "Design System — AskMeExam (internal)" },
      { name: "description", content: "Internal component preview for the AskMeExam UI kit." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Design System — AskMeExam (internal)" },
      { property: "og:description", content: "Internal component preview." },
    ],
  }),
  component: DesignSystemPreview,
});

type Row = { id: string; exam: string; mode: string; status: "Active" | "Draft" };

const rows: Row[] = [
  { id: "1", exam: "Entra ID Practice Exam A", mode: "Timed", status: "Active" },
  { id: "2", exam: "Entra ID Practice Exam B", mode: "Untimed", status: "Draft" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg">{title}</h2>
      <div className="space-y-4 rounded-lg border border-border bg-card p-6 shadow-card">
        {children}
      </div>
    </section>
  );
}

function DesignSystemPreview() {
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [page, setPage] = useState(1);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-10 px-6 py-12">
      <PageHeader
        eyebrow="Internal"
        title="Design system preview"
        description="Reusable AskMeExam components. This page is internal and not linked from public navigation."
        actions={<SecondaryButton onClick={() => notify.info("Preview only")}>Ping</SecondaryButton>}
      />

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <PrimaryButton>Primary</PrimaryButton>
          <SecondaryButton>Secondary</SecondaryButton>
          <DestructiveButton>Deactivate</DestructiveButton>
          <PrimaryButton loading loadingText="Saving">
            Save
          </PrimaryButton>
          <PrimaryButton disabled>Disabled</PrimaryButton>
        </div>
      </Section>

      <Section title="Form controls">
        <div className="grid gap-6 md:grid-cols-2">
          <TextField id="ds-email" label="Email" type="email" placeholder="you@example.com" required />
          <TextField
            id="ds-title"
            label="Exam title"
            error="Exam title is required."
            defaultValue=""
          />
          <PasswordField id="ds-password" label="Password" hint="Minimum 8 characters." required />
          <SelectField
            id="ds-difficulty"
            label="Difficulty"
            required
            options={[
              { value: "easy", label: "Easy" },
              { value: "medium", label: "Medium" },
              { value: "hard", label: "Hard" },
            ]}
          />
          <CheckboxField id="ds-timed" label="Enable timed mock availability" />
          <RadioField
            name="ds-mode"
            legend="Exam mode"
            defaultValue="timed"
            options={[
              { value: "timed", label: "Timed mock" },
              { value: "practice", label: "Untimed practice" },
            ]}
          />
        </div>
      </Section>

      <Section title="Cards, badges and alerts">
        <div className="grid gap-4 md:grid-cols-2">
          <SurfaceCard
            title="Microsoft Entra ID practice"
            description="Demonstration exam"
            actions={<StatusBadge tone="success">Active</StatusBadge>}
          >
            <p className="text-sm text-muted-foreground">60 questions · 100 minutes · 700/1000</p>
          </SurfaceCard>
          <div className="flex flex-wrap items-start gap-2">
            <StatusBadge>Neutral</StatusBadge>
            <StatusBadge tone="info">In progress</StatusBadge>
            <StatusBadge tone="success">Passed</StatusBadge>
            <StatusBadge tone="warning">Expired</StatusBadge>
            <StatusBadge tone="error">Failed</StatusBadge>
          </div>
        </div>
        <div className="grid gap-3">
          <StatusAlert tone="info" title="Practice mode">
            Explanations stay hidden until you submit.
          </StatusAlert>
          <StatusAlert tone="success" title="Answer saved" />
          <StatusAlert tone="warning" title="10 minutes remaining" />
          <StatusAlert tone="error" title="Save failed">
            We could not save your last answer. Retrying…
          </StatusAlert>
        </div>
      </Section>

      <Section title="Dialogs and toasts">
        <div className="flex flex-wrap gap-3">
          <SecondaryButton onClick={() => setModalOpen(true)}>Open modal</SecondaryButton>
          <DestructiveButton onClick={() => setConfirmOpen(true)}>
            Open confirmation
          </DestructiveButton>
          <SecondaryButton onClick={() => notify.success("Saved", "Your changes were stored.")}>
            Success toast
          </SecondaryButton>
          <SecondaryButton onClick={() => notify.error("Failed", "Please try again.")}>
            Error toast
          </SecondaryButton>
        </div>
        <Modal
          open={modalOpen}
          onOpenChange={setModalOpen}
          title="Exam instructions"
          description="Read before starting the attempt."
          footer={<PrimaryButton onClick={() => setModalOpen(false)}>Understood</PrimaryButton>}
        >
          <p className="text-sm text-muted-foreground">
            Answers autosave. The timer is server-authoritative.
          </p>
        </Modal>
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          tone="destructive"
          title="Deactivate this question?"
          description="It stays available in historical attempt reviews but will not be used in new exams."
          confirmLabel="Deactivate"
          onConfirm={() => notify.warning("Question deactivated")}
        />
      </Section>

      <Section title="Table, pagination and tabs">
        <DataTable
          caption="Example exams"
          rows={rows}
          getRowId={(row) => row.id}
          columns={[
            { key: "exam", header: "Exam", render: (row) => row.exam },
            { key: "mode", header: "Mode", render: (row) => row.mode },
            {
              key: "status",
              header: "Status",
              render: (row) => (
                <StatusBadge tone={row.status === "Active" ? "success" : "neutral"}>
                  {row.status}
                </StatusBadge>
              ),
            },
          ]}
        />
        <PaginationControls page={page} pageCount={3} totalItems={24} onPageChange={setPage} />
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="questions">Questions</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="pt-4 text-sm text-muted-foreground">
            Overview panel content.
          </TabsContent>
          <TabsContent value="questions" className="pt-4 text-sm text-muted-foreground">
            Questions panel content.
          </TabsContent>
        </Tabs>
      </Section>

      <Section title="Loading, empty and error states">
        <div className="flex items-center gap-4">
          <Spinner />
          <span className="text-sm text-muted-foreground">Inline spinner</span>
        </div>
        <LoadingBlock label="Loading exams" />
        <SkeletonList rows={2} />
        <EmptyState
          title="No attempts yet"
          description="Start a practice exam to see your results here."
          action={{ label: "Browse exams", onClick: () => notify.info("Navigate to exams") }}
        />
        <ErrorState onRetry={() => notify.info("Retrying")} />
      </Section>

      <Section title="Sidebar navigation">
        <NavSidebar />
      </Section>
    </main>
  );
}