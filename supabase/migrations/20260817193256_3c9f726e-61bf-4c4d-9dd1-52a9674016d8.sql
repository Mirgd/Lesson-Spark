ALTER TABLE public.lesson_plans
  ADD COLUMN IF NOT EXISTS content_language text NOT NULL DEFAULT 'ar';
ALTER TABLE public.lesson_plans
  ADD CONSTRAINT lesson_plans_content_language_check
  CHECK (content_language IN ('ar', 'en'));