GRANT EXECUTE ON FUNCTION private.supervises(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_review(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.school_of(uuid) TO authenticated, service_role;