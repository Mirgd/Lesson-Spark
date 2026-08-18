-- المعلمات: تسجيل بالاسم فقط دون كلمة مرور
CREATE TABLE public.teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  school text,
  branch text,
  stage text,
  subject text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teachers TO anon, authenticated;
GRANT ALL ON public.teachers TO service_role;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open teachers access" ON public.teachers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER teachers_updated_at BEFORE UPDATE ON public.teachers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- الخطط بدون حساب: مرتبطة باسم المعلمة
CREATE TABLE public.open_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_name text NOT NULL,
  local_id text,
  subject text,
  grade text,
  topic text,
  unit text,
  date date,
  objectives text,
  outcomes jsonb,
  phases jsonb,
  homework jsonb,
  question_bank jsonb,
  worksheet jsonb,
  presentation_slides jsonb,
  curriculum_ref text,
  completion_pct integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teacher_name, local_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.open_plans TO anon, authenticated;
GRANT ALL ON public.open_plans TO service_role;
ALTER TABLE public.open_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open plans access" ON public.open_plans FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER open_plans_updated_at BEFORE UPDATE ON public.open_plans FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- تقييم الخطط بالاسم
CREATE TABLE public.open_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.open_plans(id) ON DELETE CASCADE,
  teacher_name text NOT NULL DEFAULT '',
  reviewer_name text NOT NULL DEFAULT '',
  rating smallint NOT NULL DEFAULT 5,
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, reviewer_name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.open_reviews TO anon, authenticated;
GRANT ALL ON public.open_reviews TO service_role;
ALTER TABLE public.open_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open reviews access" ON public.open_reviews FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER open_reviews_updated_at BEFORE UPDATE ON public.open_reviews FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();