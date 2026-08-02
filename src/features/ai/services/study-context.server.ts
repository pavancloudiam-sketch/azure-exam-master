import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

type UserClient = SupabaseClient<Database>;

export type DomainStat = { domain: string; correct: number; total: number };
export type TopicStat = { topic: string; domain: string; correct: number; total: number };
export type MistakeSummary = {
  questionId: string;
  stem: string;
  domain: string;
  topic: string;
  explanation: string | null;
  correctAnswers: string[];
  chosenAnswers: string[];
};

export type StudyContext = {
  submittedAttempts: number;
  answeredQuestions: number;
  averagePercentage: number | null;
  domains: DomainStat[];
  topics: TopicStat[];
  mistakes: MistakeSummary[];
  uncoveredTopics: { topic: string; domain: string }[];
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const MAX_ATTEMPTS = 20;
const MAX_MISTAKES = 6;

/**
 * Builds the study context for ONE student.
 *
 * The attempt list is read through the caller's own RLS-scoped client, so the
 * database decides which attempts belong to them; the privileged client is
 * then used only to join the answer key for those already-authorised rows.
 */
export async function buildStudyContext(
  supabase: UserClient,
  userId: string,
): Promise<StudyContext> {
  const { data: attempts } = await supabase
    .from("attempts")
    .select("id, percentage, submitted_at")
    .eq("user_id", userId)
    .eq("status", "submitted")
    .order("submitted_at", { ascending: false })
    .limit(MAX_ATTEMPTS);

  const attemptIds = (attempts ?? []).map((row) => row.id);
  const percentages = (attempts ?? [])
    .map((row) => row.percentage)
    .filter((value): value is number => typeof value === "number");

  const empty: StudyContext = {
    submittedAttempts: attemptIds.length,
    answeredQuestions: 0,
    averagePercentage:
      percentages.length > 0
        ? Math.round(percentages.reduce((sum, value) => sum + value, 0) / percentages.length)
        : null,
    domains: [],
    topics: [],
    mistakes: [],
    uncoveredTopics: [],
  };
  if (attemptIds.length === 0) return empty;

  const db = await admin();
  const { data: answers } = await db
    .from("attempt_answers")
    .select(
      "attempt_id, question_id, is_correct, selected_option_ids, answered_at, questions(id, stem, explanation, topics(name, domains(name)), question_options(id, label, content, is_correct))",
    )
    .in("attempt_id", attemptIds)
    .order("answered_at", { ascending: false })
    .limit(1000);

  const domainTotals = new Map<string, DomainStat>();
  const topicTotals = new Map<string, TopicStat>();
  const seenTopics = new Set<string>();
  const mistakes: MistakeSummary[] = [];

  for (const row of answers ?? []) {
    const question = row.questions as unknown as {
      id: string;
      stem: string;
      explanation: string | null;
      topics: { name: string; domains?: { name: string } | null } | null;
      question_options: { id: string; label: string | null; content: string; is_correct: boolean }[];
    } | null;
    if (!question) continue;

    const topic = question.topics?.name ?? "Unclassified";
    const domain = question.topics?.domains?.name ?? "Unclassified";
    seenTopics.add(topic);

    const domainStat = domainTotals.get(domain) ?? { domain, correct: 0, total: 0 };
    domainStat.total += 1;
    if (row.is_correct) domainStat.correct += 1;
    domainTotals.set(domain, domainStat);

    const topicKey = `${domain}::${topic}`;
    const topicStat = topicTotals.get(topicKey) ?? { topic, domain, correct: 0, total: 0 };
    topicStat.total += 1;
    if (row.is_correct) topicStat.correct += 1;
    topicTotals.set(topicKey, topicStat);

    if (row.is_correct === false && mistakes.length < MAX_MISTAKES) {
      const selected = new Set(row.selected_option_ids ?? []);
      const render = (option: { label: string | null; content: string }) =>
        `${option.label ? `${option.label}. ` : ""}${option.content}`;
      mistakes.push({
        questionId: question.id,
        stem: question.stem,
        domain,
        topic,
        explanation: question.explanation,
        correctAnswers: question.question_options.filter((o) => o.is_correct).map(render),
        chosenAnswers: question.question_options.filter((o) => selected.has(o.id)).map(render),
      });
    }
  }

  // Topics the student has never been asked about, for "what to study next".
  const { data: allTopics } = await db
    .from("topics")
    .select("name, domains(name, certifications(is_active))")
    .eq("is_active", true)
    .limit(200);

  const uncoveredTopics = (allTopics ?? [])
    .map((row) => ({
      topic: row.name,
      domain: (row.domains as unknown as { name: string } | null)?.name ?? "Unclassified",
    }))
    .filter((row) => !seenTopics.has(row.topic))
    .slice(0, 20);

  const answeredQuestions = [...domainTotals.values()].reduce((sum, d) => sum + d.total, 0);

  return {
    ...empty,
    answeredQuestions,
    domains: [...domainTotals.values()].sort(
      (a, b) => a.correct / Math.max(a.total, 1) - b.correct / Math.max(b.total, 1),
    ),
    topics: [...topicTotals.values()].sort(
      (a, b) => a.correct / Math.max(a.total, 1) - b.correct / Math.max(b.total, 1),
    ),
    mistakes,
    uncoveredTopics,
  };
}

const pct = (correct: number, total: number) =>
  total === 0 ? "n/a" : `${Math.round((correct / total) * 100)}%`;

/** Renders the context as prompt text. Contains no personal identifiers. */
export function renderStudyContext(context: StudyContext): string {
  if (context.submittedAttempts === 0) {
    return "The student has not submitted any practice exams yet. Give general Microsoft Entra ID study guidance and encourage them to take a practice exam so future advice can be personalised.";
  }

  const lines: string[] = [
    `Submitted practice attempts: ${context.submittedAttempts}`,
    `Answered questions across those attempts: ${context.answeredQuestions}`,
    context.averagePercentage !== null
      ? `Average score: ${context.averagePercentage}%`
      : "Average score: unavailable",
  ];

  if (context.domains.length > 0) {
    lines.push(
      "Per-domain accuracy (weakest first):",
      ...context.domains.map(
        (d) => `- ${d.domain}: ${d.correct}/${d.total} correct (${pct(d.correct, d.total)})`,
      ),
    );
  }

  if (context.topics.length > 0) {
    lines.push(
      "Per-topic accuracy (weakest first, top 10):",
      ...context.topics
        .slice(0, 10)
        .map(
          (t) =>
            `- ${t.topic} (${t.domain}): ${t.correct}/${t.total} correct (${pct(t.correct, t.total)})`,
        ),
    );
  }

  if (context.uncoveredTopics.length > 0) {
    lines.push(
      "Active topics the student has not practised yet: " +
        context.uncoveredTopics.map((t) => `${t.topic} (${t.domain})`).join("; "),
    );
  }

  if (context.mistakes.length > 0) {
    lines.push("---", "Recent incorrect answers (most recent first):");
    context.mistakes.forEach((mistake, index) => {
      lines.push(
        `${index + 1}. [${mistake.domain} / ${mistake.topic}] ${mistake.stem}`,
        `   Correct answer(s): ${mistake.correctAnswers.join(" | ") || "unknown"}`,
        `   Student chose: ${mistake.chosenAnswers.join(" | ") || "nothing"}`,
        mistake.explanation
          ? `   Stored explanation (platform-authored, quote verbatim if you reference it): ${mistake.explanation}`
          : "   No stored explanation.",
      );
    });
  }

  return lines.join("\n");
}