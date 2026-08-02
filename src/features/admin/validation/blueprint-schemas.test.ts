import { describe, expect, it } from "vitest";

import { blueprintSchema } from "./blueprint-schemas";

const base = {
  name: "SC-300 realistic mock",
  certification_id: "11111111-1111-4111-8111-111111111111",
  description: "",
  mode: "realistic_mock",
  duration_minutes: 100,
  min_question_count: 40,
  max_question_count: 60,
  default_question_count: 50,
  passing_scaled_score: 700,
  scoring_model_version: "v1",
  allowed_question_types: ["single_choice"],
  pilot_question_count: 5,
  case_study_count: 1,
  allow_partial_credit: true,
  randomize_questions: true,
  randomize_options: true,
  allow_repeats: false,
  repetition_cooldown_days: 14,
  max_repeat_count: 2,
  allow_case_study_return: true,
  domains: [
    { domain_id: "22222222-2222-4222-8222-222222222222", min_percent: 20, max_percent: 60 },
    { domain_id: "33333333-3333-4333-8333-333333333333", min_percent: 20, max_percent: 60 },
  ],
};

describe("blueprintSchema", () => {
  it("accepts a valid blueprint", () => {
    expect(blueprintSchema.safeParse(base).success).toBe(true);
  });

  it("rejects a maximum below the minimum question count", () => {
    const result = blueprintSchema.safeParse({ ...base, max_question_count: 10 });
    expect(result.success).toBe(false);
  });

  it("rejects a skill area whose maximum is below its minimum", () => {
    const result = blueprintSchema.safeParse({
      ...base,
      domains: [
        { domain_id: "22222222-2222-4222-8222-222222222222", min_percent: 80, max_percent: 20 },
        { domain_id: "33333333-3333-4333-8333-333333333333", min_percent: 20, max_percent: 90 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects minimum percentages adding up to more than 100", () => {
    const result = blueprintSchema.safeParse({
      ...base,
      domains: [
        { domain_id: "22222222-2222-4222-8222-222222222222", min_percent: 70, max_percent: 90 },
        { domain_id: "33333333-3333-4333-8333-333333333333", min_percent: 60, max_percent: 90 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects maximum percentages that cannot reach 100", () => {
    const result = blueprintSchema.safeParse({
      ...base,
      domains: [
        { domain_id: "22222222-2222-4222-8222-222222222222", min_percent: 10, max_percent: 30 },
        { domain_id: "33333333-3333-4333-8333-333333333333", min_percent: 10, max_percent: 30 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a duplicated skill area", () => {
    const result = blueprintSchema.safeParse({
      ...base,
      domains: [
        { domain_id: "22222222-2222-4222-8222-222222222222", min_percent: 20, max_percent: 60 },
        { domain_id: "22222222-2222-4222-8222-222222222222", min_percent: 20, max_percent: 60 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("requires at least one allowed question type", () => {
    const result = blueprintSchema.safeParse({ ...base, allowed_question_types: [] });
    expect(result.success).toBe(false);
  });

  it("rejects more pilot items than the default question count", () => {
    const result = blueprintSchema.safeParse({ ...base, pilot_question_count: 50 });
    expect(result.success).toBe(false);
  });
});
