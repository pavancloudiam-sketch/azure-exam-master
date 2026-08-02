import {
  DIFFICULTY_VALUES,
  IMPORT_STATUS_VALUES,
  OPTION_LETTERS,
  QUESTION_TYPE_VALUES,
  type ImportRowStatus,
  type NormalizedRow,
  type OptionLetter,
  type RowIssue,
} from "../types";
import type { Difficulty, QuestionType } from "@/features/admin/types/questions";

const MAX_TEXT = 4000;

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

/** Letters/labels may be separated by a pipe, comma or semicolon. */
export function splitList(value: string): string[] {
  return value
    .split(/[|,;]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Turns one raw spreadsheet row into a normalized question, or a list of
 * human-readable problems. Nothing here touches the database — staging keeps
 * both the original row and this result so an admin can review before any
 * commit happens.
 */
export function normalizeRow(raw: Record<string, string>): {
  normalized: NormalizedRow | null;
  issues: RowIssue[];
} {
  const issues: RowIssue[] = [];
  const get = (key: string) => clean(raw[key]);

  const externalId = get("external_id");
  if (!externalId) issues.push({ column: "external_id", message: "external_id is required." });
  else if (externalId.length > 64)
    issues.push({ column: "external_id", message: "external_id must be 64 characters or fewer." });

  for (const key of ["certification", "domain", "topic"] as const) {
    if (!get(key)) issues.push({ column: key, message: `${key} is required.` });
  }

  const typeValue = get("question_type").toLowerCase();
  const questionType = QUESTION_TYPE_VALUES.includes(typeValue as QuestionType)
    ? (typeValue as QuestionType)
    : null;
  if (!questionType) {
    issues.push({
      column: "question_type",
      message: `question_type must be one of: ${QUESTION_TYPE_VALUES.join(", ")}.`,
    });
  }

  const isScenario = questionType?.startsWith("scenario_") ?? false;
  const scenario = get("scenario_text");
  if (isScenario && !scenario)
    issues.push({ column: "scenario_text", message: "scenario_text is required for scenario question types." });
  if (!isScenario && scenario && questionType)
    issues.push({
      column: "scenario_text",
      message: "scenario_text must be empty unless question_type is a scenario_* type.",
    });

  const questionText = get("question_text");
  if (!questionText) issues.push({ column: "question_text", message: "question_text is required." });
  else if (questionText.length > MAX_TEXT)
    issues.push({ column: "question_text", message: `question_text must be ${MAX_TEXT} characters or fewer.` });

  // Variable option counts: 2 to 5, and no gaps between them.
  const optionValues = OPTION_LETTERS.map((letter) => ({ letter, content: get(`option_${letter}`) }));
  const filled = optionValues.filter((option) => option.content !== "");
  const firstBlank = optionValues.findIndex((option) => option.content === "");
  if (firstBlank !== -1 && optionValues.slice(firstBlank).some((option) => option.content !== "")) {
    issues.push({
      column: "row",
      message: "Option columns must be filled in order — no gaps between option_a and the last option used.",
    });
  }
  if (filled.length < 2)
    issues.push({ column: "option_b", message: "At least two options (option_a and option_b) are required." });

  const filledLetters = new Set(filled.map((option) => option.letter));
  const correctRaw = get("correct_options");
  const correct: OptionLetter[] = [];
  if (!correctRaw) {
    issues.push({ column: "correct_options", message: "correct_options is required." });
  } else {
    for (const token of splitList(correctRaw)) {
      const letter = token.toLowerCase() as OptionLetter;
      if (!OPTION_LETTERS.includes(letter)) {
        issues.push({
          column: "correct_options",
          message: `"${token}" is not a valid option letter (A–E).`,
        });
      } else if (!filledLetters.has(letter)) {
        issues.push({
          column: "correct_options",
          message: `Option ${letter.toUpperCase()} is marked correct but option_${letter} is empty.`,
        });
      } else if (correct.includes(letter)) {
        issues.push({
          column: "correct_options",
          message: `Option ${letter.toUpperCase()} is listed twice.`,
        });
      } else {
        correct.push(letter);
      }
    }
  }

  if (questionType && correct.length > 0) {
    const wantsMany = questionType.endsWith("multiple_choice");
    if (!wantsMany && correct.length !== 1)
      issues.push({
        column: "correct_options",
        message: `${questionType} must have exactly one correct option.`,
      });
    if (wantsMany && correct.length < 2)
      issues.push({
        column: "correct_options",
        message: `${questionType} must have at least two correct options.`,
      });
    if (wantsMany && correct.length === filled.length)
      issues.push({
        column: "correct_options",
        message: "Every option cannot be correct — at least one distractor is required.",
      });
  }

  const difficultyValue = get("difficulty").toLowerCase();
  const difficulty = DIFFICULTY_VALUES.includes(difficultyValue as Difficulty)
    ? (difficultyValue as Difficulty)
    : null;
  if (!difficulty)
    issues.push({
      column: "difficulty",
      message: `difficulty must be one of: ${DIFFICULTY_VALUES.join(", ")}.`,
    });

  const statusValue = get("status").toLowerCase();
  const status = IMPORT_STATUS_VALUES.includes(statusValue as ImportRowStatus)
    ? (statusValue as ImportRowStatus)
    : null;
  if (!status)
    issues.push({
      column: "status",
      message: `status must be one of: ${IMPORT_STATUS_VALUES.join(", ")}.`,
    });

  const pointRaw = get("point_value");
  let points = 1;
  if (pointRaw) {
    const parsed = Number(pointRaw);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10)
      issues.push({ column: "point_value", message: "point_value must be a whole number between 1 and 10." });
    else points = parsed;
  }

  const explanation = get("explanation");
  if (explanation.length > MAX_TEXT)
    issues.push({ column: "explanation", message: `explanation must be ${MAX_TEXT} characters or fewer.` });

  if (issues.length > 0 || !questionType || !difficulty || !status) {
    return { normalized: null, issues };
  }

  return {
    issues,
    normalized: {
      external_id: externalId,
      certification: get("certification"),
      domain: get("domain"),
      topic: get("topic"),
      question_type: questionType,
      scenario_text: scenario || null,
      question_text: questionText,
      options: filled.map((option) => ({
        letter: option.letter,
        content: option.content,
        is_correct: correct.includes(option.letter),
      })),
      correct_options: correct,
      explanation: explanation || null,
      difficulty,
      point_value: points,
      tags: splitList(get("tags")),
      status,
    },
  };
}