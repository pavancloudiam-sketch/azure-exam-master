import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BookOpenCheck,
  Clock,
  FileQuestion,
  Layers,
  Save,
  Target,
} from "lucide-react";

import { PageShell } from "@/features/shared/components/PageShell";
import {
  CheckboxField,
  ErrorState,
  LoadingBlock,
  PrimaryButton,
  SecondaryButton,
  SelectField,
  StatusAlert,
  StatusBadge,
  SurfaceCard,
  TextField,
  notify,
} from "@/features/shared/components/ui";
import { getExam } from "@/features/exams/services/exam-service";
import { getExamBlueprint } from "@/features/exams/services/blueprint-service";
import {
  ATTEMPT_MODE_DESCRIPTIONS,
  ATTEMPT_MODE_LABELS,
  ATTEMPT_MODE_RULES,
  SELECTABLE_ATTEMPT_MODES,
  allowsCustomQuestionCount,
  isSelectableMode,
  isTimedMode,
  questionTypeLabel,
  type AttemptMode,
} from "@/features/exams/types";
import { getActiveAttempt, startAttempt } from "@/features/attempts/services/attempt-service";
import { publicCertificationsQuery } from "@/features/certifications/services";

export const INDEPENDENCE_CONFIRMATION =
  "I understand that this is an independent AskMeExam practice examination and not an official Microsoft examination.";

