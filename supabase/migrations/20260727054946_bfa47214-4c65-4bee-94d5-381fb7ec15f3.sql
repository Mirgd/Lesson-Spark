CREATE OR REPLACE FUNCTION private.school_of(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT school_id FROM public.profiles WHERE id = _user_id
$$;

CREATE OR REPLACE FUNCTION private.is_school_admin_of(_admin uuid, _target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles a ON a.id = ur.user_id
    JOIN public.profiles t ON t.id = _target
    WHERE ur.user_id = _admin
      AND ur.role = 'school_admin'
      AND a.school_id IS NOT NULL
      AND a.school_id = t.school_id
  )
$$;

REVOKE ALL ON FUNCTION private.school_of(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_school_admin_of(uuid, uuid) FROM PUBLIC;

-- schools policies
CREATE POLICY "authenticated read schools" ON public.schools
FOR SELECT TO authenticated USING (true);

CREATE POLICY "super admin manages schools" ON public.schools
FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- profiles: school admin scope
CREATE POLICY "school admin manages own school profiles" ON public.profiles
FOR ALL TO authenticated
USING (private.is_school_admin_of(auth.uid(), id))
WITH CHECK (private.is_school_admin_of(auth.uid(), id));

-- lesson plans: school admin reads plans of own school
CREATE POLICY "school admin reads own school plans" ON public.lesson_plans
FOR SELECT TO authenticated
USING (private.is_school_admin_of(auth.uid(), user_id));

-- supervisor scope visibility for school admins
CREATE POLICY "school admin reads school scope" ON public.supervisor_scope
FOR SELECT TO authenticated
USING (private.is_school_admin_of(auth.uid(), supervisor_id));

-- roles readable by school admin within school
CREATE POLICY "school admin reads school roles" ON public.user_roles
FOR SELECT TO authenticated
USING (private.is_school_admin_of(auth.uid(), user_id));
