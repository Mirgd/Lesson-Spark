CREATE OR REPLACE FUNCTION private.is_supervisor(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'supervisor'::app_role
  )
$$;

GRANT EXECUTE ON FUNCTION private.is_supervisor(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "supervisors read scoped profiles" ON public.profiles;
CREATE POLICY "supervisors read all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (private.is_supervisor(auth.uid()));

DROP POLICY IF EXISTS "supervisor reads scoped plans" ON public.lesson_plans;
CREATE POLICY "supervisors read all plans"
  ON public.lesson_plans FOR SELECT TO authenticated
  USING (private.is_supervisor(auth.uid()));

CREATE POLICY "supervisors read all roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (private.is_supervisor(auth.uid()));

CREATE OR REPLACE FUNCTION private.can_review(_reviewer uuid, _teacher uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT private.has_role(_reviewer, 'admin'::app_role)
      OR private.is_school_admin_of(_reviewer, _teacher)
      OR private.is_supervisor(_reviewer)
$$;