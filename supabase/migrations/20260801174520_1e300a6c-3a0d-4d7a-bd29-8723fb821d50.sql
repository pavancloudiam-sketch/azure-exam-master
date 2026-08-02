-- Redundant: identical to attempt_answers_attempt_id_question_id_key.
-- Every answer autosave upsert had to maintain both. Dropping halves that write cost.
DROP INDEX IF EXISTS public.attempt_answers_attempt_question_key;

-- Dashboard attempt history: attempts WHERE user_id = auth.uid() ORDER BY started_at DESC.
CREATE INDEX IF NOT EXISTS attempts_user_started_idx
  ON public.attempts (user_id, started_at DESC);

-- start_attempt(): live-attempt reuse lookup (user_id, exam_id, status='in_progress').
CREATE INDEX IF NOT EXISTS attempts_user_active_idx
  ON public.attempts (user_id, exam_id)
  WHERE status = 'in_progress';

-- get_question_stats(): attempts joined by exam_id for submitted attempts only.
CREATE INDEX IF NOT EXISTS attempts_exam_submitted_idx
  ON public.attempts (exam_id)
  WHERE status = 'submitted';

-- Every exam question render, scoring pass and duplicate fingerprint reads
-- question_options by question_id in sort order. No index existed (FK unindexed).
CREATE INDEX IF NOT EXISTS question_options_question_idx
  ON public.question_options (question_id, sort_order);

-- Unindexed foreign keys used by admin taxonomy lists and cascading filters.
CREATE INDEX IF NOT EXISTS domains_certification_idx
  ON public.domains (certification_id, sort_order);
CREATE INDEX IF NOT EXISTS topics_domain_idx
  ON public.topics (domain_id, sort_order);
CREATE INDEX IF NOT EXISTS exams_certification_idx
  ON public.exams (certification_id);

-- Legacy direct question -> exam link, still filtered on in admin views.
CREATE INDEX IF NOT EXISTS questions_exam_idx
  ON public.questions (exam_id)
  WHERE exam_id IS NOT NULL;

-- Admin question bank default browse: non-archived questions, newest first,
-- optionally narrowed by certification.
CREATE INDEX IF NOT EXISTS questions_browse_idx
  ON public.questions (certification_id, is_archived, created_at DESC);

ANALYZE public.attempts;
ANALYZE public.attempt_answers;
ANALYZE public.questions;
ANALYZE public.question_options;
