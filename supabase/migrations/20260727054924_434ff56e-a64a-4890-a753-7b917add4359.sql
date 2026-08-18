-- 1) schools
CREATE TABLE public.schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  city text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.schools TO authenticated;
GRANT ALL ON public.schools TO service_role;

ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

-- 2) new role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'school_admin';

-- 3) link profiles to schools
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS profiles_school_id_idx ON public.profiles(school_id);

INSERT INTO public.schools (name)
SELECT DISTINCT btrim(school) FROM public.profiles
WHERE school IS NOT NULL AND btrim(school) <> ''
ON CONFLICT (name) DO NOTHING;

UPDATE public.profiles p SET school_id = s.id
FROM public.schools s
WHERE p.school_id IS NULL AND btrim(p.school) = s.name;

CREATE TRIGGER schools_set_updated_at
BEFORE UPDATE ON public.schools
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
