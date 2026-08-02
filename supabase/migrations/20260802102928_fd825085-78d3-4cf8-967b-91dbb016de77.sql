DELETE FROM public.ai_feature_flags WHERE key = 'ai_performance_coach';
UPDATE public.ai_feature_flags
SET description = 'Concept explanations, revision notes, progress analysis and study plans.'
WHERE key = 'ai_study_assistant';