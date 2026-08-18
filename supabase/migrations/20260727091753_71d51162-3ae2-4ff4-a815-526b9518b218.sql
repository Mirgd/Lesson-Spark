-- 1) نطاق الإشراف مقيّد بالمدرسة
CREATE OR REPLACE FUNCTION private.supervises(_supervisor uuid, _teacher uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.supervisor_scope ss
    JOIN public.profiles s ON s.id = ss.supervisor_id
    JOIN public.profiles t ON t.id = ss.teacher_id
    WHERE ss.supervisor_id = _supervisor
      AND ss.teacher_id = _teacher
      AND s.school_id IS NOT NULL
      AND s.school_id = t.school_id
  )
$$;

REVOKE ALL ON FUNCTION private.supervises(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- 2) من يملك حق تقييم خطط معلمة معيّنة
CREATE OR REPLACE FUNCTION private.can_review(_reviewer uuid, _teacher uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT private.has_role(_reviewer, 'admin'::app_role)
      OR private.is_school_admin_of(_reviewer, _teacher)
      OR private.supervises(_reviewer, _teacher)
$$;

REVOKE ALL ON FUNCTION private.can_review(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- 3) جدول التقييمات
CREATE TABLE public.plan_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.lesson_plans(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL,
  reviewer_id uuid NOT NULL,
  rating smallint NOT NULL,
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, reviewer_id)
);

CREATE INDEX plan_reviews_plan_idx ON public.plan_reviews (plan_id);
CREATE INDEX plan_reviews_teacher_idx ON public.plan_reviews (teacher_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_reviews TO authenticated;
GRANT ALL ON public.plan_reviews TO service_role;

ALTER TABLE public.plan_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teacher reads own plan reviews"
ON public.plan_reviews FOR SELECT TO authenticated
USING (teacher_id = auth.uid());

CREATE POLICY "reviewer reads scoped reviews"
ON public.plan_reviews FOR SELECT TO authenticated
USING (private.can_review(auth.uid(), teacher_id));

CREATE POLICY "reviewer creates scoped reviews"
ON public.plan_reviews FOR INSERT TO authenticated
WITH CHECK (
  reviewer_id = auth.uid()
  AND private.can_review(auth.uid(), teacher_id)
  AND EXISTS (SELECT 1 FROM public.lesson_plans p WHERE p.id = plan_id AND p.user_id = teacher_id)
);

CREATE POLICY "reviewer updates own review"
ON public.plan_reviews FOR UPDATE TO authenticated
USING (reviewer_id = auth.uid() AND private.can_review(auth.uid(), teacher_id))
WITH CHECK (reviewer_id = auth.uid() AND private.can_review(auth.uid(), teacher_id));

CREATE POLICY "reviewer deletes own review"
ON public.plan_reviews FOR DELETE TO authenticated
USING (reviewer_id = auth.uid() AND private.can_review(auth.uid(), teacher_id));

CREATE TRIGGER plan_reviews_updated_at
BEFORE UPDATE ON public.plan_reviews
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) تشديد: إنشاء/تعديل الخطط للمعلمة صاحبة الخطة فقط ضمن حساب نشط
DROP POLICY IF EXISTS "teacher manages own plans" ON public.lesson_plans;
CREATE POLICY "teacher manages own plans"
ON public.lesson_plans FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active)
);