export const Route = createFileRoute("/_authenticated/exams_/$examId/start")({
  validateSearch: (search: Record<string, unknown>) => ({
    mode: isSelectableMode(String(search['mode'] ?? "")) 
      ? (String(search['mode']) as AttemptMode)
      : ("realistic_mock" as AttemptMode),
  }),
  head: () => ({
    meta: [
      { title: "Before you begin — AskMeExam" },
      {
        name: "description",
        content: "Exam rules, length, timing and scoring for your AskMeExam practice session.",
      },
      { property: "og:title", content: "Before you begin — AskMeExam" },
      { property: "og:description", content: "Exam rules, length, timing and scoring." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ExamStartPage,
});

function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon className="size-4" aria-hidden={true} />
        <span>{label}</span>
      </div>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function ExamStartPage() {
  const { examId } = Route.useParams();
  const { mode: initialMode } = Route.useSearch();
  const navigate = useNavigate();

  const [mode, setMode] = React.useState<AttemptMode>(initialMode);
  const [confirmed, setConfirmed] = React.useState(false);
  const [domainId, setDomainId] = React.useState("");
  const [questionCount, setQuestionCount] = React.useState("");
  const [starting, setStarting] = React.useState(false);

  const examQuery = useQuery({
    queryKey: ["exam", examId],
    queryFn: () => getExam(examId),
    staleTime: 60_000,
  });
  const blueprintQuery = useQuery({
    queryKey: ["exam-blueprint", examId],
    queryFn: () => getExamBlueprint(examId),
    staleTime: 60_000,
  });
  const certificationsQuery = useQuery(publicCertificationsQuery());
  // A student may only have one running attempt per exam. If one exists we
  // offer to resume it rather than silently starting a second.
  const activeQuery = useQuery({
    queryKey: ["active-attempt", examId],
    queryFn: () => getActiveAttempt(examId),
    staleTime: 0,
  });

  const exam = examQuery.data ?? null;
  const blueprint = blueprintQuery.data ?? null;
  const certification =
    certificationsQuery.data?.find((row) => row.id === exam?.certification_id) ?? null;
  const activeAttempt = activeQuery.data ?? null;

  const timed = isTimedMode(mode);
  const rules = ATTEMPT_MODE_RULES[mode];

  const domainOptions = React.useMemo(() => {
    if (blueprint && blueprint.domains.length > 0) {
      return blueprint.domains.map((domain) => ({
        value: domain.domain_id,
        label: domain.name,
      }));
    }
    return (certification?.domains ?? []).map((domain) => ({
      value: domain.id,
      label: domain.name,
    }));
  }, [blueprint, certification]);

  const defaultCount = blueprint?.default_question_count ?? exam?.question_count ?? 0;
  const durationMinutes = blueprint?.duration_minutes ?? exam?.time_limit_minutes ?? null;
  const passingScaled = blueprint?.passing_scaled_score ?? exam?.passing_score ?? 700;
  const allowedTypes = blueprint?.allowed_question_types ?? [];

  const customCount = allowsCustomQuestionCount(mode);
  const effectiveCount = customCount && questionCount ? Number(questionCount) : defaultCount;

  async function begin() {
    if (!exam) return;
    if (!confirmed) {
      notify.error("Please confirm the statement before starting.");
      return;
    }
    if (mode === "domain_practice" && !domainId) {
      notify.error("Choose a skill area for skill-area practice.");
      return;
    }
    setStarting(true);
    try {
      // The attempt — and therefore the clock — is created here and nowhere
      // else. Nothing has been recorded until this call succeeds.
      const attempt = await startAttempt(exam.id, mode, {
        ...(customCount && questionCount ? { questionCount: Number(questionCount) } : {}),
        ...(mode === "domain_practice" ? { domainId } : {}),
      });
      void navigate({ to: "/attempt/$attemptId", params: { attemptId: attempt.id } });
    } catch (cause) {
      notify.error(cause instanceof Error ? cause.message : "Could not start the exam.");
      setStarting(false);
    }
  }

  if (examQuery.isLoading) return <LoadingBlock label="Loading exam details" />;
  if (examQuery.error) {
    return (
      <ErrorState
        title="Exam unavailable"
        description={
          examQuery.error instanceof Error ? examQuery.error.message : "Could not load this exam."
        }
      />
    );
  }
  if (!exam) {
    return (
      <ErrorState
        title="Exam not found"
        description="This exam is not published or no longer exists."
      />
    );
  }

  return (
    <PageShell
      title="Before you begin"
      description="Read the rules for this session. Nothing is recorded and no timer starts until you press Start exam."
    >
      <SurfaceCard>
        <h2 className="text-xl font-semibold">{exam.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {certification
            ? `${certification.provider} · ${certification.code} — ${certification.name} (version ${certification.version})`
            : "Independent practice examination"}
        </p>
        {exam.description ? (
          <p className="mt-3 text-sm text-foreground">{exam.description}</p>
        ) : null}
        {blueprint ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Blueprint: <span className="font-medium text-foreground">{blueprint.name}</span>
            {blueprint.description ? ` — ${blueprint.description}` : null}
          </p>
        ) : null}
      </SurfaceCard>

      {activeAttempt ? (
        <StatusAlert tone="warning" title="You already have this exam in progress">
          You can only run one attempt of an exam at a time. Resume the attempt you started, or
          cancel it from inside the exam screen before starting a new one.{" "}
          <Link
            to="/attempt/$attemptId"
            params={{ attemptId: activeAttempt.id }}
            className="font-medium underline"
          >
            Resume attempt
          </Link>
        </StatusAlert>
      ) : null}

      <section className="mt-8" aria-labelledby="mode-heading">
        <h2 id="mode-heading" className="text-lg font-semibold">
          1. Choose your mode
        </h2>
        <fieldset className="mt-3">
          <legend className="sr-only">Exam mode</legend>
          <ul className="grid gap-3 md:grid-cols-2">
            {SELECTABLE_ATTEMPT_MODES.map((option) => {
              const selected = option === mode;
              return (
                <li key={option}>
                  <label
                    className={
                      "flex min-h-11 cursor-pointer gap-3 rounded-lg border p-4 transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 " +
                      (selected ? "border-accent bg-accent/10" : "border-border bg-background")
                    }
                  >
                    <input
                      type="radio"
                      name="attempt-mode"
                      value={option}
                      checked={selected}
                      onChange={() => setMode(option)}
                      className="mt-1 size-4 accent-[var(--color-accent)]"
                    />
                    <span>
                      <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                        {ATTEMPT_MODE_LABELS[option]}
                        <StatusBadge tone={isTimedMode(option) ? "warning" : "neutral"}>
                          {isTimedMode(option) ? "Timed" : "Untimed"}
                        </StatusBadge>
                      </span>
                      <span className="mt-1 block text-sm text-muted-foreground">
                        {ATTEMPT_MODE_DESCRIPTIONS[option]}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>

        {(customCount || mode === "domain_practice") ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {mode === "domain_practice" ? (
              <SelectField
                id="practice-domain"
                label="Skill area"
                value={domainId}
                onValueChange={setDomainId}
                options={[{ value: "", label: "Choose a skill area" }, ...domainOptions]}
              />
            ) : null}
            {customCount ? (
              <TextField
                id="question-count"
                type="number"
                label="Number of questions"
                value={questionCount}
                min={blueprint?.min_question_count ?? 1}
                max={blueprint?.max_question_count ?? exam.question_count}
                onChange={(event) => setQuestionCount(event.target.value)}
                placeholder={String(defaultCount)}
                hint={`Leave blank for the default of ${defaultCount}.`}
              />
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="mt-8" aria-labelledby="facts-heading">
        <h2 id="facts-heading" className="text-lg font-semibold">
          2. What to expect
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Fact icon={FileQuestion} label="Questions" value={String(effectiveCount)} />
          <Fact
            icon={Clock}
            label="Duration"
            value={timed && durationMinutes ? `${durationMinutes} minutes` : "No time limit"}
          />
          <Fact icon={Target} label="Passing scaled score" value={`${passingScaled} of 1000`} />
          <Fact
            icon={BookOpenCheck}
            label="Mode"
            value={ATTEMPT_MODE_LABELS[mode]}
          />
        </div>

        <dl className="mt-4 grid gap-2 rounded-lg border border-border bg-surface p-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-medium">Timer</dt>
            <dd className="text-muted-foreground">{rules.timer}</dd>
          </div>
          <div>
            <dt className="font-medium">Explanations</dt>
            <dd className="text-muted-foreground">{rules.explanations}</dd>
          </div>
          <div>
            <dt className="font-medium">Repeated questions</dt>
            <dd className="text-muted-foreground">{rules.repeats}</dd>
          </div>
          <div>
            <dt className="font-medium">Skill areas</dt>
            <dd className="text-muted-foreground">{rules.domainFilter}</dd>
          </div>
        </dl>
      </section>

      {allowedTypes.length > 0 ? (
        <section className="mt-8" aria-labelledby="types-heading">
          <h2 id="types-heading" className="text-lg font-semibold">
            3. Question types you may see
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {allowedTypes.map((type) => (
              <li key={type}>
                <StatusBadge tone="info">{questionTypeLabel(type)}</StatusBadge>
              </li>
            ))}
          </ul>
          {blueprint && blueprint.case_study_count > 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              This sitting can include up to {blueprint.case_study_count} case{" "}
              {blueprint.case_study_count === 1 ? "study" : "studies"}. Case-study questions show
              the scenario beside the question and{" "}
              {blueprint.allow_case_study_return
                ? "you may return to earlier case-study questions at any time."
                : "you should complete each case study before moving on, because returning to it is discouraged in this blueprint."}
            </p>
          ) : null}
        </section>
      ) : null}

      {blueprint && blueprint.domains.length > 0 && mode === "realistic_mock" ? (
        <section className="mt-8" aria-labelledby="distribution-heading">
          <h2 id="distribution-heading" className="text-lg font-semibold">
            4. Skill-area distribution
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Each sitting is generated within these ranges, so no two attempts have exactly the same
            shape.
          </p>
          <div className="mt-3 overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <caption className="sr-only">Blueprint weighting per skill area</caption>
              <thead className="bg-surface">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left font-medium">
                    Skill area
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Share of the exam
                  </th>
                </tr>
              </thead>
              <tbody>
                {blueprint.domains.map((domain) => (
                  <tr key={domain.domain_id} className="border-t border-border">
                    <th scope="row" className="px-4 py-3 text-left font-normal">
                      {domain.name}
                    </th>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {domain.min_percent}–{domain.max_percent}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="mt-8" aria-labelledby="rules-heading">
        <h2 id="rules-heading" className="text-lg font-semibold">
          5. How the exam screen works
        </h2>
        <ul className="mt-3 space-y-3 text-sm">
          <li className="flex gap-3">
            <Save className="mt-0.5 size-4 shrink-0 text-accent-ink" aria-hidden="true" />
            <span>
              <strong className="font-semibold">Autosave.</strong> Every answer is saved as you make
              it. If you lose connection, answers are held on your device and sent automatically
              when you are back online, so a refresh or a dropped signal never loses your work.
            </span>
          </li>
          <li className="flex gap-3">
            <Layers className="mt-0.5 size-4 shrink-0 text-accent-ink" aria-hidden="true" />
            <span>
              <strong className="font-semibold">Mark for review.</strong> Flag any question you want
              to revisit. Marked questions are highlighted in the question palette and listed in the
              submission summary, and marking never changes your answer or your score.
            </span>
          </li>
          <li className="flex gap-3">
            <BookOpenCheck className="mt-0.5 size-4 shrink-0 text-accent-ink" aria-hidden="true" />
            <span>
              <strong className="font-semibold">Case studies.</strong> When a question belongs to a
              case study, the scenario stays on screen beside the question. On a small screen it
              collapses into a panel you can open and close. Moving between the questions of a case
              study keeps the same scenario open.
            </span>
          </li>
          <li className="flex gap-3">
            <Target className="mt-0.5 size-4 shrink-0 text-accent-ink" aria-hidden="true" />
            <span>
              <strong className="font-semibold">Submitting.</strong> You can submit at any time. You
              will see how many questions are answered, unanswered and marked before you confirm.
              {timed
                ? " If the timer reaches zero, the attempt is submitted for you automatically."
                : " There is no timer, so nothing is submitted for you."}{" "}
              Once submitted, answers are locked and results and explanations become available.
            </span>
          </li>
        </ul>
      </section>

      <section className="mt-8" aria-labelledby="scoring-heading">
        <h2 id="scoring-heading" className="text-lg font-semibold">
          6. How this is scored
        </h2>
        <StatusAlert tone="info" title="AskMeExam practice scoring">
          Your result is reported as a scaled score from 1 to 1000 using AskMeExam's own practice
          scoring model{blueprint ? ` (version ${blueprint.scoring_model_version})` : ""}. It does
          not reproduce Microsoft's official scaled-score calculation, and{" "}
          {passingScaled} is a scaled figure — it is not the same thing as{" "}
          {Math.round(passingScaled / 10)}% of the questions.{" "}
          {blueprint?.allow_partial_credit
            ? "Questions with several correct answers can earn partial credit."
            : "Questions with several correct answers must be fully correct to earn their points."}{" "}
          Some questions may be unscored trial items; they never count for or against you.
        </StatusAlert>
      </section>

      <section className="mt-8" aria-labelledby="independence-heading">
        <h2 id="independence-heading" className="text-lg font-semibold">
          7. Confirm and start
        </h2>
        <div className="mt-3 rounded-lg border border-border bg-surface p-4">
          <p className="flex gap-3 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-ink" aria-hidden="true" />
            <span>
              AskMeExam is an independent study platform. It is not affiliated with, endorsed by or
              sponsored by Microsoft. Our questions are written in-house, our scoring is our own,
              and a result here does not predict or guarantee an official examination outcome.
            </span>
          </p>
        </div>

        <div className="mt-4">
          <CheckboxField
            id="independence-confirmation"
            label={INDEPENDENCE_CONFIRMATION}
            checked={confirmed}
            onCheckedChange={(value) => setConfirmed(value === true)}
          />
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <PrimaryButton
            onClick={() => void begin()}
            loading={starting}
            disabled={!confirmed || Boolean(activeAttempt)}
            className="min-h-11"
          >
            Start exam
          </PrimaryButton>
          <SecondaryButton asChild className="min-h-11">
            <Link to="/exams">Cancel</Link>
          </SecondaryButton>
        </div>
        {!confirmed ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Tick the confirmation above to enable Start exam. The timer only begins once you press
            it.
          </p>
        ) : null}
      </section>
    </PageShell>
  );
}
